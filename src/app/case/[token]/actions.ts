"use server";

import {
  closeCaseByToken,
  isBookingConfigured,
  markThreadRead,
  postReferrerMessage,
  reopenCaseByToken,
} from "@/lib/apps-script-api";

/**
 * แพทย์ต้นทางส่งข้อความจากหน้า /case/[token]
 *
 * ไม่ต้อง requireSession — case_token 32 ตัวคือสิทธิ์เข้าถึง (โมเดลเดียวกับ
 * ลิงก์อ่านคำตอบ/เลื่อนนัด) Apps Script ตรวจ token ซ้ำก่อนเขียนอยู่แล้ว
 */
export async function sendReferrerMessageAction(
  caseToken: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!caseToken || !text.trim()) {
    return { ok: false, error: "ยังไม่ได้พิมพ์ข้อความ" };
  }
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }
  try {
    await postReferrerMessage({ caseToken, text: text.trim() });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "ส่งไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

/** ล้างธง unread ของแพทย์ต้นทางเมื่อเปิดอ่าน — เขียนฟรี ไม่กระทบโควตา push */
export async function markReadReferrerAction(caseToken: string): Promise<void> {
  if (!caseToken || !isBookingConfigured()) return;
  try {
    await markThreadRead({ side: "referrer", caseToken });
  } catch {
    // อ่าน thread ได้อยู่แล้ว การล้างธงไม่สำเร็จไม่ใช่เรื่องคอขาดบาดตาย
  }
}

/** แพทย์ต้นทางกดจบเคสเอง (อ่านคำแนะนำแล้วดูแลต่อได้เอง) */
export async function closeCaseAction(
  caseToken: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!caseToken) return { ok: false, error: "ลิงก์ไม่ถูกต้อง" };
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }
  try {
    await closeCaseByToken({ caseToken });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "จบเคสไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

/** แพทย์ต้นทางเปิดเคสที่ปิดไปแล้วกลับมาถามเพิ่ม */
export async function reopenCaseAction(
  caseToken: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!caseToken) return { ok: false, error: "ลิงก์ไม่ถูกต้อง" };
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }
  try {
    await reopenCaseByToken({ caseToken });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "เปิดเคสไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}
