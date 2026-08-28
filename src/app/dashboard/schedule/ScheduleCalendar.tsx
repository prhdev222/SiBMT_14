"use client";

import { useState } from "react";
import {
  dayOfMonth,
  formatTimeRange,
  type ScheduleDay,
} from "@/lib/fellow-schedule";
import { ScheduleEditor } from "./ScheduleEditor";

const WEEKDAY_LABELS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

/**
 * เคสที่นัดไว้ในวันหนึ่ง — แสดงเมื่อกดเลือกวันในปฏิทิน
 *
 * มีไว้ให้ fellow เปิดดูก่อนถึงวันออกตรวจว่าจะมีใครมาบ้าง เป็นโรคอะไร
 * และโทรถามข้อมูลการรักษาจากแพทย์ต้นทางได้ล่วงหน้า — ไม่ใช่มารู้หน้างาน
 *
 * ไม่มีชื่อและ HN ของผู้ป่วยเพราะระบบไม่ได้เก็บไว้ตั้งแต่ต้น
 */
export interface DayBooking {
  referralId: string;
  fellowName: string;
  diagnosis: string;
  indicationTh: string;
  referrerOrg: string;
  referrerName: string;
  referrerPhone: string;
}

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
  bookings,
}: {
  yearMonth: string;
  days: ScheduleDay[];
  fellows: string[];
  canEdit: boolean;
  /** เคสที่นัดไว้ แยกตามวันที่ (yyyy-MM-dd) */
  bookings: Record<string, DayBooking[]>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const cells = buildCells(yearMonth, days);
  const selectedDay = selected ? days.find((d) => d.date === selected) : undefined;
  const selectedBookings = selected ? (bookings[selected] ?? []) : [];

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
                      {formatTimeRange(f.startTime, f.endTime) && (
                        <p className="tabular-nums opacity-80">
                          {formatTimeRange(f.startTime, f.endTime)}
                        </p>
                      )}
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

      {!selected && (
        <p className="text-xs text-zinc-500">
          คลิกวันที่ในปฏิทินเพื่อดูเคสที่นัดไว้
          {canEdit && " และเพิ่มหรือลบวันออกตรวจ"}
        </p>
      )}

      {selected && <DayBookings date={selected} bookings={selectedBookings} />}

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

/**
 * รายชื่อเคสของวันที่เลือก
 *
 * เรียงตามชื่อ fellow เพื่อให้คนที่เปิดดูของตัวเองกวาดตาหาได้เร็ว
 * ในวันที่มี fellow ออกตรวจพร้อมกันหลายคน
 */
function DayBookings({
  date,
  bookings,
}: {
  date: string;
  bookings: DayBooking[];
}) {
  const [y, m, d] = date.split("-").map(Number);
  const title = `${d}/${m}/${y + 543}`;

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 p-4">
        <h3 className="font-semibold text-zinc-900 text-sm">
          เคสที่นัดไว้ {title}
        </h3>
        <p className="text-sm text-zinc-500 mt-1">
          ยังไม่มีผู้ป่วยจองคิววันนี้
        </p>
      </div>
    );
  }

  const sorted = [...bookings].sort((a, b) =>
    a.fellowName.localeCompare(b.fellowName, "th"),
  );

  return (
    <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
        <h3 className="font-semibold text-zinc-900 text-sm">
          เคสที่นัดไว้ {title} — {bookings.length} ราย
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          โทรถามข้อมูลการรักษาจากแพทย์ต้นทางได้ก่อนวันตรวจ
        </p>
      </div>

      <ul className="divide-y divide-zinc-100">
        {sorted.map((b) => (
          <li key={b.referralId} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">
                  {b.fellowName}
                </p>
                <p className="font-mono text-xs text-zinc-500">
                  {b.referralId}
                </p>
                {b.diagnosis && (
                  <p className="text-sm text-zinc-800 mt-1">{b.diagnosis}</p>
                )}
                {b.indicationTh && (
                  <p className="text-sm text-zinc-600">
                    <span className="text-zinc-400">I/C:</span> {b.indicationTh}
                  </p>
                )}
                <p className="text-sm text-zinc-600 mt-1">
                  {b.referrerOrg}
                  {b.referrerName && ` · ${b.referrerName}`}
                </p>
              </div>

              {b.referrerPhone && (
                <a
                  href={`tel:${b.referrerPhone}`}
                  className="shrink-0 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                >
                  โทร {b.referrerPhone}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
