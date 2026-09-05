"use client";

import { useState } from "react";
import { checkStructureAction } from "./actions";

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

  return (
    <div className="space-y-3">
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
