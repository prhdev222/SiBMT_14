/**
 * จองคิว fellow ให้เคสกลุ่มที่ 1
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

const API_URL = process.env.BOOKING_API_URL;
const API_TOKEN = process.env.BOOKING_API_TOKEN;

export function isBookingConfigured(): boolean {
  return Boolean(API_URL && API_TOKEN);
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
}

export async function bookTransplantSlot(
  payload: BookingInput,
): Promise<BookingResult> {
  if (!API_URL || !API_TOKEN) {
    throw new Error(
      "ระบบจองคิวยังไม่พร้อมใช้งาน กรุณาโทรติดต่อเจ้าหน้าที่",
    );
  }

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bookTransplantSlot",
        token: API_TOKEN,
        payload,
      }),
      // Apps Script ตอบด้วย 302 ไปยัง googleusercontent ก่อนเสมอ
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "ติดต่อระบบจองคิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือโทรติดต่อเจ้าหน้าที่",
    );
  }

  if (!response.ok) {
    throw new Error(`จองคิวไม่สำเร็จ (${response.status}) กรุณาลองใหม่อีกครั้ง`);
  }

  const result = (await response.json().catch(() => {
    throw new Error("ระบบจองคิวตอบกลับผิดรูปแบบ กรุณาโทรติดต่อเจ้าหน้าที่");
  })) as { ok: boolean; data?: BookingResult; error?: string };

  // ข้อความ error จาก Apps Script เขียนไว้ให้ผู้ใช้อ่านเข้าใจแล้ว เช่น "คิวเต็มแล้ว"
  if (!result.ok) throw new Error(result.error || "จองคิวไม่สำเร็จ");

  return result.data as BookingResult;
}
