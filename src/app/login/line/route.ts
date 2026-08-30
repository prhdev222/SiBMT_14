import { NextResponse } from "next/server";
import {
  LINE_STATE_COOKIE,
  LINE_STATE_MAX_AGE,
  authorizeUrl,
  callbackUrl,
  isLineLoginConfigured,
  randomToken,
  safeNextPath,
} from "@/lib/line-login";

export const dynamic = "force-dynamic";

/**
 * เริ่มขั้นตอนเข้าสู่ระบบด้วย LINE
 *
 * เก็บ state ไว้ใน cookie แล้วเด้งไปหน้ายืนยันของ LINE
 *
 * ⚠️ state คือสิ่งเดียวที่กันไม่ให้คนอื่นยัดคำขอที่กลับมา
 *
 * ถ้าไม่มี ใครก็สร้างลิงก์ callback พร้อม code ของตัวเองแล้วหลอกให้อาจารย์กด
 * ผลคือเบราว์เซอร์ของอาจารย์จะถูกล็อกอินเป็นบัญชีของคนอื่นโดยไม่รู้ตัว
 * ค่าที่อยู่ใน cookie ต้องตรงกับที่ LINE ส่งกลับมาเท่านั้นจึงจะยอมรับ
 *
 * เก็บ next ไว้ใน cookie เดียวกัน ไม่ได้ฝากไปกับ LINE เพราะค่าที่วิ่งผ่าน
 * บริการภายนอกแล้วกลับมาต้องถือว่าถูกแก้ระหว่างทางได้เสมอ
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));

  if (!isLineLoginConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=line_not_configured", request.url),
    );
  }

  const state = randomToken();
  const nonce = randomToken();

  const response = NextResponse.redirect(
    authorizeUrl(callbackUrl(request), state, nonce),
  );

  response.cookies.set(LINE_STATE_COOKIE, `${state}|${next}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // ต้องเป็น lax ไม่ใช่ strict — คำขอที่กลับมาจาก LINE เป็นการข้ามเว็บ
    // ถ้าตั้ง strict เบราว์เซอร์จะไม่ส่ง cookie นี้มาด้วย แล้วจะตรวจ state ไม่ได้เลย
    sameSite: "lax",
    path: "/",
    maxAge: LINE_STATE_MAX_AGE,
  });

  return response;
}
