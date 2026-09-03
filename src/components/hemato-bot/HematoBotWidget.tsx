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
import { lookupStatusAction, listCasesAction } from "@/app/hemato-bot/actions";
import {
  BOT_PARAM_MESSAGES,
  CASES_NOT_FOUND_TEXT,
  MAIN_MENU_CHIPS,
  MENU_CHIP,
  REFERRAL_ID_EXAMPLE,
  RETRY_CASES_CHIP,
  RETRY_STATUS_CHIP,
  SEARCH_ANOTHER_ID_CHIP,
  SEARCH_ANOTHER_PHONE_CHIP,
  STATIC_STEP_MESSAGES,
  STATUS_NOT_FOUND_TEXT,
  casesAskMessage,
  casesFoundSummary,
  formatCaseLine,
  formatStatusResult,
  greetingMessage,
  menuMessage,
  statusAskMessage,
  type BotChip,
  type BotMessage,
  type BotStep,
} from "./flows";

/** หน้าที่ไม่ควรมีวิดเจ็ตลอย — เป็นหน้าทำงานของบุคลากร/หน้าเปิดจากลิงก์เฉพาะ */
const HIDDEN_PATH_PREFIXES = ["/dashboard", "/login", "/answer"];

function buildStepMessages(step: BotStep): BotMessage[] {
  if (step === "menu") return [menuMessage()];
  if (step === "status.ask") return [statusAskMessage()];
  if (step === "cases.ask") return [casesAskMessage()];
  return STATIC_STEP_MESSAGES[step]?.() ?? [];
}

export function HematoBotWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<BotStep>("menu");
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // เปิดอัตโนมัติพร้อมข้อความที่เหมาะสมเมื่อกลับมาจากหน้าผูกบัญชี LINE (Task 7)
  // ดู src/app/hemato-bot/line/{route,callback}/route.ts สำหรับค่าที่เป็นไปได้
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const bot = params.get("bot");
    if (!bot) return;
    const text = BOT_PARAM_MESSAGES[bot];
    if (!text) return;

    // sync จาก URL query (external system) ตอน mount ครั้งเดียว — แพตเทิร์นเดียว
    // กับ FontSizeControl.tsx ที่ sync จาก localStorage ตอน mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([{ from: "bot", text, chips: MAIN_MENU_CHIPS }]);
    setStep("menu");
    setOpen(true);

    // ล้าง ?bot= ออกจาก URL กันข้อความเด้งซ้ำตอนรีเฟรช/กด back
    params.delete("bot");
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (search ? `?${search}` : "") + window.location.hash,
    );
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
    setMessages((prev) => [
      ...(userLabel ? [...prev, { from: "user", text: userLabel } as BotMessage] : prev),
      ...buildStepMessages(next),
    ]);
    setStep(next);
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

  function handleChip(chip: BotChip) {
    goTo(chip.go, chip.label);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (step === "status.ask") void submitStatus(inputValue);
    else if (step === "cases.ask") void submitCases(inputValue);
  }

  const showInput = step === "status.ask" || step === "cases.ask";
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
                  <p
                    className={`whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                      m.from === "user"
                        ? "rounded-br-sm bg-blue-600 text-white"
                        : "rounded-bl-sm bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    {m.text}
                  </p>
                  {i === lastIndex && !pending && (m.chips?.length || m.links?.length) ? (
                    <div className="flex flex-wrap gap-1.5">
                      {m.links?.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex items-center rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          {link.label}
                        </Link>
                      ))}
                      {m.chips?.map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => handleChip(chip)}
                          className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
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
                <p className="rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-sm text-zinc-500">
                  กำลังค้นข้อมูล...
                </p>
              </div>
            )}
          </div>

          {showInput && (
            <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 p-3">
              <input
                type="text"
                inputMode={step === "cases.ask" ? "numeric" : "text"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={step === "status.ask" ? REFERRAL_ID_EXAMPLE : "081-234-5678"}
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
