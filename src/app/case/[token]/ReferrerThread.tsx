"use client";

import { useEffect, useState } from "react";
import type { CaseMessage } from "@/lib/referral-repository";
import { MessageThreadView } from "@/components/MessageThreadView";
import {
  closeCaseAction,
  markReadReferrerAction,
  reopenCaseAction,
  sendReferrerMessageAction,
} from "./actions";

/**
 * กล่องสนทนาฝั่งแพทย์ต้นทางในหน้า /case/[token]
 * เปิดหน้าปุ๊บล้างธง unread (ฟรี) เพื่อให้ข้อความใหม่ครั้งถัดไป push เตือนได้อีก
 * มีปุ่ม "จบเคส" ให้แพทย์ต้นทางปิดเองเมื่ออ่านคำแนะนำแล้วดูแลต่อได้
 */
export function ReferrerThread({
  caseToken,
  referrerOrg,
  initialMessages,
  initiallyClosed,
  autoPromptClose = false,
}: {
  caseToken: string;
  referrerOrg: string;
  initialMessages: CaseMessage[];
  initiallyClosed: boolean;
  /** มาจากลิงก์ "จบเคส" ในอีเมล/LINE (?done=1) — เด้งยืนยันจบเคสให้ทันที */
  autoPromptClose?: boolean;
}) {
  const [closed, setClosed] = useState(initiallyClosed);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    markReadReferrerAction(caseToken);
  }, [caseToken]);

  // เปิดหน้าจากลิงก์ "จบเคส" ในอีเมล/LINE → เด้งยืนยันเลย (คลิกเดียวจบ)
  useEffect(() => {
    if (autoPromptClose && !initiallyClosed) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function close() {
    if (
      !window.confirm(
        "จบเคสนี้?\n\nเหมาะเมื่ออ่านคำแนะนำแล้วนำไปดูแลต่อเองได้ — " +
          "เคสจะถูกปิด ถ้ามีคำถามเพิ่มภายหลังยังพิมพ์ได้ ทีมจะเห็น",
      )
    )
      return;
    setClosing(true);
    setError(null);
    const result = await closeCaseAction(caseToken);
    if (result.ok) setClosed(true);
    else setError(result.error ?? "จบเคสไม่สำเร็จ");
    setClosing(false);
  }

  async function reopen() {
    setReopening(true);
    setError(null);
    const result = await reopenCaseAction(caseToken);
    if (result.ok) setClosed(false);
    else setError(result.error ?? "เปิดเคสไม่สำเร็จ");
    setReopening(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <MessageThreadView
        initialMessages={initialMessages}
        mySide="referrer"
        myName={referrerOrg || "แพทย์ต้นทาง"}
        onSend={(text, file, opts) =>
          sendReferrerMessageAction(caseToken, text, file, opts.urgent)
        }
        locked={closed}
        allowAttach
        showUrgent
      />

      {closed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <span className="text-sm text-emerald-800">
            ✓ เคสนี้ปิดแล้ว — มีคำถามเพิ่ม? เปิดเคสใหม่ก่อนได้เลย
          </span>
          <button
            type="button"
            onClick={reopen}
            disabled={reopening}
            className="rounded-lg border border-emerald-400 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {reopening ? "กำลังเปิด…" : "เปิดเคสใหม่เพื่อถามเพิ่ม"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2.5">
          <span className="text-sm text-zinc-600">
            อ่านคำแนะนำแล้ว นำไปดูแลต่อเองได้?
          </span>
          <button
            type="button"
            onClick={close}
            disabled={closing}
            className="rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {closing ? "กำลังจบเคส…" : "✓ จบเคสนี้"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
