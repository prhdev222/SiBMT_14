import { NextResponse } from "next/server";
import { redeemTelegramLogin } from "@/lib/apps-script-api";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * แลก token จากคำสั่ง /login ในกลุ่ม Telegram → ออก session เข้า dashboard
 *
 * ลิงก์นี้มาจากบอท (SITE_URL/login/telegram?t=<token>) หลังบอทเช็คแล้วว่า
 * ผู้ใช้อยู่ในกลุ่มทีม — token ใช้ครั้งเดียว อายุ 5 นาที เก็บฝั่ง Apps Script
 * สิทธิ์เข้า dashboard จึงค้ำด้วยสมาชิกภาพกลุ่ม เหมือน LINE login
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  if (!token) return fail("tg_missing");

  let result;
  try {
    result = await redeemTelegramLogin({ token });
  } catch (error) {
    console.error("[telegram-login]", error);
    return fail("tg_failed");
  }

  if (!result.allowed || !result.displayName) return fail("tg_expired");

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  // ชื่อ Telegram ตามจริง เพื่อตามได้ว่าใครทำอะไรใน status_log (เหมือน LINE)
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(result.displayName, "telegram"),
    sessionCookieOptions("telegram"),
  );
  return response;
}
