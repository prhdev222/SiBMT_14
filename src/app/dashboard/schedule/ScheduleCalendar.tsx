"use client";

import { useState } from "react";
import { dayOfMonth, type ScheduleDay } from "@/lib/fellow-schedule";
import { ScheduleEditor } from "./ScheduleEditor";

const WEEKDAY_LABELS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

/** สร้างช่องปฏิทินทั้งเดือน โดยเริ่มสัปดาห์ที่วันจันทร์ */
function buildCells(yearMonth: string, days: ScheduleDay[]) {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  // getDay(): 0 = อาทิตย์ → แปลงให้จันทร์ = 0
  const leading = (first.getDay() + 6) % 7;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const pad = (n: number) => String(n).padStart(2, "0");

  const cells: ({ date: string; day: ScheduleDay | undefined } | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    cells.push({ date, day: byDate.get(date) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

export function ScheduleCalendar({
  yearMonth,
  days,
  fellows,
  canEdit,
}: {
  yearMonth: string;
  days: ScheduleDay[];
  fellows: string[];
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const cells = buildCells(yearMonth, days);
  const selectedDay = selected ? days.find((d) => d.date === selected) : undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-xs font-medium text-zinc-500"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell) {
              return (
                <div
                  key={i}
                  className="min-h-24 border-b border-r border-zinc-100 bg-zinc-50/50"
                />
              );
            }

            const { date, day } = cell;
            const isWeekend = i % 7 >= 5;
            const isSelected = date === selected;

            const content = (
              <>
                <p
                  className={`text-xs font-medium mb-1 ${
                    day?.allFull ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  {dayOfMonth(date)}
                </p>

                <div className="space-y-1">
                  {day?.fellows.map((f) => (
                    <div
                      key={f.fellowName}
                      title={f.note || undefined}
                      className={`rounded px-1.5 py-1 text-[11px] leading-tight border ${
                        f.isFull
                          ? "border-zinc-300 bg-zinc-200 text-zinc-500"
                          : "border-green-300 bg-green-50 text-green-900"
                      }`}
                    >
                      {/* ตัดคำแทนการตัดท้ายด้วย … — ชื่อ fellow คือสาระของช่องนี้
                          ถ้าอ่านไม่ออกว่าใคร ปฏิทินก็ไม่มีประโยชน์บนจอแคบ */}
                      <p className="font-medium break-words">{f.fellowName}</p>
                      <p className="tabular-nums">
                        {f.isFull ? "เต็ม" : `ว่าง ${f.remaining}`} ({f.booked}/
                        {f.maxSlots})
                      </p>
                    </div>
                  ))}
                </div>
              </>
            );

            const background = day?.allFull
              ? "bg-zinc-100"
              : isWeekend
                ? "bg-zinc-50/50"
                : "bg-white";

            if (!canEdit) {
              return (
                <div
                  key={date}
                  className={`min-h-24 border-b border-r border-zinc-100 p-1.5 ${background}`}
                >
                  {content}
                </div>
              );
            }

            return (
              <button
                key={date}
                type="button"
                // ช่องปฏิทินมีแต่ตัวเลขกับป้ายชื่อ อ่านด้วยเสียงแล้วไม่รู้ว่าวันไหน
                aria-label={
                  `${dayOfMonth(date)} — ` +
                  (day
                    ? day.fellows
                        .map((f) => `${f.fellowName} ${f.booked}/${f.maxSlots}`)
                        .join(", ")
                    : "ไม่มีคลินิก")
                }
                aria-pressed={isSelected}
                onClick={() => setSelected(isSelected ? null : date)}
                className={`min-h-24 border-b border-r border-zinc-100 p-1.5 text-left align-top transition-colors hover:bg-blue-50 ${
                  isSelected ? "ring-2 ring-inset ring-blue-500 bg-blue-50" : background
                }`}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>

      {canEdit && !selected && (
        <p className="text-xs text-zinc-500">
          คลิกวันที่ในปฏิทินเพื่อเพิ่มหรือลบวันออกตรวจ
        </p>
      )}

      {canEdit && selected && (
        <ScheduleEditor
          key={selected}
          selectedDate={selected}
          fellows={fellows}
          existing={selectedDay?.fellows ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
