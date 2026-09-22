"use client";

import { useState, useTransition } from "react";
import {
  addClinicDaysAction,
  addFellowAction,
  deactivateFellowAction,
  renameFellowAction,
  removeClinicDayAction,
  type ActionResult,
} from "./actions";
import {
  formatTimeRange,
  type FellowDayAvailability,
} from "@/lib/fellow-schedule";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function formatDateTh(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = TH_DAY[new Date(y, m - 1, d).getDay()];
  return `วัน${weekday}ที่ ${d} ${TH_MONTH[m - 1]} ${y + 543}`;
}

/** วันที่จะถูกสร้างเมื่อกดเพิ่ม — แสดงให้เห็นก่อนกด */
function previewDates(startIso: string, weeks: number): string[] {
  const [y, m, d] = startIso.split("-").map(Number);
  const out: string[] = [];
  for (let w = 0; w < Math.min(Math.max(weeks, 1), 52); w++) {
    const date = new Date(y, m - 1, d + w * 7);
    out.push(`${date.getDate()} ${TH_MONTH[date.getMonth()]}`);
  }
  return out;
}

export function ScheduleEditor({
  selectedDate,
  fellows,
  existing,
  onClose,
}: {
  selectedDate: string;
  fellows: string[];
  existing: FellowDayAvailability[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const [pickedFellow, setPickedFellow] = useState("");
  const [secondPickedFellow, setSecondPickedFellow] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [slots, setSlots] = useState(2);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [note, setNote] = useState("");
  const [newFellow, setNewFellow] = useState("");
  const [editingFellow, setEditingFellow] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  /**
   * ชื่อที่เลือกอยู่จริง — คำนวณตอน render ไม่เก็บเป็น state ตั้งต้น
   *
   * ตอนเปิดแผงครั้งแรกอาจยังไม่มีรายชื่อสักคน ถ้าเก็บ fellows[0] ไว้เป็นค่าเริ่มต้น
   * ของ state ค่านั้นจะค้างเป็นสตริงว่างตลอด เพราะ useState ตั้งค่าแค่ตอน mount
   * พอเพิ่มชื่อคนแรกเสร็จ dropdown จะแสดงชื่อให้เห็น (เบราว์เซอร์เลือก option แรกเอง)
   * แต่ state ยังว่างอยู่ ปุ่มบันทึกเลยกดไม่ได้ทั้งที่หน้าจอดูเหมือนพร้อมแล้ว
   */
  const fellowName = fellows.includes(pickedFellow)
    ? pickedFellow
    : (fellows[0] ?? "");
  const secondFellowName = fellows.includes(secondPickedFellow)
    ? secondPickedFellow
    : (fellows[1] ?? "");

  // ปล่อยให้กดบันทึกแล้วค่อยรู้ว่าเวลากลับหัวเป็นการเสียเที่ยว บอกตั้งแต่พิมพ์
  const timeError =
    startTime && endTime && endTime <= startTime
      ? "เวลาสิ้นสุดต้องหลังเวลาเริ่ม"
      : null;

  function run(fn: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => setResult(await fn()));
  }

  const dates = selectedDate ? previewDates(selectedDate, weeks) : [];
  const weekday = selectedDate
    ? TH_DAY[
        new Date(
          Number(selectedDate.slice(0, 4)),
          Number(selectedDate.slice(5, 7)) - 1,
          Number(selectedDate.slice(8, 10)),
        ).getDay()
      ]
    : "";

  return (
    <div className="rounded-xl bg-white border-2 border-blue-500 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-semibold text-zinc-900">
          {formatDateTh(selectedDate)}
        </h2>
        <button
          onClick={onClose}
          className="text-sm text-zinc-400 hover:text-zinc-700"
        >
          ปิด
        </button>
      </div>

      {existing.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">มีอยู่แล้วในวันนี้</p>
          <ul className="space-y-1">
            {existing.map((f) => (
              <li
                key={f.rowNumber}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-zinc-800">{f.fellowName}</span>
                  {formatTimeRange(f.startTime, f.endTime) && (
                    <span className="text-zinc-600 tabular-nums">
                      {" "}
                      {formatTimeRange(f.startTime, f.endTime)}
                    </span>
                  )}
                  <span className="text-zinc-500 tabular-nums">
                    {" "}
                    — นัดแล้ว {f.booked}/{f.maxSlots}
                  </span>
                </span>
                <button
                  disabled={pending || f.booked > 0}
                  onClick={() =>
                    run(() =>
                      removeClinicDayAction({
                        rowNumber: f.rowNumber,
                        clinicDate: f.clinicDate,
                        fellowName: f.fellowName,
                      }),
                    )
                  }
                  title={
                    f.booked > 0
                      ? "ลบไม่ได้ เพราะมีผู้ป่วยนัดไว้แล้ว — ต้องย้ายนัดก่อน"
                      : undefined
                  }
                  className="text-xs text-red-600 hover:underline disabled:text-zinc-300 disabled:no-underline whitespace-nowrap"
                >
                  ลบ
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-zinc-200 pt-4 space-y-3">
        <p className="text-sm font-medium text-zinc-800">เพิ่มวันออกตรวจ</p>

        {fellows.length === 0 ? (
          <p className="text-sm text-amber-700">
            ยังไม่มีรายชื่อ fellow — เพิ่มชื่อด้านล่างก่อน
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="block text-xs text-zinc-500 mb-1">Fellow คนที่ 1</span>
                <select
                  value={fellowName}
                  onChange={(e) => setPickedFellow(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                >
                  {fellows.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="block text-xs text-zinc-500 mb-1">Fellow คนที่ 2</span>
                <select
                  value={secondFellowName}
                  onChange={(e) => setSecondPickedFellow(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
                >
                  <option value="">ไม่เพิ่มคนที่ 2</option>
                  {fellows.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="block text-xs text-zinc-500 mb-1">
                  ออกตรวจกี่สัปดาห์ติดกัน
                </span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={weeks}
                  onChange={(e) => setWeeks(Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 tabular-nums"
                />
              </label>

              <label className="text-sm">
                <span className="block text-xs text-zinc-500 mb-1">คิวต่อวัน</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={slots}
                  onChange={(e) => setSlots(Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 tabular-nums"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="block text-xs text-zinc-500 mb-1">
                  เวลาเริ่มออกตรวจ
                </span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-2 py-1.5 tabular-nums"
                />
              </label>

              <label className="text-sm">
                <span className="block text-xs text-zinc-500 mb-1">
                  เวลาสิ้นสุด
                </span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  aria-invalid={timeError !== null}
                  className={`w-full rounded-md border px-2 py-1.5 tabular-nums ${
                    timeError ? "border-red-400" : "border-zinc-300"
                  }`}
                />
              </label>
            </div>

            {timeError && (
              <p role="alert" className="text-xs text-red-600">
                {timeError}
              </p>
            )}

            <label className="block text-sm">
              <span className="block text-xs text-zinc-500 mb-1">
                หมายเหตุ (ไม่บังคับ)
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ตรวจร่วมกับอาจารย์"
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
              />
            </label>

            <p className="text-xs text-zinc-600">
              <span className="font-medium">จะสร้าง {dates.length} วัน</span> (ทุกวัน
              {weekday}):{" "}
              {dates.length > 6
                ? `${dates.slice(0, 4).join(", ")} … ${dates[dates.length - 1]}`
                : dates.join(", ")}
            </p>

            <button
              disabled={pending || !fellowName || timeError !== null}
              onClick={() =>
                run(async () => {
                  const names = [...new Set([fellowName, secondFellowName].filter(Boolean))];
                  const results = await Promise.all(
                    names.map((name) =>
                      addClinicDaysAction({
                        fellowName: name,
                        startDate: selectedDate,
                        repeatWeeks: weeks,
                        maxSlots: slots,
                        note,
                        startTime,
                        endTime,
                      }),
                    ),
                  );
                  return {
                    ok: results.every((item) => item.ok),
                    message: results.map((item) => item.message).join(" · "),
                  };
                })
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-300"
            >
              {pending ? "กำลังบันทึก…" : "เพิ่มลงตาราง"}
            </button>
          </>
        )}
      </div>

      <div className="border-t border-zinc-200 pt-4">
        <p className="text-sm font-medium text-zinc-800 mb-2">รายชื่อ Fellow</p>

        <div className="flex flex-wrap gap-2 mb-3">
          {fellows.map((f) =>
            editingFellow === f ? (
              <span key={f} className="inline-flex items-center gap-1.5">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-40 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                  autoFocus
                />
                <button
                  disabled={pending || !editName.trim()}
                  onClick={() => {
                    run(() => renameFellowAction(f, editName));
                    setEditingFellow(null);
                  }}
                  className="text-xs text-blue-600 disabled:text-zinc-300"
                >
                  บันทึก
                </button>
                <button
                  disabled={pending}
                  onClick={() => setEditingFellow(null)}
                  className="text-xs text-zinc-500"
                >
                  ยกเลิก
                </button>
              </span>
            ) : (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700"
              >
                {f}
                <button
                  disabled={pending}
                  onClick={() => {
                    setEditingFellow(f);
                    setEditName(f);
                  }}
                  title="แก้ชื่อ Fellow"
                  className="text-zinc-400 hover:text-blue-600"
                >
                  แก้
                </button>
                <button
                  disabled={pending}
                  onClick={() => run(() => deactivateFellowAction(f))}
                  title="ปิดการใช้งาน — ตารางเก่ายังอยู่"
                  className="text-zinc-400 hover:text-red-600"
                >
                  ✕
                </button>
              </span>
            ),
          )}
          {fellows.length === 0 && (
            <span className="text-xs text-zinc-400">ยังไม่มีรายชื่อ</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={newFellow}
            onChange={(e) => setNewFellow(e.target.value)}
            placeholder="เช่น พญ. สุดา"
            className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <button
            disabled={pending || !newFellow.trim()}
            onClick={() => {
              run(() => addFellowAction(newFellow));
              setNewFellow("");
            }}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-300"
          >
            เพิ่มชื่อ
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-1.5">
          เปลี่ยนรอบปีการศึกษาให้กด ✕ ปิดชื่อเดิม แทนการลบ — ตารางเก่ายังอ้างถึงชื่อนั้นอยู่
        </p>
      </div>

      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            result.ok
              ? "bg-green-50 border border-green-200 text-green-900"
              : "bg-red-50 border border-red-200 text-red-900"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
