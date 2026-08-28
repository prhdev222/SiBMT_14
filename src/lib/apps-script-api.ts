/**
 * เรียก Apps Script เพื่อ "เขียน" ลงไฟล์ข้อมูลผู้ป่วย
 *
 * ต่างจาก schedule-store.ts ที่เขียนไฟล์ตารางเวรตรง ๆ — การจองต้องผ่าน Apps Script
 * ด้วยเหตุผลสองข้อ
 *
 * 1. แถวเคสอยู่ในชีต referrals ซึ่งอยู่ในไฟล์ข้อมูลผู้ป่วย เว็บมีสิทธิ์อ่านอย่างเดียว
 *    และต้องเป็นแบบนั้นต่อไป
 * 2. สำคัญกว่านั้น — Apps Script มี LockService ทำให้ "ตรวจว่าคิวยังว่าง" กับ
 *    "เขียนแถว" เกิดในจังหวะเดียว สองคนกดจองคิวสุดท้ายพร้อมกันจึงไม่ได้ทั้งคู่
 *    Sheets API เปล่า ๆ ทำแบบนี้ไม่ได้ จะจองเกินโควตาแบบเงียบ ๆ
 *
 * ช้ากว่าเขียนตรง (1–10 วินาที) แต่จองเกิดครั้งเดียวต่อเคส จึงยอมรับได้
 *
 * ⚠️ server-only — token อยู่ใน environment ห้ามเรียกจาก client component
 */

/**
 * อ่านค่าตอนถูกเรียก ไม่ใช่ตอนโหลดโมดูล
 *
 * บน Cloudflare Workers ค่า environment มาพร้อมกับ request ไม่ได้อยู่ตั้งแต่
 * ตอนสร้าง isolate การอ่านไว้เป็น const ที่ระดับบนสุดจะได้ undefined ค้างไว้
 * ตลอดอายุ isolate แล้วหน้าเว็บจะขึ้นว่า "ยังไม่ได้ตั้งค่า BOOKING_API_URL"
 * ทั้งที่ตั้ง secret ไว้เรียบร้อย — และแก้ด้วยการ deploy ใหม่ก็ไม่หาย
 */
function credentials() {
  return {
    url: process.env.BOOKING_API_URL,
    token: process.env.BOOKING_API_TOKEN,
  };
}

export function isBookingConfigured(): boolean {
  const { url, token } = credentials();
  return Boolean(url && token);
}

export interface BookingInput {
  clinicDate: string;
  fellowName: string;
  referrerOrg: string;
  referrerName: string;
  referrerPhone: string;
  referrerEmail: string;
  diseaseGroup: string;
  diagnosis: string;
  patientAge: string;
  patientSex: string;
  note: string;
}

export interface BookingResult {
  referralId: string;
  clinicDate: string;
  fellowName: string;
  remainingAfter: number;
  /** ใช้ทำลิงก์จัดการนัดบนหน้ายืนยัน — ดู apps-script/ManageBooking.gs */
  manageToken: string;
}

export async function bookTransplantSlot(
  payload: BookingInput,
): Promise<BookingResult> {
  return callAppsScript("bookTransplantSlot", payload);
}

export interface AdviceInput {
  referralId: string;
  advice: string;
  status: string;
}

export interface AdviceResult {
  referralId: string;
  status: string;
  /** false = เคสไม่มีอีเมลผู้ส่ง หรือส่งไม่สำเร็จ ต้องแจ้งกลับเอง */
  emailed: boolean;
}

export async function saveAdvice(payload: AdviceInput): Promise<AdviceResult> {
  return callAppsScript("saveAdvice", payload);
}

async function callAppsScript<T>(
  action: string,
  payload: unknown,
): Promise<T> {
  const { url, token } = credentials();

  if (!url || !token) {
    throw new Error(
      "ระบบจองคิวยังไม่พร้อมใช้งาน กรุณาโทรติดต่อเจ้าหน้าที่",
    );
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token, payload }),
      // Apps Script ตอบด้วย 302 ไปยัง googleusercontent ก่อนเสมอ
      redirect: "follow",
      cache: "no-store",
    });
  } catch (error) {
    // แพทย์ต้นทางไม่ควรเห็น error ดิบ แต่ถ้าไม่บันทึกไว้เลยก็หาสาเหตุไม่ได้
    // — ครั้งแรกที่หน้านี้พังจริง ข้อความที่แสดงบอกแค่ว่า "ติดต่อไม่สำเร็จ"
    // ทั้งที่สาเหตุจริงอยู่ในตัว error ที่ถูกโยนทิ้งไป
    const cause = (error as { cause?: { errors?: unknown[] } }).cause;
    const detail = (cause?.errors ?? [cause]).map((e) => {
      const x = e as { code?: string; address?: string; port?: number };
      return `${x?.code ?? "?"} ${x?.address ?? ""}:${x?.port ?? ""}`;
    });
    console.error("[booking] เรียก Apps Script ไม่สำเร็จ:", detail.join(" | "));

    throw new Error(
      "ติดต่อระบบจองคิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือโทรติดต่อเจ้าหน้าที่",
    );
  }

  if (!response.ok) {
    throw new Error(`จองคิวไม่สำเร็จ (${response.status}) กรุณาลองใหม่อีกครั้ง`);
  }

  const result = (await response.json().catch(() => {
    throw new Error("ระบบจองคิวตอบกลับผิดรูปแบบ กรุณาโทรติดต่อเจ้าหน้าที่");
  })) as { ok: boolean; data?: T; error?: string };

  // ข้อความ error จาก Apps Script เขียนไว้ให้ผู้ใช้อ่านเข้าใจแล้ว เช่น "คิวเต็มแล้ว"
  if (!result.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");

  return result.data as T;
}

/* ------------------------------------------------------------------ */
/* จัดการนัดกลุ่มที่ 1 โดยแพทย์ต้นทางเอง                                 */
/* ------------------------------------------------------------------ */

/**
 * ข้อมูลพิสูจน์ว่าเป็นเจ้าของนัด — ส่ง token หรือ phone อย่างน้อยหนึ่งอย่าง
 *
 * token มาจากลิงก์ในอีเมล ส่วน phone คือเบอร์ที่กรอกไว้ตอนจอง
 * สำหรับคนที่หาอีเมลไม่เจอ (ดู apps-script/ManageBooking.gs)
 */
export interface BookingCredentials {
  referralId: string;
  token?: string;
  phone?: string;
}

export interface BookingDetail {
  referralId: string;
  status: string;
  clinicDate: string;
  fellowName: string;
  referrerOrg: string;
  diagnosis: string;
  /** ยังแก้ไขได้ไหม — false เมื่อถึงวันนัดแล้วหรือสถานะไม่ใช่ยืนยันนัด */
  canChange: boolean;
}

export async function lookupBooking(
  credentials: BookingCredentials,
): Promise<BookingDetail> {
  return callAppsScript("lookupBooking", credentials);
}

export interface CancelResult {
  referralId: string;
  clinicDate: string;
  fellowName: string;
}

export async function cancelBooking(
  credentials: BookingCredentials,
): Promise<CancelResult> {
  return callAppsScript("cancelBooking", credentials);
}

export interface RescheduleResult {
  referralId: string;
  clinicDate: string;
  fellowName: string;
  previousDate: string;
  previousFellow: string;
}

export async function rescheduleBooking(
  input: BookingCredentials & { clinicDate: string; fellowName: string },
): Promise<RescheduleResult> {
  return callAppsScript("rescheduleBooking", input);
}
