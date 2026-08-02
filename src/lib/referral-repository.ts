/**
 * แหล่งข้อมูล referral สำหรับ dashboard
 *
 * ถ้ายังไม่ได้ตั้งค่า Google Sheet จะใช้ข้อมูลตัวอย่างแทน
 * ทำให้เปิดสาธิตและพัฒนาต่อได้โดยไม่ต้องมี credential
 *
 * ⚠️ server-only — เรียกจาก server component เท่านั้น
 */

import { readSheetRows, readCredentials } from "./google-sheets";
import { MOCK_REFERRALS } from "./mock-referrals";
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

/** ชื่อชีตที่เก็บชุดข้อมูลที่ 1 — ต้องตรงกับ SHEETS.referrals ใน apps-script/Config.gs */
const REFERRALS_SHEET = "referrals";

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
    referrerPhone: text(row["referrer_phone"]) || "—",
    urgency: parseUrgency(row["urgency"]),
    status,
    assignedTo: text(row["assigned_to"]) || null,
    elapsedBusinessHours: number(row["elapsed_business_hours"]),
    followUpDate: text(row["follow_up_date"]) || null,
    possibleDuplicateOf: text(row["possible_duplicate_of"]) || null,
    note: pickNote(row),
  };
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
