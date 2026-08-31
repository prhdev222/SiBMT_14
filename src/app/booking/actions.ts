"use server";

import {
  cancelBooking,
  lookupBooking,
  rescheduleBooking,
  type BookingDetail,
} from "@/lib/apps-script-api";
import { allowBookingLookup } from "@/lib/rate-limit";

/**
 * Server Action ของหน้าจัดการนัด (กลุ่มที่ 1)
 *
 * ⚠️ หน้านี้ไม่ต้องล็อกอิน โดยตั้งใจ — ผู้ใช้คือแพทย์โรงพยาบาลอื่น
 * ที่ไม่มีบัญชีในระบบนี้ การพิสูจน์สิทธิ์จึงอยู่ที่ token หรือเบอร์โทรแทน
 * และตรวจฝั่ง Apps Script ทุกครั้ง ไม่ใช่แค่ตอนเปิดหน้า
 *
 * เหตุผลที่ต้องตรวจซ้ำทุก action ไม่ใช่แค่ตอน lookup: Server Action
 * ถูกยิงด้วย POST ตรง ๆ ได้ ไม่ต้องผ่านหน้าจอที่เพิ่งตรวจไป
 */

export interface ManageState {
  ok: boolean;
  message: string;
  booking?: BookingDetail;
  /**
   * เบอร์ที่ใช้ค้นเจอ — ส่งกลับไปให้หน้าเว็บแนบไปกับคำสั่งยกเลิก/เลื่อนต่อ
   *
   * จำเป็นเพราะเซิร์ฟเวอร์ไม่ได้จำว่าใครค้นอะไรไว้ (ไม่มี session)
   * และ Apps Script ตรวจสิทธิ์ใหม่ทุกคำสั่ง ไม่ใช่เชื่อว่าเคยผ่านมาแล้ว
   *
   * ไม่ใช่ข้อมูลที่รั่ว — เป็นเบอร์ที่ผู้ใช้เพิ่งพิมพ์เข้ามาเอง ส่งกลับไปที่
   * เบราว์เซอร์เดิมเท่านั้น
   */
  phone?: string;
  /** สำเร็จแล้วและไม่ต้องแสดงฟอร์มอีก */
  done?: "cancelled" | "rescheduled";
}

function credentialsFrom(formData: FormData) {
  return {
    referralId: String(formData.get("referralId") ?? "").trim(),
    token: String(formData.get("token") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
  };
}

/** ค้นนัดจากรหัสอ้างอิง + เบอร์โทร (ทางสำหรับคนที่หาอีเมลไม่เจอ) */
export async function findBookingAction(
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  if (!(await allowBookingLookup())) {
    return {
      ok: false,
      message:
        "ค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ " +
        `หากยังไม่ได้ โทร ${CONTACT_PHONE} ในเวลาราชการ`,
    };
  }

  const credentials = credentialsFrom(formData);
  if (!credentials.referralId) {
    return { ok: false, message: "กรุณากรอกเลขที่อ้างอิง" };
  }
  if (!credentials.token && !credentials.phone) {
    return { ok: false, message: "กรุณากรอกเบอร์ติดต่อกลับที่ให้ไว้ตอนจอง" };
  }

  try {
    return {
      ok: true,
      message: "",
      booking: await lookupBooking(credentials),
      phone: credentials.phone,
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

export async function cancelBookingAction(
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  try {
    const result = await cancelBooking(credentialsFrom(formData));
    return {
      ok: true,
      done: "cancelled",
      message:
        `ยกเลิกนัด ${result.referralId} เรียบร้อยแล้ว ` +
        "คิวนี้ว่างกลับเข้าระบบให้แพทย์ท่านอื่นจองต่อได้ทันที",
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

export async function rescheduleBookingAction(
  _previous: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const clinicDate = String(formData.get("clinicDate") ?? "").trim();
  const fellowName = String(formData.get("fellowName") ?? "").trim();

  if (!clinicDate || !fellowName) {
    return { ok: false, message: "กรุณาเลือกวันนัดใหม่" };
  }

  try {
    const result = await rescheduleBooking({
      ...credentialsFrom(formData),
      clinicDate,
      fellowName,
    });
    return {
      ok: true,
      done: "rescheduled",
      message:
        `เลื่อนนัด ${result.referralId} เรียบร้อยแล้ว ` +
        "กรุณาแจ้งผู้ป่วยให้ชัดเจนว่ามาวันใหม่เท่านั้น",
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/** ข้อความจาก Apps Script เขียนให้ผู้ใช้อ่านเข้าใจอยู่แล้ว ส่งต่อได้เลย */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const CONTACT_PHONE = "02-419-7642 หรือ 02-419-7644 ต่อ 101-102";
