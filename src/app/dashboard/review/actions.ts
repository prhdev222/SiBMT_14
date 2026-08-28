"use server";

import { revalidatePath } from "next/cache";
import { saveAdvice } from "@/lib/apps-script-api";
import { requireSession } from "@/lib/session";

/**
 * บันทึกคำตอบของอาจารย์
 *
 * ⚠️ requireSession() อยู่นอก try โดยตั้งใจ — มันทำงานด้วยการ throw redirect
 * ถ้าอยู่ใน try จะถูก catch กลืนแล้วกลายเป็นข้อความ error แทนการเด้งไปหน้า login
 */

export interface AdviceState {
  ok: boolean;
  message: string;
  referralId?: string;
}

export async function saveAdviceAction(
  _previous: AdviceState,
  formData: FormData,
): Promise<AdviceState> {
  // ยังต้องเรียกเพื่อกันคนที่ไม่ได้ล็อกอิน — ชื่อผู้ตอบมาจากช่องที่กรอกเอง
  // ไม่ใช่จาก username เพราะบัญชีอาจใช้ร่วมกันในวอร์ด
  await requireSession();

  const referralId = String(formData.get("referralId") ?? "").trim();
  const advice = String(formData.get("advice") ?? "").trim();
  const status = String(formData.get("status") ?? "Advice Sent").trim();
  const answeredBy = String(formData.get("answeredBy") ?? "").trim();
  const wardPhone = String(formData.get("wardPhone") ?? "").trim();
  const directPhone = String(formData.get("directPhone") ?? "").trim();

  if (!referralId) return { ok: false, message: "ไม่พบเลขที่อ้างอิงของเคส" };
  if (!advice) return { ok: false, message: "กรุณาพิมพ์คำตอบก่อนบันทึก" };
  if (!answeredBy) return { ok: false, message: "กรุณากรอกชื่อผู้ตอบ" };
  // เบอร์วอร์ดบังคับ เพราะเป็นเบอร์เดียวที่รับประกันว่ามีคนรับสาย
  // resident ติดเรียนได้ตลอด แต่พยาบาลที่วอร์ดรับเรื่องไว้ให้ได้เสมอ
  if (!wardPhone) return { ok: false, message: "กรุณากรอกเบอร์วอร์ดเคมีบำบัด" };

  try {
    // ไม่ต่อท้ายชื่อในเนื้อคำตอบแล้ว — มีคอลัมน์ advice_by แยกต่างหาก
    // และอีเมลมีบล็อก "ติดต่อกลับ" ของตัวเอง การใส่ซ้ำทำให้อ่านสับสน
    //
    // username ที่ล็อกอินยังถูกบันทึกใน status_log อยู่ ถ้าวันหลังต้องตรวจสอบว่า
    // ชื่อที่กรอกกับบัญชีที่ใช้ตอบตรงกันหรือไม่ ยังย้อนดูได้
    const result = await saveAdvice({
      referralId,
      advice,
      status,
      answeredBy,
      wardPhone,
      directPhone,
    });

    return {
      ok: true,
      referralId: result.referralId,
      message: result.emailed
        ? `บันทึกคำตอบและส่งอีเมลกลับแพทย์ต้นทางแล้ว`
        : `บันทึกคำตอบแล้ว — แต่เคสนี้ไม่มีอีเมลผู้ส่ง กรุณาโทรแจ้งกลับเอง`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    revalidatePath("/dashboard/review");
  }
}
