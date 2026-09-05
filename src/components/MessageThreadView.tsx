"use client";

import { useState } from "react";
import type { CaseMessage } from "@/lib/referral-repository";

/**
 * มุมมองบทสนทนาต่อเคส — ใช้ทั้งหน้า /case (แพทย์ต้นทาง) และ dashboard (dent)
 *
 * mySide = ฝั่งของผู้ใช้คนนี้ ข้อความของตัวเองชิดขวา ของอีกฝ่ายชิดซ้าย
 * ส่งสำเร็จแล้วต่อข้อความเข้าไปเลย (optimistic) ไม่ต้องรอโหลดใหม่
 */
export function MessageThreadView({
  initialMessages,
  mySide,
  myName,
  onSend,
}: {
  initialMessages: CaseMessage[];
  mySide: "referrer" | "resident";
  myName: string;
  onSend: (text: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [messages, setMessages] = useState<CaseMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const t = draft.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    const result = await onSend(t);
    if (result.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          senderRole: mySide,
          senderName: myName,
          channel: "web",
          text: t,
          createdAt: new Date()
            .toISOString()
            .slice(0, 16)
            .replace("T", " "),
        },
      ]);
      setDraft("");
    } else {
      setError(result.error ?? "ส่งไม่สำเร็จ กรุณาลองใหม่");
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">
            ยังไม่มีข้อความ — เริ่มพิมพ์ด้านล่างได้เลย
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === mySide;
            return (
              <div
                key={m.id}
                className={mine ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm " +
                    (mine
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-zinc-100 text-zinc-900 rounded-bl-sm")
                  }
                >
                  <div
                    className={
                      "mb-0.5 flex items-center gap-1.5 text-xs " +
                      (mine ? "text-blue-100" : "text-zinc-500")
                    }
                  >
                    <span className="font-medium">
                      {m.senderRole === "system" ? "ระบบ" : m.senderName || "—"}
                    </span>
                    {m.channel === "line" && <span title="ทาง LINE">· LINE</span>}
                  </div>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <div
                    className={
                      "mt-0.5 text-[11px] " +
                      (mine ? "text-blue-100" : "text-zinc-400")
                    }
                  >
                    {m.createdAt}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-zinc-100 pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          rows={2}
          placeholder="พิมพ์ข้อความ… (แนบลิงก์ไฟล์ได้)"
          className="flex-1 min-w-0 resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {sending ? "กำลังส่ง…" : "ส่ง"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] text-zinc-400">
        กด Ctrl/⌘ + Enter เพื่อส่งเร็ว · ทุกข้อความถูกบันทึกเป็นบันทึกการปรึกษา
      </p>
    </div>
  );
}
