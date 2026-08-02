"use server";

import { revalidatePath } from "next/cache";
import * as api from "@/lib/schedule-api";
import { requireSession } from "@/lib/session";

/**
 * Server Actions สำหรับแก้ตารางออกตรวจ fellow
 *
 * ⚠️ ทุกฟังก์ชันต้องเรียก requireSession() เองเป็นบรรทัดแรก
 * Server Action ถูกยิงด้วย POST ตรง ๆ ได้ ไม่ได้ผ่านหน้าจอเท่านั้น
 * การที่ proxy.ts กั้นหน้า /dashboard ไว้แล้วจึงยังไม่พอ — เอกสาร Next
 * ระบุชัดว่า proxy เป็นแค่ด่านคัดกรองหยาบ ๆ ไม่ใช่ระบบ authorization
 *
 * ข้อมูลที่แก้ได้ผ่านทางนี้เป็นตารางเวรของบุคลากรเท่านั้น
 * ไม่มีคำสั่งใดที่แตะข้อมูลผู้ป่วยได้ (ดู apps-script/Api.gs)
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

function toResult(error: unknown): ActionResult {
  return {
    ok: false,
    message: error instanceof Error ? error.message : String(error),
  };
}

export async function addClinicDaysAction(input: {
  fellowName: string;
  startDate: string;
  repeatWeeks: number;
  maxSlots: number;
  note: string;
}): Promise<ActionResult> {
  // นอก try โดยตั้งใจ — requireSession() ทำงานด้วยการ throw redirect
  // ถ้าอยู่ใน try จะถูก catch กลืนแล้วกลายเป็นข้อความ error แทนการเด้งไปหน้า login
  await requireSession();

  try {
    const { added, skipped } = await api.addClinicDays(input);
    revalidatePath("/dashboard/schedule");

    if (added === 0 && skipped > 0) {
      return { ok: true, message: `วันเหล่านี้มีอยู่แล้ว ไม่ได้เพิ่มซ้ำ (${skipped} วัน)` };
    }
    return {
      ok: true,
      message:
        `เพิ่ม ${added} วัน` + (skipped > 0 ? ` (ข้ามที่มีอยู่แล้ว ${skipped} วัน)` : ""),
    };
  } catch (error) {
    return toResult(error);
  }
}

export async function removeClinicDayAction(input: {
  rowNumber: number;
  clinicDate: string;
  fellowName: string;
}): Promise<ActionResult> {
  // นอก try โดยตั้งใจ — requireSession() ทำงานด้วยการ throw redirect
  // ถ้าอยู่ใน try จะถูก catch กลืนแล้วกลายเป็นข้อความ error แทนการเด้งไปหน้า login
  await requireSession();

  try {
    await api.removeClinicDay(input);
    revalidatePath("/dashboard/schedule");
    return { ok: true, message: "ลบวันออกตรวจแล้ว" };
  } catch (error) {
    return toResult(error);
  }
}

export async function addFellowAction(name: string): Promise<ActionResult> {
  // นอก try โดยตั้งใจ — requireSession() ทำงานด้วยการ throw redirect
  // ถ้าอยู่ใน try จะถูก catch กลืนแล้วกลายเป็นข้อความ error แทนการเด้งไปหน้า login
  await requireSession();

  try {
    await api.addFellow(name);
    revalidatePath("/dashboard/schedule");
    return { ok: true, message: `เพิ่ม ${name} แล้ว` };
  } catch (error) {
    return toResult(error);
  }
}

export async function deactivateFellowAction(name: string): Promise<ActionResult> {
  // นอก try โดยตั้งใจ — requireSession() ทำงานด้วยการ throw redirect
  // ถ้าอยู่ใน try จะถูก catch กลืนแล้วกลายเป็นข้อความ error แทนการเด้งไปหน้า login
  await requireSession();

  try {
    await api.deactivateFellow(name);
    revalidatePath("/dashboard/schedule");
    return { ok: true, message: `ปิดการใช้งาน ${name} แล้ว` };
  } catch (error) {
    return toResult(error);
  }
}
