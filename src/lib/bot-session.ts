/**
 * cookie ยืนยันตัวตนของ Hemato Bot — แยกจาก session dashboard โดยสิ้นเชิง
 *
 * ไฟล์นี้ตั้งใจไม่ import next/headers เพื่อให้ vitest รันได้ตรง ๆ
 * การอ่าน/เขียน cookie ทำในไฟล์ actions (Task 4)
 */

export const BOT_VERIFIED_COOKIE = "sibmt_bot_verified";
export const BOT_CODE_COOKIE = "sibmt_bot_code";
export const BOT_VERIFIED_MAX_AGE = 30 * 24 * 60 * 60; // วินาที
export const BOT_CODE_MAX_AGE = 10 * 60;

const enc = new TextEncoder();
const dec = new TextDecoder();

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function signBotPayload(
  payload: object,
  secret: string,
): Promise<string> {
  const body = bytesToBase64Url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body, secret)}`;
}

export async function readBotPayload<T>(
  token: string | undefined,
  secret: string,
): Promise<T | null> {
  if (!token) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  if ((await hmac(body, secret)) !== sig) return null;

  try {
    const payload = JSON.parse(dec.decode(base64UrlToBytes(body))) as T & {
      exp: number;
    };
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* ตัวช่วยเข้ารหัส/ถอดรหัส                                              */
/* ------------------------------------------------------------------ */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return base64ToBytes(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
