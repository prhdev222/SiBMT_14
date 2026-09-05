"use client";

import { useState, useTransition } from "react";
import type { AttendingRow } from "@/lib/referral-repository";
import {
  refreshAttendingsAction,
  saveAttendingAction,
  setAttendingActiveAction,
} from "./actions";

/**
 * แก้รายชื่ออาจารย์ที่ปรึกษาบนเว็บ — เพิ่ม / แก้ชื่อ / เปิด-ปิดใช้งาน
 * โดยไม่ต้องเปิด Google Sheet (เขียนผ่าน Apps Script ที่รันในฐานะเจ้าของไฟล์)
 *
 * ที่ตอบคำปรึกษา (resident) จะเห็นเฉพาะคนที่ "เปิดใช้งาน" ใน dropdown
 */
export function AttendingsEditor({ initial }: { initial: AttendingRow[] }) {
  const [rows, setRows] = useState<AttendingRow[]>(initial);
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply(result: { ok: boolean; error?: string }) {
    if (!result.ok) {
      setError(result.error ?? "บันทึกไม่สำเร็จ");
      return false;
    }
    setError(null);
    return true;
  }

  async function refresh() {
    setRows(await refreshAttendingsAction());
  }

  function add() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      if (apply(await saveAttendingAction(name, ""))) {
        setNewName("");
        await refresh();
      }
    });
  }

  function saveEdit(originalName: string) {
    const name = draft.trim();
    if (!name) return;
    startTransition(async () => {
      if (apply(await saveAttendingAction(name, originalName))) {
        setEditingName(null);
        await refresh();
      }
    });
  }

  function toggle(name: string, active: boolean) {
    startTransition(async () => {
      if (apply(await setAttendingActiveAction(name, active))) await refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* เพิ่มอาจารย์ใหม่ */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="พิมพ์ชื่ออาจารย์ เช่น อ. สมชาย"
          className="flex-1 min-w-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !newName.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          + เพิ่มอาจารย์
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">ยังไม่มีรายชื่ออาจารย์</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
          {rows.map((r) => (
            <li
              key={r.name}
              className="flex items-center gap-2 px-3 py-2.5 text-sm"
            >
              {editingName === r.name ? (
                <>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(r.name)}
                    autoFocus
                    className="flex-1 min-w-0 rounded-md border border-zinc-300 px-2 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(r.name)}
                    disabled={pending}
                    className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingName(null)}
                    className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                  >
                    ยกเลิก
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={
                      "flex-1 min-w-0 truncate " +
                      (r.active ? "text-zinc-900" : "text-zinc-400 line-through")
                    }
                  >
                    {r.name}
                  </span>
                  {!r.active && (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                      ปิดใช้งาน
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(r.name);
                      setDraft(r.name);
                    }}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                  >
                    แก้ชื่อ
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(r.name, !r.active)}
                    disabled={pending}
                    className={
                      "shrink-0 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50 " +
                      (r.active
                        ? "text-zinc-600 hover:bg-zinc-100"
                        : "text-green-700 hover:bg-green-50")
                    }
                  >
                    {r.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
