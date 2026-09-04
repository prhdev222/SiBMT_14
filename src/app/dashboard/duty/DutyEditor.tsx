"use client";

/**
 * ตัวแก้ตารางเวร Chief จากหน้าเวร — ใช้ตอนแลกเวรกันโดยไม่ต้องเปิด HSOS/ชีต
 *
 * การแก้ที่นี่เขียนลงชีต resident_schedule ทันที (ผ่าน Apps Script) และ
 * "อยู่ถาวร" — ไม่มี sync อัตโนมัติมาเขียนทับ ปุ่มดึงจาก HSOS เป็นคำสั่ง
 * เขียนทับทั้งชุดโดยเจตนา จึงมี confirm เตือนก่อนเสมอ
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ResidentShift } from "@/lib/referral-repository";
import {
  deleteShiftAction,
  saveShiftAction,
  syncFromHsosAction,
} from "./actions";

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:bg-zinc-100";

export function DutyEditor({
  shifts,
  residents,
}: {
  /** เฉพาะช่วงปัจจุบัน+อนาคต — เวรที่ผ่านมาแล้วเป็นประวัติ ไม่เปิดให้แก้ */
  shifts: ResidentShift[];
  residents: string[];
}) {
  const router = useRouter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keyOf = (s: ResidentShift) => `${s.fromDate}|${s.toDate}|${s.name}`;

  async function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setSaving(true);
    setError(null);
    const result = await task();
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return false;
    }
    setEditingKey(null);
    setAdding(false);
    router.refresh();
    return true;
  }

  async function handleSync() {
    const sure = window.confirm(
      "ดึงตารางเวรจาก HSOS ทับข้อมูลในระบบทั้งชุด?\n\n" +
        "ช่วงเวรที่แก้/เพิ่มมือไว้ในระบบนี้จะถูกเขียนทับด้วยข้อมูลจาก HSOS",
    );
    if (!sure) return;
    await run(() => syncFromHsosAction());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setEditingKey(null);
            setError(null);
          }}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          ＋ เพิ่มช่วงเวร
        </button>
        <button
          type="button"
          onClick={handleSync}
          disabled={saving}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400"
        >
          🔄 ดึงตารางจาก HSOS
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {adding && (
        <ShiftForm
          residents={residents}
          saving={saving}
          onCancel={() => setAdding(false)}
          onSave={(values) =>
            run(() =>
              saveShiftAction({
                originalFrom: "",
                originalTo: "",
                originalName: "",
                ...values,
              }),
            )
          }
        />
      )}

      <ul className="space-y-2">
        {shifts.map((s) => {
          const key = keyOf(s);
          if (editingKey === key) {
            return (
              <li key={key}>
                <ShiftForm
                  residents={residents}
                  initial={s}
                  saving={saving}
                  onCancel={() => setEditingKey(null)}
                  onSave={(values) =>
                    run(() =>
                      saveShiftAction({
                        originalFrom: s.fromDate,
                        originalTo: s.toDate,
                        originalName: s.name,
                        ...values,
                      }),
                    )
                  }
                  onDelete={() => {
                    if (
                      window.confirm(
                        `ลบช่วงเวร ${s.name} (${s.fromDate} – ${s.toDate})?`,
                      )
                    ) {
                      void run(() =>
                        deleteShiftAction({
                          fromDate: s.fromDate,
                          toDate: s.toDate,
                          residentName: s.name,
                        }),
                      );
                    }
                  }}
                />
              </li>
            );
          }
          return (
            <li
              key={key}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <span className="font-medium text-zinc-900">{s.name}</span>
              <span className="text-zinc-500">
                {s.fromDate} – {s.toDate}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingKey(key);
                  setAdding(false);
                  setError(null);
                }}
                disabled={saving}
                className="ml-auto rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                แก้ / แลกเวร
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ShiftForm({
  residents,
  initial,
  saving,
  onSave,
  onCancel,
  onDelete,
}: {
  residents: string[];
  initial?: ResidentShift;
  saving: boolean;
  onSave: (values: {
    fromDate: string;
    toDate: string;
    residentName: string;
  }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [fromDate, setFromDate] = useState(initial?.fromDate ?? "");
  const [toDate, setToDate] = useState(initial?.toDate ?? "");
  const [residentName, setResidentName] = useState(initial?.name ?? "");

  const valid = fromDate && toDate && residentName && fromDate <= toDate;

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-blue-50/50 p-3 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-zinc-600">
          เริ่มเวร
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            disabled={saving}
            className={`mt-1 block ${INPUT_CLASS}`}
          />
        </label>
        <label className="text-xs text-zinc-600">
          ถึงวันที่ (รวมวันนั้น)
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            disabled={saving}
            className={`mt-1 block ${INPUT_CLASS}`}
          />
        </label>
        <label className="text-xs text-zinc-600">
          Chief resident
          <select
            value={residentName}
            onChange={(e) => setResidentName(e.target.value)}
            disabled={saving}
            className={`mt-1 block min-w-40 ${INPUT_CLASS}`}
          >
            <option value="">— เลือกชื่อ —</option>
            {initial?.name && !residents.includes(initial.name) && (
              <option value={initial.name}>{initial.name}</option>
            )}
            {residents.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave({ fromDate, toDate, residentName })}
          disabled={saving || !valid}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          ยกเลิก
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="ml-auto rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            ลบช่วงเวรนี้
          </button>
        )}
      </div>
    </div>
  );
}
