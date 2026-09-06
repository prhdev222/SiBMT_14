"use client";

import { useRef, useState } from "react";
import type { CaseMessage } from "@/lib/referral-repository";

type SendResult = {
  ok: boolean;
  error?: string;
  fileUrl?: string;
  fileName?: string;
};

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
  locked = false,
  allowAttach = false,
  showUrgent = false,
}: {
  initialMessages: CaseMessage[];
  mySide: "referrer" | "resident";
  myName: string;
  onSend: (
    text: string,
    file: File | null,
    urgent: boolean,
  ) => Promise<SendResult>;
  /** true = ล็อกช่องพิมพ์ (เช่น เคสปิดแล้ว) — โชว์เฉพาะประวัติสนทนา */
  locked?: boolean;
  /** true = แสดงปุ่มแนบไฟล์ (PDF/Word/รูป) */
  allowAttach?: boolean;
  /** true = แสดงตัวเลือก "ด่วน" (แจ้งทีมทันที) — ฝั่งแพทย์ต้นทาง */
  showUrgent?: boolean;
}) {
  const [messages, setMessages] = useState<CaseMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function send() {
    const t = draft.trim();
    if ((!t && !file) || sending) return;
    setSending(true);
    setError(null);
    const result = await onSend(t, file, urgent);
    if (result.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          senderRole: mySide,
          senderName: myName,
          channel: "web",
          text: t,
          createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
          fileName: result.fileName ?? (file ? file.name : undefined),
          fileUrl: result.fileUrl,
        },
      ]);
      setDraft("");
      setFile(null);
      setUrgent(false);
      if (fileInput.current) fileInput.current.value = "";
    } else {
      setError(result.error ?? "ส่งไม่สำเร็จ กรุณาลองใหม่");
    }
    setSending(false);
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > 10 * 1024 * 1024) {
      setError("ไฟล์ใหญ่เกิน 10 MB");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setError(null);
    setFile(f);
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
                  {m.text && (
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  )}
                  {m.fileUrl && (
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        "mt-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium " +
                        (mine
                          ? "bg-white/20 hover:bg-white/30"
                          : "bg-white border border-zinc-200 hover:bg-zinc-50 text-blue-700")
                      }
                    >
                      📎 <span className="truncate">{m.fileName || "ไฟล์แนบ"}</span>
                    </a>
                  )}
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

      {locked ? null : (
        <>
          {file && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs text-blue-800">
              📎 <span className="flex-1 min-w-0 truncate">{file.name}</span>
              <span className="text-blue-400">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
                className="text-blue-500 hover:text-blue-700"
                aria-label="เอาไฟล์ออก"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 border-t border-zinc-100 pt-3">
            {allowAttach && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png"
                  onChange={pickFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  title="แนบไฟล์ (PDF/Word/รูป)"
                  className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
                >
                  📎
                </button>
              </>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
              }}
              rows={2}
              placeholder="พิมพ์ข้อความ…"
              className="flex-1 min-w-0 resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || (!draft.trim() && !file)}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {sending ? "กำลังส่ง…" : "ส่ง"}
            </button>
          </div>
          {showUrgent && (
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span>
                🔴 <b>ด่วน</b> — แจ้งทีมทาง LINE ทันที ·{" "}
                {urgent ? (
                  "ทีมจะได้รับแจ้งเดี๋ยวนี้"
                ) : (
                  <span className="text-zinc-400">
                    ไม่ติ๊ก = ส่งเข้ากลุ่มทีมรอบเช้า 10:00 (ทีมเห็นบน dashboard ได้ตลอด)
                  </span>
                )}
              </span>
            </label>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {allowAttach ? (
            <p className="text-[11px] text-amber-700">
              ⚠️ แนบ PDF/Word/รูปได้ (≤10 MB) · อ้างอิงด้วยเลข HEM- เท่านั้น —{" "}
              <b>ห้ามใส่ชื่อ-สกุล / HN / เลขบัตร</b> ของผู้ป่วยในไฟล์หรือข้อความ
            </p>
          ) : (
            <p className="text-[11px] text-zinc-400">
              กด Ctrl/⌘ + Enter เพื่อส่งเร็ว · ทุกข้อความถูกบันทึกเป็นบันทึกการปรึกษา
            </p>
          )}
        </>
      )}
    </div>
  );
}
