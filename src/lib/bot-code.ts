/**
 * แปลงรหัสยืนยัน 6 หลักเป็น HMAC-SHA256 hex (คีย์ = AUTH_SECRET) — เก็บ hash
 * แทนรหัสจริงใน cookie
 *
 * payload ใน cookie เซ็นด้วย HMAC กัน tampering ได้ แต่ตัว payload เอง
 * ยังเป็น base64 ที่ใครถือ cookie ก็ถอดอ่านได้ ถ้าเก็บรหัสตรง ๆ คนที่มี
 * cookie (ขโมยจาก browser, proxy log, หน้าจอที่ลืมล็อก) จะเห็นรหัสโดยไม่ต้อง
 * เปิดอีเมลเลย จึงต้องเก็บ hash แล้วเทียบ hash ตอนยืนยันแทน
 *
 * ⚠️ ต้องเป็น hash แบบมีกุญแจ (HMAC) ไม่ใช่ SHA-256 เฉย ๆ — รหัสมีแค่ 6 หลัก
 * (10^6 ความเป็นไปได้) ถ้า hash ไม่มีกุญแจ คนที่ขโมย cookie ไปคำนวณ SHA-256
 * ของทุกความเป็นไปได้แบบออฟไลน์ได้หมดภายในไม่กี่วินาที แล้วเทียบหา hash
 * ที่ตรงกับใน payload — เท่ากับรู้รหัสโดยไม่ต้องเปิดอีเมลเลย การใส่กุญแจ
 * (AUTH_SECRET ที่ผู้ขโมย cookie ไม่มี) ทำให้คำนวณล่วงหน้าแบบนี้ไม่ได้อีก
 *
 * ไฟล์นี้ตั้งใจไม่ import next/headers เพื่อให้ vitest รันได้ตรง ๆ เหมือน bot-session.ts
 */
export async function hashCode(code: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(code));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
