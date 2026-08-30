/**
 * แปลงข้อมูลดิบเป็นชิ้นของกราฟวงกลม
 *
 * แยกออกมาเป็นไฟล์เดียวเพื่อให้กราฟบนหน้าจอ (SVG) กับรูปที่บันทึก (canvas)
 * ใช้ตัวเลขและสีชุดเดียวกันแน่นอน — ถ้าคำนวณแยกกันสองที่ วันหนึ่งจะแก้ที่เดียว
 * แล้วรูปที่เอาไปใส่สไลด์จะไม่ตรงกับที่เห็นบนจอ โดยไม่มีอะไรฟ้อง
 */

import { MAX_SLICES, RESIDUAL, SERIES } from "./palette";
import type { BarDatum } from "./CategoryBars";

export interface Slice {
  label: string;
  count: number;
  /** สัดส่วนต่อยอดรวมทั้งหมด 0–1 — คิดจากยอดก่อนยุบ "อื่น ๆ" เสมอ */
  fraction: number;
  color: string;
  /** true = ชิ้นนี้คือหลายรายการที่ถูกยุบรวมกัน */
  residual: boolean;
}

export interface PieData {
  slices: Slice[];
  total: number;
  /** จำนวนรายการที่ถูกยุบเข้า "อื่น ๆ" — 0 คือแสดงครบทุกรายการ */
  folded: number;
}

/**
 * จัดชิ้นของวงกลม โดยยุบรายการที่เกินจำนวนสีที่มีเป็น "อื่น ๆ"
 *
 * ⚠️ สีของชิ้นมาจากอันดับ ไม่ได้ผูกกับตัวรายการ ยกเว้นชุดที่ส่ง seriesIndex มาเอง
 *
 * ตามหลักแล้วสีควรผูกกับตัวรายการเสมอ แต่กลุ่มโรคกับสิทธิการรักษาไม่มีเลข
 * ประจำตัว การผูกด้วยการแฮชชื่อจะทำให้สองรายการได้สีเดียวกันเมื่อชนกัน
 * ซึ่งอ่านผิดหนักกว่า — จึงใช้อันดับแทน แล้วชดเชยด้วยการเขียนชื่อ จำนวน
 * และร้อยละกำกับทุกชิ้นในคำอธิบายที่เรียงลำดับตรงกับวงกลม
 * ตัวตนของชิ้นจึงไม่เคยขึ้นกับสีเพียงอย่างเดียว
 */
export function buildPieData(data: BarDatum[]): PieData {
  const rows = data.filter((d) => d.count > 0);
  const total = rows.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return { slices: [], total: 0, folded: 0 };

  const head = rows.slice(0, MAX_SLICES);
  const tail = rows.slice(MAX_SLICES);

  const slices: Slice[] = head.map((d, i) => ({
    label: d.label,
    count: d.count,
    fraction: d.count / total,
    color: SERIES[(d.seriesIndex ?? i) % SERIES.length],
    residual: false,
  }));

  if (tail.length > 0) {
    const rest = tail.reduce((sum, d) => sum + d.count, 0);
    slices.push({
      label: `อื่น ๆ (${tail.length} รายการ)`,
      count: rest,
      fraction: rest / total,
      color: RESIDUAL,
      residual: true,
    });
  }

  return { slices, total, folded: tail.length };
}

/** ร้อยละสำหรับแสดงผล — ทศนิยมหนึ่งตำแหน่งเมื่อชิ้นเล็กกว่า 10% */
export function percentText(fraction: number): string {
  const pct = fraction * 100;
  return pct < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
}
