/**
 * อ่านและตรวจ session จาก cookie
 *
 * แยกจาก auth.ts เพราะไฟล์นี้ใช้ next/headers ซึ่ง proxy.ts เรียกไม่ได้
 *
 * ⚠️ server-only — เรียกจาก server component หรือ Server Action เท่านั้น
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  isAuthConfigured,
  readSessionToken,
  type Session,
} from "./auth";

/**
 * ผู้ใช้ที่ล็อกอินอยู่ คืน null ถ้ายังไม่ได้ล็อกอิน
 *
 * ยังไม่ได้ตั้งรหัสผ่าน = ทุกคนเข้าได้ในนาม "ยังไม่ได้ตั้งรหัสผ่าน"
 * เพื่อให้พัฒนาและสาธิตต่อได้ — หน้าจอจะขึ้นแถบเตือนสีแดงเอง
 */
export async function getSession(): Promise<Session | null> {
  if (!isAuthConfigured()) {
    return { username: "ยังไม่ได้ตั้งรหัสผ่าน", expiresAt: Number.MAX_SAFE_INTEGER };
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSessionToken(token);
}

/**
 * บังคับให้ล็อกอินก่อน ไม่งั้นเด้งไปหน้า login
 *
 * ต้องเรียกในทุก Server Action และทุกหน้าที่มีข้อมูล ไม่ใช่พึ่ง proxy.ts อย่างเดียว
 * เพราะ Server Action ถูกยิงด้วย POST ตรง ๆ ได้ และเอกสาร Next ระบุชัดว่า
 * proxy เป็นแค่ด่านคัดกรองหยาบ ๆ ไม่ใช่ระบบ authorization
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
