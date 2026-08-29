"use server";

import { contactAdmin } from "@/lib/apps-script-api";
import { allowAdminContact } from "@/lib/rate-limit";

export interface ContactState {
  ok: boolean;
  message: string;
}

/** ยาวกว่านี้ LINE จะตัดทิ้งอยู่ดี และคำถามคลินิกยาว ๆ ควรไปกลุ่มที่ 2 */
const MAX_MESSAGE_CHARS = 1500;

export async function contactAdminAction(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // endpoint สาธารณะที่ push เข้า LINE ของทีม — ต้องกันสแปมก่อนทำอย่างอื่น
  if (!(await allowAdminContact())) {
    return {
      ok: false,
      message: "ส่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const org = String(formData.get("org") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const referralId = String(formData.get("referralId") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name) return { ok: false, message: "กรุณากรอกชื่อผู้ติดต่อ" };
  if (!org) return { ok: false, message: "กรุณากรอกโรงพยาบาลต้นทาง" };
  if (!contact)
    return { ok: false, message: "กรุณากรอกเบอร์หรืออีเมลให้ติดต่อกลับ" };
  if (!message) return { ok: false, message: "กรุณาพิมพ์ข้อความ" };
  if (message.length > MAX_MESSAGE_CHARS) {
    return {
      ok: false,
      message: `ข้อความยาวเกิน ${MAX_MESSAGE_CHARS} ตัวอักษร — หากเป็นคำถามทางคลินิก กรุณาส่งผ่านกลุ่มที่ 2 แทน`,
    };
  }

  try {
    await contactAdmin({ name, org, contact, referralId, message });
    return {
      ok: true,
      message:
        "ส่งข้อความถึงแพทย์แอดมินกลางแล้ว — จะมีผู้ติดต่อกลับตามช่องทางที่ท่านให้ไว้",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
