import { phoneKey } from "./phone-key";
import { STATUS_LABEL_TH, type Status } from "./referral-types";

/**
 * เลขกลุ่มตามค่าที่ชีตเก็บ — คู่กับ REFERRAL_TYPE_META ใน referral-types.ts
 * และ GROUP_NUMBER ใน apps-script/Config.gs
 */
const GROUP_NUMBER: Record<string, 1 | 2 | 3 | 4> = {
  TRANSPLANT_APPOINTMENT: 1,
  REGIMEN_CONSULT: 2,
  CHEMO_ADMISSION: 3,
  GENERAL_OPD: 4,
};

export interface BotCaseStatus {
  referralId: string;
  groupNumber: 1 | 2 | 3 | 4 | null;
  statusLabelTh: string;
  submittedTh: string;
}

const t = (v: string | undefined) => String(v ?? "").trim();

/** ⚠️ เพดานการเปิดเผยต่อคนที่ยังไม่ยืนยันตัวตน — ห้ามเพิ่ม field โดยไม่แก้ spec */
export function shapeStatus(row: Record<string, string>): BotCaseStatus {
  const status = t(row["status"]);
  return {
    referralId: t(row["referral_id"]),
    groupNumber: GROUP_NUMBER[t(row["referral_type"])] ?? null,
    statusLabelTh: STATUS_LABEL_TH[status as Status] ?? status,
    submittedTh: t(row["submitted_at"]),
  };
}

export function findByReferralId(
  rows: Record<string, string>[], id: string,
): Record<string, string> | null {
  const key = t(id).toUpperCase();
  return rows.find((r) => t(r["referral_id"]).toUpperCase() === key) ?? null;
}

/**
 * แปลง submitted_at เป็นเวลา (ms) เพื่อเรียง — คืน null ถ้าอ่านไม่ออก
 * ตรรกะเดียวกับ toDate_ ใน apps-script/Util.gs
 */
function submittedAtMs(value: string | undefined): number | null {
  const raw = t(value);
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * เรียงใหม่สุดก่อน — ตรรกะเดียวกับ findEmailByPhone_ ใน apps-script/LineWebhook.gs
 * แต่ชีตเก็บ submitted_at ได้ทั้ง "8/5/2026" และ "2026-08-05" ปนกัน จึงต้องเทียบ
 * ด้วย Date แทน string ตรง ๆ — ถ้าอ่านวันที่ไม่ออกทั้งคู่ ค่อย fallback เป็น string
 * แถวที่วันที่อ่านไม่ออกจะตกไปอยู่ท้ายสุดเสมอ
 */
function compareSubmittedDesc(
  a: Record<string, string>, b: Record<string, string>,
): number {
  const x = submittedAtMs(a["submitted_at"]);
  const y = submittedAtMs(b["submitted_at"]);
  if (x !== null && y !== null) return y - x;
  if (x !== null) return -1;
  if (y !== null) return 1;
  return t(b["submitted_at"]).localeCompare(t(a["submitted_at"]));
}

export function casesForPhone(
  rows: Record<string, string>[], phone: string,
): Record<string, string>[] {
  const key = phoneKey(phone);
  if (!key) return [];
  return rows
    .filter((r) => t(r["referral_id"]) && phoneKey(r["referrer_phone"]) === key)
    .sort(compareSubmittedDesc)
    .slice(0, 10);
}

export function latestEmailForPhone(
  rows: Record<string, string>[], phone: string,
): string {
  return (
    casesForPhone(rows, phone)
      .map((r) => t(r["referrer_email"]))
      .find((email) => email.length > 0) ?? ""
  );
}
