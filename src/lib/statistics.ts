/**
 * สรุปสถิติจากเคสทั้งหมด
 *
 * คำนวณจากข้อมูลที่โหลดมาแล้ว ไม่อ่านชีตเพิ่ม และไม่พึ่งแท็บ stats_monthly
 * ที่ Apps Script สร้างรายเดือน — แท็บนั้นเป็นบันทึกถาวรสำหรับรายงานย้อนหลัง
 * ส่วนหน้านี้ต้องแสดงตัวเลข ณ วินาทีที่เปิดดู
 *
 * ⚠️ ตัวเลขทั้งหมดครอบคลุมเฉพาะเคสที่ยังอยู่ในชีต — เคสที่ปิดเกิน 12 เดือน
 * ถูกย้ายเข้าคลังถาวรไปแล้ว (PDPA-005) สถิติหน้านี้จึงเป็นภาพของ 12 เดือนล่าสุด
 * ไม่ใช่ตั้งแต่เปิดระบบ
 *
 * ⚠️ นับเฉพาะกลุ่มที่ 1–3 ไม่รวมกลุ่มที่ 4
 *
 * กลุ่มที่ 4 ไม่มีทางเข้าสู่ระบบนี้เลย — ไม่มี Google Form และ TYPE_FROM_FORM_LABEL
 * แปลงได้แค่กลุ่ม 2 กับ 3 (มติอาจารย์ 2 ส.ค. 2569 ให้ไปใช้ระบบนัดหมายของโรงพยาบาล)
 * ยอดจึงเป็นศูนย์ตลอดไปโดยการออกแบบ
 *
 * กรองทิ้งที่ต้นทางแทนการซ่อนเฉพาะกราฟ เพื่อให้ทุกตัวเลขในหน้านี้นับจากชุดเดียวกัน
 * — ถ้ากรองแค่บางกราฟ ผลรวมของแท่งจะไม่เท่ากับ "เคสทั้งหมด" แล้วอ่านไม่ตรงกัน
 */

import {
  REFERRAL_TYPES_ORDERED,
  REFERRAL_TYPE_META,
  isTerminal,
  type Referral,
  type ReferralType,
} from "./referral-types";

export interface CountRow {
  label: string;
  count: number;
}

export interface Statistics {
  total: number;
  open: number;
  answered: number;
  /** ค่ากลางของชั่วโมงทำการที่ใช้ตอบ — ใช้มัธยฐาน ไม่ใช่ค่าเฉลี่ย */
  medianBusinessHours: number | null;
  withinSla: number;
  overSla: number;
  byType: CountRow[];
  byStatus: CountRow[];
  byDiseaseGroup: CountRow[];
  byInsurance: CountRow[];
  byRegimen: CountRow[];
  byMonth: CountRow[];
}

/** เกณฑ์ SLA — ต้องตรงกับ ESCALATION_THRESHOLDS.redBusinessHours */
const SLA_BUSINESS_HOURS = 24;

function tally(values: string[]): CountRow[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = v.trim();
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * มัธยฐาน ไม่ใช่ค่าเฉลี่ย
 *
 * เคสเดียวที่ค้างสามสัปดาห์เพราะแพทย์ต้นทางไม่ตอบกลับ จะดึงค่าเฉลี่ยขึ้นจน
 * ไม่สะท้อนอะไรเลย — มัธยฐานบอกว่า "เคสทั่วไปใช้เวลาเท่าไร" ซึ่งเป็นสิ่งที่ถาม
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

export function buildStatistics(all: Referral[]): Statistics {
  const referrals = all.filter((r) => r.referralType !== "GENERAL_OPD");

  const answeredCases = referrals.filter(
    (r) => r.adviceRecord.trim().length > 0,
  );
  const closedHours = referrals
    .filter((r) => isTerminal(r.status))
    .map((r) => r.elapsedBusinessHours)
    .filter((h) => h > 0);

  const byType: CountRow[] = REFERRAL_TYPES_ORDERED.filter(
    (t) => t !== "GENERAL_OPD",
  ).map((t: ReferralType) => ({
    label: `กลุ่มที่ ${REFERRAL_TYPE_META[t].groupNumber} — ${REFERRAL_TYPE_META[t].titleTh}`,
    count: referrals.filter((r) => r.referralType === t).length,
  }));

  return {
    total: referrals.length,
    open: referrals.filter((r) => !isTerminal(r.status)).length,
    answered: answeredCases.length,
    medianBusinessHours: median(closedHours),
    withinSla: closedHours.filter((h) => h <= SLA_BUSINESS_HOURS).length,
    overSla: closedHours.filter((h) => h > SLA_BUSINESS_HOURS).length,
    byType,
    byStatus: tally(referrals.map((r) => r.status)),
    byDiseaseGroup: tally(referrals.map((r) => r.diseaseGroup ?? "")),
    byInsurance: tally(referrals.map((r) => r.insuranceScheme)),
    // สูตรยาหนึ่งเคสมีได้หลายสูตร จึงต้องแยกด้วยจุลภาคก่อนนับ
    // ⚠️ นับเฉพาะสูตรที่เลือกจากคลัง ไม่ใช่ทุกสูตรที่พิมพ์ในคำตอบ (ดู similar-cases.ts)
    byRegimen: tally(
      answeredCases.flatMap((r) =>
        r.adviceRegimens.split(",").map((s) => s.trim()),
      ),
    ),
    byMonth: monthlyCounts(referrals),
  };
}

/**
 * จำนวนเคสต่อเดือน เรียงเก่าไปใหม่
 *
 * submittedAt มาจาก formatSubmittedAt() ในรูปแบบ "yyyy-MM-dd HH:mm"
 * จึงตัดเอาหกตัวแรกได้เลย ไม่ต้อง parse เป็น Date ซึ่งจะไปตีความ timezone
 * แล้วเคสที่ส่งช่วงดึกวันสิ้นเดือนอาจถูกนับเข้าเดือนถัดไป
 *
 * แถวที่รูปแบบไม่ตรง (เช่นวันที่อ่านไม่ออก คืนค่าดิบมา) จะถูกข้าม
 * ยอดรวมรายเดือนจึงน้อยกว่ายอดทั้งหมดได้ — ตั้งใจให้เป็นแบบนั้น
 * ดีกว่าเดาเดือนให้เคสที่ไม่รู้วันที่จริง
 */
function monthlyCounts(referrals: Referral[]): CountRow[] {
  const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
              "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  const map = new Map<string, number>();
  for (const r of referrals) {
    const m = r.submittedAt.match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    const key = `${m[1]}-${m[2]}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [year, month] = key.split("-");
      // แสดงเป็น พ.ศ. ให้ตรงกับที่ใช้ทั้งระบบ
      return {
        label: `${TH[Number(month) - 1]} ${Number(year) + 543}`,
        count,
      };
    });
}
