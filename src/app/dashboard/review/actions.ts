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
  const session = await requireSession();

  const referralId = String(formData.get("referralId") ?? "").trim();
  const advice = String(formData.get("advice") ?? "").trim();
  const status = String(formData.get("status") ?? "Advice Sent").trim();

  if (!referralId) return { ok: false, message: "ไม่พบเลขที่อ้างอิงของเคส" };
  if (!advice) return { ok: false, message: "กรุณาพิมพ์คำตอบก่อนบันทึก" };

  try {
    // ต่อท้ายคำตอบด้วยชื่อผู้ตอบ — ชีตไม่มีคอลัมน์ผู้ตอบ และการรู้ว่าใครตอบ
    // สำคัญกว่าความสวยงามของข้อความเมื่อต้องย้อนกลับมาดูทีหลัง
    const signed = `${advice}\n\n— ตอบโดย ${session.username}`;

    const result = await saveAdvice({ referralId, advice: signed, status });

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
