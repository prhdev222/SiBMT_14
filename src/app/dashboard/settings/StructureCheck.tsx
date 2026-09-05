"use client";

import { useState } from "react";
import {
  checkStructureAction,
  protectHeadersAction,
  unprotectHeadersAction,
} from "./actions";

/**
 * ปุ่มตรวจโครงสร้างชีต — แอดมินกดหลังแก้ตาราง เพื่อรู้ทันทีว่ายังถูกต้องไหม
 * ก่อนที่ dashboard จะพังเงียบ ๆ (ป้องกันแอดมินใหม่แก้หัวคอลัมน์แล้วไม่รู้ตัว)
 */
export function StructureCheck() {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok" }
    | { kind: "problems"; items: string[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [lock, setLock] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "done"; locked: string[] }
    | { kind: "unlocked"; tabs: string[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function run() {
    setState({ kind: "loading" });
    const result = await checkStructureAction();
    if (!result.ok) {
      setState({ kind: "error", message: result.error ?? "ตรวจไม่สำเร็จ" });
    } else if ((result.problems ?? []).length === 0) {
      setState({ kind: "ok" });
    } else {
      setState({ kind: "problems", items: result.problems ?? [] });
    }
  }

  async function runUnlock() {
    if (
      !window.confirm(
        "ปลดล็อกหัวคอลัมน์ทุกแท็บ?\n\nหลังปลดล็อก ใครก็แก้แถวหัวคอลัมน์ได้ — " +
          "ระวังการแก้ผิดที่ทำให้ระบบอ่านข้อมูลไม่เจอ",
      )
    )
      return;
    setLock({ kind: "loading" });
    const result = await unprotectHeadersAction();
    if (result.ok) {
      setLock({ kind: "unlocked", tabs: result.unlocked ?? [] });
    } else {
      setLock({ kind: "error", message: result.error ?? "ปลดล็อกไม่สำเร็จ" });
    }
  }

  async function runLock() {
    if (
      !window.confirm(
        "ล็อกแถวหัวคอลัมน์ทุกแท็บ?\n\nหลังล็อก แถวหัว (แถวบนสุด) จะแก้ได้เฉพาะ" +
          "เจ้าของไฟล์ ส่วนแถวข้อมูลด้านล่างยังแก้ได้ตามปกติ — ทำครั้งเดียวก็พอ",
      )
    )
      return;
    setLock({ kind: "loading" });
    const result = await protectHeadersAction();
    if (result.ok) {
      setLock({ kind: "done", locked: result.locked ?? [] });
    } else {
      setLock({ kind: "error", message: result.error ?? "ล็อกไม่สำเร็จ" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 space-y-2">
        <p className="text-sm text-zinc-700">
          กดล็อกหัวคอลัมน์ครั้งเดียว — กันแอดมินใหม่เผลอแก้หัวคอลัมน์แล้วระบบพัง
          (แถวข้อมูลยังแก้ได้ตามปกติ)
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runLock}
            disabled={lock.kind === "loading"}
            className="rounded-lg border-2 border-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
          >
            {lock.kind === "loading" ? "กำลังดำเนินการ…" : "🔒 ล็อกหัวคอลัมน์ทุกแท็บ"}
          </button>
          <button
            type="button"
            onClick={runUnlock}
            disabled={lock.kind === "loading"}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            🔓 ปลดล็อก
          </button>
        </div>
        {lock.kind === "done" && (
          <p className="text-sm text-green-800">
            ล็อกแล้ว 🔒 — {lock.locked.length} แท็บ ({lock.locked.join(", ")})
          </p>
        )}
        {lock.kind === "unlocked" && (
          <p className="text-sm text-zinc-700">
            {lock.tabs.length
              ? "ปลดล็อกแล้ว 🔓 — " + lock.tabs.join(", ")
              : "ไม่พบหัวคอลัมน์ที่ล็อกไว้"}
          </p>
        )}
        {lock.kind === "error" && (
          <p className="text-sm text-amber-800">{lock.message}</p>
        )}
      </div>

      <button
        type="button"
        onClick={run}
        disabled={state.kind === "loading"}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        {state.kind === "loading" ? "กำลังตรวจ…" : "🔍 ตรวจโครงสร้างชีตตอนนี้"}
      </button>

      {state.kind === "ok" && (
        <div className="rounded-lg bg-green-50 border border-green-300 px-4 py-3 text-sm text-green-900">
          ✅ โครงสร้างชีตถูกต้อง ระบบพร้อมใช้งาน
        </div>
      )}

      {state.kind === "problems" && (
        <div className="rounded-lg bg-red-50 border border-red-300 px-4 py-3 text-sm text-red-900 space-y-1.5">
          <p className="font-semibold">
            พบ {state.items.length} จุดที่ต้องแก้:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            {state.items.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
          {state.message}
        </div>
      )}
    </div>
  );
}
