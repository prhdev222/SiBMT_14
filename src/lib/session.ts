/**
 * อ่านและตรวจ session จาก cookie
 *
 * แยกจาก auth.ts เพราะไฟล์นี้ใช้ next/headers ซึ่ง Web Crypto ล้วน ๆ ใน auth.ts ไม่ต้องพึ่ง
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
 * ⚠️ นี่คือด่านเดียวของระบบ ไม่มี proxy.ts คอยกันไว้ให้ข้างหน้าแล้ว
 * ทุกหน้าใต้ /dashboard และทุก Server Action ต้องเรียกฟังก์ชันนี้เอง
 * (Server Action ถูกยิงด้วย POST ตรง ๆ ได้อยู่แล้ว proxy จึงกันไม่ได้จริงตั้งแต่ต้น
 *  เอกสาร Next ก็ระบุเองว่า proxy เป็นแค่ด่านคัดกรองหยาบ ๆ ไม่ใช่ authorization)
 *
 * @param returnTo เส้นทางที่ผู้ใช้ตั้งใจจะเข้า เพื่อพากลับมาหลังล็อกอินสำเร็จ
 *                 หน้าต้องส่งค่านี้มาเอง เพราะ Server Component อ่าน pathname
 *                 ของตัวเองไม่ได้ถ้าไม่มี proxy คอยแปะ header ให้
 */
export async function requireSession(returnTo?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    // กันการถูกหลอกให้เด้งออกไปเว็บอื่น — รับเฉพาะเส้นทางภายในเท่านั้น
    const safe =
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//");
    redirect(safe ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return session;
}
