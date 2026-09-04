"use server";

/**
 * Server Actions ของหน้า dashboard หลัก
 *
 * ⚠️ ทุก action ต้องเรียก requireSession() เอง — ไม่มี proxy คอยกันให้
 * (เหตุผลเดียวกับหมายเหตุใน src/lib/session.ts)
 */

import { requireSession } from "@/lib/session";
import { isBookingConfigured, updateAssignedTo } from "@/lib/apps-script-api";

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
