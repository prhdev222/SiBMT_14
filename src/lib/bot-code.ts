/**
 * แปลงรหัสยืนยัน 6 หลักเป็น SHA-256 hex — เก็บ hash แทนรหัสจริงใน cookie
 *
 * payload ใน cookie เซ็นด้วย HMAC กัน tampering ได้ แต่ตัว payload เอง
 * ยังเป็น base64 ที่ใครถือ cookie ก็ถอดอ่านได้ ถ้าเก็บรหัสตรง ๆ คนที่มี
 * cookie (ขโมยจาก browser, proxy log, หน้าจอที่ลืมล็อก) จะเห็นรหัสโดยไม่ต้อง
 * เปิดอีเมลเลย จึงต้องเก็บ hash แล้วเทียบ hash ตอนยืนยันแทน
 *
 * ไฟล์นี้ตั้งใจไม่ import next/headers เพื่อให้ vitest รันได้ตรง ๆ เหมือน bot-session.ts
 */
export async function hashCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
