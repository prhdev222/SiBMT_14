/**
 * ตารางออกตรวจ fellow transplant และการนับคิว (กลุ่มที่ 1)
 *
 * ตามเอกสารข้อเสนอโครงการ: แพทย์แอดมินกรอกตารางออกตรวจล่วงหน้าทั้งปีการศึกษา
 * นัดผู้ป่วยได้ไม่เกิน 2 คนต่อ fellow 1 ท่านต่อวันออกตรวจ
 * เมื่อเต็มระบบต้องแสดงให้เห็นว่าเต็ม เพื่อให้ไปนัด fellow ท่านอื่นหรือวันอื่น
 * — เป้าหมายคือเกลี่ยงานให้สมดุล ไม่ให้กระจุกที่คนใดคนหนึ่ง
 */

import type { Referral } from "./referral-types";

/** ค่าเริ่มต้นเมื่อไม่ได้ระบุ max_slots รายวัน */
export const DEFAULT_SLOTS_PER_FELLOW = 2;

/** หนึ่งแถวในชีต fellow_schedule = fellow 1 ท่าน ออกตรวจ 1 วัน */
export interface FellowClinicDay {
  /** yyyy-MM-dd */
  clinicDate: string;
  fellowName: string;
  maxSlots: number;
  note: string;
  /**
   * เลขแถวจริงในชีต (แถวแรกคือหัวตาราง = 1)
   * ต้องมีเพื่อสั่งลบแถวนั้นได้ และส่งไปให้ Apps Script ตรวจซ้ำก่อนลบ
   */
  rowNumber: number;
}

export interface FellowDayAvailability extends FellowClinicDay {
  booked: number;
  remaining: number;
  isFull: boolean;
}

/** สรุปรายวัน — ใช้วาดปฏิทิน */
export interface ScheduleDay {
  /** yyyy-MM-dd */
  date: string;
  fellows: FellowDayAvailability[];
  totalRemaining: number;
  /** true = ทุก fellow ในวันนั้นเต็มหมด ต้องไปนัดวันอื่น */
  allFull: boolean;
}

/**
 * นับจำนวนผู้ป่วยที่นัดไว้แล้ว แยกตาม fellow และวัน
 *
 * นับเฉพาะเคสกลุ่มที่ 1 ที่ยังไม่ถูกยกเลิก — เคสที่ปิดหรือส่งต่อช่องทางอื่นแล้ว
 * ไม่ควรกินคิวของ fellow
 */
function countBookings(referrals: Referral[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const r of referrals) {
    if (r.referralType !== "TRANSPLANT_APPOINTMENT") continue;
    if (r.status === "Rejected / Redirected") continue;
    if (!r.appointmentDate || !r.fellowAssigned) continue;

    const key = `${r.appointmentDate}|${r.fellowAssigned.trim()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * รวมตารางออกตรวจกับจำนวนที่นัดไปแล้ว คืนเป็นรายวันเรียงตามวันที่
 */
export function buildSchedule(
  clinicDays: FellowClinicDay[],
  referrals: Referral[],
): ScheduleDay[] {
  const bookings = countBookings(referrals);
  const byDate = new Map<string, FellowDayAvailability[]>();

  for (const day of clinicDays) {
    const booked = bookings.get(`${day.clinicDate}|${day.fellowName.trim()}`) ?? 0;
    const remaining = Math.max(0, day.maxSlots - booked);

    const entry: FellowDayAvailability = {
      ...day,
      booked,
      remaining,
      isFull: remaining === 0,
    };

    const list = byDate.get(day.clinicDate);
    if (list) list.push(entry);
    else byDate.set(day.clinicDate, [entry]);
  }

  return [...byDate.entries()]
    .map(([date, fellows]) => {
      const totalRemaining = fellows.reduce((sum, f) => sum + f.remaining, 0);
      return {
        date,
        fellows: fellows.sort((a, b) => a.fellowName.localeCompare(b.fellowName, "th")),
        totalRemaining,
        allFull: totalRemaining === 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** เลือกเฉพาะเดือนที่ต้องการแสดง (yyyy-MM) */
export function filterMonth(days: ScheduleDay[], yearMonth: string): ScheduleDay[] {
  return days.filter((d) => d.date.startsWith(yearMonth));
}

/** รายชื่อเดือนที่มีตารางอยู่ เรียงจากเก่าไปใหม่ */
export function monthsAvailable(days: ScheduleDay[]): string[] {
  return [...new Set(days.map((d) => d.date.slice(0, 7)))].sort();
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** "2026-08" → "สิงหาคม 2569" */
export function formatMonthTh(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

/** "2026-08-05" → 5 */
export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}
