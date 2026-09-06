"use client";

import { useState } from "react";
import { setLinePushAction } from "./actions";

/**
 * สวิตช์เปิด/ปิด LINE push อัตโนมัติ — เขียนค่า line_push ในชีต config
 * ปิด (ค่าเริ่มต้น) = ไม่เสียโควตา LINE · ทีมดึงข้อมูลเองผ่านปุ่ม/เมนู + dashboard
 */
export function LinePushToggle({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setOn(next); // แสดงผลทันที
    const result = await setLinePushAction(next);
    if (!result.ok) {
      setOn(!next); // คืนค่าถ้าบันทึกไม่สำเร็จ
      setError(result.error ?? "บันทึกไม่สำเร็จ");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 rounded-lg bg-zinc-50 border border-zinc-200 p-3">
        <div>
          <p className="text-sm font-medium text-zinc-900">
            แจ้งเตือน LINE อัตโนมัติ (push)
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {on
              ? "เปิดอยู่ — ระบบเด้งแจ้งเตือนเข้า LINE เอง (ใช้โควตา LINE)"
              : "ปิดอยู่ — ไม่เสียโควตา LINE · ทีมกดปุ่ม “เมนู/ข้อความใหม่” ดึงเอง + ดู dashboard"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => toggle(!on)}
          disabled={saving}
          className={
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 " +
            (on ? "bg-green-500" : "bg-zinc-300")
          }
        >
          <span
            className={
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
              (on ? "translate-x-6" : "translate-x-1")
            }
          />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] text-zinc-400">
        ปิดไว้เพื่อประหยัดค่าใช้จ่าย LINE — การถาม-ตอบยังทำงานครบผ่าน dashboard,
        อีเมล และการพิมพ์คำสั่งในกลุ่ม LINE (บอทตอบให้ฟรี)
      </p>
    </div>
  );
}
