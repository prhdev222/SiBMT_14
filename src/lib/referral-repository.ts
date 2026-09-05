/**
 * แหล่งข้อมูล referral สำหรับ dashboard
 *
 * ถ้ายังไม่ได้ตั้งค่า Google Sheet จะใช้ข้อมูลตัวอย่างแทน
 * ทำให้เปิดสาธิตและพัฒนาต่อได้โดยไม่ต้องมี credential
 *
 * ⚠️ server-only — เรียกจาก server component เท่านั้น
 */

import {
  readCredentials,
  readSheetRows,
  scheduleSpreadsheetId,
} from "./google-sheets";
import { MOCK_FELLOW_SCHEDULE, MOCK_REFERRALS } from "./mock-referrals";
import {
  TRANSPLANT_INDICATIONS,
  type TransplantIndication,
} from "./transplant-indications";
import {
  DEFAULT_SLOTS_PER_FELLOW,
  type FellowClinicDay,
} from "./fellow-schedule";
import {
  DISEASE_GROUPS,
  REFERRAL_TYPES,
  STATUSES,
  type DiseaseGroup,
  type Referral,
  type ReferralType,
  type Status,
  type Urgency,
} from "./referral-types";

/**
 * ชื่อชีต — ต้องตรงกับ SHEETS ใน apps-script/Config.gs
 *
 * fellow_schedule กับ fellows อยู่คนละไฟล์กับ referrals เมื่อตั้งค่า
 * GOOGLE_SCHEDULE_SHEET_ID แล้ว — ดูเหตุผลใน google-sheets.ts
 */
const REFERRALS_SHEET = "referrals";
const FELLOW_SCHEDULE_SHEET = "fellow_schedule";
const FELLOWS_SHEET = "fellows";
const CONFIG_SHEET = "config";
const INDICATIONS_SHEET = "transplant_indications";
const REGIMENS_SHEET = "chemo_regimens";
const ATTENDINGS_SHEET = "attendings";
const LINE_LINKS_SHEET = "line_links";

export interface ReferralSource {
  referrals: Referral[];
  /** true = ข้อมูลตัวอย่าง ยังไม่ได้ต่อ Google Sheet */
  isSampleData: boolean;
  /** ข้อความอธิบายเมื่ออ่านชีตไม่สำเร็จ */
  error: string | null;
}

export async function loadReferrals(): Promise<ReferralSource> {
  if (!readCredentials()) {
    return { referrals: MOCK_REFERRALS, isSampleData: true, error: null };
  }

  try {
    const rows = await readSheetRows(REFERRALS_SHEET);
    const referrals = rows
      .map(toReferral)
      .filter((r): r is Referral => r !== null);

    return { referrals, isSampleData: false, error: null };
  } catch (error) {
    // อ่านชีตไม่ได้แล้วหน้าจอว่างเปล่าจะทำให้เข้าใจผิดว่าไม่มีเคสค้าง
    // จึงต้องแจ้งให้เห็นชัดว่าข้อมูลที่แสดงเป็นข้อมูลตัวอย่าง
    return {
      referrals: MOCK_REFERRALS,
      isSampleData: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * อ่านตารางออกตรวจ fellow จากชีต `fellow_schedule`
 *
 * แพทย์แอดมินกรอกตารางนี้เอง ไม่ต้องแก้โค้ด (SRS NFR-005)
 * คืน array ว่างถ้ายังไม่ได้ตั้งค่าหรืออ่านไม่ได้ — หน้าปฏิทินจะบอกเองว่ายังไม่มีตาราง
 */
export interface FellowScheduleSource {
  days: FellowClinicDay[];
  /** จำนวนแถวที่อ่านได้จากชีต ก่อนคัดแถวที่ใช้ไม่ได้ออก */
  rawRowCount: number;
  /** แถวที่มีข้อมูลแต่ใช้ไม่ได้ เช่น วันที่ผิดรูปแบบ — แยกจาก "ยังไม่ได้กรอก" */
  skippedRows: number;
  isSampleData: boolean;
  error: string | null;
}

export async function loadFellowSchedule(): Promise<FellowScheduleSource> {
  // โหมดสาธิต — ยังไม่ได้ต่อ Sheet จึงใช้ตารางตัวอย่างให้เห็นหน้าตาปฏิทิน
  if (!readCredentials()) {
    return {
      days: MOCK_FELLOW_SCHEDULE,
      rawRowCount: MOCK_FELLOW_SCHEDULE.length,
      skippedRows: 0,
      isSampleData: true,
      error: null,
    };
  }

  try {
    const rows = await readSheetRows(
      FELLOW_SCHEDULE_SHEET,
      scheduleSpreadsheetId() ?? undefined,
    );
    let skipped = 0;

    const days = rows
      .map((row, index) => {
        const clinicDate = toIsoDate(row["clinic_date"]);
        const fellowName = text(row["fellow_name"]);

        // แถวว่างทั้งแถวไม่นับว่าผิด — แต่แถวที่กรอกมาแล้วใช้ไม่ได้ต้องบอกให้รู้
        if (!clinicDate || !fellowName) {
          const hasAnything =
            text(row["clinic_date"]) || fellowName || text(row["max_slots"]);
          if (hasAnything) skipped++;
          return null;
        }

        const slots = Number(text(row["max_slots"]));
        return {
          clinicDate,
          fellowName,
          maxSlots:
            Number.isFinite(slots) && slots > 0
              ? slots
              : DEFAULT_SLOTS_PER_FELLOW,
          note: text(row["note"]),
          startTime: toTimeHHmm(row["start_time"]),
          endTime: toTimeHHmm(row["end_time"]),
          // แถวแรกของชีตเป็นหัวตาราง ข้อมูลแถวแรกจึงเป็นแถวที่ 2
          rowNumber: index + 2,
        };
      })
      .filter((d): d is FellowClinicDay => d !== null);

    return {
      days,
      rawRowCount: rows.length,
      skippedRows: skipped,
      isSampleData: false,
      error: null,
    };
  } catch (error) {
    return {
      days: [],
      rawRowCount: 0,
      skippedRows: 0,
      isSampleData: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * รายชื่อ fellow ที่ยังออกตรวจอยู่ จากชีต `fellows`
 *
 * ต้องตรงกับ listFellows() ใน apps-script/Menu.gs — ชื่อที่ปิดไปแล้ว
 * (active = no) ไม่ควรโผล่ใน dropdown แต่ตารางเก่ายังอ้างถึงชื่อนั้นได้
 */
export async function loadFellows(): Promise<string[]> {
  if (!readCredentials()) {
    return [...new Set(MOCK_FELLOW_SCHEDULE.map((d) => d.fellowName))].sort();
  }

  try {
    const rows = await readSheetRows(
      FELLOWS_SHEET,
      scheduleSpreadsheetId() ?? undefined,
    );
    return rows
      .filter((row) => {
        if (!text(row["fellow_name"])) return false;
        const active = text(row["active"]).toLowerCase();
        // เว้นว่างถือว่ายังใช้งาน — ต้องพิมพ์ no ถึงจะปิด
        return active !== "no" && active !== "ไม่" && active !== "false";
      })
      .map((row) => text(row["fellow_name"]));
  } catch {
    // ไม่มีชีต fellows ไม่ใช่เรื่องคอขาดบาดตาย — ปฏิทินยังแสดงได้
    return [];
  }
}

/**
 * อ่านชื่อผู้รับผิดชอบและค่าตั้งอื่นจากชีต `config`
 *
 * ชื่อคนเปลี่ยนบ่อย (แพทย์แอดมิน ผู้สำรอง fellow) จึงต้องแก้ในชีตได้
 * ไม่ใช่ฝังใน config.ts ที่ต้องให้โปรแกรมเมอร์แก้แล้ว deploy ใหม่
 */
/**
 * เกณฑ์การส่งต่อเพื่อปลูกถ่าย — อ่านจากชีตเพื่อให้แก้ได้โดยไม่ต้อง deploy
 *
 * ⚠️ ถ้าอ่านชีตไม่ได้หรือชีตว่าง จะใช้ค่าที่ฝังในโค้ดแทน ไม่ใช่คืนรายการว่าง
 *
 * ถ้าคืนว่าง dropdown ในหน้าจองคิวจะไม่มีตัวเลือกเลย แล้วไม่มีใครจองได้
 * — ปัญหาเล็กที่ชีต (พิมพ์ชื่อแท็บผิด, ลบแถวเผลอ) จะกลายเป็นระบบหยุดทำงาน
 * ค่าที่ฝังในโค้ดคือฉบับเดียวกับ docs/I:CBMT.pdf จึงใช้แทนกันได้ปลอดภัย
 */
export async function loadTransplantIndications(): Promise<
  TransplantIndication[]
> {
  if (!readCredentials()) return TRANSPLANT_INDICATIONS;

  try {
    const rows = await readSheetRows(INDICATIONS_SHEET);
    const parsed = rows
      .filter((row) => text(row["id"]) && isActive(row))
      .map((row) => ({
        id: text(row["id"]),
        type: text(row["type"]) === "AUTOLOGOUS" ? "AUTOLOGOUS" : "ALLOGENEIC",
        diseaseTh: text(row["disease"]),
        statusTh: text(row["disease_status"]),
        ageTh: text(row["age"]),
      })) as TransplantIndication[];

    return parsed.length > 0 ? parsed : TRANSPLANT_INDICATIONS;
  } catch {
    return TRANSPLANT_INDICATIONS;
  }
}

/**
 * เปิดคำตอบด้วย token จากลิงก์ในอีเมลหรือ LINE
 *
 * ⚠️ token คือสิ่งเดียวที่กั้นอยู่ — ใช้กลไกเดียวกับลิงก์จัดการนัดของกลุ่ม 1
 * (32 ตัวอักษร เดาไม่ได้ในทางปฏิบัติ) หน้าที่แสดงผลจึงต้อง noindex
 * และห้ามมีข้อมูลที่ระบุตัวผู้ป่วย ซึ่งระบบนี้ไม่เคยเก็บอยู่แล้ว
 *
 * เทียบ token แบบตรงตัว ไม่ใช่ค้นบางส่วน — token สั้นกว่าที่ควรจะเป็น
 * แม้แต่ตัวเดียวไม่ควรเปิดเคสของคนอื่นได้
 */
export async function loadReferralByAnswerToken(
  token: string,
): Promise<Referral | null> {
  if (token.length < 16) return null;

  // โหมดสาธิต: จับคู่กับ token ปลอมของ mock — ให้ลิงก์อ่านคำตอบจากแชท
  // เปิดได้จริงใน demo (เดิมเด้ง 404 ทุกครั้ง ทดสอบ flow ไม่จบ)
  if (!readCredentials()) {
    return (
      MOCK_REFERRALS.find(
        (r) => r.adviceRecord && demoAnswerToken(r.referralId) === token,
      ) ?? null
    );
  }

  try {
    const rows = await readSheetRows(REFERRALS_SHEET);
    const row = rows.find((r) => text(r["answer_token"]) === token);
    return row ? toReferral(row) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* บทสนทนาต่อเนื่องต่อเคส (Case Conversation)                          */
/* ------------------------------------------------------------------ */

const MESSAGES_SHEET = "messages";

export interface CaseMessage {
  id: string;
  senderRole: "referrer" | "resident" | "system";
  senderName: string;
  channel: string;
  text: string;
  createdAt: string;
}

export interface CaseThread {
  referralId: string;
  caseToken: string;
  referralType: ReferralType;
  status: Status;
  referrerOrg: string;
  submittedAt: string;
  messages: CaseMessage[];
}

/** โหลดข้อความของเคสหนึ่ง เรียงตามเวลา — ใช้ทั้งหน้า /case และ dashboard */
export async function loadMessages(referralId: string): Promise<CaseMessage[]> {
  if (!readCredentials()) return demoMessages(referralId);

  try {
    const rows = await readSheetRows(MESSAGES_SHEET);
    return rows
      .filter((r) => text(r["referral_id"]) === referralId && text(r["text"]))
      .map((r) => ({
        id: text(r["message_id"]),
        senderRole: (text(r["sender_role"]) || "system") as
          | "referrer"
          | "resident"
          | "system",
        senderName: text(r["sender_name"]),
        channel: text(r["channel"]),
        text: text(r["text"]),
        createdAt: text(r["created_at"]),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

/** โหลดเคส + ข้อความจาก case_token — สำหรับหน้า /case/[token] (ไม่ต้องล็อกอิน) */
export async function loadCaseByToken(
  token: string,
): Promise<CaseThread | null> {
  if (token.length < 16) return null;

  if (!readCredentials()) {
    const demo = MOCK_REFERRALS.find(
      (r) => demoCaseToken(r.referralId) === token,
    );
    if (!demo) return null;
    return {
      referralId: demo.referralId,
      caseToken: token,
      referralType: demo.referralType,
      status: demo.status,
      referrerOrg: demo.referrerOrg,
      submittedAt: demo.submittedAt,
      messages: demoMessages(demo.referralId),
    };
  }

  try {
    const rows = await readSheetRows(REFERRALS_SHEET);
    const row = rows.find((r) => text(r["case_token"]) === token);
    if (!row) return null;
    const referralId = text(row["referral_id"]);
    return {
      referralId,
      caseToken: token,
      referralType: text(row["referral_type"]) as ReferralType,
      status: (text(row["status"]) || "Submitted") as Status,
      referrerOrg: text(row["referrer_org"]),
      submittedAt: text(row["submitted_at"] || row["Timestamp"]),
      messages: await loadMessages(referralId),
    };
  } catch {
    return null;
  }
}

/** token ปลอมของเคสสำหรับโหมดสาธิต — เปิดหน้า /case ทดสอบได้ */
export function demoCaseToken(referralId: string): string {
  return `case-${referralId}`.padEnd(32, "0");
}

/** ข้อความตัวอย่างโหมดสาธิต — ให้เห็นหน้าตา thread เวลาไม่มี Google Sheet */
function demoMessages(referralId: string): CaseMessage[] {
  return [
    {
      id: "demo-1",
      senderRole: "referrer",
      senderName: "รพ.ตัวอย่าง (เดโม่)",
      channel: "web",
      text: `สวัสดีครับ ขอสอบถามความคืบหน้าเคส ${referralId} ครับ`,
      createdAt: "2026-09-05 09:10",
    },
    {
      id: "demo-2",
      senderRole: "resident",
      senderName: "พญ. ณัฐชยา (เดโม่)",
      channel: "line",
      text: "รับเรื่องแล้วค่ะ กำลังปรึกษาอาจารย์ เดี๋ยวแจ้งกลับภายในวันนี้นะคะ",
      createdAt: "2026-09-05 09:32",
    },
  ];
}

/**
 * แถวดิบสำหรับ Hemato Bot — ใช้ฝั่ง server เท่านั้น อย่าส่งทั้งแถวให้ client
 *
 * โหมดสาธิต (dev:demo) ไม่มี credential ให้อ่านชีตจริง จึงแปลง MOCK_REFERRALS
 * เป็นรูปแถวดิบแทน เพื่อให้ทดสอบแชทได้ครบทุกเส้นทางแม้ไม่ได้ต่อ Google Sheet
 */
export async function loadRawReferralRows(): Promise<Record<string, string>[]> {
  if (!readCredentials()) return MOCK_REFERRALS.map(toDemoRawRow);

  try {
    return await readSheetRows(REFERRALS_SHEET);
  } catch {
    return [];
  }
}

/**
 * แปลง Referral ตัวอย่างเป็นแถวดิบของโหมดสาธิต
 *
 * MOCK_REFERRALS ไม่มีคอลัมน์อีเมล/answer_token จริง (ไม่ใช่ field ของ Referral)
 * จึงเติม token ปลอมให้เฉพาะเคสที่มี adviceRecord แล้ว (มีคำตอบให้เปิดดูได้)
 * ส่วนอีเมลปล่อยว่างเพราะข้อมูลตัวอย่างไม่มีให้อ้างอิง
 */
function toDemoRawRow(referral: Referral): Record<string, string> {
  return {
    referral_id: referral.referralId,
    referral_type: referral.referralType,
    status: referral.status,
    submitted_at: referral.submittedAt,
    referrer_phone: referral.referrerPhone,
    referrer_email: "",
    advice_record: referral.adviceRecord,
    answer_token: referral.adviceRecord
      ? demoAnswerToken(referral.referralId)
      : "",
  };
}

/** token ปลอมสำหรับโหมดสาธิตเท่านั้น ยาวพอผ่านเกณฑ์ตรวจความยาวเหมือน token จริง */
function demoAnswerToken(referralId: string): string {
  return `demo-${referralId}`.padEnd(32, "0");
}

/**
 * ผูก LINE userId กับเบอร์โทรที่ยืนยันตัวตนแล้ว จากชีต `line_links`
 *
 * ชีตเดียวกับที่ findLineLink_ ใน apps-script/LineWebhook.gs อ่าน — แต่ที่นี่
 * เทียบ active === "yes" ตรง ๆ (ไม่ถือว่าเว้นว่าง = ใช้งานอยู่เหมือนฝั่ง .gs)
 * เพราะแถวที่ยกเลิกผูกแล้ว (เช่น เปลี่ยนเบอร์) ต้องไม่ให้ bot คืนเบอร์เก่า
 */
export async function loadLineLink(
  userId: string,
): Promise<{ phone: string } | null> {
  if (!readCredentials() || !userId) return null;

  try {
    const rows = await readSheetRows(LINE_LINKS_SHEET);
    const hit = rows.find(
      (r) =>
        text(r["line_user_id"]) === userId &&
        text(r["active"]).toLowerCase() === "yes",
    );
    return hit ? { phone: text(hit["referrer_phone"]) } : null;
  } catch {
    return null;
  }
}

export interface ChemoRegimen {
  diseaseGroup: string;
  abbr: string;
  components: string;
}

/**
 * คลังสูตรยาเคมีบำบัด — ปุ่มช่วยพิมพ์ในหน้าตอบคำปรึกษา
 *
 * คืนรายการว่างได้โดยไม่เป็นไร ต่างจาก loadTransplantIndications()
 * ที่ต้องมีค่าสำรองในโค้ด เพราะ dropdown ว่างที่นั่นแปลว่าไม่มีใครจองคิวได้
 * ส่วนที่นี่ถ้าไม่มีตัวเลือก resident ยังพิมพ์สูตรยาเองได้ตามปกติ
 * — จึงไม่เก็บสำเนา 204 แถวไว้ในโค้ดให้ไม่ตรงกับชีต
 */
export async function loadRegimens(): Promise<ChemoRegimen[]> {
  if (!readCredentials()) return [];

  try {
    const rows = await readSheetRows(REGIMENS_SHEET);
    return rows
      .filter((row) => text(row["abbr"]) && isActive(row))
      .map((row) => ({
        diseaseGroup: text(row["disease_group"]) || "อื่น ๆ",
        abbr: text(row["abbr"]),
        components: text(row["components"]),
      }));
  } catch {
    return [];
  }
}

/**
 * รายชื่ออาจารย์ผู้ให้คำปรึกษา — resident เลือกตอนตอบคำปรึกษา
 *
 * คืนรายการว่างได้ ฟอร์มตอบจะสลับไปให้พิมพ์ชื่อเองแทน
 * แท็บที่ยังไม่ได้กรอกไม่ควรทำให้ทั้งระบบตอบคำปรึกษาไม่ได้
 */
export async function loadAttendings(): Promise<string[]> {
  if (!readCredentials()) return [];

  try {
    const rows = await readSheetRows(ATTENDINGS_SHEET);
    return rows
      .filter((row) => text(row["name"]) && isActive(row))
      .map((row) => text(row["name"]));
  } catch {
    return [];
  }
}

export interface AttendingRow {
  name: string;
  active: boolean;
}

/**
 * รายชื่ออาจารย์ทั้งหมด (รวมที่ปิดใช้งาน) พร้อมสถานะ — สำหรับหน้าตั้งค่าเท่านั้น
 * ต่างจาก loadAttendings() ที่กรองเฉพาะ active ไว้ให้ dropdown ตอนตอบคำปรึกษา
 */
export async function loadAttendingRows(): Promise<AttendingRow[]> {
  if (!readCredentials()) {
    return [
      { name: "อ. สมชาย (เดโม่)", active: true },
      { name: "อ. สุนีย์ (เดโม่)", active: true },
      { name: "อ. วิชัย (เดโม่ — ปิดใช้งาน)", active: false },
    ];
  }

  try {
    const rows = await readSheetRows(ATTENDINGS_SHEET);
    return rows
      .filter((row) => text(row["name"]))
      .map((row) => ({ name: text(row["name"]), active: isActive(row) }));
  } catch {
    return [];
  }
}

const RESIDENTS_SHEET = "residents";
const RESIDENT_SCHEDULE_SHEET = "resident_schedule";
const DOCUMENTS_SHEET = "documents";

export interface ResidentShift {
  /** ISO yyyy-mm-dd — วันแรกและวันสุดท้ายของช่วงเวร (รวมทั้งสองวัน) */
  fromDate: string;
  toDate: string;
  name: string;
}

/**
 * ตารางเวร Chief resident (sync จาก HSOS ทุกเช้า — ดู apps-script/SyncHsos.gs)
 * เรียงตามวันเริ่มเวร ช่วงเหลื่อมกันได้ = อยู่เวรพร้อมกันหลายคน
 */
export async function loadResidentSchedule(): Promise<ResidentShift[]> {
  if (!readCredentials()) {
    return [
      { fromDate: "2026-08-23", toDate: "2026-09-19", name: "ณัฐชยา (เดโม่)" },
      { fromDate: "2026-08-23", toDate: "2026-09-19", name: "ภัคชนก (เดโม่)" },
      { fromDate: "2026-09-20", toDate: "2026-10-17", name: "ณัฐชา (เดโม่)" },
      { fromDate: "2026-09-20", toDate: "2026-10-17", name: "ศิวัชา (เดโม่)" },
    ];
  }

  try {
    const rows = await readSheetRows(RESIDENT_SCHEDULE_SHEET);
    return rows
      .map((row) => ({
        fromDate: toIsoDate(row["from_date"]) ?? "",
        toDate: toIsoDate(row["to_date"]) ?? "",
        name: text(row["resident_name"]),
      }))
      .filter((s) => s.fromDate && s.toDate && s.name)
      .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  } catch {
    return [];
  }
}

export interface SystemDocument {
  title: string;
  /** tag กลุ่ม เช่น "1" / "2,3" / "ทั้งหมด" — ตีความที่ documentsForGroup */
  groups: string;
  url: string;
  description: string;
}

/**
 * คลังเอกสารสำคัญสำหรับแพทย์ต้นทาง (ใบสิทธิ, standing order, ประกาศสิทธิยา ฯลฯ)
 *
 * แอดมินอัปโหลดไฟล์เข้า Drive แล้วเพิ่มแถวในชีต documents — โผล่บนเว็บทันที
 * เรียงตามลำดับแถวในชีต / active = no ซ่อนโดยไม่ต้องลบแถว
 */
export async function loadDocuments(): Promise<SystemDocument[]> {
  if (!readCredentials()) {
    return [
      {
        title: "ใบส่งตรวจ HLA typing (ตัวอย่างโหมดสาธิต)",
        groups: "1",
        url: "https://drive.google.com/file/d/demo/view",
        description: "ให้ผู้ป่วยและพี่น้องไปเจาะเลือดที่โรงพยาบาลต้นทาง",
      },
      {
        title: "Standing order เคมีบำบัด (ตัวอย่างโหมดสาธิต)",
        groups: "2,3",
        url: "https://drive.google.com/file/d/demo/view",
        description: "ฉบับปรับปรุงล่าสุด",
      },
      {
        title: "ประกาศสิทธิยามุ่งเป้า (ตัวอย่างโหมดสาธิต)",
        groups: "ทั้งหมด",
        url: "https://drive.google.com/file/d/demo/view",
        description: "",
      },
    ];
  }

  try {
    const rows = await readSheetRows(DOCUMENTS_SHEET);
    return rows
      .filter((row) => text(row["title"]) && text(row["url"]) && isActive(row))
      .map((row) => ({
        title: text(row["title"]),
        groups: text(row["groups"]),
        url: text(row["url"]),
        description: text(row["description"]),
      }));
  } catch {
    return [];
  }
}

export interface DocumentRow extends SystemDocument {
  active: boolean;
}

/**
 * เอกสารทั้งหมด (รวมที่ซ่อนไว้) พร้อมสถานะ — สำหรับหน้าตั้งค่าเท่านั้น
 * ต่างจาก loadDocuments() ที่กรองเฉพาะ active ไว้ให้แพทย์ต้นทาง
 */
export async function loadDocumentRows(): Promise<DocumentRow[]> {
  if (!readCredentials()) {
    return (await loadDocuments()).map((d) => ({ ...d, active: true }));
  }

  try {
    const rows = await readSheetRows(DOCUMENTS_SHEET);
    return rows
      .filter((row) => text(row["title"]) && text(row["url"]))
      .map((row) => ({
        title: text(row["title"]),
        groups: text(row["groups"]),
        url: text(row["url"]),
        description: text(row["description"]),
        active: isActive(row),
      }));
  } catch {
    return [];
  }
}

/** เอกสารที่ควรแสดงบนหน้าของกลุ่มนั้น — tag ตรงเลขกลุ่ม หรือ "ทั้งหมด"/ว่าง */
export function documentsForGroup(
  docs: SystemDocument[],
  groupNumber: number,
): SystemDocument[] {
  return docs.filter((d) => {
    const tag = d.groups.trim().toLowerCase();
    if (!tag || tag === "ทั้งหมด" || tag === "all") return true;
    return tag
      .split(/[,\s]+/)
      .map((part) => part.trim())
      .includes(String(groupNumber));
  });
}

/**
 * รายชื่อ resident ที่ตอบกลุ่ม 2/3 — ตัวเลือก dropdown ผู้รับผิดชอบบน dashboard
 *
 * โหมดสาธิตคืนชื่อชุดเดียวกับที่ mock referrals ใช้ เพื่อให้ dropdown ทดลองได้
 */
export async function loadResidents(): Promise<string[]> {
  if (!readCredentials()) {
    return ["นพ. พีรพัฒน์", "นพ. ธนกฤต", "พญ. ณัฐกานต์", "พญ. ศิรินทิพย์"];
  }

  try {
    const rows = await readSheetRows(RESIDENTS_SHEET);
    return rows
      .filter((row) => text(row["name"]) && isActive(row))
      .map((row) => text(row["name"]));
  } catch {
    return [];
  }
}

/** ว่างไว้ = ใช้งานอยู่ — ต้องพิมพ์ no ชัดเจนถึงจะถือว่าเลิกใช้ */
function isActive(row: Record<string, string>): boolean {
  const value = text(row["active"]).toLowerCase();
  return value !== "no" && value !== "false" && value !== "ไม่";
}

export async function loadConfigValues(): Promise<Record<string, string>> {
  if (!readCredentials()) return {};

  try {
    const rows = await readSheetRows(CONFIG_SHEET);
    const out: Record<string, string> = {};
    for (const row of rows) {
      const key = text(row["key"]);
      if (key) out[key] = text(row["value"]);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * แปลงหนึ่งแถวในชีตเป็น Referral
 * คืน null ถ้าแถวนั้นข้อมูลไม่พอใช้ เพื่อไม่ให้ทั้งหน้าพัง
 */
function toReferral(row: Record<string, string>): Referral | null {
  const referralId = text(row["referral_id"]);
  const referralType = parseReferralType(row["referral_type"]);
  const status = parseStatus(row["status"]);

  if (!referralId || !referralType || !status) return null;

  return {
    referralId,
    referralType,
    diseaseGroup: parseDiseaseGroup(row["disease_group"]),
    submittedAt: formatSubmittedAt(row["submitted_at"] || row["Timestamp"]),
    referrerOrg: text(row["referrer_org"]) || "—",
    referrerName: text(row["referrer_name"]),
    referrerPhone: displayPhone(text(row["referrer_phone"])) || "—",
    insuranceScheme: text(row["insurance_scheme"]),
    appointmentNote: text(row["appointment_note"]),
    adviceRegimens: text(row["advice_regimens"]),
    questionType: text(row["advice_question_type"]),
    answeredBy: text(row["advice_by"]),
    adviceAttending: text(row["advice_attending"]),
    urgency: parseUrgency(row["urgency"]),
    status,
    assignedTo: text(row["assigned_to"]) || null,
    elapsedBusinessHours: number(row["elapsed_business_hours"]),
    followUpDate: text(row["follow_up_date"]) || null,
    possibleDuplicateOf: text(row["possible_duplicate_of"]) || null,
    appointmentDate: toIsoDate(row["appointment_date"]),
    fellowAssigned: text(row["fellow_assigned"]) || null,
    note: pickNote(row),
    diagnosis: text(row["diagnosis"]),
    stage: text(row["stage"]),
    treatmentSummary: text(row["treatment_summary"]),
    comorbidity: text(row["comorbidity"]),
    clinicalQuestion: text(row["clinical_question"]),
    adviceRecord: text(row["advice_record"]),
    transplantIndication: text(row["transplant_indication"]),
    // อีเมลสองช่องในฟอร์มไม่ตรงกัน หรือยังไม่มีใครกดยืนยันลิงก์เกิน 1 วันทำการ (8 ชม.)
    // — เกินกว่านั้นแปลว่าไม่ใช่แค่ยังไม่ว่างเปิดอ่าน แต่อีเมลอาจใช้ไม่ได้จริง
    //
    // ⚠️ เงื่อนไข "ยังไม่ยืนยัน" ต้องเช็กก่อนว่ามีการออกลิงก์ยืนยันจริง
    // (`email_verify_token` ไม่ว่าง) เคสที่ส่งเข้ามาก่อนฟีเจอร์นี้มีทั้งคู่ —
    // ไม่มี email_verify_token เลย เพราะ onFormSubmit ตอนนั้นยังไม่สร้างให้ —
    // ถ้าเช็กแค่ "email_verified_at ว่าง + เกิน 8 ชม." เฉย ๆ เคสเก่าทุกแถวที่
    // ยังไม่จบ (กลุ่ม 2/3) จะโดนขึ้นธงเตือนหมดตั้งแต่วันเปิดใช้ฟีเจอร์นี้ ทั้งที่
    // ไม่เคยมีลิงก์ให้กดยืนยันเลยตั้งแต่ต้น — เจ้าหน้าที่จะเห็นธงเต็มหน้าจอจน
    // เลิกสนใจ (alert fatigue) แล้วพลาดเคสที่ธงขึ้นจริง ๆ ไป ตัว boolean
    // นี้ไม่เก็บค่า token ไว้ใน Referral — ใช้แค่ตัดสิน "เคยออกลิงก์หรือยัง"
    emailUnverified: (() => {
      const tokenIssued = Boolean(text(row["email_verify_token"]));
      const mismatch = text(row["email_mismatch"]).toLowerCase() === "yes";
      const staleUnverified =
        tokenIssued &&
        !text(row["email_verified_at"]) &&
        number(row["elapsed_business_hours"]) >= 8;
      return mismatch || staleUnverified;
    })(),
  };
}

/** รับได้ทั้งค่าที่ Google ส่งมาเป็น 8/5/2026 และที่พิมพ์เป็น 2026-08-05 */
/**
 * เติมเลข 0 นำหน้ากลับให้เบอร์ที่ชีตตัดทิ้ง
 *
 * เคสกลุ่มที่ 1 ที่จองก่อน 1 ก.ย. 2569 ถูกชีตเก็บเบอร์เป็นตัวเลข เลข 0 นำหน้า
 * จึงหายถาวร ("0812345678" → "812345678") — เบอร์ไทย 8–9 หลักที่ไม่ขึ้นต้น
 * ด้วย 0 ไม่มีอยู่จริง เติมกลับให้ตอนแสดงผลจึงปลอดภัย ส่วนแถวใหม่ถูกเขียน
 * เป็นข้อความตั้งแต่ตอนจองแล้วจะไม่เข้าเงื่อนไขนี้เลย
 */
function displayPhone(value: string): string {
  return /^[1-9]\d{7,8}$/.test(value) ? `0${value}` : value;
}

function toIsoDate(value: string | undefined): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * ทำให้เวลาออกมาเป็น "HH:mm" เสมอ
 *
 * ฝั่งที่เขียนตั้งคอลัมน์เป็นข้อความไว้แล้ว แต่แถวที่คนพิมพ์เองในชีตยังหลุด
 * มาเป็น "9:00:00 AM" หรือ "9:00" ได้ เพราะ Sheets ตีความเป็นเวลาให้เอง
 */
function toTimeHHmm(value: string | undefined): string {
  const raw = text(value);
  if (!raw) return "";

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return "";

  let hour = Number(match[1]);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  if (hour > 23) return "";

  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function text(value: string | undefined): string {
  return (value ?? "").trim();
}

function number(value: string | undefined): number {
  const n = Number(text(value));
  return Number.isFinite(n) ? n : 0;
}

/** รวมหมายเหตุจากหลายคอลัมน์ตามลำดับความสำคัญ */
function pickNote(row: Record<string, string>): string {
  return (
    text(row["note"]) ||
    text(row["incomplete_reason"]) ||
    text(row["appointment_note"]) ||
    text(row["advice_record"]) ||
    ""
  );
}

function parseReferralType(value: string | undefined): ReferralType | null {
  const raw = text(value);
  return (REFERRAL_TYPES as string[]).includes(raw)
    ? (raw as ReferralType)
    : null;
}

function parseStatus(value: string | undefined): Status | null {
  const raw = text(value);
  return (STATUSES as string[]).includes(raw) ? (raw as Status) : null;
}

function parseDiseaseGroup(value: string | undefined): DiseaseGroup | null {
  const raw = text(value);
  if ((DISEASE_GROUPS as string[]).includes(raw)) return raw as DiseaseGroup;

  // ตัวเลือกในฟอร์มอาจมีคำขยายต่อท้าย เช่น "MPN (PV, ET, Myelofibrosis)"
  // และช่อง "Other" ของ Google Form จะเก็บข้อความอิสระที่ผู้ใช้พิมพ์เอง
  if (/aplastic|BMF|ไขกระดูกฝ่อ/i.test(raw)) return "Aplastic Anemia / BMF";
  if (/\bCML\b/i.test(raw)) return "CML";
  if (/\bMDS\b|myelodysplas/i.test(raw)) return "MDS";
  if (/\bMPN\b|myelofibrosis|polycythemia|thrombocythemia/i.test(raw))
    return "MPN";
  if (/leukemia|AML|ALL|APL/i.test(raw)) return "Acute Leukemia";
  if (/lymphoma/i.test(raw)) return "Lymphoma";
  if (/myeloma|plasma cell/i.test(raw)) return "Multiple Myeloma";

  if (raw) return "Other Hematology";
  return null;
}

/** ฟอร์มบันทึกเป็นภาษาไทย แต่ระบบภายในใช้ค่าอังกฤษ */
function parseUrgency(value: string | undefined): Urgency {
  const raw = text(value);
  if (raw === "Urgent" || raw === "เร่งด่วน") return "Urgent";
  return "Routine";
}

/** ตัดวินาทีและเขตเวลาออก ให้อ่านง่ายในตาราง */
function formatSubmittedAt(value: string | undefined): string {
  const raw = text(value);
  if (!raw) return "—";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
