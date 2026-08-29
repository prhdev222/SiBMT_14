/**
 * แปลงวันที่ ISO (yyyy-MM-dd) เป็นข้อความภาษาไทยพร้อมปี พ.ศ.
 *
 * แยกออกมาเป็นโมดูลกลางเพราะเดิมมีสำเนาเดียวกันอยู่ใน BookingFlow.tsx
 * และ ScheduleEditor.tsx อยู่แล้ว การเพิ่มสำเนาที่สามทำให้ชื่อเดือนหรือ
 * รูปแบบวันที่เพี้ยนกันได้โดยไม่มีใครสังเกต
 *
 * ⚠️ แยกตัวเลขจากสตริงเอง ไม่ใช้ new Date(iso) เพราะ Date จะตีความ
 * "2026-09-07" เป็นเวลา UTC เที่ยงคืน แล้วเครื่องที่อยู่โซนเวลาติดลบ
 * จะแสดงเป็นวันก่อนหน้า — วันนัดที่คลาดไปหนึ่งวันคือผู้ป่วยมาผิดวัน
 */

const TH_MONTH_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const TH_MONTH_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const TH_DAY = [
  "อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์",
];

/**
 * @param iso   วันที่รูปแบบ yyyy-MM-dd
 * @param long  true = "วันจันทร์ที่ 7 กันยายน 2569", false = "7 ก.ย. 2569"
 */
export function formatThaiDate(iso: string, long = false): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;

  const buddhistYear = y + 543;
  if (!long) return `${d} ${TH_MONTH_SHORT[m - 1]} ${buddhistYear}`;

  const weekday = TH_DAY[new Date(y, m - 1, d).getDay()];
  return `วัน${weekday}ที่ ${d} ${TH_MONTH_FULL[m - 1]} ${buddhistYear}`;
}
