/**
 * นิยามเมนู/ข้อความของ Hemato Bot — แยกจาก HematoBotWidget.tsx โดยตั้งใจ
 * เพื่อให้แก้ถ้อยคำ/ลำดับเมนูได้โดยไม่ต้องแตะ state machine หรือ logic เรียก action
 *
 * ⚠️ ลำดับ MAIN_MENU_CHIPS อ้างอิงตาม task brief ตรง ๆ (เช็กสถานะ → เคสของฉัน →
 * อ่านคำตอบ → จองนัด → เลื่อน/ยกเลิกนัด → สูตรเคมี → transplant indication →
 * กลุ่ม 4/ติดต่อแอดมิน) ห้ามสลับโดยไม่คุยกับทีมออกแบบก่อน เพราะเรียงตาม
 * ความถี่การใช้งานจริงที่พบใน LINE OA
 */

/** ทุก step ที่ widget รู้จัก — บาง step (answers.phone/code/list, regimens.result,
 * indications.disease) ยังไม่มี logic จริงใน Task 8 เพราะเป็นของ Task 9-10
 * แต่ประกาศ union ไว้ครบตาม spec เพื่อไม่ต้องแก้ type ซ้ำทีหลัง
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
  | "booking"
  | "reschedule"
  | "group4"
  | "contact";

export interface BotChip {
  label: string;
  go: BotStep;
}

export interface BotLink {
  label: string;
  href: string;
}

export interface BotMessage {
  from: "bot" | "user";
  text: string;
  chips?: BotChip[];
  links?: BotLink[];
}

/** ตัวอย่างรูปแบบเลขที่อ้างอิง — ใช้ทั้งตอนถามและตอนบอกว่าไม่พบ ให้ตรงกันเสมอ */
export const REFERRAL_ID_EXAMPLE = "HEM-20260101-0001";

export const GREETING_TEXT = "สวัสดีครับ ผม Hemato Bot ถามอะไรผมได้เลย 🩸";

/** chip "⌂ เมนูหลัก" — ใส่ในทุก step ตาม spec */
export const MENU_CHIP: BotChip = { label: "⌂ เมนูหลัก", go: "menu" };

export const MAIN_MENU_CHIPS: BotChip[] = [
  { label: "🔍 เช็กสถานะ", go: "status.ask" },
  { label: "📋 เคสของฉัน", go: "cases.ask" },
  { label: "💬 อ่านคำตอบ", go: "answers.entry" },
  { label: "📅 จองนัด", go: "booking" },
  { label: "🔁 เลื่อน/ยกเลิกนัด", go: "reschedule" },
  { label: "💊 สูตรเคมี", go: "regimens.ask" },
  { label: "🧬 Transplant indication", go: "indications.type" },
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

const PLACEHOLDER_TEXT = "เมนูนี้กำลังเปิดใช้งานเร็ว ๆ นี้ 🙏 ระหว่างนี้ลองเมนูอื่นได้ครับ";

/**
 * ข้อความคงที่ของ step ที่ "ตอบจบในตัวเอง" — ไม่ต้องเรียก server action
 * และไม่มีลูกเข้า input ต่อ (ลิงก์ตรง/placeholder เฉย ๆ)
 *
 * status.ask, status.result, cases.ask, cases.result มี logic เรียก action
 * จริงจึงประกอบข้อความใน HematoBotWidget.tsx แทน ไม่ได้อยู่ในตารางนี้
 */
export const STATIC_STEP_MESSAGES: Partial<Record<BotStep, () => BotMessage[]>> = {
  "answers.entry": () => [
    { from: "bot", text: PLACEHOLDER_TEXT, chips: [MENU_CHIP] },
  ],
  "regimens.ask": () => [
    { from: "bot", text: PLACEHOLDER_TEXT, chips: [MENU_CHIP] },
  ],
  "indications.type": () => [
    { from: "bot", text: PLACEHOLDER_TEXT, chips: [MENU_CHIP] },
  ],
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
  group4: () => [
    {
      from: "bot",
      text: "ส่งต่อผู้ป่วยนอกด้วยเหตุผลอื่น (กลุ่มที่ 4) กดลิงก์ด้านล่างเพื่อกรอกแบบฟอร์มได้เลยครับ",
      links: [{ label: "🌐 Refer กลุ่มที่ 4", href: "/refer/general" }],
      chips: [{ label: "📞 ติดต่อแอดมิน", go: "contact" }, MENU_CHIP],
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

/**
 * ข้อความต้อนรับกลับตอนเปิดวิดเจ็ตอัตโนมัติจาก `?bot=` (มาจาก redirect ของ
 * src/app/hemato-bot/line/route.ts และ line/callback/route.ts — Task 7)
 *
 * เก็บ key ตรงกับค่าที่ route เหล่านั้น redirect มา ห้ามเปลี่ยนโดยไม่แก้ทั้งคู่
 * Task 9 จะต่อยอดจากตรงนี้ (เช่น ดึงเคสที่ผูกไว้มาแสดงทันทีตอน verified)
 */
export const BOT_PARAM_MESSAGES: Record<string, string> = {
  verified:
    "ผูกบัญชี LINE กับเบอร์นี้เรียบร้อยแล้วครับ ✅ กดเมนู “เคสของฉัน” หรือ “อ่านคำตอบ” เพื่อดูรายละเอียดได้เลย",
  unlinked:
    "ยังไม่พบบัญชี LINE ที่ผูกกับเบอร์นี้ครับ ลองผูกบัญชีใหม่อีกครั้ง หรือเลือกเมนูอื่นได้เลย",
  unavailable:
    "ตอนนี้ระบบผูกบัญชียังไม่พร้อมใช้งานครับ กรุณาลองใหม่ภายหลัง หรือติดต่อแอดมิน",
  error: "เกิดข้อผิดพลาดระหว่างผูกบัญชี กรุณาลองใหม่อีกครั้งครับ",
};
