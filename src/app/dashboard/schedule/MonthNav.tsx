"use client";

/**
 * ตัวเลือกเดือนแบบมือถือ: ‹ [dropdown เดือน] ›
 *
 * เม็ดเดือน 14 อันแบบ desktop กินจอมือถือไป 4-5 บรรทัดจนปฏิทินตกไปอยู่
 * ใต้พับ — มือถือจึงใช้ลูกศรเลื่อนทีละเดือน (ท่าที่ใช้บ่อยสุด) คู่กับ
 * dropdown ไว้กระโดดไกล ๆ ส่วน desktop ยังเป็นเม็ดเดือนเหมือนเดิม
 */

import { useRouter } from "next/navigation";

export function MonthNav({
  months,
  selected,
  formatLabel,
}: {
  months: string[];
  selected: string;
  /** ป้ายเดือนภาษาไทยที่ format มาแล้วจาก server เรียงตาม months */
  formatLabel: Record<string, string>;
}) {
  const router = useRouter();
  const index = months.indexOf(selected);
  const prev = index > 0 ? months[index - 1] : null;
  const next = index >= 0 && index < months.length - 1 ? months[index + 1] : null;

  const go = (month: string | null) => {
    if (month) router.push(`/dashboard/schedule?month=${month}`);
  };

  const arrowClass = (enabled: boolean) =>
    `flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
      enabled
        ? "border-zinc-300 bg-white text-zinc-700 active:bg-zinc-100"
        : "border-zinc-200 bg-zinc-50 text-zinc-300"
    }`;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(prev)}
        disabled={!prev}
        aria-label="เดือนก่อนหน้า"
        className={arrowClass(Boolean(prev))}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <select
        value={selected}
        onChange={(e) => go(e.target.value)}
        aria-label="เลือกเดือน"
        className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {formatLabel[m] ?? m}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => go(next)}
        disabled={!next}
        aria-label="เดือนถัดไป"
        className={arrowClass(Boolean(next))}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
