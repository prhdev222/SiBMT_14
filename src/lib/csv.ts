/**
 * สร้างและดาวน์โหลดไฟล์ CSV
 *
 * ⚠️ client-only — ใช้ Blob กับ URL.createObjectURL
 */

/**
 * แปลงตารางเป็นข้อความ CSV
 *
 * ครอบทุกช่องด้วยเครื่องหมายคำพูดเสมอ ไม่ใช่เฉพาะช่องที่มีจุลภาค
 * เพราะข้อมูลในระบบนี้มีทั้งข้อความยาวหลายบรรทัด (คำตอบของแพทย์)
 * และเบอร์โทรที่ขึ้นต้นด้วยศูนย์ — การครอบทุกช่องทำให้ไม่ต้องเดาว่าช่องไหนต้องครอบ
 */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) =>
    `"${String(v ?? "").replaceAll('"', '""')}"`;

  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))]
    .join("\n");
}

/**
 * สั่งให้เบราว์เซอร์บันทึกไฟล์
 *
 * ⚠️ ต้องมี BOM (﻿) นำหน้า มิฉะนั้น Excel จะอ่านภาษาไทยเป็นอักขระขยะ
 *
 * Excel บนวินโดวส์เดาการเข้ารหัสจากไบต์แรกของไฟล์ ถ้าไม่มี BOM มันจะเดาเป็น
 * รหัสท้องถิ่นแล้วภาษาไทยเพี้ยนทั้งไฟล์ — เปิดใน Numbers หรือ Google Sheets
 * จะดูปกติ ทำให้ไม่เจอปัญหาจนกว่าจะมีคนเปิดด้วย Excel จริง
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** วันที่แบบ yyyy-MM-dd สำหรับต่อท้ายชื่อไฟล์ — เรียงตามเวลาได้เมื่อเก็บหลายไฟล์ */
export function fileStamp(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`
  );
}
