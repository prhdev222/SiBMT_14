"use client";

import { useState, useTransition } from "react";
import type { DocumentRow } from "@/lib/referral-repository";
import {
  deleteDocumentAction,
  refreshDocumentsAction,
  saveDocumentAction,
  setDocumentActiveAction,
} from "./actions";

const GROUP_OPTIONS = [
  { value: "ทั้งหมด", label: "ทุกกลุ่ม" },
  { value: "1", label: "กลุ่ม 1 (ปลูกถ่าย)" },
  { value: "2,3", label: "กลุ่ม 2,3" },
  { value: "2", label: "กลุ่ม 2" },
  { value: "3", label: "กลุ่ม 3" },
];

const EMPTY = {
  title: "",
  url: "",
  groups: "ทั้งหมด",
  description: "",
  originalTitle: "",
  originalUrl: "",
};

/**
 * แก้คลังเอกสาร/ลิงก์ไฟล์บนเว็บ — เพิ่ม / แก้ / ซ่อน / ลบถาวร
 * โดยไม่ต้องเปิด Google Sheet
 *
 * แนบไฟล์: อัปไฟล์ขึ้น Google Drive เอง → แชร์ "ใครมีลิงก์ดูได้" → วางลิงก์ตรงนี้
 * (เว็บอัปไฟล์ให้ตรง ๆ ไม่ได้ด้วยเหตุผลด้านสิทธิ์และความปลอดภัย)
 */
export function DocumentsEditor({ initial }: { initial: DocumentRow[] }) {
  const [rows, setRows] = useState<DocumentRow[]>(initial);
  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isEditing = Boolean(form.originalTitle || form.originalUrl);

  function apply(result: { ok: boolean; error?: string }) {
    if (!result.ok) {
      setError(result.error ?? "บันทึกไม่สำเร็จ");
      return false;
    }
    setError(null);
    return true;
  }

  async function refresh() {
    setRows(await refreshDocumentsAction());
  }

  function resetForm() {
    setForm({ ...EMPTY });
    setShowForm(false);
    setError(null);
  }

  function save() {
    if (!form.title.trim() || !form.url.trim()) {
      setError("กรอกชื่อเอกสารและลิงก์ให้ครบก่อน");
      return;
    }
    startTransition(async () => {
      if (apply(await saveDocumentAction(form))) {
        resetForm();
        await refresh();
      }
    });
  }

  function startEdit(d: DocumentRow) {
    setForm({
      title: d.title,
      url: d.url,
      groups: d.groups || "ทั้งหมด",
      description: d.description,
      originalTitle: d.title,
      originalUrl: d.url,
    });
    setShowForm(true);
    setError(null);
  }

  function toggle(d: DocumentRow) {
    startTransition(async () => {
      if (apply(await setDocumentActiveAction(d.title, d.url, !d.active)))
        await refresh();
    });
  }

  function remove(d: DocumentRow) {
    if (
      !window.confirm(
        `ลบเอกสาร "${d.title}" ถาวร?\n\nลบแล้วหายจากคลังทันที กู้คืนไม่ได้ ` +
          "(ถ้าแค่อยากซ่อนชั่วคราว ให้กด “ซ่อน” แทน)",
      )
    )
      return;
    startTransition(async () => {
      if (apply(await deleteDocumentAction(d.title, d.url))) await refresh();
    });
  }

  return (
    <div className="space-y-3">
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + เพิ่มเอกสาร / ลิงก์ไฟล์
        </button>
      )}

      {showForm && (
        <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-800">
            {isEditing ? "แก้เอกสาร" : "เพิ่มเอกสารใหม่"}
          </p>

          <label className="block text-sm">
            <span className="text-zinc-600">ชื่อเอกสาร</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="เช่น ใบส่งตรวจ HLA typing"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-600">ลิงก์ไฟล์ (URL)</span>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://drive.google.com/file/d/..../view"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              อัปไฟล์ขึ้น Google Drive → แชร์ &ldquo;ใครมีลิงก์ดูได้&rdquo; →
              copy ลิงก์มาวาง
            </span>
          </label>

          <label className="block text-sm">
            <span className="text-zinc-600">แสดงในกลุ่ม</span>
            <select
              value={form.groups}
              onChange={(e) => setForm({ ...form, groups: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 bg-white"
            >
              {GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-zinc-600">คำอธิบาย (ไม่บังคับ)</span>
            <input
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="เช่น ฉบับปรับปรุงล่าสุด"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {!showForm && error && (
        <p className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">ยังไม่มีเอกสารในคลัง</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
          {rows.map((d) => (
            <li key={d.title + d.url} className="px-3 py-2.5 text-sm">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      "font-medium truncate " +
                      (d.active ? "text-zinc-900" : "text-zinc-400")
                    }
                  >
                    {d.title}
                    {!d.active && (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-500">
                        ซ่อนอยู่
                      </span>
                    )}
                  </p>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline break-all"
                  >
                    {d.url}
                  </a>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    กลุ่ม: {d.groups || "ทั้งหมด"}
                    {d.description ? ` · ${d.description}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(d)}
                  className="rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => toggle(d)}
                  disabled={pending}
                  className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                >
                  {d.active ? "ซ่อน" : "แสดง"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(d)}
                  disabled={pending}
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  ลบถาวร
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
