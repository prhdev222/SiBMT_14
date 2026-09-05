"use server";

import {
  closeCaseByToken,
  isBookingConfigured,
  markThreadRead,
  postReferrerMessage,
  reopenCaseByToken,
} from "@/lib/apps-script-api";

const ATTACH_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};
const ATTACH_MAX_BYTES = 10 * 1024 * 1024;

/** แปลงไฟล์เป็น base64 ทีละก้อน (กัน call stack ล้นเมื่อไฟล์ใหญ่) */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * แพทย์ต้นทางส่งข้อความ (+ ไฟล์แนบ) จากหน้า /case/[token]
 *
 * ไม่ต้อง requireSession — case_token 32 ตัวคือสิทธิ์เข้าถึง (โมเดลเดียวกับ
 * ลิงก์อ่านคำตอบ/เลื่อนนัด) Apps Script ตรวจ token ซ้ำก่อนเขียนอยู่แล้ว
 * ส่งไฟล์เป็น File (ไม่แปลง base64 ฝั่ง client) เพื่อไม่ให้เกินลิมิต body
 */
export async function sendReferrerMessageAction(
  caseToken: string,
  text: string,
  file: File | null,
): Promise<{
  ok: boolean;
  error?: string;
  fileUrl?: string;
  fileName?: string;
}> {
  if (!caseToken || (!text.trim() && !file)) {
    return { ok: false, error: "ยังไม่ได้พิมพ์ข้อความหรือแนบไฟล์" };
  }
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }

  let fileBase64 = "";
  let fileName = "";
  let fileMimeType = "";
  if (file) {
    if (!(file.type in ATTACH_TYPES)) {
      return {
        ok: false,
        error: "แนบได้เฉพาะ PDF, Word, Excel หรือรูปภาพ",
      };
    }
    if (file.size > ATTACH_MAX_BYTES) {
      return { ok: false, error: "ไฟล์ใหญ่เกิน 10 MB" };
    }
    fileBase64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    fileName = file.name;
    fileMimeType = file.type;
  }

  try {
    const r = await postReferrerMessage({
      caseToken,
      text: text.trim(),
      fileBase64,
      fileName,
      fileMimeType,
    });
    return { ok: true, fileUrl: r.fileUrl, fileName: r.fileName };
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
