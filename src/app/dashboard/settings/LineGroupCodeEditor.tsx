"use client";

import { useState } from "react";
import { setLineGroupCodeAction } from "./actions";

/** สุ่มรหัส 6 ตัว ตัดตัวที่สับสน 0/O 1/I ออก — ชุดเดียวกับฝั่ง Apps Script */
function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * รหัสผูกกลุ่ม LINE — อ่าน/แก้ค่า line_group_code ในชีต config
 *
 * ทีมเชิญบอท OA เข้ากลุ่ม LINE ของตัวเอง แล้วพิมพ์ "ผูกกลุ่ม <รหัส>" ในกลุ่มนั้น
 * กลุ่มจะถามบอทได้ (เคสค้าง / นัดวันนี้) และเข้า dashboard ด้วย LINE ได้ทันที
 * ไม่ต้องขอ groupId มาวางใน Apps Script อีก
 */
export function LineGroupCodeEditor({ initialCode }: { initialCode: string }) {
  const [saved, setSaved] = useState(initialCode);
  const [draft, setDraft] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dirty = draft.trim().toUpperCase() !== saved;
  const bindText = `ผูกกลุ่ม ${saved}`;

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    const result = await setLineGroupCodeAction(draft);
    if (result.ok) {
      setSaved(draft.trim().toUpperCase());
    } else {
      setError(result.error ?? "บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  async function copyBind() {
    try {
      await navigator.clipboard.writeText(bindText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      {saved ? (
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 space-y-2">
          <p className="text-xs text-zinc-500">
            ส่งบรรทัดนี้ให้ทีม — พิมพ์ในกลุ่ม LINE ที่เชิญบอทเข้าไปแล้ว
          </p>
          <div className="flex items-center justify-between gap-3">
            <code className="text-base font-semibold tracking-wide text-zinc-900">
              {bindText}
            </code>
            <button
              type="button"
              onClick={copyBind}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white"
            >
              {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          ยังไม่มีรหัส — ตั้งด้านล่าง หรือพิมพ์ &ldquo;รหัสผูกกลุ่ม&rdquo;
          ในกลุ่ม Telegram แอดมิน ระบบจะสร้างให้เอง
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          maxLength={12}
          placeholder="เช่น AB12CD"
          aria-label="รหัสผูกกลุ่ม LINE"
          className="w-40 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tracking-wider uppercase focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setDraft(randomCode())}
          disabled={saving}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          สุ่มใหม่
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก…" : "บันทึกรหัส"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <p className="text-[11px] text-zinc-400">
        เปลี่ยนรหัสแล้ว รหัสเดิมใช้ผูกไม่ได้ทันที กลุ่มที่ผูกไว้แล้วไม่หลุด ·
        ให้รหัสเฉพาะบุคลากรของหน่วย เพราะกลุ่มที่ผูกจะเข้า dashboard ได้ ·
        เอาบอทออกจากกลุ่ม = สิทธิ์กลุ่มนั้นหลุดทันที
      </p>
    </div>
  );
}
