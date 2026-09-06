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
  markThreadRead,
  postDentMessage,
  updateAssignedTo,
  updateStatus,
} from "@/lib/apps-script-api";
import { loadMessages, type CaseMessage } from "@/lib/referral-repository";
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

/* ------------------------------------------------------------------ */
/* บทสนทนาต่อเนื่องต่อเคส (ฝั่ง dent บน dashboard)                       */
/* ------------------------------------------------------------------ */

/** โหลดข้อความของเคส — เรียกตอนเปิดกล่องรายละเอียด (lazy) */
export async function loadMessagesAction(
  referralId: string,
): Promise<CaseMessage[]> {
  await requireSession();
  const id = referralId.trim();
  if (!id) return [];
  return loadMessages(id);
}

/** dent ส่งข้อความในเคส */
export async function postDentMessageAction(
  referralId: string,
  text: string,
  senderName: string,
  notifyChannel: "chat" | "email" | "line" = "email",
): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  const id = referralId.trim();
  if (!id) return { ok: false, error: "ไม่พบเลขที่อ้างอิงของเคส" };
  if (!text.trim()) return { ok: false, error: "ยังไม่ได้พิมพ์ข้อความ" };
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }
  try {
    await postDentMessage({
      referralId: id,
      text: text.trim(),
      senderName: senderName.trim(),
      notifyChannel,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "ส่งไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

/** ล้างธง unread ฝั่ง dent เมื่อเปิดอ่าน thread */
export async function markReadDentAction(referralId: string): Promise<void> {
  await requireSession();
  const id = referralId.trim();
  if (!id || !isBookingConfigured()) return;
  try {
    await markThreadRead({ side: "dent", referralId: id });
  } catch {
    // ล้างธงไม่สำเร็จไม่ใช่เรื่องคอขาดบาดตาย
  }
}
