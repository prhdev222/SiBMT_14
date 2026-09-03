import { NextResponse } from "next/server";
import {
  LINE_STATE_COOKIE,
  LINE_STATE_MAX_AGE,
  authorizeUrl,
  isLineLoginConfigured,
  randomToken,
} from "@/lib/line-login";

export const dynamic = "force-dynamic";

/**
 * ที่อยู่ที่ LINE จะส่งผู้ใช้กลับมา — คนละเส้นทางกับ `/login/line/callback`
 *
 * ⚠️ ไม่ใช้ `callbackUrl()` ของ line-login.ts เพราะฟังก์ชันนั้นชี้ไป
 * `/login/line/callback` ตายตัว (เส้นทางล็อกอินเข้า dashboard) ถ้าใช้ร่วมกัน
 * LINE จะส่งผู้ใช้แชทกลับไปที่ callback ของ dashboard แทน ต้องลงทะเบียน URL นี้
 * แยกไว้ในหน้า LINE Developers ด้วย (ช่อง Callback URL รับได้หลายค่า)
 */
function callbackUrl(request: Request): string {
  return new URL("/hemato-bot/line/callback", request.url).toString();
}

/**
 * เริ่มขั้นตอนผูกบัญชี LINE เข้ากับแชท Hemato Bot
 *
 * เก็บ state ไว้ใน cookie แล้วเด้งไปหน้ายืนยันของ LINE — แพตเทิร์นเดียวกับ
 * `/login/line/route.ts` ทุกประการ ต่างกันแค่ปลายทางตอนกลับมา (ดูใน callback)
 *
 * ⚠️ state คือสิ่งเดียวที่กันไม่ให้คนอื่นยัดคำขอที่กลับมา ดูเหตุผลเต็มใน
 * `/login/line/route.ts`
 *
 * ไม่ต้องเก็บ next ไว้ด้วยเหมือนฝั่ง dashboard เพราะปลายทางคงที่เสมอคือ "/"
 */
export async function GET(request: Request) {
  const secret = process.env.AUTH_SECRET ?? "";

  // เช็กก่อนเด้งไป LINE ไม่ใช่รอถึงตอน callback — ไม่งั้นผู้ใช้เสียเวลากดยืนยัน
  // บนหน้า LINE ไปเปล่า ๆ แล้วมาพังตอนจะเซ็น BOT_VERIFIED_COOKIE ทีหลัง
  if (!secret || !isLineLoginConfigured()) {
    return NextResponse.redirect(new URL("/?bot=unavailable", request.url));
  }

  const state = randomToken();

  const response = NextResponse.redirect(
    authorizeUrl(callbackUrl(request), state),
  );

  response.cookies.set(LINE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    // ต้องเป็น lax ไม่ใช่ strict — คำขอที่กลับมาจาก LINE เป็นการข้ามเว็บ
    // ถ้าตั้ง strict เบราว์เซอร์จะไม่ส่ง cookie นี้มาด้วย แล้วจะตรวจ state ไม่ได้เลย
    sameSite: "lax",
    path: "/",
    maxAge: LINE_STATE_MAX_AGE,
  });

  return response;
}
