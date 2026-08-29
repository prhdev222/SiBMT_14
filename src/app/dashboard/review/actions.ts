"use server";

import { revalidatePath } from "next/cache";
import { saveAdvice } from "@/lib/apps-script-api";
import { loadAttendings } from "@/lib/referral-repository";
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

/**
 * ชนิดไฟล์ที่แนบได้ — ต้องตรงกับ ATTACHMENT.allowedMimeTypes ใน apps-script/Config.gs
 *
 * จำกัดไว้เพราะไฟล์จะถูกตั้งเป็น "ผู้ที่มีลิงก์ → ผู้อ่าน" บน Drive
 * ยิ่งรับชนิดไฟล์กว้าง ยิ่งเสี่ยงมีคนอัปโหลดสิ่งที่ไม่ควรเปิดสาธารณะ
 */
const ALLOWED_ATTACHMENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * แปลงไฟล์เป็น base64
 *
 * ทยอยทีละก้อน ไม่ใช้ String.fromCharCode(...bytes) รวดเดียว
 * เพราะการ spread อาร์เรย์ขนาดหลายล้านตัวจะทำให้ call stack ล้น
 * — ไฟล์ 10 MB พังแน่นอน ส่วนไฟล์เล็กที่ใช้ทดสอบจะผ่านได้ ทำให้ไม่เจอตอนพัฒนา
 */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
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
  const attending = String(formData.get("attending") ?? "").trim();
  const approved = formData.get("attendingApproved") === "on";
  const visitDate = String(formData.get("visitDate") ?? "").trim();
  const visitTime = String(formData.get("visitTime") ?? "").trim();
  const visitDoctor = String(formData.get("visitDoctor") ?? "").trim();

  if (!referralId) return { ok: false, message: "ไม่พบเลขที่อ้างอิงของเคส" };
  if (!advice) return { ok: false, message: "กรุณาพิมพ์คำตอบก่อนบันทึก" };
  if (!answeredBy) return { ok: false, message: "กรุณากรอกชื่อผู้ตอบ" };
  // เบอร์วอร์ดบังคับ เพราะเป็นเบอร์เดียวที่รับประกันว่ามีคนรับสาย
  // resident ติดเรียนได้ตลอด แต่พยาบาลที่วอร์ดรับเรื่องไว้ให้ได้เสมอ
  if (!wardPhone) return { ok: false, message: "กรุณากรอกเบอร์วอร์ดเคมีบำบัด" };
  if (!attending)
    return { ok: false, message: "กรุณาระบุอาจารย์ผู้ให้คำปรึกษา" };
  // ประตูบานเดียวที่กั้นไม่ให้คำตอบออกไปโดยยังไม่ผ่านอาจารย์
  // ตรวจซ้ำที่เซิร์ฟเวอร์เพราะ required ใน HTML ปิดได้ด้วย devtools
  if (!approved)
    return {
      ok: false,
      message: "ต้องยืนยันว่าอาจารย์ให้ความเห็นแล้วก่อนส่งคำตอบ",
    };

  // ชื่อที่ไม่อยู่ในรายชื่ออาจารย์ทำให้คำรับรองไร้ความหมาย — ตรวจที่เซิร์ฟเวอร์
  // ข้ามการตรวจเมื่อแท็บยังว่าง เพราะตอนนั้นฟอร์มให้พิมพ์ชื่อเอง
  const attendings = await loadAttendings();
  if (attendings.length > 0 && !attendings.includes(attending)) {
    return {
      ok: false,
      message: `ไม่พบชื่อ "${attending}" ในรายชื่ออาจารย์ กรุณาโหลดหน้าใหม่`,
    };
  }

  // เลือกนัดตรวจแล้วต้องกรอกให้ครบทั้งสามช่อง — ครึ่ง ๆ กลาง ๆ ใช้ไม่ได้
  // แพทย์ต้นทางต้องคัดลอกบรรทัดนี้ไปเขียนบนหัวกระดาษใบ refer
  // ถ้าขาดข้อใดข้อหนึ่ง ธุรการ OPD 700 จะคัดกรองผู้ป่วยรายนี้ไม่ได้
  if (status === "Readiness Visit Scheduled") {
    if (!visitDate || !visitTime || !visitDoctor) {
      return {
        ok: false,
        message: "กรุณากรอกวันที่ เวลา และชื่อแพทย์ที่นัดให้ครบ",
      };
    }
  }

  // ตรวจไฟล์ที่ฝั่งเซิร์ฟเวอร์ด้วย — accept กับ maxlength ในฟอร์มเป็นแค่ตัวช่วย
  // ผู้ใช้ปิดได้ด้วย devtools และเราจะเอาไฟล์นี้ไปเปิดสาธารณะบน Drive
  let fileName = "";
  let fileMimeType = "";
  let fileBase64 = "";

  const upload = formData.get("attachment");
  if (upload instanceof File && upload.size > 0) {
    if (!(upload.type in ALLOWED_ATTACHMENT_TYPES)) {
      return {
        ok: false,
        message: `แนบไฟล์ชนิดนี้ไม่ได้ — รับเฉพาะ ${Object.values(
          ALLOWED_ATTACHMENT_TYPES,
        ).join(", ")}`,
      };
    }
    if (upload.size > MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        message: `ไฟล์ใหญ่ ${(upload.size / 1024 / 1024).toFixed(1)} MB เกินเพดาน 10 MB`,
      };
    }

    fileName = upload.name;
    fileMimeType = upload.type;
    fileBase64 = toBase64(new Uint8Array(await upload.arrayBuffer()));
  }

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
      fileName,
      fileMimeType,
      fileBase64,
      attending,
      // ส่งเฉพาะเมื่อเลือกสถานะนัดตรวจ — สถานะอื่นกรอกช่องนี้ไว้ก็ไม่นับ
      visitDate: status === "Readiness Visit Scheduled" ? visitDate : "",
      visitTime: status === "Readiness Visit Scheduled" ? visitTime : "",
      visitDoctor: status === "Readiness Visit Scheduled" ? visitDoctor : "",
    });

    // บอกให้ชัดว่าไฟล์ไปด้วยหรือไม่ — ถ้าเงียบไว้ resident จะไม่รู้ว่าลืมแนบ
    // จนกว่าแพทย์ต้นทางจะโทรมาถาม ซึ่งสายเกินแก้แล้วเพราะแก้คำตอบเดิมไม่ได้
    const withFile = result.fileUrl ? " (แนบไฟล์ไปด้วยแล้ว)" : "";

    return {
      ok: true,
      referralId: result.referralId,
      message: result.emailed
        ? `บันทึกคำตอบและส่งอีเมลกลับแพทย์ต้นทางแล้ว${withFile}`
        : `บันทึกคำตอบแล้ว${withFile} — แต่เคสนี้ไม่มีอีเมลผู้ส่ง กรุณาโทรแจ้งกลับเอง`,
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
