import { NextResponse } from "next/server";
import { verifyTelegramWebApp } from "@/lib/apps-script-api";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * ยืนยัน Telegram Web App (แบบ B) แล้วออก session เข้า dashboard
 *
 * หน้า /tg (เปิดในแอป Telegram) ส่ง initData ที่ Telegram เซ็นให้มาที่นี่ →
 * Apps Script ตรวจลายเซ็นด้วย bot token + เช็คว่าอยู่ในกลุ่มทีม → ออก session
 * (bot token คงอยู่ที่ Apps Script ที่เดียว เหมือน LINE/redeemTelegramLogin)
 */
export async function POST(request: Request) {
  let initData = "";
  try {
    const body = await request.json();
    initData = String(body?.initData ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!initData) {
    return NextResponse.json({ ok: false, error: "no_init_data" }, { status: 400 });
  }

  let result;
  try {
    result = await verifyTelegramWebApp({ initData });
  } catch (error) {
    console.error("[telegram-webapp]", error);
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 502 });
  }

  if (!result.allowed || !result.displayName) {
    return NextResponse.json({ ok: false, error: "not_member" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(result.displayName, "telegram"),
    sessionCookieOptions("telegram"),
  );
  return response;
}
