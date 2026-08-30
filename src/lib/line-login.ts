/**
 * เข้าสู่ระบบด้วย LINE (LINE Login v2.1)
 *
 * ⚠️ คนละ channel กับ Messaging API ที่บอทใช้อยู่
 *
 * LINE แยก "บอทที่ส่งข้อความ" (Messaging API channel) ออกจาก "ปุ่มล็อกอิน"
 * (LINE Login channel) เป็นคนละอย่าง มี id และ secret คนละชุด แม้จะอยู่
 * provider เดียวกันและผูกกับ OA ตัวเดียวกันก็ตาม
 *
 * ⚠️ server-only — channel secret อยู่ใน environment ห้าม import จาก client
 *
 * สิ่งที่ไฟล์นี้ทำมีแค่ "พิสูจน์ว่าเป็น LINE ของใคร" ส่วน "คนนั้นมีสิทธิ์เข้า
 * dashboard ไหม" เป็นคนละคำถาม และตอบโดย Apps Script ซึ่งถือ token ของบอท
 * อยู่แล้ว (ดู checkDashboardMember ใน apps-script/Api.gs)
 */

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const PROFILE_URL = "https://api.line.me/v2/profile";

/** ชื่อ cookie ที่เก็บค่ากันปลอมคำขอระหว่างเด้งไป LINE แล้วกลับมา */
export const LINE_STATE_COOKIE = "sibmt_line_state";

/** อายุสั้นมาก — เป็นค่าที่มีชีวิตอยู่แค่ช่วงที่ผู้ใช้กำลังกดยืนยันบนหน้า LINE */
export const LINE_STATE_MAX_AGE = 10 * 60;

export function isLineLoginConfigured(): boolean {
  return Boolean(
    process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET,
  );
}

/**
 * ที่อยู่ที่ LINE จะส่งผู้ใช้กลับมา
 *
 * ⚠️ ต้องตรงกับที่กรอกไว้ในหน้า LINE Developers ทุกตัวอักษร รวมทั้ง https
 * ไม่งั้น LINE จะปฏิเสธตั้งแต่ก่อนแสดงหน้ายืนยัน
 *
 * สร้างจาก URL ของคำขอที่เข้ามาจริง ไม่ได้ฝังไว้เป็นค่าคงที่ เพื่อให้ทดสอบ
 * ที่ localhost กับใช้งานจริงบน workers.dev ใช้โค้ดชุดเดียวกันได้
 */
export function callbackUrl(request: Request): string {
  return new URL("/login/line/callback", request.url).toString();
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINE_LOGIN_CHANNEL_ID ?? "",
    redirect_uri: redirectUri,
    state,
    /*
     * ขอแค่ profile อย่างเดียว
     *
     * ระบบต้องการแค่ userId เพื่อถามว่าอยู่ในกลุ่มไหม ซึ่ง /v2/profile ให้ครบ
     *
     * ⚠️ ไม่ขอ openid โดยตั้งใจ — มันเปิดใช้ OpenID Connect ซึ่งเป็นการตั้งค่า
     * อีกชั้นที่ต้องเปิดในหน้า LINE Developers และเป็นจุดที่พังได้โดยไม่จำเป็น
     * ในเมื่อไม่ได้อ่าน id_token เลย และไม่ขอ email เพราะระบบไม่เคยใช้ —
     * สิทธิ์ที่ขอแต่ไม่ได้ใช้ทำให้หน้ายืนยันดูน่ากลัวและต้องยื่นขออนุมัติเพิ่ม
     */
    scope: "profile",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface LineProfile {
  userId: string;
  displayName: string;
}

/**
 * แลก code เป็น access token แล้วอ่านโปรไฟล์
 *
 * โยน error พร้อมข้อความภาษาไทยเมื่อไม่สำเร็จ เพราะผู้เรียกจะเอาไปแสดง
 * บนหน้า login ตรง ๆ — ผู้ใช้ไม่ควรเห็นข้อความดิบจาก LINE
 */
export async function exchangeCodeForProfile(
  code: string,
  redirectUri: string,
): Promise<LineProfile> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.LINE_LOGIN_CHANNEL_ID ?? "",
    client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET ?? "",
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    // ข้อความจาก LINE มักบอกสาเหตุจริง เช่น redirect_uri ไม่ตรง
    // ซึ่งเป็นความผิดพลาดตอนตั้งค่า ไม่ใช่ของผู้ใช้ จึงต้องเข้า log ให้ได้
    console.error("[line-login] แลก token ไม่สำเร็จ:", await tokenRes.text());
    throw new Error("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new Error("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  const profileRes = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });

  if (!profileRes.ok) {
    console.error("[line-login] อ่านโปรไฟล์ไม่สำเร็จ:", profileRes.status);
    throw new Error("อ่านข้อมูลบัญชี LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  const profile = (await profileRes.json()) as {
    userId?: string;
    displayName?: string;
  };

  if (!profile.userId) {
    throw new Error("อ่านข้อมูลบัญชี LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }

  return {
    userId: profile.userId,
    displayName: (profile.displayName ?? "").trim() || "ผู้ใช้ LINE",
  };
}

/** ค่าสุ่มสำหรับ state และ nonce — 32 ตัวอักษรเดาไม่ได้ในทางปฏิบัติ */
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * รับเฉพาะเส้นทางภายในเว็บนี้
 *
 * ค่า next มาจาก query string ซึ่งใครก็ใส่อะไรมาก็ได้ ถ้าเอาไป redirect ตรง ๆ
 * ลิงก์ที่หน้าตาเหมือนของเราจะพาผู้ใช้ไปเว็บอื่นหลังล็อกอินสำเร็จ
 * — ปฏิเสธ // ด้วย เพราะเบราว์เซอร์อ่านว่าเป็นโดเมนอื่น
 */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}
