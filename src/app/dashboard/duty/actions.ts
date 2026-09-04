"use server";

/**
 * Server Actions ของหน้าเวร Chief resident
 *
 * ⚠️ ทุก action ต้องเรียก requireSession() เอง — ไม่มี proxy คอยกันให้
 * การเขียนตารางเวรวิ่งผ่าน Apps Script เพราะเว็บเป็น Viewer บนไฟล์หลัก
 */

import { requireSession } from "@/lib/session";
import {
  deleteResidentShift,
  isBookingConfigured,
  saveResidentShift,
  syncResidentSchedule,
} from "@/lib/apps-script-api";

const DEMO_ERROR = "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script จึงบันทึกไม่ได้";

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

/** ดึงตารางเวรจาก HSOS ทับชีตทันที — เขียนทับช่วงเวรที่แก้มือทั้งหมด */
export async function syncFromHsosAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  await requireSession();
  if (!isBookingConfigured()) return { ok: false, error: DEMO_ERROR };

  try {
    await syncResidentSchedule();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function saveShiftAction(payload: {
  originalFrom: string;
  originalTo: string;
  originalName: string;
  fromDate: string;
  toDate: string;
  residentName: string;
}): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  if (!isBookingConfigured()) return { ok: false, error: DEMO_ERROR };

  try {
    await saveResidentShift(payload);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function deleteShiftAction(payload: {
  fromDate: string;
  toDate: string;
  residentName: string;
}): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  if (!isBookingConfigured()) return { ok: false, error: DEMO_ERROR };

  try {
    await deleteResidentShift(payload);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}
