"use server";

/**
 * Server Actions ของแชท Hemato Bot
 *
 * ⚠️ ทุก action ต้องเช็ก rate limit ก่อนเสมอ และห้าม throw กลับไปหา client —
 * คืน discriminated union แทน (ยกเว้น searchRegimensAction ที่สัญญาไว้เป็น
 * array เปล่า ๆ ตาม spec — ถ้าโดนจำกัดอัตราก็คืน [] เงียบ ๆ แทนการ throw)
 *
 * เพดานการเปิดเผยข้อมูลก่อนยืนยันตัวตน: มีแค่ field ใน BotCaseStatus
 * (+ hasAnswer ใน listCasesAction) ห้ามเพิ่ม field อื่นโดยไม่แก้ spec
 * และห้ามบอกว่าเบอร์ไหน "มี"/"ไม่มี" เคสหรืออีเมลที่ผูกไว้
 */

import { cookies } from "next/headers";
import {
  BOT_CODE_COOKIE,
  BOT_CODE_MAX_AGE,
  BOT_VERIFIED_COOKIE,
  BOT_VERIFIED_MAX_AGE,
  readBotPayload,
  signBotPayload,
} from "@/lib/bot-session";
import { hashCode } from "@/lib/bot-code";
import {
  casesForPhone,
  findByReferralId,
  latestEmailForPhone,
  shapeStatus,
  type BotCaseStatus,
} from "@/lib/bot-lookup";
import { loadRawReferralRows, loadRegimens } from "@/lib/referral-repository";
import { allowBotCode, allowBotLookup } from "@/lib/rate-limit";
import { resendAdviceEmail, sendBotCodeEmail } from "@/lib/apps-script-api";
import { phoneKey } from "@/lib/phone-key";

/** อ่านตอนถูกเรียก ไม่ใช่ตอนโหลดโมดูล — เหตุผลเดียวกับ apps-script-api.ts */
const secret = () => process.env.AUTH_SECRET ?? "";

/**
 * ข้อความตอบเมื่อยังไม่ได้ตั้ง AUTH_SECRET
 *
 * ⚠️ ห้ามปล่อยให้ signBotPayload/readBotPayload ถูกเรียกด้วย secret ว่างเปล่า —
 * crypto.subtle.importKey ปฏิเสธคีย์ยาวศูนย์ไบต์ทันที (throw ตรง ๆ ไม่ใช่ reject
 * แบบจับได้ง่าย) ทำให้ action ล่มดิบไปหา client แทนที่จะได้ discriminated union
 * ตามสัญญา — ต้องเช็กก่อนเรียกฟังก์ชันเข้ารหัสทุกครั้ง ไม่ใช่ไปแก้ที่ bot-session.ts
 * เพราะไฟล์นั้นตั้งใจให้ pure และไม่รู้จัก environment
 */
const AUTH_NOT_READY = "ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน กรุณาติดต่อแอดมิน";

/* ------------------------------------------------------------------ */
/* ค้นสถานะแบบไม่ยืนยันตัวตน — เห็นได้แค่เพดานใน BotCaseStatus                */
/* ------------------------------------------------------------------ */

export async function lookupStatusAction(
  referralId: string,
): Promise<
  | { ok: true; found: BotCaseStatus | null }
  | { ok: false; error: string }
> {
  if (!(await allowBotLookup())) {
    return { ok: false, error: "ค้นบ่อยเกินไป กรุณารออีกสักครู่" };
  }

  const id = referralId.trim();
  if (!id) return { ok: false, error: "กรุณากรอกเลขที่อ้างอิง" };

  const row = findByReferralId(await loadRawReferralRows(), id);
  return { ok: true, found: row ? shapeStatus(row) : null };
}

export async function listCasesAction(
  phone: string,
): Promise<
  | { ok: true; cases: (BotCaseStatus & { hasAnswer: boolean })[] }
  | { ok: false; error: string }
> {
  if (!(await allowBotLookup())) {
    return { ok: false, error: "ค้นบ่อยเกินไป กรุณารออีกสักครู่" };
  }

  const key = phoneKey(phone);
  if (!key) {
    return {
      ok: false,
      error: "เบอร์โทรไม่ครบ กรุณาพิมพ์ใหม่ เช่น 081-234-5678",
    };
  }

  const rows = casesForPhone(await loadRawReferralRows(), key);
  return {
    ok: true,
    cases: rows.map((row) => ({
      ...shapeStatus(row),
      hasAnswer: Boolean(row["advice_record"]?.trim()),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* ยืนยันตัวตนด้วยรหัสทางอีเมล                                            */
/* ------------------------------------------------------------------ */

export async function requestCodeAction(
  phone: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await allowBotCode())) {
    return { ok: false, error: "ขอรหัสบ่อยเกินไป กรุณารออีกสักครู่" };
  }
  if (!secret()) return { ok: false, error: AUTH_NOT_READY };

  const key = phoneKey(phone);
  if (!key) {
    return {
      ok: false,
      error: "เบอร์โทรไม่ครบ กรุณาพิมพ์ใหม่ เช่น 081-234-5678",
    };
  }

  const email = latestEmailForPhone(await loadRawReferralRows(), key);
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // เบอร์ไม่พบ/ไม่มีอีเมล: ไม่ส่งจริงแต่ตอบเหมือนส่งแล้ว — ไม่เผยว่าเบอร์ไหนมีเคส
  // ⚠️ ต้องไม่ await การส่งอีเมล — ถ้ารอเฉพาะตอนมีอีเมล เวลาตอบสนอง (1-10 วิ)
  // จะต่างจากตอนไม่มีอีเมล (ตอบทันที) จนกลายเป็น timing oracle เดาได้ว่า
  // เบอร์ไหนมีเคสผูกอยู่จากความช้าเร็วของคำตอบ จึงต้อง "ยิงทิ้ง" ผ่าน
  // waitUntil ของ Cloudflare ให้ทั้งสองเส้นทางตอบเร็วเท่ากัน
  if (email) scheduleBotCodeEmail(email, code);

  const codeHash = await hashCode(code, secret());
  const token = await signBotPayload(
    { codeHash, phone: key, exp: Date.now() + BOT_CODE_MAX_AGE * 1000 },
    secret(),
  );
  (await cookies()).set(BOT_CODE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: BOT_CODE_MAX_AGE,
    path: "/",
  });
  return { ok: true };
}

/**
 * ส่งอีเมลรหัสแบบ "ยิงทิ้ง" ไม่รอผล — กัน timing oracle ใน requestCodeAction
 *
 * แพตเทิร์น dynamic import เดียวกับ getLimiter ใน rate-limit.ts เพราะโมดูล
 * @opennextjs/cloudflare มีเฉพาะตอนรันบน Cloudflare — บน `next dev` (dev:demo)
 * import จะ throw แล้วตกไป fallback เป็น await ตรง ๆ แทน ซึ่งจะทำให้เวลาตอบสนอง
 * ต่างกันอีกครั้งเฉพาะตอนพัฒนาบนเครื่องตัวเอง (ไม่มี waitUntil ให้ใช้จริง ๆ)
 * — ยอมรับได้เพราะ production (Cloudflare Workers) มี context นี้เสมอ
 */
function scheduleBotCodeEmail(email: string, code: string): void {
  void (async () => {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      getCloudflareContext().ctx.waitUntil(
        sendBotCodeEmail({ email, code }).catch((error: unknown) => {
          console.error(
            "[hemato-bot] ส่งรหัสอีเมลไม่สำเร็จ: " + String(error),
          );
        }),
      );
    } catch {
      // dev:demo ไม่มี Cloudflare context ให้ waitUntil ใช้ — await ตรง ๆ แทน
      try {
        await sendBotCodeEmail({ email, code });
      } catch (error) {
        console.error(
          "[hemato-bot] ส่งรหัสอีเมลไม่สำเร็จ: " + String(error),
        );
      }
    }
  })();
}

export async function verifyCodeAction(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await allowBotLookup())) {
    return { ok: false, error: "ยืนยันรหัสบ่อยเกินไป กรุณารออีกสักครู่" };
  }
  if (!secret()) return { ok: false, error: AUTH_NOT_READY };

  const jar = await cookies();
  const payload = await readBotPayload<{
    codeHash: string;
    phone: string;
    exp: number;
  }>(jar.get(BOT_CODE_COOKIE)?.value, secret());

  if (!payload) {
    return { ok: false, error: "รหัสหมดอายุ กรุณาขอรหัสใหม่" };
  }

  const enteredHash = await hashCode(code.trim(), secret());
  if (enteredHash !== payload.codeHash) {
    return { ok: false, error: "รหัสไม่ถูกต้อง กรุณาพิมพ์ใหม่" };
  }

  const token = await signBotPayload(
    { phone: payload.phone, exp: Date.now() + BOT_VERIFIED_MAX_AGE * 1000 },
    secret(),
  );
  jar.set(BOT_VERIFIED_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: BOT_VERIFIED_MAX_AGE,
    path: "/",
  });
  jar.delete(BOT_CODE_COOKIE);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* หลังยืนยันตัวตนแล้ว — เห็นลิงก์คำตอบได้                                  */
/* ------------------------------------------------------------------ */

export async function verifiedCasesAction(): Promise<
  | {
      ok: true;
      verified: boolean;
      cases: (BotCaseStatus & { answerUrl: string | null })[];
    }
  | { ok: false; error: string }
> {
  if (!(await allowBotLookup())) {
    return { ok: false, error: "ค้นบ่อยเกินไป กรุณารออีกสักครู่" };
  }
  if (!secret()) return { ok: false, error: AUTH_NOT_READY };

  const payload = await readBotPayload<{ phone: string; exp: number }>(
    (await cookies()).get(BOT_VERIFIED_COOKIE)?.value,
    secret(),
  );
  if (!payload) {
    return { ok: true, verified: false, cases: [] };
  }

  const rows = casesForPhone(await loadRawReferralRows(), payload.phone);
  return {
    ok: true,
    verified: true,
    cases: rows.map((row) => ({
      ...shapeStatus(row),
      answerUrl:
        row["advice_record"]?.trim() && row["answer_token"]?.trim()
          ? `/answer/${row["answer_token"]}`
          : null,
    })),
  };
}

export async function resendAnswerAction(
  referralId: string,
): Promise<{ ok: boolean; error?: string }> {
  // ส่งอีเมลจริงซ้ำได้ — ใช้ถังเดียวกับขอรหัส ไม่ใช่ถังค้นเฉย ๆ
  if (!(await allowBotCode())) {
    return { ok: false, error: "ขอส่งซ้ำบ่อยเกินไป กรุณารออีกสักครู่" };
  }

  const id = referralId.trim();
  if (!id) return { ok: false, error: "กรุณากรอกเลขที่อ้างอิง" };

  // ส่งไปอีเมลที่ผูกไว้กับเคสอยู่แล้วเท่านั้น — ข้อความตอบจึงไม่ต้อง (และไม่ควร)
  // เอ่ยถึงอีเมลปลายทาง ⚠️ ต้องไม่ส่งข้อความจาก Apps Script ต่อให้ client ตรง ๆ
  // ด้วย เพราะนั่นคือฝากความรับผิดชอบ "ห้ามเผยอีเมล" ไว้กับโค้ดฝั่ง Apps Script
  // ที่ไม่ได้ทวนตรงนี้ — คืนข้อความคงที่เสมอ ส่วนรายละเอียดจริงบันทึกไว้ที่ log
  // ฝั่งเซิร์ฟเวอร์เท่านั้น
  const GENERIC_ERROR = "ส่งคำตอบซ้ำไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
  try {
    const result = await resendAdviceEmail({ referralId: id });
    if (!result.ok) {
      console.error("[hemato-bot] resendAdvice ไม่สำเร็จ: " + (result.error ?? ""));
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: true };
  } catch (error) {
    console.error("[hemato-bot] resendAdvice เรียกไม่สำเร็จ: " + String(error));
    return { ok: false, error: GENERIC_ERROR };
  }
}

/* ------------------------------------------------------------------ */
/* ค้นสูตรยาเคมีบำบัด — ปุ่มช่วยพิมพ์ในแชท                                   */
/* ------------------------------------------------------------------ */

export async function searchRegimensAction(
  query: string,
): Promise<{ diseaseGroup: string; abbr: string; components: string }[]> {
  // สัญญาไว้เป็น array เปล่า ๆ ไม่มีช่อง error — โดนจำกัดอัตราก็คืน [] เงียบ ๆ
  if (!(await allowBotLookup())) return [];

  const regimens = await loadRegimens();
  const q = query.trim().toLowerCase();
  if (!q) return regimens;

  return regimens.filter(
    (r) =>
      r.diseaseGroup.toLowerCase().includes(q) ||
      r.abbr.toLowerCase().includes(q) ||
      r.components.toLowerCase().includes(q),
  );
}
