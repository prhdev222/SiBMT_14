/**
 * สั่งให้เบราว์เซอร์บันทึกไฟล์จากข้อมูลที่สร้างในหน้าเว็บ
 *
 * ⚠️ client-only — ใช้ Blob กับ URL.createObjectURL
 *
 * ⚠️ ต้องใส่ลิงก์ลงในหน้าจริงก่อนกด และคืน URL ทีหลัง ไม่ใช่ทันที
 *
 * ลิงก์ที่ลอยอยู่นอกหน้าเอกสารถูกบางเบราว์เซอร์เมิน และการคืน URL ทันที
 * หลังกดทำให้เบราว์เซอร์ที่อ่านไฟล์แบบไม่พร้อมกันได้ไฟล์เปล่า — ทั้งสองอย่าง
 * ล้มเหลวแบบเงียบ ๆ คือกดแล้วไม่มีอะไรเกิดขึ้นเลย ซึ่งหาสาเหตุยากมาก
 */
export function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * ตัดอักขระที่ตั้งเป็นชื่อไฟล์ไม่ได้ออก
 *
 * ชื่อกราฟมาจากหัวข้อบนหน้าจอ ซึ่งมีทั้งวงเล็บและทับ เช่น "ปรับขนาดยา / ผลข้างเคียง"
 * — ทับตัวเดียวทำให้วินโดวส์ปฏิเสธทั้งไฟล์
 */
export function safeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
