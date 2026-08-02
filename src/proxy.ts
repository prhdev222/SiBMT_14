/**
 * ด่านคัดกรองก่อนเข้า /dashboard
 *
 * Next.js 16 เปลี่ยนชื่อ middleware เป็น proxy — ไฟล์ต้องชื่อ proxy.ts
 * และวางระดับเดียวกับ app/ (ที่นี่คือ src/)
 *
 * ⚠️ นี่เป็นแค่ด่านแรก ไม่ใช่ระบบ authorization
 * เอกสาร Next ระบุว่า proxy ควรทำแค่ตรวจ cookie แบบหยาบ ๆ
 * การตรวจจริงอยู่ที่ requireSession() ในแต่ละหน้าและทุก Server Action
 * เพราะ Server Action ถูกยิงด้วย POST ตรง ๆ ได้โดยไม่ผ่านหน้าจอ
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isAuthConfigured, readSessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  // ยังไม่ได้ตั้งรหัสผ่าน — ปล่อยผ่านเพื่อให้พัฒนาและสาธิตได้
  // หน้า dashboard จะขึ้นแถบเตือนสีแดงเองว่ายังไม่ได้ปิดประตู
  if (!isAuthConfigured()) return NextResponse.next();

  const session = await readSessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (session) return NextResponse.next();

  // จำหน้าที่ตั้งใจจะเข้าไว้ เพื่อพากลับมาหลังล็อกอิน
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // ระบุ "/dashboard" แยกไว้ด้วย ไม่พึ่งว่า :path* จะครอบตัวมันเอง
  matcher: ["/dashboard", "/dashboard/:path*"],
};
