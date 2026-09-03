import { NextResponse } from "next/server";
import {
  LINE_STATE_COOKIE,
  exchangeCodeForProfile,
  isLineLoginConfigured,
} from "@/lib/line-login";
import { loadLineLink } from "@/lib/referral-repository";
import {
  BOT_VERIFIED_COOKIE,
  BOT_VERIFIED_MAX_AGE,
  signBotPayload,
} from "@/lib/bot-session";
import { phoneKey } from "@/lib/phone-key";

export const dynamic = "force-dynamic";

/** ต้องตรงกับ URL ที่ `/hemato-bot/line/route.ts` ส่งให้ LINE ไปตอนเริ่มขั้นตอน */
function callbackUrl(request: Request): string {
  return new URL("/hemato-bot/line/callback", request.url).toString();
}

/**
 * ขากลับจากหน้ายืนยันของ LINE — เส้นทางของแชท Hemato Bot
 *
 * ลำดับการตรวจสำคัญเหมือน `/login/line/callback/route.ts` ห้ามสลับ
 *   1. state ตรงกับที่ออกไปไหม        — กันคำขอที่ถูกยัดมา
 *   2. code แลกเป็นตัวตนได้ไหม         — พิสูจน์ว่าเป็น LINE ของใครจริง
 *   3. LINE นั้นเคยผูกกับเบอร์ไหนไว้ไหม  — loadLineLink ไม่ใช่ checkDashboardMember
 *
 * ข้อ 3 ต่างจากฝั่ง dashboard: ที่นี่ไม่ได้ตรวจสิทธิ์เข้าระบบ แค่หาว่าบัญชี LINE
 * นี้เคยผูกกับเบอร์ที่เคยส่งเคสไว้หรือยัง — ไม่เจอไม่ใช่ error แค่ยังไม่ได้ผูก
 * (ส่งกลับ bot=unlinked ให้ widget ชวนผูกบัญชีต่อ ไม่ใช่ปฏิเสธการเข้าใช้งาน)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${LINE_STATE_COOKIE}=`));

  const expectedState = cookie
    ? decodeURIComponent(cookie.split("=").slice(1).join("="))
    : "";

  // ห้ามแสดงข้อความ error ดิบจาก LINE หรือจากระบบตรง ๆ บนหน้าแชท — เหลือแค่
  // สถานะสั้น ๆ ใน query ให้ widget เลือกคำอธิบายเอง
  const fail = (reason: string) => {
    const to = NextResponse.redirect(new URL(`/?bot=${reason}`, request.url));
    to.cookies.delete(LINE_STATE_COOKIE);
    return to;
  };

  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret || !isLineLoginConfigured()) return fail("unavailable");

  // ผู้ใช้กดยกเลิกบนหน้า LINE ก็มาที่นี่เหมือนกัน แต่ไม่มี code ติดมา
  if (!code || !state) return fail("error");
  if (!expectedState || state !== expectedState) return fail("error");

  let profile;
  try {
    profile = await exchangeCodeForProfile(code, callbackUrl(request));
  } catch (error) {
    console.error("[hemato-bot line-login]", error);
    return fail("error");
  }

  const link = await loadLineLink(profile.userId);

  const response = NextResponse.redirect(
    new URL(link ? "/?bot=verified" : "/?bot=unlinked", request.url),
  );
  response.cookies.delete(LINE_STATE_COOKIE);

  if (link) {
    // เพดานสิทธิ์เดียวกับที่ verifyCodeAction ให้หลังยืนยันรหัสทางอีเมล —
    // เก็บแค่เบอร์ที่ทำ key แล้ว ไม่เก็บ userId หรือชื่อ LINE ไว้ใน cookie
    const token = await signBotPayload(
      {
        phone: phoneKey(link.phone),
        exp: Date.now() + BOT_VERIFIED_MAX_AGE * 1000,
      },
      secret,
    );
    response.cookies.set(BOT_VERIFIED_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: BOT_VERIFIED_MAX_AGE,
    });
  }

  return response;
}
