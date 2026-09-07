/**
 * รหัสผ่านสำหรับเข้า dashboard
 *
 * ทำไมทำเอง ไม่ใช้ไลบรารี:
 * โปรเจกต์นี้ deploy บน edge ของ Cloudflare ซึ่งไม่มี Node crypto
 * ไลบรารี auth ส่วนใหญ่ลากทั้ง bcrypt และ session store ตามมาด้วย
 * ที่ต้องการจริงมีแค่ "ตรวจรหัสผ่าน" กับ "เซ็น cookie" ซึ่ง Web Crypto ทำได้ครบ
 * (แนวเดียวกับ google-sheets.ts ที่เซ็น JWT เองด้วยเหตุผลเดียวกัน)
 *
 * ⚠️ ไฟล์นี้ต้องรันฝั่ง server เท่านั้น — อ่านรหัสผ่านจาก environment
 *    ห้าม import จาก client component
 *
 * ไฟล์นี้ตั้งใจไม่ import next/headers เพื่อให้ proxy.ts (edge) ใช้ได้ด้วย
 */

/** ชื่อ cookie ที่เก็บ session */
export const SESSION_COOKIE = "sibmt_session";

/**
 * อายุ session 12 ชั่วโมง — ครอบคลุมหนึ่งวันทำงาน แล้วต้องล็อกอินใหม่
 *
 * ยาวกว่านี้สะดวกขึ้นก็จริง แต่ระบบนี้มีข้อมูลประสานงานผู้ป่วยอยู่
 * เครื่องที่ลืม log out ทิ้งไว้ที่ OPD ไม่ควรเปิดค้างข้ามสัปดาห์
 */
const SESSION_HOURS = 12;

/**
 * session ที่มาจาก LINE สั้นกว่า เพราะถอนสิทธิ์ได้ช้ากว่า
 *
 * ⚠️ ตรงนี้คือข้อแลกเปลี่ยนที่ต้องรู้ตัว
 *
 * บัญชีรหัสผ่านถอนสิทธิ์ได้ทันที — ลบชื่อออกจาก DASHBOARD_USERS แล้ว
 * readSessionToken() ปฏิเสธ token เดิมในคำขอถัดไปเลย
 * ส่วน LINE ตรวจสมาชิกภาพกลุ่มตอนล็อกอินเท่านั้น คนที่ถูกเอาออกจากกลุ่ม
 * จึงยังใช้ session ที่ถืออยู่ต่อได้จนหมดอายุ ตัวเลขนี้คือเพดานของช่วงนั้น
 *
 * แปดชั่วโมงราวหนึ่งเวร และการล็อกอินใหม่ด้วย LINE เป็นการกดปุ่มเดียว
 * เพราะเบราว์เซอร์จำการอนุญาตไว้แล้ว จึงไม่ได้แลกความสะดวกไปมาก
 */
const LINE_SESSION_HOURS = 8;

/** ที่มาของ session — ใช้ตัดสินว่าจะตรวจรายชื่อผู้ใช้ซ้ำหรือไม่ */
export type SessionSource = "password" | "line" | "telegram";

/**
 * session ภายนอก (LINE/Telegram) — ยืนยันสิทธิ์จากสมาชิกภาพกลุ่มตอนล็อกอิน
 * ไม่ได้อยู่ใน DASHBOARD_USERS จึงใช้เพดานอายุสั้นกว่าและข้ามการตรวจรายชื่อซ้ำ
 */
function isExternalSource(via: SessionSource | undefined): boolean {
  return via === "line" || via === "telegram";
}

export interface Session {
  username: string;
  /** epoch milliseconds */
  expiresAt: number;
  /**
   * มาจากไหน — ไม่มีค่า = ของเดิมที่ออกก่อนมี LINE Login ถือเป็นรหัสผ่าน
   *
   * เก็บไว้ใน token เพราะ readSessionToken() ต้องรู้ว่าจะเอาชื่อไปตรวจกับ
   * DASHBOARD_USERS หรือไม่ — ชื่อที่มาจาก LINE ไม่มีวันอยู่ในรายการนั้น
   */
  via?: SessionSource;
}

/* ------------------------------------------------------------------ */
/* การตั้งค่า                                                          */
/* ------------------------------------------------------------------ */

/**
 * รายชื่อผู้ใช้จาก environment
 * รูปแบบ: `ชื่อผู้ใช้:pbkdf2.รอบ.salt.hash;ชื่อผู้ใช้:pbkdf2.รอบ.salt.hash`
 *
 * แยกคู่ด้วย `;` และแยกชื่อกับ hash ด้วย `:` ตัวแรกเท่านั้น
 *
 * ตัว hash ใช้ `.` คั่นและเข้ารหัสแบบ base64url โดยตั้งใจ
 * ทั้งก้อนจึงมีแต่ [A-Za-z0-9-_.] — รูปแบบยอดนิยมอย่าง `pbkdf2$รอบ$...`
 * ใช้ไม่ได้ที่นี่ เพราะไฟล์ .env ตีความ `$` เป็นตัวแปรแล้วกลืนค่าหายไปเงียบ ๆ
 */
function parseUsers(): Map<string, string> {
  const raw = process.env.DASHBOARD_USERS ?? "";
  const users = new Map<string, string>();

  for (const entry of raw.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf(":");
    if (separator < 1) continue;

    const username = trimmed.slice(0, separator).trim().toLowerCase();
    const hash = trimmed.slice(separator + 1).trim();
    if (username && hash) users.set(username, hash);
  }
  return users;
}

/**
 * ตั้งรหัสผ่านไว้แล้วหรือยัง
 *
 * ถ้ายัง dashboard จะยังเปิดได้ตามเดิมเพื่อไม่ให้การพัฒนาและการสาธิตติดขัด
 * แต่หน้าจอจะขึ้นแถบเตือนสีแดงให้เห็นชัดว่ายังไม่ได้ปิดประตู
 */
export function isAuthConfigured(): boolean {
  return parseUsers().size > 0 && Boolean(process.env.AUTH_SECRET);
}

/** รายชื่อผู้ใช้ที่ตั้งไว้ — ใช้แสดงในหน้าตรวจสอบการตั้งค่าเท่านั้น */
export function configuredUsernames(): string[] {
  return [...parseUsers().keys()].sort();
}

/* ------------------------------------------------------------------ */
/* ตรวจรหัสผ่าน                                                        */
/* ------------------------------------------------------------------ */

/**
 * ตรวจชื่อผู้ใช้กับรหัสผ่าน คืนชื่อผู้ใช้ถ้าถูก
 *
 * รับได้สองรูปแบบ:
 *   `admin:รหัสผ่านตรง ๆ`                → พิมพ์เองใน .env ได้เลย
 *   `admin:pbkdf2.210000.salt.hash`      → ได้จาก scripts/make-user.mjs
 * ผสมกันในค่าเดียวได้ ไม่ต้องเลือกอย่างใดอย่างหนึ่ง
 *
 * ผิดเมื่อไหร่ก็คืน null เหมือนกันหมด ไม่บอกว่าผิดที่ชื่อหรือรหัส
 * เพราะข้อความว่า "ไม่มีชื่อนี้" ทำให้เดาได้ว่าชื่อไหนมีอยู่จริง
 */
export async function verifyPassword(
  username: string,
  password: string,
): Promise<string | null> {
  const clean = username.trim().toLowerCase();
  const stored = parseUsers().get(clean);

  // ไม่มีชื่อนี้ก็ยังเทียบกับค่าหลอกให้ครบขั้นตอน จะได้ไม่ตอบกลับเร็วผิดปกติ
  // จนบอกใบ้ว่าชื่อไหนมีอยู่จริง (หน้า login หน่วงเวลาเมื่อผิดอีกชั้นหนึ่งด้วย)
  const target = stored ?? " ไม่มีผู้ใช้ชื่อนี้ ";

  const ok = await checkStored(password, target);
  return stored && ok ? clean : null;
}

/** เลือกวิธีตรวจตามรูปแบบของค่าที่เก็บไว้ */
async function checkStored(password: string, stored: string): Promise<boolean> {
  // ค่าที่ขึ้นต้นด้วย pbkdf2. คือ hash — นอกนั้นถือเป็นรหัสผ่านที่พิมพ์ไว้ตรง ๆ
  //
  // รองรับแบบพิมพ์ตรง ๆ เพราะกุญแจของ Google ก็อยู่ใน environment เดียวกันนี้
  // ใครที่อ่าน environment ได้ก็เข้าถึงชีตได้อยู่แล้ว การ hash จึงกันได้แค่
  // กรณีเดียวคือรหัสผ่านซ้ำกับที่ใช้ในบริการอื่น — ซึ่งกันได้ด้วยการ
  // ตั้งรหัสไม่ซ้ำกับที่อื่น เอกสารจึงย้ำเรื่องนี้แทนการบังคับให้ hash
  if (stored.startsWith("pbkdf2.")) return checkPbkdf2(password, stored);

  return timingSafeEqualString(password, stored);
}

async function checkPbkdf2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = base64UrlToBytes(parts[2]);
    expected = base64UrlToBytes(parts[3]);
  } catch {
    return false;
  }

  const actual = await derive(password, salt, iterations, expected.length * 8);
  return timingSafeEqual(actual, expected);
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bits: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    bits,
  );
  return new Uint8Array(derived);
}

/* ------------------------------------------------------------------ */
/* session cookie                                                      */
/* ------------------------------------------------------------------ */

/**
 * สร้าง token ที่เซ็นแล้ว
 *
 * เนื้อใน token ไม่ใช่ความลับ (มีแค่ชื่อผู้ใช้กับเวลาหมดอายุ) จึงเซ็นอย่างเดียว
 * ไม่ต้องเข้ารหัส — ลายเซ็นคือสิ่งที่กันไม่ให้ปลอมชื่อผู้ใช้เข้ามา
 */
export async function createSessionToken(
  username: string,
  via: SessionSource = "password",
): Promise<string> {
  const hours = isExternalSource(via) ? LINE_SESSION_HOURS : SESSION_HOURS;
  const session: Session = {
    username,
    expiresAt: Date.now() + hours * 60 * 60 * 1000,
    via,
  };

  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(session)),
  );
  return `${payload}.${await sign(payload)}`;
}

/**
 * ตรวจ token คืน session ถ้าลายเซ็นถูก ยังไม่หมดอายุ และชื่อยังอยู่ในรายชื่อ
 *
 * ที่ต้องเช็กรายชื่อซ้ำอีกครั้งตรงนี้ เพราะ token เก็บชื่อไว้ในตัวเองและมีอายุ 12 ชั่วโมง
 * ถ้าไม่เช็ก คนที่ถูกลบออกจาก DASHBOARD_USERS แล้วจะยังใช้งานต่อได้จนกว่า token จะหมดอายุ
 * ซึ่งขัดกับสิ่งที่คนตั้งค่าคาดหวังตอนลบชื่อออก — ลบแล้วต้องออกทันที
 */
export async function readSessionToken(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = await sign(payload);
  if (!timingSafeEqualString(signature, expected)) return null;

  try {
    const session = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload)),
    ) as Session;

    if (!session.username || typeof session.expiresAt !== "number") return null;
    if (session.expiresAt < Date.now()) return null;

    // ชื่อที่มาจาก LINE/Telegram ไม่ได้อยู่ใน DASHBOARD_USERS และไม่ควรอยู่
    // สิ่งที่ค้ำ session นี้คือลายเซ็น HMAC กับการตรวจสมาชิกภาพกลุ่มตอนออก token
    if (!isExternalSource(session.via) && !parseUsers().has(session.username)) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

async function sign(payload: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("ยังไม่ได้ตั้ง AUTH_SECRET");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

/** ตัวเลือก cookie ที่ใช้ทั้งตอนตั้งและตอนลบ ต้องตรงกันไม่งั้นลบไม่ออก */
export function sessionCookieOptions(via: SessionSource = "password") {
  return {
    httpOnly: true,
    // dev รันบน http:// — ตั้ง secure ตายตัวจะล็อกอินในเครื่องไม่ได้
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: (isExternalSource(via) ? LINE_SESSION_HOURS : SESSION_HOURS) * 60 * 60,
  };
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

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
