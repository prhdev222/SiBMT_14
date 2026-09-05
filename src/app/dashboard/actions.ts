"use server";

/**
 * Server Actions ของหน้า dashboard หลัก
 *
 * ⚠️ ทุก action ต้องเรียก requireSession() เอง — ไม่มี proxy คอยกันให้
 * (เหตุผลเดียวกับหมายเหตุใน src/lib/session.ts)
 */

import { requireSession } from "@/lib/session";
import {
  isBookingConfigured,
  updateAssignedTo,
  updateStatus,
} from "@/lib/apps-script-api";
import type { Status } from "@/lib/referral-types";

/**
 * เปลี่ยนผู้รับผิดชอบเคสจาก dropdown — ค่าว่าง = ยกเลิกมอบหมาย
 *
 * ข้อความ error จาก Apps Script ส่งต่อได้ตรง ๆ เพราะเป็นเส้นทางหลังบ้าน
 * ที่ล็อกอินแล้ว และข้อความถูกออกแบบให้บอกวิธีแก้ (เช่น ชื่อไม่อยู่ในชีต)
 */
export async function updateAssignedToAction(
  referralId: string,
  assignedTo: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSession();

  const id = referralId.trim();
  if (!id) return { ok: false, error: "ไม่พบเลขที่อ้างอิงของเคส" };

  if (!isBookingConfigured()) {
    return {
      ok: false,
      error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script จึงบันทึกไม่ได้",
    };
  }

  try {
    await updateAssignedTo({ referralId: id, assignedTo: assignedTo.trim() });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
}

/**
 * ปิดเคส / เปิดเคสกลับ — ปุ่มบน dashboard
 *
 * ปิดเคส = ตั้งสถานะ "Closed" แล้วเคสจะหายจากลิสต์หลัก (เห็นได้เมื่อกดดูเคสที่ปิดแล้ว)
 * เปิดกลับ = คืนสถานะที่เหมาะสม ให้ผู้ใช้ส่ง targetStatus มาเอง
 */
export async function updateStatusAction(
  referralId: string,
  status: Status,
): Promise<{ ok: boolean; error?: string }> {
  await requireSession();

  const id = referralId.trim();
  if (!id) return { ok: false, error: "ไม่พบเลขที่อ้างอิงของเคส" };

  if (!isBookingConfigured()) {
    return {
      ok: false,
      error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script จึงบันทึกไม่ได้",
    };
  }

  try {
    await updateStatus({ referralId: id, status });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
}
