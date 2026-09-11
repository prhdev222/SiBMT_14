"use client";

/**
 * Hemato Bot — วิดเจ็ตแชทลอยมุมขวาล่าง
 *
 * ⚠️ ตำแหน่ง: ปุ่มเปิด (launcher) วางสูงกว่า FontSizeControl (bottom-3/right-3,
 * กว้างราว 118px สูงราว 42px) เพื่อไม่ให้ทับกันตอนแผงปิดอยู่ — ห้ามย้าย
 * FontSizeControl มาชนที่นี่แทน ส่วนแผงแชทตอนเปิด ใช้ z-index สูงกว่าตามสเปก
 * จึงซ้อนทับ FontSizeControl ได้ตอนเปิดใช้งาน (ตั้งใจ เพราะแผงมีปุ่มปิดในตัว)
 *
 * ⚠️ mount ใน RootLayout (server component) ได้ตรง ๆ เพราะไฟล์นี้เป็น client
 * component ทั้งไฟล์ — import client component เข้า server component ทำได้ปกติ
 *
 * ⚠️ ไม่ใช้ useSearchParams เพราะจะบังคับให้ทั้งเว็บ (mount ทุกหน้าผ่าน layout)
 * เสีย static rendering ไปเป็น dynamic ทุกหน้าโดยไม่จำเป็น — อ่าน
 * window.location.search เองใน useEffect ตอน mount แทน (ฝั่ง client เท่านั้น
 * อยู่แล้ว จึงไม่มีปัญหาเรื่อง SSR/hydration mismatch)
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { TransplantType } from "@/lib/transplant-indications";
import {
  lookupStatusAction,
  listCasesAction,
  requestCodeAction,
  verifyCodeAction,
  verifiedCasesAction,
  listDocumentsAction,
  resendAnswerAction,
  searchRegimensAction,
} from "@/app/hemato-bot/actions";
import {
  ADMIN_CONTACT_CHIP,
  ANSWERS_EMPTY_TEXT,
  AUTH_NOT_READY_MARKER,
  BOT_PARAM_MESSAGES,
  CASES_NOT_FOUND_TEXT,
  CODE_EXAMPLE_PLACEHOLDER,
  CODE_SENT_TEXT,
  CODE_VERIFIED_LINKED_TEXT,
  CODE_VERIFIED_TEXT,
  EXPIRED_CODE_MARKER,
  LINE_REDIRECT_TEXT,
  MAIN_MENU_CHIPS,
  MENU_CHIP,
  PENDING_TEXT,
  REFERRAL_ID_EXAMPLE,
  REGIMEN_QUERY_PLACEHOLDER,
  REQUEST_CODE_FALLBACK_ERROR,
  REQUEST_NEW_CODE_CHIP,
  RESEND_FALLBACK_ERROR,
  RESEND_OK_TEXT,
  RETRY_CASES_CHIP,
  RETRY_STATUS_CHIP,
  SEARCH_ANOTHER_ID_CHIP,
  SEARCH_ANOTHER_PHONE_CHIP,
  DOCS_EMPTY_TEXT,
  DOCS_FALLBACK_ERROR,
  STATIC_STEP_MESSAGES,
  docMessage,
  docsListFooterChips,
  docsListHeaderMessage,
  STATUS_NOT_FOUND_TEXT,
  VERIFY_CODE_FALLBACK_ERROR,
  answerCaseMessage,
  answersEntryMessage,
  answersPhoneAskMessage,
  casesAskMessage,
  casesFoundSummary,
  formatCaseLine,
  formatStatusResult,
  greetingMessage,
  indicationResultMessage,
  indicationsDiseaseMessage,
  lineUnlinkedMessage,
  lineVerifiedMessage,
  menuMessage,
  regimenResultMessage,
  regimensAskMessage,
  statusAskMessage,
  uniqueDiseaseGroups,
  type BotChip,
  type BotMessage,
  type BotStep,
} from "./flows";

/** เลือก chips ท้าย error bubble — AUTH_NOT_READY (ยังไม่ตั้ง AUTH_SECRET) ให้
 * ปุ่มติดต่อแอดมินแทนการชวนลองใหม่ เพราะลองใหม่กี่ครั้งก็พังเหมือนเดิม
 */
function authAwareChips(error: string): BotChip[] {
  return error.includes(AUTH_NOT_READY_MARKER) ? [ADMIN_CONTACT_CHIP, MENU_CHIP] : [MENU_CHIP];
}

/** เหมือน authAwareChips แต่เพิ่มกรณีรหัสหมดอายุ — ต้องขอรหัสใหม่ ไม่ใช่พิมพ์ซ้ำ */
function codeErrorChips(error: string): BotChip[] {
  if (error.includes(AUTH_NOT_READY_MARKER)) return [ADMIN_CONTACT_CHIP, MENU_CHIP];
  if (error.includes(EXPIRED_CODE_MARKER)) return [REQUEST_NEW_CODE_CHIP, MENU_CHIP];
  return [MENU_CHIP];
}

/** หน้าที่ไม่ควรมีวิดเจ็ตลอย — เป็นหน้าทำงานของบุคลากร/หน้าเปิดจากลิงก์เฉพาะ */
const HIDDEN_PATH_PREFIXES = ["/dashboard", "/login", "/answer"];

/** คลาสร่วมของปุ่มลิงก์/ปุ่ม chip ท้ายข้อความ — แยกเป็นค่าคงที่เพราะลิงก์ตอนนี้
 * แตกเป็น 3 แบบ (next/link ปกติ, <a> แท็บเดิม, <a> แท็บใหม่) แต่หน้าตาต้องเหมือนกัน
 */
const LINK_CLASS =
  "inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100";
const CHIP_CLASS =
  "inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100";

function buildStepMessages(step: BotStep): BotMessage[] {
  if (step === "menu") return [menuMessage()];
  if (step === "status.ask") return [statusAskMessage()];
  if (step === "cases.ask") return [casesAskMessage()];
  if (step === "answers.phone") return [answersPhoneAskMessage()];
  return STATIC_STEP_MESSAGES[step]?.() ?? [];
}

/** step ที่มีช่องกรอกข้อความด้านล่างแผงแชท */
const INPUT_STEPS: BotStep[] = [
  "status.ask",
  "cases.ask",
  "answers.phone",
  "answers.code",
  "regimens.ask",
];

/** step ที่คีย์บอร์ดมือถือควรขึ้นแป้นตัวเลข (เบอร์โทร/รหัส 6 หลัก) */
const NUMERIC_INPUT_STEPS: BotStep[] = ["cases.ask", "answers.phone", "answers.code"];

export function HematoBotWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<BotStep>("menu");
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pending, setPending] = useState(false);
  // แคชกลุ่มโรคเด่นจาก searchRegimensAction("") ครั้งแรก — null = ยังไม่เคยโหลด,
  // [] = โหลดแล้วแต่ไม่มีข้อมูล (เช่น demo ที่ไม่มีชีตให้อ่าน) ทั้งสองกรณีต่างจากกัน
  // เพื่อไม่ให้ enterRegimensAsk() ยิง action ซ้ำทุกครั้งที่กลับมาที่เมนูนี้
  const [regimenDiseaseGroups, setRegimenDiseaseGroups] = useState<string[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // เปิดอัตโนมัติพร้อมข้อความที่เหมาะสมเมื่อกลับมาจากหน้าผูกบัญชี LINE (Task 7)
  // ดู src/app/hemato-bot/line/{route,callback}/route.ts สำหรับค่าที่เป็นไปได้
  //
  // verified → ผูกบัญชีสำเร็จแล้ว ข้ามไปโหลด+โชว์รายการเคสให้ทันที (Task 9)
  // ไม่ต้องให้กดเมนู "อ่านคำตอบ" ซ้ำเอง เพราะเพิ่งยืนยันตัวตนเสร็จหมาด ๆ
  // unlinked → ยังไม่เคยผูกเบอร์ไว้ ชวนแอด LINE OA แล้วพิมพ์ "ผูกบัญชี" แทน
  // unavailable/error → ข้อความทั่วไปเหมือนเดิม กลับไปเมนูหลัก
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const bot = params.get("bot");
    if (!bot) return;

    // sync จาก URL query (external system) ตอน mount ครั้งเดียว — แพตเทิร์นเดียว
    // กับ FontSizeControl.tsx ที่ sync จาก localStorage ตอน mount
    if (bot === "verified") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([lineVerifiedMessage()]);
      setStep("answers.list");
      setOpen(true);
      void refreshAnswers();
    } else if (bot === "unlinked") {
      // ถามเบอร์ต่อทันที — ยืนยันรหัสผ่านแล้ว verifyCodeAction จะผูก LINE ให้เอง
      setMessages([lineUnlinkedMessage()]);
      setStep("answers.phone");
      setOpen(true);
    } else {
      const text = BOT_PARAM_MESSAGES[bot];
      if (!text) return;
      setMessages([{ from: "bot", text, chips: MAIN_MENU_CHIPS }]);
      setStep("menu");
      setOpen(true);
    }

    // ล้าง ?bot= ออกจาก URL กันข้อความเด้งซ้ำตอนรีเฟรช/กด back
    params.delete("bot");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (search ? `?${search}` : "") + window.location.hash,
    );
    // ตั้งใจไม่ใส่ refreshAnswers ใน deps — ฟังก์ชันประกาศในคอมโพเนนต์ แต่ effect นี้
    // ต้องรันครั้งเดียวตอน mount เท่านั้น (อ่าน query string ครั้งเดียว) เหมือนกันกับ
    // เหตุผลของ eslint-disable react-hooks/set-state-in-effect ด้านบน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pending]);

  if (HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  function openWidget() {
    setOpen(true);
    setMessages((prev) => (prev.length === 0 ? [greetingMessage()] : prev));
  }

  function goTo(next: BotStep, userLabel?: string) {
    setMessages((prev) =>
      userLabel ? [...prev, { from: "user", text: userLabel } as BotMessage] : prev,
    );
    setStep(next);

    // answers.entry ต้องเช็ก verifiedCasesAction() ก่อนตัดสินใจว่าจะโชว์อะไร
    // (ข้ามไปรายการเคสเลยถ้ายืนยันตัวตนอยู่แล้ว) จึงแยกออกจาก buildStepMessages
    // แบบซิงโครนัสของ step อื่น ๆ — ดู refreshAnswers ด้านล่าง
    if (next === "answers.entry") {
      void refreshAnswers();
      return;
    }
    // regimens.ask ต้องพก chips กลุ่มโรคเด่นที่มาจาก searchRegimensAction("") —
    // โหลดครั้งแรกแล้วแคชไว้ใน state (regimenDiseaseGroups) เหตุผลเดียวกับ
    // answers.entry ด้านบนที่แยกออกจาก buildStepMessages แบบซิงโครนัส
    if (next === "regimens.ask") {
      void enterRegimensAsk();
      return;
    }
    setMessages((prev) => [...prev, ...buildStepMessages(next)]);
  }

  /** โหลด chips กลุ่มโรคเด่นครั้งแรก (แคชไว้ไม่ยิง action ซ้ำ) แล้วต่อท้ายด้วย
   * regimensAskMessage — ดู state regimenDiseaseGroups ด้านบน
   */
  async function enterRegimensAsk() {
    if (regimenDiseaseGroups !== null) {
      setMessages((prev) => [...prev, regimensAskMessage(regimenDiseaseGroups)]);
      return;
    }
    setPending(true);
    const results = await searchRegimensAction("");
    setPending(false);
    const groups = uniqueDiseaseGroups(results);
    setRegimenDiseaseGroups(groups);
    setMessages((prev) => [...prev, regimensAskMessage(groups)]);
  }

  async function submitRegimenSearch(rawQuery: string) {
    const value = rawQuery.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { from: "user", text: value }]);
    setInputValue("");
    setPending(true);
    const results = await searchRegimensAction(value);
    setPending(false);
    setMessages((prev) => [...prev, regimenResultMessage(value, results)]);
    setStep("regimens.result");
  }

  /** เลือกประเภทปลูกถ่าย (Auto/Allo) ใน indications.type — โชว์ chips รายโรค
   * ของประเภทนั้นต่อทันที ไม่ต้องเรียก action เพราะเป็น static data ล้วน ๆ
   */
  function selectTransplantType(type: TransplantType, label: string) {
    setMessages((prev) => [
      ...prev,
      { from: "user", text: label },
      indicationsDiseaseMessage(type, label),
    ]);
    setStep("indications.disease");
  }

  /** เลือกโรคใน indications.disease — โชว์บับเบิลเกณฑ์ของโรคนั้นทันที ไม่เปลี่ยน
   * step (ยังเป็น indications.disease อยู่ ไม่มี step แยกสำหรับผลลัพธ์)
   */
  function selectIndication(id: string, label: string) {
    setMessages((prev) => [
      ...prev,
      { from: "user", text: label },
      indicationResultMessage(id),
    ]);
  }

  async function submitStatus(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { from: "user", text: value }]);
    setInputValue("");
    setPending(true);
    const result = await lookupStatusAction(value);
    setPending(false);

    if (!result.ok) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: result.error, chips: [RETRY_STATUS_CHIP, MENU_CHIP] },
      ]);
      setStep("status.result");
      return;
    }
    if (!result.found) {
      setMessages((prev) => [
        ...prev,
        {
          from: "bot",
          text: STATUS_NOT_FOUND_TEXT,
          chips: [SEARCH_ANOTHER_ID_CHIP, MENU_CHIP],
        },
      ]);
      setStep("status.result");
      return;
    }

    const text = formatStatusResult(result.found);
    setMessages((prev) => [
      ...prev,
      { from: "bot", text, chips: [SEARCH_ANOTHER_ID_CHIP, MENU_CHIP] },
    ]);
    setStep("status.result");
  }

  async function submitCases(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { from: "user", text: value }]);
    setInputValue("");
    setPending(true);
    const result = await listCasesAction(value);
    setPending(false);

    if (!result.ok) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: result.error, chips: [RETRY_CASES_CHIP, MENU_CHIP] },
      ]);
      setStep("cases.result");
      return;
    }
    if (result.cases.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          from: "bot",
          text: CASES_NOT_FOUND_TEXT,
          chips: [SEARCH_ANOTHER_PHONE_CHIP, MENU_CHIP],
        },
      ]);
      setStep("cases.result");
      return;
    }

    const lines = result.cases.map(formatCaseLine);
    setMessages((prev) => [
      ...prev,
      { from: "bot", text: casesFoundSummary(result.cases.length) },
      { from: "bot", text: lines.join("\n\n"), chips: [SEARCH_ANOTHER_PHONE_CHIP, MENU_CHIP] },
    ]);
    setStep("cases.result");
  }

  /**
   * แกนกลางของ flow อ่านคำตอบ — เรียก verifiedCasesAction() แล้วแตกเป็น 3 ทาง:
   * error (รวม AUTH_NOT_READY) / ยืนยันตัวตนอยู่แล้ว (โชว์รายการเคสทันที) /
   * ยังไม่ยืนยัน (โชว์ 2 ปุ่มให้เลือกวิธี) — ใช้ทั้งตอนกด "อ่านคำตอบ" จากเมนู,
   * ตอนกลับมาจาก LINE ด้วย ?bot=verified และตอน verifyCodeAction สำเร็จ
   */
  async function refreshAnswers() {
    setPending(true);
    const result = await verifiedCasesAction();
    setPending(false);

    if (!result.ok) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: result.error, chips: authAwareChips(result.error) },
      ]);
      return;
    }
    if (result.verified) {
      appendCaseList(result.cases);
      setStep("answers.list");
      return;
    }
    setMessages((prev) => [...prev, answersEntryMessage()]);
    setStep("answers.entry");
  }

  /** ต่อข้อความรายการเคส 1 ข้อความต่อ 1 เคส (sticky ทุกอัน) + MENU_CHIP ท้ายเคส
   * สุดท้าย — กรณีไม่มีเคสเลยก็ยังต้องตอบอะไรสักอย่าง กันจอว่างเปล่า
   */
  function appendCaseList(cases: Parameters<typeof answerCaseMessage>[0][]) {
    if (cases.length === 0) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: ANSWERS_EMPTY_TEXT, chips: [MENU_CHIP] },
      ]);
      return;
    }

    const caseMessages = cases.map(answerCaseMessage);
    const lastCaseMessage = caseMessages[caseMessages.length - 1];
    lastCaseMessage.chips = [...(lastCaseMessage.chips ?? []), MENU_CHIP];

    setMessages((prev) => [
      ...prev,
      { from: "bot", text: casesFoundSummary(cases.length) },
      ...caseMessages,
    ]);
  }

  async function submitAnswersPhone(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { from: "user", text: value }]);
    setInputValue("");
    setPending(true);
    const result = await requestCodeAction(value);
    setPending(false);

    if (!result.ok) {
      const error = result.error ?? REQUEST_CODE_FALLBACK_ERROR;
      setMessages((prev) => [...prev, { from: "bot", text: error, chips: authAwareChips(error) }]);
      // step ยังเป็น answers.phone อยู่ ช่องกรอกไม่หาย ลองพิมพ์เบอร์ใหม่ได้ทันที
      return;
    }

    // ข้อความเดียวกันเป๊ะไม่ว่าเบอร์จะมีเคสจริงหรือไม่ — ดูเหตุผลที่ CODE_SENT_TEXT
    setMessages((prev) => [...prev, { from: "bot", text: CODE_SENT_TEXT, chips: [MENU_CHIP] }]);
    setStep("answers.code");
  }

  async function submitAnswersCode(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { from: "user", text: value }]);
    setInputValue("");
    setPending(true);
    const result = await verifyCodeAction(value);
    setPending(false);

    if (!result.ok) {
      const error = result.error ?? VERIFY_CODE_FALLBACK_ERROR;
      setMessages((prev) => [...prev, { from: "bot", text: error, chips: codeErrorChips(error) }]);
      // step ยังเป็น answers.code อยู่ ช่องกรอกไม่หาย พิมพ์รหัสใหม่ได้ทันที
      return;
    }

    setMessages((prev) => [
      ...prev,
      { from: "bot", text: result.linkedLine ? CODE_VERIFIED_LINKED_TEXT : CODE_VERIFIED_TEXT },
    ]);
    await refreshAnswers();
  }

  async function submitResend(referralId: string, label: string) {
    setMessages((prev) => [...prev, { from: "user", text: label }]);
    setPending(true);
    const result = await resendAnswerAction(referralId);
    setPending(false);

    const text = result.ok ? RESEND_OK_TEXT : result.error ?? RESEND_FALLBACK_ERROR;
    setMessages((prev) => [...prev, { from: "bot", text, chips: [MENU_CHIP] }]);
  }

  async function selectDocsGroup(group: 1 | 2 | 3 | null, label: string) {
    if (pending) return;
    setMessages((prev) => [...prev, { from: "user", text: label }]);
    setPending(true);
    const result = await listDocumentsAction(group);
    setPending(false);
    setStep("docs.list");

    if (!result.ok) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: result.error ?? DOCS_FALLBACK_ERROR, chips: docsListFooterChips() },
      ]);
      return;
    }
    if (result.docs.length === 0) {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: DOCS_EMPTY_TEXT, chips: docsListFooterChips() },
      ]);
      return;
    }
    setMessages((prev) => [
      ...prev,
      docsListHeaderMessage(result.docs.length),
      ...result.docs.map(docMessage),
      { from: "bot", text: "ดูหมวดอื่นหรือกลับเมนูหลักได้เลยครับ", chips: docsListFooterChips() },
    ]);
  }

  function handleChip(chip: BotChip) {
    if (chip.docGroup !== undefined) {
      void selectDocsGroup(chip.docGroup, chip.label);
      return;
    }
    if (chip.resendReferralId) {
      void submitResend(chip.resendReferralId, chip.label);
      return;
    }
    if (chip.query !== undefined) {
      void submitRegimenSearch(chip.query);
      return;
    }
    if (chip.transplantType) {
      selectTransplantType(chip.transplantType, chip.label);
      return;
    }
    if (chip.indicationId) {
      selectIndication(chip.indicationId, chip.label);
      return;
    }
    if (chip.go) goTo(chip.go, chip.label);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (step === "status.ask") void submitStatus(inputValue);
    else if (step === "cases.ask") void submitCases(inputValue);
    else if (step === "answers.phone") void submitAnswersPhone(inputValue);
    else if (step === "answers.code") void submitAnswersCode(inputValue);
    else if (step === "regimens.ask") void submitRegimenSearch(inputValue);
  }

  const showInput = INPUT_STEPS.includes(step);
  const lastIndex = messages.length - 1;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openWidget}
          aria-label="เปิดแชท Hemato Bot"
          className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-white shadow-lg hover:scale-105 transition-transform print:hidden"
          style={{ bottom: "5.5rem" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hemato-bot.png" alt="" className="h-12 w-12 object-contain" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="แชท Hemato Bot"
          className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl print:hidden"
          style={{
            bottom: "1rem",
            right: "1rem",
            width: "min(24rem, calc(100vw - 2rem))",
            maxHeight: "70vh",
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/hemato-bot.png" alt="" className="h-8 w-8 object-contain" />
              <p className="text-sm font-semibold text-zinc-900">Hemato Bot</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="ปิดแชท Hemato Bot"
              className="rounded-full p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] space-y-2">
                  <div
                    className={`whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                      m.from === "user"
                        ? "rounded-br-sm bg-blue-600 text-white"
                        : "rounded-bl-sm bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    <p>{m.text}</p>
                    {m.items?.length ? (
                      <div className="mt-1.5 space-y-1">
                        {m.items.map((item, itemIndex) => (
                          <p key={itemIndex}>
                            <span className="font-semibold">{item.primary}</span>
                            {item.secondary ? (
                              <span className="text-zinc-500"> — {item.secondary}</span>
                            ) : null}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {m.footer ? <p className="mt-1.5">{m.footer}</p> : null}
                  </div>
                  {(i === lastIndex || m.sticky) && !pending && (m.chips?.length || m.links?.length) ? (
                    <div className="flex flex-wrap gap-1.5">
                      {m.links?.map((link) => {
                        if (link.external) {
                          // ปลายทางข้ามโดเมนจริง (เช่น LINE OA) — เปิดแท็บใหม่
                          return (
                            <a
                              key={link.href}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={LINK_CLASS}
                            >
                              {link.label}
                            </a>
                          );
                        }
                        if (link.hardNavigation) {
                          // route handler ที่ redirect ต่อเอง (เช่น /hemato-bot/line
                          // ไป LINE OAuth) — next/link จะ fetch แบบ RSC ก่อนคลิกแล้วพัง
                          // เมื่อปลายทาง redirect ข้ามโดเมน จึงต้องเป็น <a> แท็บเดิม
                          //
                          // ระหว่างรอหน้า LINE โหลด (หลายวินาที) ต้องมีอะไรบอกว่า
                          // ระบบกำลังทำงาน ไม่งั้นผู้ใช้คิดว่าปุ่มเสีย — ขึ้น bubble
                          // แล้วปล่อยให้เบราว์เซอร์นำทางตามปกติ
                          return (
                            <a
                              key={link.href}
                              href={link.href}
                              className={LINK_CLASS}
                              onClick={() => {
                                setMessages((prev) => [
                                  ...prev,
                                  { from: "bot", text: LINE_REDIRECT_TEXT },
                                ]);
                                setPending(true);
                              }}
                            >
                              {link.label}
                            </a>
                          );
                        }
                        return (
                          <Link key={link.href} href={link.href} className={LINK_CLASS}>
                            {link.label}
                          </Link>
                        );
                      })}
                      {m.chips?.map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => handleChip(chip)}
                          className={CHIP_CLASS}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <p
                  className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-sm text-zinc-500"
                  role="status"
                  aria-label={PENDING_TEXT}
                >
                  {PENDING_TEXT}
                  {/* จุดสามจุดเด้งสลับกัน — สัญญาณว่าระบบยังทำงานอยู่ */}
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </p>
              </div>
            )}
          </div>

          {showInput && (
            <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 p-3">
              <input
                type="text"
                inputMode={NUMERIC_INPUT_STEPS.includes(step) ? "numeric" : "text"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  step === "status.ask"
                    ? REFERRAL_ID_EXAMPLE
                    : step === "answers.code"
                      ? CODE_EXAMPLE_PLACEHOLDER
                      : step === "regimens.ask"
                        ? REGIMEN_QUERY_PLACEHOLDER
                        : "081-234-5678"
                }
                maxLength={step === "answers.code" ? 6 : undefined}
                disabled={pending}
                className="w-full min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
              />
              <button
                type="submit"
                disabled={pending || !inputValue.trim()}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                ส่ง
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
