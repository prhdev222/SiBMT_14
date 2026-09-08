"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CaseMessage } from "@/lib/referral-repository";

type SendResult = {
  ok: boolean;
  error?: string;
  fileUrl?: string;
  fileName?: string;
};

/** ตัวเลือกเสริมตอนส่ง — urgent (ฝั่งแพทย์) / channel (ฝั่ง dent เลือกช่องแจ้ง) */
export type SendOpts = { urgent: boolean; channel: DentChannel };

/** ช่องที่ dent เลือกส่งคำตอบให้แพทย์ต้นทาง */
export type DentChannel = "chat" | "email";

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
  showChannelPicker = false,
  onRefresh,
  onSeen,
}: {
  initialMessages: CaseMessage[];
  mySide: "referrer" | "resident";
  myName: string;
  onSend: (
    text: string,
    file: File | null,
    opts: SendOpts,
  ) => Promise<SendResult>;
  /** true = ล็อกช่องพิมพ์ (เช่น เคสปิดแล้ว) — โชว์เฉพาะประวัติสนทนา */
  locked?: boolean;
  /** true = แสดงปุ่มแนบไฟล์ (PDF/Word/รูป) */
  allowAttach?: boolean;
  /** true = แสดงตัวเลือก "จำเป็นต้องส่งเลย" — ฝั่งแพทย์ต้นทาง */
  showUrgent?: boolean;
  /** true = แสดงตัวเลือกช่องแจ้ง (แชท/อีเมล/LINE) — ฝั่ง dent */
  showChannelPicker?: boolean;
  /** ให้มา = เปิดแชทสด: ดึงข้อความใหม่เองทุก ~7 วิ (หยุดเมื่อสลับไปแท็บอื่น) */
  onRefresh?: () => Promise<CaseMessage[]>;
  /** เรียกเมื่อ poll พบข้อความใหม่ (ให้ล้างธง unread ระหว่างที่กำลังดูอยู่) */
  onSeen?: () => void;
}) {
  // ข้อความจากเซิร์ฟเวอร์ (แหล่งความจริง) + ข้อความที่เพิ่งส่ง (optimistic) รอ poll เก็บ
  const [serverMessages, setServerMessages] =
    useState<CaseMessage[]>(initialMessages);
  const [pending, setPending] = useState<CaseMessage[]>([]);
  const messages = useMemo(
    () => [...serverMessages, ...pending],
    [serverMessages, pending],
  );

  // แชทสด: poll ข้อความใหม่ทุก 7 วิ เฉพาะตอนแท็บนี้ถูกมองอยู่ (ประหยัด)
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const seenRef = useRef(onSeen);
  seenRef.current = onSeen;
  const countRef = useRef(serverMessages.length);
  countRef.current = serverMessages.length;

  useEffect(() => {
    if (!refreshRef.current) return;
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible" || !refreshRef.current) return;
      try {
        const fresh = await refreshRef.current();
        if (!alive) return;
        setServerMessages(fresh);
        // เจอข้อความใหม่จากอีกฝั่ง → ล้างธง unread (กำลังดูอยู่) + ตัด optimistic ที่ถึงแล้ว
        if (fresh.length > countRef.current) seenRef.current?.();
        setPending((p) =>
          p.filter(
            (pm) =>
              !fresh.some(
                (s) =>
                  s.senderRole === pm.senderRole &&
                  s.senderName === pm.senderName &&
                  s.text === pm.text,
              ),
          ),
        );
      } catch {
        /* เงียบ — รอบถัดไปลองใหม่ */
      }
    };
    const id = setInterval(tick, 7000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [channel, setChannel] = useState<DentChannel>("email");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function send() {
    const t = draft.trim();
    if ((!t && !file) || sending) return;
    setSending(true);
    setError(null);
    const result = await onSend(t, file, { urgent, channel });
    if (result.ok) {
      setPending((prev) => [
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
              placeholder="ขอ/ส่งเอกสารเพิ่มเติม หรือแนบไฟล์…"
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
            <label className="flex items-start gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300"
              />
              <span>
                <b>จำเป็นต้องให้ทีมเห็นเดี๋ยวนี้</b> (แจ้งทีมทาง LINE ทันที)
                <span className="block text-zinc-400">
                  ปกติทีมจะได้รับข้อความรอบ 10:00 น. ของวันทำการอยู่แล้ว และเห็นบน
                  dashboard ได้ตลอด — ติ๊กช่องนี้เฉพาะเมื่อรอถึงรอบเช้าไม่ได้จริง ๆ
                </span>
              </span>
            </label>
          )}
          {showChannelPicker && (
            <div className="text-xs text-zinc-600">
              <span className="mr-2">แจ้งแพทย์ต้นทางทาง:</span>
              <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
                {(
                  [
                    ["chat", "แชทเท่านั้น"],
                    ["email", "อีเมล"],
                  ] as [DentChannel, string][]
                ).map(([value, label]) => (
                  <label key={value} className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="dent-channel"
                      checked={channel === value}
                      onChange={() => setChannel(value)}
                    />
                    {label}
                  </label>
                ))}
              </span>
              <span className="block text-zinc-400 mt-0.5">
                {channel === "chat"
                  ? "แพทย์เห็นเมื่อเปิดหน้าเคส — ไม่ส่งอีเมล (เหมาะเมื่อกำลังคุยกันสด)"
                  : "ส่งอีเมลแจ้ง (ฟรี) — แพทย์เปิดหน้าเคสอ่านต่อได้"}
              </span>
            </div>
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
