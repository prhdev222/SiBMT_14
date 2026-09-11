"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CaseMessage } from "@/lib/referral-repository";
import { MessageThreadView } from "@/components/MessageThreadView";
import {
  closeCaseAction,
  loadCaseMessagesAction,
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

  // กดจบเคสพลาด (ลิงก์ ?done=1 ในอีเมลกดง่าย) → เปิดกลับได้เอง ไม่ต้องติดต่อทีม
  // (คำขอผู้ใช้ 11 ก.ย. 2569) เคสกลับไปรอทีมและทีมได้รับแจ้งทาง Telegram
  async function reopen() {
    setClosing(true);
    setError(null);
    const result = await reopenCaseAction(caseToken);
    if (result.ok) setClosed(false);
    else setError(result.error ?? "เปิดเคสกลับไม่สำเร็จ");
    setClosing(false);
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
        onRefresh={() => loadCaseMessagesAction(caseToken)}
        onSeen={() => markReadReferrerAction(caseToken)}
      />

      {closed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <span className="text-sm text-emerald-800">
            ✓ เคสนี้ปิดแล้ว — เรื่องใหม่กรุณากรอกฟอร์มส่งต่อใหม่ (1 เรื่อง = 1 เคส)
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reopen}
              disabled={closing}
              className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              {closing ? "กำลังเปิด…" : "ปิดผิด? เปิดเคสกลับ"}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-emerald-400 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              กรอกฟอร์มเรื่องใหม่ →
            </Link>
          </div>
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
