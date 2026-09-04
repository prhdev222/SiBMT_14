/**
 * นิยามเมนู/ข้อความของ Hemato Bot — แยกจาก HematoBotWidget.tsx โดยตั้งใจ
 * เพื่อให้แก้ถ้อยคำ/ลำดับเมนูได้โดยไม่ต้องแตะ state machine หรือ logic เรียก action
 *
 * ⚠️ ลำดับ MAIN_MENU_CHIPS อ้างอิงตาม task brief ตรง ๆ (เช็กสถานะ → เคสของฉัน →
 * อ่านคำตอบ → จองนัด → เลื่อน/ยกเลิกนัด → สูตรเคมี → transplant indication →
 * กลุ่ม 4/ติดต่อแอดมิน) ห้ามสลับโดยไม่คุยกับทีมออกแบบก่อน เพราะเรียงตาม
 * ความถี่การใช้งานจริงที่พบใน LINE OA
 */

import { LINE_OA } from "@/lib/config";
import {
  INDICATIONS_BY_TYPE,
  TRANSPLANT_TYPE_LABEL_TH,
  findIndication,
  type TransplantType,
} from "@/lib/transplant-indications";

/** ทุก step ที่ widget รู้จัก — answers.entry/phone/code/list (Task 9) และ
 * regimens.ask/result, indications.type/disease (Task 10) มี logic จริงแล้ว
 */
export type BotStep =
  | "menu"
  | "status.ask"
  | "status.result"
  | "cases.ask"
  | "cases.result"
  | "answers.entry"
  | "answers.phone"
  | "answers.code"
  | "answers.list"
  | "regimens.ask"
  | "regimens.result"
  | "indications.type"
  | "indications.disease"
  | "docs.ask"
  | "docs.list"
  | "booking"
  | "reschedule"
  | "group4"
  | "contact";

export interface BotChip {
  label: string;
  /** ปุ่มเปลี่ยน step ปกติ — ไม่ตั้งคู่กับ resendReferralId/query/transplantType/indicationId */
  go?: BotStep;
  /**
   * ถ้ามีค่า chip นี้เรียก listDocumentsAction ด้วยเลขกลุ่ม (null = ทั้งหมด)
   * — ใช้เฉพาะปุ่มเลือกหมวดใน docs.ask
   */
  docGroup?: 1 | 2 | 3 | null;
  /**
   * ถ้ามีค่า แปลว่า chip นี้ไม่เปลี่ยน step แต่เรียก resendAnswerAction(referralId)
   * แทน — ใช้เฉพาะปุ่ม "ส่งสำเนาเข้าอีเมลเดิม" ใน answers.list (ต่อ 1 เคส)
   */
  resendReferralId?: string;
  /**
   * chip กลุ่มโรคเด่นใน regimens.ask — กดแล้วค้นด้วยคำนี้ทันที (เรียก
   * searchRegimensAction(query) แล้วไป regimens.result เอง) ไม่ใช่แค่เปลี่ยน step เฉย ๆ
   */
  query?: string;
  /** chip เลือกประเภทปลูกถ่ายใน indications.type — พาไป indications.disease
   * พร้อม chips เฉพาะโรคของประเภทนั้น */
  transplantType?: TransplantType;
  /** chip เลือกโรคใน indications.disease — โชว์ bubble เกณฑ์ของโรคนั้นทันที
   * (id อ้างอิง TransplantIndication.id ใน src/lib/transplant-indications.ts) */
  indicationId?: string;
}

export interface BotLink {
  label: string;
  href: string;
  /**
   * true = ปลายทางข้ามโดเมนจริง (เช่น LINE OA) — เปิดแท็บใหม่ด้วย
   * <a target="_blank" rel="noopener noreferrer"> แทน next/link
   */
  external?: boolean;
  /**
   * true = ใช้ <a> ธรรมดา (แท็บเดิม) แทน next/link — สำหรับลิงก์ไป route handler
   * ที่ redirect ต่อเอง เช่น /hemato-bot/line ที่เด้งไป LINE OAuth แล้ววกกลับมาเอง
   * next/link จะ fetch แบบ RSC ก่อนคลิก ซึ่งพังเมื่อปลายทาง redirect ข้ามโดเมน —
   * ดูตัวอย่างเดียวกันที่ src/app/login/page.tsx (ปุ่ม "เข้าสู่ระบบด้วย LINE")
   */
  hardNavigation?: boolean;
}

/** แถวย่อยในบับเบิลเดียว — primary ตัวหนา + secondary ตัวรอง (ใช้กับรายการสูตรยา
 * ใน regimens.result: abbr เป็น primary, components เป็น secondary) */
export interface BotMessageItem {
  primary: string;
  secondary?: string;
}

export interface BotMessage {
  from: "bot" | "user";
  text: string;
  chips?: BotChip[];
  links?: BotLink[];
  /**
   * true = แสดง chips/links ได้แม้ไม่ใช่ข้อความล่าสุด — ปกติ widget โชว์ chips
   * เฉพาะข้อความสุดท้ายเพื่อกันปุ่มค้าง แต่ answers.list ต้องมีหลายเคสพร้อมกัน
   * แต่ละเคสมีลิงก์/ปุ่มของตัวเอง จึงต้องคงไว้ทุกอันพร้อมกันไม่ใช่แค่อันสุดท้าย
   */
  sticky?: boolean;
  /** รายการย่อยแสดงต่อจาก text ในบับเบิลเดียวกัน — ดู BotMessageItem */
  items?: BotMessageItem[];
  /** ข้อความปิดท้ายบับเบิลเดียวกัน ต่อจาก items — ใช้กับ regimens.result เพื่อชวน
   * ส่งเคสกลุ่ม 2 ต่อจากรายการสูตรยา ไม่ต้องแยกบับเบิลใหม่ (ลิงก์อยู่ใน links ตามปกติ) */
  footer?: string;
}

/** ตัวอย่างรูปแบบเลขที่อ้างอิง — ใช้ทั้งตอนถามและตอนบอกว่าไม่พบ ให้ตรงกันเสมอ */
export const REFERRAL_ID_EXAMPLE = "HEM-20260101-0001";

export const GREETING_TEXT = "สวัสดีครับ ผม Hemato Bot ถามอะไรผมได้เลย 🩸";

/** chip "⌂ เมนูหลัก" — ใส่ในทุก step ตาม spec */
export const MENU_CHIP: BotChip = { label: "⌂ เมนูหลัก", go: "menu" };

/**
 * chip "📞 ติดต่อแอดมิน" — ใช้ทั้งใน group4 (เดิม) และแนบท้ายทุก error bubble
 * ที่ error message มาจาก AUTH_NOT_READY (ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน)
 * เพราะกรณีนั้นให้ผู้ใช้ลองใหม่เองไม่มีประโยชน์ ต้องรอแอดมินแก้ค่า AUTH_SECRET
 */
export const ADMIN_CONTACT_CHIP: BotChip = { label: "📞 ติดต่อแอดมิน", go: "contact" };

export const MAIN_MENU_CHIPS: BotChip[] = [
  { label: "🔍 เช็กสถานะ", go: "status.ask" },
  { label: "📋 เคสของฉัน", go: "cases.ask" },
  { label: "💬 อ่านคำตอบ", go: "answers.entry" },
  { label: "📅 จองนัด", go: "booking" },
  { label: "🔁 เลื่อน/ยกเลิกนัด", go: "reschedule" },
  { label: "💊 สูตรเคมี", go: "regimens.ask" },
  { label: "🧬 Transplant indication", go: "indications.type" },
  { label: "📚 เอกสาร", go: "docs.ask" },
  { label: "🌐 กลุ่ม 4 / ติดต่อแอดมิน", go: "group4" },
];

/** ข้อความทักทายตอนเปิดวิดเจ็ตครั้งแรก */
export function greetingMessage(): BotMessage {
  return { from: "bot", text: GREETING_TEXT, chips: MAIN_MENU_CHIPS };
}

/** ข้อความเมนูหลัก ตอนกดกลับมาจาก step อื่น (ไม่ทักทายซ้ำ) */
export function menuMessage(): BotMessage {
  return { from: "bot", text: "เมนูหลักครับ เลือกได้เลย", chips: MAIN_MENU_CHIPS };
}

/**
 * ข้อความคงที่ของ step ที่ "ตอบจบในตัวเอง" — ไม่ต้องเรียก server action
 * และไม่มีลูกเข้า input ต่อ (ลิงก์ตรง/placeholder เฉย ๆ)
 *
 * status.ask, status.result, cases.ask, cases.result, answers.entry,
 * answers.phone, answers.code, answers.list, regimens.ask, regimens.result,
 * indications.disease มี logic เรียก action จริงหรือต้องพก state (กลุ่มโรคเด่น/
 * ประเภทปลูกถ่ายที่เลือก) จึงประกอบข้อความใน HematoBotWidget.tsx แทน (ผ่าน
 * ฟังก์ชันของ flows.ts เอง) ไม่ได้อยู่ในตารางนี้ — indications.type ไม่มี state
 * ให้พกจึงยังอยู่ในตารางนี้ได้ตามปกติ
 */
export const STATIC_STEP_MESSAGES: Partial<Record<BotStep, () => BotMessage[]>> = {
  "indications.type": () => [indicationsTypeMessage()],
  "docs.ask": () => [docsAskMessage()],
  booking: () => [
    {
      from: "bot",
      text: "จองคิวพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด (กลุ่มที่ 1) กดลิงก์ด้านล่างเพื่อเลือกวันเวลาได้เลยครับ",
      links: [{ label: "📅 จองคิว fellow transplant", href: "/book/transplant" }],
      chips: [MENU_CHIP],
    },
  ],
  reschedule: () => [
    {
      from: "bot",
      text: "จัดการนัดที่จองไว้ — เลื่อนหรือยกเลิกนัดกดลิงก์ด้านล่างแล้วกรอกเบอร์โทรที่ใช้ตอนจองได้เลยครับ",
      links: [{ label: "🔁 จัดการนัดหมาย", href: "/booking" }],
      chips: [MENU_CHIP],
    },
  ],
  // เนื้อหาอ้างอิงจาก HospitalAppointmentCard ใน src/app/refer/[type]/page.tsx
  // (ส่วนกลุ่มที่ 4) — คัดมาเฉพาะข้อเท็จจริงที่หน้านั้นแสดงจริงเท่านั้น ไม่ใช้ฟอร์ม
  // ไม่ใช่คำอธิบายทั่วไปเหมือนของเดิม เพราะกลุ่มนี้ไม่มีแบบฟอร์มให้กรอกเลย
  // (มติอาจารย์ 2 ส.ค. 2569)
  //
  // ⚠️ ห้ามใส่เบอร์โทรใด ๆ ในบับเบิลนี้ — HOSPITAL_APPOINTMENT.contactPhone ใน
  // src/lib/config.ts ตั้งใจปล่อยเป็น null พร้อมคอมเมนต์อธิบายเหตุผลไว้ชัดเจน:
  // กลุ่มนี้ไปที่ OPD อายุรศาสตร์ ไม่ใช่ OPD 700 โลหิตวิทยา การให้เบอร์ที่นี่จะพา
  // ผู้ป่วยไปโทรหาหน่วยงานที่ไม่เห็นคิวของตัวเอง — ช่องทางถามคือแชท LINE เท่านั้น
  // ตามที่หน้า /refer/[type] เขียนไว้จริง ("ติดต่อสอบถามได้ทางแชท LINE นั้น")
  group4: () => [
    {
      from: "bot",
      text:
        'ส่งต่อผู้ป่วยนอกด้วยเหตุผลอื่น (กลุ่มที่ 4) ไม่ต้องกรอกแบบฟอร์มครับ ให้ผู้ป่วยเพิ่มเพื่อน LINE "Siriraj นัดหมาย" ' +
        "แล้วทำนัดผู้ป่วยนอกเอง — ผู้ที่ยังไม่มี HN ทำบัตรโรงพยาบาลออนไลน์ผ่านเมนูในนั้นได้เลย " +
        'ดูนัดหมาย/ชำระเงินครั้งถัดไปได้ที่เมนู "Siriraj Connect" ในแอปเดียวกัน ' +
        "มีคำถามถามได้ทางแชท LINE นั้นโดยตรง กดลิงก์ด้านล่างดูขั้นตอนแบบเต็มพร้อม QR code ได้เลยครับ",
      links: [{ label: "🌐 ขั้นตอน Refer กลุ่มที่ 4", href: "/refer/general" }],
      chips: [ADMIN_CONTACT_CHIP, MENU_CHIP],
    },
  ],
  contact: () => [
    {
      from: "bot",
      text: "ติดต่อเจ้าหน้าที่ OPD 700 โลหิตวิทยาได้ตามช่องทางด้านล่างครับ",
      links: [{ label: "📞 ข้อมูลติดต่อ", href: "/contact" }],
      chips: [MENU_CHIP],
    },
  ],
};

export function statusAskMessage(): BotMessage {
  return {
    from: "bot",
    text: `พิมพ์เลขที่อ้างอิงที่ต้องการเช็กสถานะ เช่น ${REFERRAL_ID_EXAMPLE}`,
    chips: [MENU_CHIP],
  };
}

export function casesAskMessage(): BotMessage {
  return {
    from: "bot",
    text: "พิมพ์เบอร์โทรที่ใช้ตอนส่งเรื่อง เช่น 081-234-5678",
    chips: [MENU_CHIP],
  };
}

export const STATUS_NOT_FOUND_TEXT =
  `ไม่พบเลขที่อ้างอิงนี้ ตรวจรูปแบบ เช่น ${REFERRAL_ID_EXAMPLE}`;

/**
 * chip "ลองอีกครั้ง"/"ค้นเลขอื่น/เบอร์อื่น" ของ 2 flow ที่เรียก action จริง
 * (status/cases) — เก็บที่นี่เหมือน MENU_CHIP เพื่อให้ HematoBotWidget.tsx
 * ไม่ต้องมี label ภาษาไทยฝังอยู่ในนั้นเลย
 */
export const RETRY_STATUS_CHIP: BotChip = { label: "ลองอีกครั้ง", go: "status.ask" };
export const RETRY_CASES_CHIP: BotChip = { label: "ลองอีกครั้ง", go: "cases.ask" };
export const SEARCH_ANOTHER_ID_CHIP: BotChip = { label: "ค้นเลขอื่น", go: "status.ask" };
export const SEARCH_ANOTHER_PHONE_CHIP: BotChip = { label: "ค้นเบอร์อื่น", go: "cases.ask" };

export const CASES_NOT_FOUND_TEXT = "ไม่พบเคสที่ผูกกับเบอร์นี้ครับ ลองตรวจเบอร์อีกครั้ง";

/** ฟิลด์ร่วมของ BotCaseStatus (src/lib/bot-lookup.ts) — พิมพ์ซ้ำแบบ structural
 * แทนการ import type ข้ามมาที่นี่ เพื่อให้ flows.ts เป็นไฟล์ copy ล้วน ๆ
 * ไม่ผูกกับ shape ของ server action โดยตรง
 */
interface StatusFields {
  referralId: string;
  groupNumber: 1 | 2 | 3 | 4 | null;
  statusLabelTh: string;
  submittedTh: string;
}

/** บรรทัดผลลัพธ์ของ flow เช็กสถานะ (เจอเคส) */
export function formatStatusResult(s: StatusFields): string {
  return [
    `เลขที่อ้างอิง: ${s.referralId}`,
    `กลุ่ม: ${s.groupNumber ? `กลุ่มที่ ${s.groupNumber}` : "ไม่ระบุ"}`,
    `สถานะ: ${s.statusLabelTh}`,
    `ส่งเมื่อ: ${s.submittedTh || "-"}`,
  ].join("\n");
}

interface CaseFields extends StatusFields {
  hasAnswer: boolean;
}

/** บรรทัดผลลัพธ์ต่อ 1 เคสของ flow เคสของฉัน */
export function formatCaseLine(c: CaseFields): string {
  const group = c.groupNumber ? `กลุ่มที่ ${c.groupNumber}` : "ไม่ระบุกลุ่ม";
  const answer = c.hasAnswer ? "✅ มีคำตอบแล้ว" : "⏳ ยังไม่มีคำตอบ";
  return `${c.referralId} · ${group}\n${c.statusLabelTh} · ส่งเมื่อ ${c.submittedTh || "-"}\n${answer}`;
}

/** หัวข้อสรุปจำนวนเคสที่พบ */
export function casesFoundSummary(count: number): string {
  return `พบ ${count} เคสครับ`;
}

/* ------------------------------------------------------------------ */
/* อ่านคำตอบ — ยืนยันตัวตนด้วย LINE หรือรหัสทางอีเมล (Task 9)              */
/* ------------------------------------------------------------------ */

/**
 * ข้อความส่วนที่ปรากฏในหลาย error message ของ src/app/hemato-bot/actions.ts
 * เมื่อยังไม่ได้ตั้ง AUTH_SECRET — ใช้ `.includes()` ตรวจใน HematoBotWidget.tsx
 * แทนการเทียบทั้งประโยค เผื่อข้อความเปลี่ยนคำต่อท้ายภายหลัง
 */
export const AUTH_NOT_READY_MARKER = "ระบบยืนยันตัวตนยังไม่พร้อม";

/** ส่วนที่ปรากฏใน error ของ verifyCodeAction เมื่อคุกกี้รหัสหมดอายุ/ไม่มีแล้ว
 * ต่างจากรหัสผิด (ต้องขอรหัสใหม่ ไม่ใช่พิมพ์รหัสเดิมซ้ำ)
 */
export const EXPIRED_CODE_MARKER = "รหัสหมดอายุ";

/** chip "ขอรหัสใหม่" — ใช้ตอน verifyCodeAction บอกว่ารหัสหมดอายุ พาไปหน้ากรอกเบอร์ใหม่ */
export const REQUEST_NEW_CODE_CHIP: BotChip = { label: "ขอรหัสใหม่", go: "answers.phone" };

/** ข้อความชวนเลือกวิธียืนยันตัวตน — โชว์เมื่อยังไม่เคยยืนยันตัวตนในเซสชันนี้ */
const ANSWERS_ENTRY_TEXT = "ยืนยันตัวตนก่อนอ่านคำตอบครับ เลือกวิธีที่สะดวก";

/** ข้อความระหว่างรอ action — คู่กับจุดสามจุดเด้ง ๆ ใน widget */
export const PENDING_TEXT = "กำลังค้นข้อมูล";

/**
 * ข้อความตอนกด "เข้าด้วย LINE" — การพาไป LINE ใช้เวลาหลายวินาที
 * (route → LINE OAuth → อ่านชีต → เด้งกลับ) ถ้าไม่ขึ้นอะไรเลย
 * ผู้ใช้จะคิดว่าปุ่มเสีย (feedback จากการใช้จริง 4 ก.ย. 2569)
 */
export const LINE_REDIRECT_TEXT =
  "กำลังพาไปหน้า LINE เพื่อยืนยันตัวตน กรุณารอสักครู่...";

/** ข้อความชวนเลือกวิธียืนยันตัวตน — ทั้ง 2 ปุ่ม (ลิงก์ LINE + chip ขอรหัสอีเมล) */
export function answersEntryMessage(): BotMessage {
  return {
    from: "bot",
    text: ANSWERS_ENTRY_TEXT,
    links: [
      { label: "เข้าด้วย LINE", href: "/hemato-bot/line", hardNavigation: true },
    ],
    chips: [{ label: "รับรหัสทางอีเมล", go: "answers.phone" }],
  };
}

/** ข้อความถามเบอร์โทรตอนเลือก "รับรหัสทางอีเมล" */
export function answersPhoneAskMessage(): BotMessage {
  return {
    from: "bot",
    text: "พิมพ์เบอร์โทรที่ใช้ตอนส่งเรื่อง เพื่อรับรหัสยืนยันทางอีเมล เช่น 081-234-5678",
    chips: [MENU_CHIP],
  };
}

/** bubble หลัง requestCodeAction สำเร็จ — ข้อความเดียวกันเป๊ะ ๆ ไม่ว่าเบอร์จะมีเคสจริง
 * หรือไม่ (ดู requestCodeAction ใน actions.ts) ห้ามแก้ให้ต่างกันตามผลลัพธ์จริง
 * เพราะจะกลายเป็นช่องทางเดาว่าเบอร์ไหน "มี" เคสอยู่
 */
export const CODE_SENT_TEXT =
  "ส่งรหัส 6 หลักไปที่อีเมลที่ลงทะเบียนไว้แล้ว (ใช้ได้ 10 นาที) ตรวจโฟลเดอร์จดหมายขยะด้วย";

/** ตัวอย่างรูปแบบรหัส — ใช้เป็น placeholder ช่องกรอกรหัส */
export const CODE_EXAMPLE_PLACEHOLDER = "123456";

/** bubble หลัง verifyCodeAction สำเร็จ ก่อนแสดงรายการเคส */
export const CODE_VERIFIED_TEXT = "ยืนยันตัวตนสำเร็จ ✅";

/** ข้อความ fallback เผื่อ requestCodeAction/verifyCodeAction/resendAnswerAction
 * คืน ok:false โดยไม่มี error — ชนิดคืนค่าของ 3 action นี้ไม่ใช่ discriminated
 * union (error เป็น optional เสมอไม่ว่า ok จะเป็นอะไร) จึงต้องมี fallback ให้
 * TypeScript แคบชนิดได้ และกันข้อความว่างจริง ๆ หลุดไปแสดงบนหน้าจอ
 */
export const REQUEST_CODE_FALLBACK_ERROR = "ขอรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
export const VERIFY_CODE_FALLBACK_ERROR = "ยืนยันรหัสไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
export const RESEND_FALLBACK_ERROR = "ส่งสำเนาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

/** ปุ่มลิงก์ "เปิดอ่านคำตอบ" — ต่อ 1 เคสที่มี answerUrl แล้วเท่านั้น */
export const OPEN_ANSWER_LABEL = "เปิดอ่านคำตอบ";

/** chip "ส่งสำเนาเข้าอีเมลเดิม" — ต่อ 1 เคสที่มี answerUrl แล้วเท่านั้น */
export const RESEND_ANSWER_LABEL = "ส่งสำเนาเข้าอีเมลเดิม";

/** bubble หลัง resendAnswerAction สำเร็จ — คงที่เสมอ ไม่เอ่ยถึงอีเมลปลายทาง
 * (เหตุผลเดียวกับ resendAnswerAction ใน actions.ts — ห้ามเผยอีเมลที่ผูกไว้)
 */
export const RESEND_OK_TEXT = "ส่งสำเนาไปที่อีเมลที่ลงทะเบียนไว้แล้ว ✓";

/** ข้อความต่อท้ายบรรทัดเคสที่ยังไม่มีคำตอบ */
export const NO_ANSWER_YET_TEXT = "ยังไม่มีคำตอบ";

/** ข้อความตอนยืนยันตัวตนแล้วแต่ไม่มีเคสผูกกับเบอร์นี้เลย (กันไม่ให้ขึ้นจอว่าง) */
export const ANSWERS_EMPTY_TEXT = "ยังไม่พบเคสที่ผูกกับบัญชีนี้ครับ";

interface AnswerCaseFields extends StatusFields {
  answerUrl: string | null;
}

/** บรรทัดผลลัพธ์ต่อ 1 เคสของ flow อ่านคำตอบ (ไม่รวมท้าย "ยังไม่มีคำตอบ" —
 * ใส่แยกใน answerCaseMessage เพื่อให้ formatAnswerCaseLine ใช้ซ้ำได้เฉย ๆ)
 */
export function formatAnswerCaseLine(c: AnswerCaseFields): string {
  const group = c.groupNumber ? `กลุ่มที่ ${c.groupNumber}` : "ไม่ระบุกลุ่ม";
  return `${c.referralId} · ${group}\n${c.statusLabelTh} · ส่งเมื่อ ${c.submittedTh || "-"}`;
}

/**
 * ข้อความต่อ 1 เคสของ answers.list — sticky เสมอเพราะแต่ละเคสมีลิงก์/ปุ่มของ
 * ตัวเอง ต้องกดได้พร้อมกันทุกเคสไม่ใช่แค่เคสสุดท้าย (ดู BotMessage.sticky)
 *
 * ไม่แนบ MENU_CHIP ในนี้ — HematoBotWidget.tsx เป็นคนแนบต่อท้ายข้อความเคส
 * สุดท้ายเองหลัง map ครบ ให้ตรงแพตเทิร์นเดียวกับ formatCaseLine/cases.result
 * ที่ chip ของ "ชุดผลลัพธ์" ประกอบใน widget ไม่ใช่ในฟังก์ชัน format ต่อรายการ
 */
export function answerCaseMessage(c: AnswerCaseFields): BotMessage {
  const text = c.answerUrl
    ? formatAnswerCaseLine(c)
    : `${formatAnswerCaseLine(c)}\n${NO_ANSWER_YET_TEXT}`;
  return {
    from: "bot",
    text,
    links: c.answerUrl ? [{ label: OPEN_ANSWER_LABEL, href: c.answerUrl }] : undefined,
    chips: c.answerUrl
      ? [{ label: RESEND_ANSWER_LABEL, resendReferralId: c.referralId }]
      : undefined,
    sticky: true,
  };
}

/* ------------------------------------------------------------------ */
/* ค้นสูตรยาเคมีบำบัด — Task 10                                            */
/* ------------------------------------------------------------------ */

/** ฟิลด์ร่วมของผลลัพธ์ searchRegimensAction (src/app/hemato-bot/actions.ts) —
 * พิมพ์ซ้ำแบบ structural แทนการ import type ข้ามมา เพื่อให้ flows.ts เป็นไฟล์
 * copy ล้วน ๆ ไม่ผูกกับ shape ของ server action โดยตรง (แพตเทิร์นเดียวกับ StatusFields)
 */
interface RegimenListItem {
  diseaseGroup: string;
  abbr: string;
  components: string;
}

/** placeholder ช่องค้นสูตรยา */
export const REGIMEN_QUERY_PLACEHOLDER = "เช่น CHOP";

/** แสดงผลลัพธ์สูตรยาสูงสุดกี่รายการต่อการค้น 1 ครั้ง — ตาม spec */
export const MAX_REGIMEN_RESULTS = 15;

/** chip "ค้นคำใหม่" ท้าย regimens.result — กลับไป regimens.ask (แสดง chips
 * กลุ่มโรคเด่นที่แคชไว้แล้ว ไม่ต้องเรียก searchRegimensAction("") ซ้ำ — ดู
 * enterRegimensAsk ใน HematoBotWidget.tsx)
 */
export const RETRY_REGIMENS_CHIP: BotChip = { label: "ค้นคำใหม่", go: "regimens.ask" };

/**
 * ตัดกลุ่มโรคซ้ำออก เก็บลำดับที่ปรากฏก่อน — ใช้สร้าง chips "กลุ่มโรคเด่น" จาก
 * ผลค้นครั้งแรก (query ว่าง) ของ searchRegimensAction ตอนเข้า regimens.ask ครั้งแรก
 *
 * เป็น pure formatter (ไม่พก state/side effect) จึงมีเทสต์แยกที่
 * src/components/hemato-bot/__tests__/flows.test.ts
 */
export function uniqueDiseaseGroups(regimens: RegimenListItem[]): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const r of regimens) {
    if (!seen.has(r.diseaseGroup)) {
      seen.add(r.diseaseGroup);
      groups.push(r.diseaseGroup);
    }
  }
  return groups;
}

/** ข้อความถามคำค้น + chips กลุ่มโรคเด่น — diseaseGroups ว่างได้ (เช่นตอน demo ที่
 * ไม่มีชีตให้อ่าน) ก็ยังพิมพ์ค้นเองในช่องกรอกด้านล่างแผงแชทได้ตามปกติ
 */
/** ถามหมวดเอกสาร — เลือกกลุ่มหรือดูทั้งหมด */
export function docsAskMessage(): BotMessage {
  return {
    from: "bot",
    text: "ต้องการเอกสารของกลุ่มไหนครับ",
    chips: [
      { label: "กลุ่ม 1 — ปลูกถ่าย", docGroup: 1 },
      { label: "กลุ่ม 2 — ปรึกษาสูตรยา", docGroup: 2 },
      { label: "กลุ่ม 3 — ส่งตัวให้ยาเคมี", docGroup: 3 },
      { label: "📚 ดูทั้งหมด", docGroup: null },
      MENU_CHIP,
    ],
  };
}

export const DOCS_EMPTY_TEXT =
  "ยังไม่มีเอกสารในหมวดนี้ครับ ลองดูหมวดอื่น หรือติดต่อแอดมินได้เลย";

export const DOCS_FALLBACK_ERROR =
  "เปิดรายการเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

/** รายการเอกสารหนึ่งไฟล์ — ลิงก์เปิดแท็บใหม่ (ไฟล์อยู่บน Google Drive) */
export function docMessage(doc: {
  title: string;
  url: string;
  description: string;
}): BotMessage {
  return {
    from: "bot",
    sticky: true,
    text: doc.description ? doc.title + "\n" + doc.description : doc.title,
    links: [{ label: "📄 เปิดเอกสาร", href: doc.url, external: true }],
  };
}

/** สรุปหัวรายการเอกสาร + chips ไปหมวดอื่น */
export function docsListHeaderMessage(count: number): BotMessage {
  return {
    from: "bot",
    text: "พบ " + count + " ไฟล์ครับ กดเปิดได้เลย",
  };
}

export function docsListFooterChips(): BotChip[] {
  return [{ label: "ดูหมวดอื่น", go: "docs.ask" }, MENU_CHIP];
}

export function regimensAskMessage(diseaseGroups: string[]): BotMessage {
  return {
    from: "bot",
    text: "พิมพ์ชื่อสูตรยา หรือกลุ่มโรคที่ต้องการค้นได้เลยครับ",
    chips: [
      ...diseaseGroups.map((g): BotChip => ({ label: g, query: g })),
      MENU_CHIP,
    ],
  };
}

/** บับเบิลผลค้นสูตรยา — ไม่พบ: ข้อความสุภาพ + ชวนลองใหม่ / พบ: abbr ตัวหนา +
 * components ตัวรอง สูงสุด MAX_REGIMEN_RESULTS รายการ + บรรทัดท้ายชวนส่งเคส
 * กลุ่ม 2 พร้อมลิงก์ — ทั้งหมดอยู่ในบับเบิลเดียว (sticky เพราะลิงก์/chip ต้องกด
 * ได้ต่อแม้ผู้ใช้ค้นคำใหม่ต่อจนบับเบิลนี้ไม่ใช่ข้อความล่าสุดแล้ว)
 */
export function regimenResultMessage(
  query: string,
  results: RegimenListItem[],
): BotMessage {
  if (results.length === 0) {
    return {
      from: "bot",
      text: `ไม่พบสูตรยาที่ตรงกับ "${query}" ครับ ลองคำค้นอื่น หรือเลือกกลุ่มโรคด้านล่างอีกครั้ง`,
      chips: [RETRY_REGIMENS_CHIP, MENU_CHIP],
    };
  }

  const shown = results.slice(0, MAX_REGIMEN_RESULTS);
  const items = shown.map((r): BotMessageItem => ({ primary: r.abbr, secondary: r.components }));
  const text =
    results.length > MAX_REGIMEN_RESULTS
      ? `พบ ${results.length} สูตร แสดง ${MAX_REGIMEN_RESULTS} รายการแรกที่ตรงกับ "${query}"`
      : `พบ ${results.length} สูตรที่ตรงกับ "${query}"`;

  return {
    from: "bot",
    text,
    items,
    footer: "ต้องการความเห็นสูตรยา ส่งเคสกลุ่ม 2 ได้เลยครับ",
    links: [{ label: "💊 ส่งเคสกลุ่ม 2 — ขอความเห็นสูตรยา", href: "/refer/regimen-consult" }],
    chips: [RETRY_REGIMENS_CHIP, MENU_CHIP],
    sticky: true,
  };
}

/* ------------------------------------------------------------------ */
/* Transplant indication — เกณฑ์การส่งต่อเข้าเตรียมปลูกถ่าย (Task 10)        */
/* ------------------------------------------------------------------ */

/** ข้อความถามประเภทปลูกถ่าย — label ใช้ TRANSPLANT_TYPE_LABEL_TH ตรง ๆ ตาม spec */
export function indicationsTypeMessage(): BotMessage {
  return {
    from: "bot",
    text: "เลือกประเภทการปลูกถ่ายที่ต้องการดูเกณฑ์ครับ",
    chips: [
      { label: TRANSPLANT_TYPE_LABEL_TH.AUTOLOGOUS, transplantType: "AUTOLOGOUS" },
      { label: TRANSPLANT_TYPE_LABEL_TH.ALLOGENEIC, transplantType: "ALLOGENEIC" },
      MENU_CHIP,
    ],
  };
}

/** ข้อความถามโรค — chips ต่อโรคของประเภทที่เลือก (INDICATIONS_BY_TYPE คำนวณจาก
 * TRANSPLANT_INDICATIONS ไว้แล้วใน transplant-indications.ts) รายชื่อโรคอาจยาว
 * แต่ container ของ chips เป็น flex-wrap อยู่แล้ว (ดู HematoBotWidget.tsx) จึง
 * ตัดบรรทัดเองในพื้นที่แผงแชทโดยไม่ต้องเพิ่ม CSS พิเศษ
 */
export function indicationsDiseaseMessage(type: TransplantType, typeLabel: string): BotMessage {
  const diseases = INDICATIONS_BY_TYPE[type];
  return {
    from: "bot",
    text: `เลือกโรคของ ${typeLabel} ที่ต้องการดูเกณฑ์ครับ`,
    chips: [
      ...diseases.map((d): BotChip => ({ label: d.diseaseTh, indicationId: d.id })),
      MENU_CHIP,
    ],
  };
}

/** ข้อความกำกับมาตรฐาน — ต้องคงคำนี้เป๊ะตามมติอาจารย์ 2 ส.ค. 2569 (ดูหัวไฟล์
 * transplant-indications.ts): เกณฑ์เป็นข้อมูลประกอบ ไม่ใช่ด่านกั้นการส่งเคส
 */
export const TRANSPLANT_INDICATION_DISCLAIMER =
  "ข้อมูลประกอบการตัดสินใจ ไม่ใช่ด่านกั้น — ส่งเคสได้แม้เกณฑ์ยังไม่ครบ";

const INDICATION_NOT_FOUND_TEXT = "ไม่พบข้อมูลเกณฑ์ของรายการนี้ครับ";

/** บับเบิลเกณฑ์ของโรคที่เลือก — statusTh/ageTh อาจว่าง (บางแถวไม่ระบุ) จึงมี
 * fallback "ไม่ระบุ" กันบรรทัดว่างเปล่าดูเหมือนข้อมูลหาย
 */
export function indicationResultMessage(id: string): BotMessage {
  const indication = findIndication(id);
  if (!indication) {
    return { from: "bot", text: INDICATION_NOT_FOUND_TEXT, chips: [MENU_CHIP] };
  }

  const text = [
    indication.diseaseTh,
    `เกณฑ์ตอบสนอง: ${indication.statusTh || "ไม่ระบุ"}`,
    `เกณฑ์อายุ: ${indication.ageTh || "ไม่ระบุ"}`,
    "",
    TRANSPLANT_INDICATION_DISCLAIMER,
  ].join("\n");

  return {
    from: "bot",
    text,
    links: [{ label: "📅 จองนัดกลุ่ม 1", href: "/book/transplant" }],
    chips: [MENU_CHIP],
    sticky: true,
  };
}

/** ข้อความต้อนรับกลับตอนเปิดวิดเจ็ตอัตโนมัติจาก `?bot=verified` — ตามด้วยรายการ
 * เคสที่ HematoBotWidget.tsx โหลดต่อทันที (ไม่ต้องกดเมนูซ้ำ)
 */
export function lineVerifiedMessage(): BotMessage {
  return { from: "bot", text: "ผูกบัญชี LINE กับเบอร์นี้เรียบร้อยแล้วครับ ✅" };
}

/** ข้อความตอนกลับมาจาก LINE แล้วยังไม่เคยผูกเบอร์ไว้ — ชวนแอด LINE OA แล้วพิมพ์
 * "ผูกบัญชี" ในแชท (ฝั่ง LINE OA มี webhook รับคำสั่งนี้แยกต่างหาก ไม่ใช่ของหน้านี้)
 */
export function lineUnlinkedMessage(): BotMessage {
  return {
    from: "bot",
    text:
      `ยังไม่พบบัญชี LINE ที่ผูกกับเบอร์นี้ครับ เพิ่มเพื่อน ${LINE_OA.displayName} ` +
      'ด้านล่าง แล้วพิมพ์คำว่า "ผูกบัญชี" ในแชทเพื่อผูกบัญชีได้เลยครับ',
    links: [
      { label: `เพิ่มเพื่อน ${LINE_OA.displayName}`, href: LINE_OA.addFriendUrl, external: true },
    ],
    chips: [MENU_CHIP],
  };
}

/**
 * ข้อความต้อนรับกลับตอนเปิดวิดเจ็ตอัตโนมัติจาก `?bot=` (มาจาก redirect ของ
 * src/app/hemato-bot/line/route.ts และ line/callback/route.ts — Task 7)
 *
 * เก็บ key ตรงกับค่าที่ route เหล่านั้น redirect มา ห้ามเปลี่ยนโดยไม่แก้ทั้งคู่
 *
 * เหลือแค่ unavailable/error สองค่า — verified/unlinked มีข้อความ+ลิงก์เฉพาะทาง
 * มากกว่า plain text ธรรมดา จึงย้ายไปเป็น lineVerifiedMessage()/lineUnlinkedMessage()
 * ข้างบนแทน (Task 9)
 */
export const BOT_PARAM_MESSAGES: Record<string, string> = {
  unavailable:
    "ตอนนี้ระบบผูกบัญชียังไม่พร้อมใช้งานครับ กรุณาลองใหม่ภายหลัง หรือติดต่อแอดมิน",
  error: "เกิดข้อผิดพลาดระหว่างผูกบัญชี กรุณาลองใหม่อีกครั้งครับ",
};
