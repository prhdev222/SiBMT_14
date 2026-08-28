"use server";

import { revalidatePath } from "next/cache";
import { cancelBooking, rescheduleBooking } from "@/lib/apps-script-api";
import { requireSession } from "@/lib/session";

/**
 * ยกเลิก/เลื่อนนัดแทนแพทย์ต้นทาง สำหรับเจ้าหน้าที่ที่ล็อกอินแล้ว
 *
 * มีไว้เพราะหน้าสาธารณะ /booking ช่วยไม่ได้เมื่อแพทย์หาอีเมลไม่เจอ
 * และจำรหัสอ้างอิงไม่ได้ — ซึ่งมักมาพร้อมกัน เพราะรหัสอยู่ในอีเมลฉบับนั้นเอง
 * เส้นทางจึงเป็น แพทย์โทรมา → เจ้าหน้าที่ยืนยันตัวตนทางโทรศัพท์ → กดให้
 *
 * ⚠️ requireSession() อยู่นอก try โดยตั้งใจ — มันทำงานด้วยการ throw redirect
 * ถ้าอยู่ใน try จะถูก catch กลืนแล้วกลายเป็นข้อความ error แทนการเด้งไปหน้า login
 */

export interface StaffManageState {
  ok: boolean;
  message: string;
}

export async function staffCancelAction(
  _previous: StaffManageState,
  formData: FormData,
): Promise<StaffManageState> {
  const session = await requireSession("/dashboard/appointments");
  const referralId = String(formData.get("referralId") ?? "").trim();

  if (!referralId) return { ok: false, message: "ไม่พบเลขที่อ้างอิงของนัด" };

  try {
    const result = await cancelBooking({
      referralId,
      staffUser: session.username,
    });
    return {
      ok: true,
      message:
        `ยกเลิกนัด ${result.referralId} แล้ว — ` +
        `คิวของ ${result.fellowName} วันที่ ${result.clinicDate} ว่างกลับเข้าปฏิทิน`,
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  } finally {
    revalidatePath("/dashboard/appointments");
  }
}

export async function staffRescheduleAction(
  _previous: StaffManageState,
  formData: FormData,
): Promise<StaffManageState> {
  const session = await requireSession("/dashboard/appointments");
  const referralId = String(formData.get("referralId") ?? "").trim();
  const clinicDate = String(formData.get("clinicDate") ?? "").trim();
  const fellowName = String(formData.get("fellowName") ?? "").trim();

  if (!referralId) return { ok: false, message: "ไม่พบเลขที่อ้างอิงของนัด" };
  if (!clinicDate || !fellowName) {
    return { ok: false, message: "กรุณาเลือกวันนัดใหม่" };
  }

  try {
    const result = await rescheduleBooking({
      referralId,
      staffUser: session.username,
      clinicDate,
      fellowName,
    });
    return {
      ok: true,
      message:
        `เลื่อนนัด ${result.referralId} จาก ${result.previousDate} ` +
        `เป็น ${result.clinicDate} (${result.fellowName}) แล้ว`,
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  } finally {
    revalidatePath("/dashboard/appointments");
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
