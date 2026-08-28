"use server";

import { bookTransplantSlot, type BookingInput } from "@/lib/apps-script-api";
import { DISEASE_GROUPS } from "@/lib/referral-types";

/**
 * Server Action สำหรับจองคิวกลุ่มที่ 1
 *
 * ⚠️ หน้านี้เปิดให้แพทย์ต้นทางใช้โดยไม่ต้องล็อกอิน จึงไม่มี requireSession()
 * ต่างจาก Server Action ของ dashboard — ตัวกั้นของหน้านี้คือการเข้าถึงผ่าน
 * เมนู LINE OA เท่านั้น (ดู docs/GROUP1_BOOKING_OPTIONS.md)
 *
 * ทุกค่าที่รับเข้ามาต้องตรวจซ้ำที่นี่ ไม่เชื่อฝั่งหน้าจอ เพราะ Server Action
 * ถูกยิงด้วย POST ตรง ๆ ได้โดยไม่ผ่านหน้าจอเลย
 */

export interface BookingState {
  ok: boolean;
  message: string;
  referralId?: string;
  clinicDate?: string;
  fellowName?: string;
  /** ใช้ทำลิงก์จัดการนัดบนหน้ายืนยัน — ลิงก์เดียวกับที่ส่งไปในอีเมล */
  manageToken?: string;
}

const MAX_LENGTH = 200;

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().slice(0, MAX_LENGTH);
}

export async function bookAction(
  _previous: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const input: BookingInput = {
    clinicDate: clean(formData.get("clinicDate")),
    fellowName: clean(formData.get("fellowName")),
    referrerOrg: clean(formData.get("referrerOrg")),
    referrerName: clean(formData.get("referrerName")),
    referrerPhone: clean(formData.get("referrerPhone")),
    referrerEmail: clean(formData.get("referrerEmail")),
    diseaseGroup: clean(formData.get("diseaseGroup")),
    diagnosis: clean(formData.get("diagnosis")),
    patientAge: clean(formData.get("patientAge")),
    patientSex: clean(formData.get("patientSex")),
    note: clean(formData.get("note")),
    transplantIndication: clean(formData.get("transplantIndication")),
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.clinicDate) || !input.fellowName) {
    return { ok: false, message: "ยังไม่ได้เลือกวันนัดและแพทย์" };
  }

  const missing = [
    !input.referrerOrg && "โรงพยาบาลต้นทาง",
    !input.referrerName && "ชื่อแพทย์ผู้ส่ง",
    !input.referrerPhone && "เบอร์ติดต่อ",
    !input.diagnosis && "การวินิจฉัย",
    !input.patientAge && "อายุผู้ป่วย",
  ].filter(Boolean);

  if (missing.length > 0) {
    return { ok: false, message: `กรุณากรอก: ${missing.join(", ")}` };
  }

  if (!(DISEASE_GROUPS as readonly string[]).includes(input.diseaseGroup)) {
    return { ok: false, message: "กรุณาเลือกกลุ่มโรค" };
  }

  if (formData.get("consent") !== "on") {
    return {
      ok: false,
      message: "กรุณายืนยันว่าได้แจ้งผู้ป่วยและให้ลงนามรับทราบเรียบร้อยแล้ว",
    };
  }

  try {
    const result = await bookTransplantSlot(input);
    return {
      ok: true,
      message: "จองคิวเรียบร้อยแล้ว",
      referralId: result.referralId,
      clinicDate: result.clinicDate,
      fellowName: result.fellowName,
      manageToken: result.manageToken,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
