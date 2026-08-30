import { NextResponse } from "next/server";
import {
  LINE_STATE_COOKIE,
  callbackUrl,
  exchangeCodeForProfile,
  isLineLoginConfigured,
  safeNextPath,
} from "@/lib/line-login";
import { checkDashboardMember } from "@/lib/apps-script-api";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * ขากลับจากหน้ายืนยันของ LINE
 *
 * ลำดับการตรวจสำคัญ ห้ามสลับ
 *   1. state ตรงกับที่ออกไปไหม        — กันคำขอที่ถูกยัดมา
 *   2. code แลกเป็นตัวตนได้ไหม         — พิสูจน์ว่าเป็น LINE ของใครจริง
 *   3. คนนั้นอยู่ในกลุ่มที่กำหนดไหม      — พิสูจน์ว่ามีสิทธิ์เข้า dashboard
 *
 * ข้อ 2 บอกแค่ว่า "เป็นใคร" ทุกคนบนโลกที่มี LINE ผ่านข้อนี้ได้ — ข้อ 3 ต่างหาก
 * ที่เป็นประตู ถ้าข้ามข้อ 3 ไปเท่ากับเปิด dashboard ให้ทุกคนที่มีบัญชี LINE
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

  const stored = cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
  const [expectedState, storedNext] = stored.split("|");
  const next = safeNextPath(storedNext ?? null);

  const fail = (reason: string) => {
    const to = NextResponse.redirect(
      new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, request.url),
    );
    to.cookies.delete(LINE_STATE_COOKIE);
    return to;
  };

  if (!isLineLoginConfigured()) return fail("line_not_configured");

  // ผู้ใช้กดยกเลิกบนหน้า LINE ก็มาที่นี่เหมือนกัน แต่ไม่มี code ติดมา
  if (!code || !state) return fail("line_cancelled");
  if (!expectedState || state !== expectedState) return fail("line_state");

  let profile;
  try {
    profile = await exchangeCodeForProfile(code, callbackUrl(request));
  } catch (error) {
    console.error("[line-login]", error);
    return fail("line_exchange");
  }

  let member;
  try {
    member = await checkDashboardMember(profile.userId, profile.displayName);
  } catch (error) {
    // อ่านสมาชิกภาพไม่ได้ = ตอบไม่ได้ว่ามีสิทธิ์ไหม ต้องถือว่าไม่มี
    // ระบบที่ปล่อยผ่านเมื่อตรวจไม่ได้ จะเปิดประตูทุกครั้งที่ Apps Script ล่ม
    console.error("[line-login] ตรวจสมาชิกกลุ่มไม่สำเร็จ:", error);
    return fail("line_check_failed");
  }

  if (!member.allowed) return fail("line_not_member");

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.delete(LINE_STATE_COOKIE);

  // ชื่อที่จะไปโผล่บนแถบด้านบนและใน status_log — ใช้ชื่อ LINE ตามจริง
  // เพื่อให้ตามได้ว่าใครเป็นคนตอบเคสไหน ต่างจากบัญชีรหัสผ่านที่ใช้ร่วมกันในวอร์ด
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(member.displayName, "line"),
    sessionCookieOptions("line"),
  );

  return response;
}
