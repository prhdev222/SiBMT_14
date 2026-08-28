"use client";

import { useActionState, useState } from "react";
import {
  staffCancelAction,
  staffRescheduleAction,
  type StaffManageState,
} from "./actions";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function formatDateTh(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `วัน${TH_DAY[new Date(y, m - 1, d).getDay()]}ที่ ${d} ${TH_MONTH[m - 1]} ${y + 543}`;
}

export interface AppointmentRow {
  referralId: string;
  clinicDate: string;
  fellowName: string;
  referrerOrg: string;
  referrerPhone: string;
  diagnosis: string;
  /** ข้อบ่งชี้การปลูกถ่ายที่แพทย์ต้นทางเลือกตอนจอง ว่างได้ถ้าจองก่อนมีช่องนี้ */
  indicationTh: string;
  /** วันนัดผ่านมาแล้วหรือยัง — ใช้แยกกลุ่มแสดงผล ไม่ได้ห้ามเจ้าหน้าที่แก้ */
  isPast: boolean;
}

export interface OpenDay {
  date: string;
  fellows: { fellowName: string; remaining: number }[];
}

const INITIAL: StaffManageState = { ok: false, message: "" };

export function AppointmentList({
  appointments,
  days,
  fellows,
}: {
  appointments: AppointmentRow[];
  days: OpenDay[];
  fellows: string[];
}) {
  const [fellowFilter, setFellowFilter] = useState("");
  const [hidePast, setHidePast] = useState(true);

  const shown = appointments.filter(
    (a) =>
      (!fellowFilter || a.fellowName === fellowFilter) &&
      (!hidePast || !a.isPast),
  );

  /**
   * นับรายผู้ป่วยต่อวัน ให้ fellow รู้ว่าวันไหนมีกี่ราย
   *
   * เป็นสิ่งที่ fellow ถามก่อนเสมอ — ไม่ได้อยากรู้ว่ามีเคสอะไรบ้าง
   * แต่อยากรู้ว่าวันนั้นต้องเผื่อเวลาไว้เท่าไร
   */
  const perDay = new Map<string, number>();
  for (const a of shown) perDay.set(a.clinicDate, (perDay.get(a.clinicDate) ?? 0) + 1);

  if (appointments.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
        <p className="text-lg font-semibold text-zinc-900">ไม่มีนัดที่ยืนยันแล้ว</p>
        <p className="text-sm text-zinc-600 mt-1">
          นัดกลุ่มที่ 1 ที่ยังไม่ถูกยกเลิกจะแสดงที่นี่
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white border border-zinc-200 p-4 flex flex-wrap items-center gap-4">
        <label className="text-sm">
          <span className="block text-xs font-medium text-zinc-500 mb-1">
            ดูเฉพาะแพทย์
          </span>
          <select
            value={fellowFilter}
            onChange={(e) => setFellowFilter(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900"
          >
            <option value="">ทุกคน</option>
            {fellows.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-700 mt-4">
          <input
            type="checkbox"
            checked={hidePast}
            onChange={(e) => setHidePast(e.target.checked)}
            className="h-4 w-4"
          />
          ซ่อนนัดที่ผ่านมาแล้ว
        </label>

        <p className="text-sm text-zinc-600 mt-4 ml-auto">
          แสดง <span className="font-semibold text-zinc-900">{shown.length}</span> ราย
          {fellowFilter && ` ของ ${fellowFilter}`}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl bg-white border border-zinc-200 p-6 text-center text-sm text-zinc-600">
          ไม่มีนัดที่ตรงกับตัวกรอง
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((row) => (
            <li key={row.referralId}>
              <AppointmentCard
                row={row}
                days={days}
                sameDayCount={perDay.get(row.clinicDate) ?? 1}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AppointmentCard({
  row,
  days,
  sameDayCount,
}: {
  row: AppointmentRow;
  days: OpenDay[];
  /** จำนวนผู้ป่วยทั้งหมดของวันนั้นตามตัวกรองปัจจุบัน */
  sameDayCount: number;
}) {
  const [mode, setMode] = useState<"view" | "cancel" | "move">("view");
  const [cancelState, cancelAction, cancelling] = useActionState(
    staffCancelAction,
    INITIAL,
  );
  const [moveState, moveAction, moving] = useActionState(
    staffRescheduleAction,
    INITIAL,
  );
  const [picked, setPicked] = useState<{ date: string; fellow: string } | null>(
    null,
  );

  const done = cancelState.ok || moveState.ok;

  if (done) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-300 px-4 py-3 text-sm text-green-900">
        {cancelState.ok ? cancelState.message : moveState.message}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-white border overflow-hidden ${
        row.isPast ? "border-zinc-200 opacity-70" : "border-zinc-200"
      }`}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-zinc-500">{row.referralId}</p>
            <p className="font-semibold text-zinc-900 mt-0.5">
              {formatDateTh(row.clinicDate)}
              {row.isPast && (
                <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  ผ่านมาแล้ว
                </span>
              )}
              {sameDayCount > 1 && (
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  วันนี้มี {sameDayCount} ราย
                </span>
              )}
            </p>
            <p className="text-sm text-zinc-600">
              {row.fellowName} · {row.referrerOrg}
            </p>
            {row.diagnosis && (
              <p className="text-sm text-zinc-800 mt-1">{row.diagnosis}</p>
            )}
            {row.indicationTh && (
              <p className="text-sm text-zinc-600 mt-0.5">
                <span className="text-zinc-400">I/C:</span> {row.indicationTh}
              </p>
            )}
          </div>
          {row.referrerPhone && (
            <a
              href={`tel:${row.referrerPhone}`}
              className="shrink-0 text-sm text-blue-600 hover:underline whitespace-nowrap"
            >
              {row.referrerPhone}
            </a>
          )}
        </div>

        {mode === "view" && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("move")}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              เลื่อนนัด
            </button>
            <button
              type="button"
              onClick={() => setMode("cancel")}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
            >
              ยกเลิกนัด
            </button>
          </div>
        )}
      </div>

      {mode === "cancel" && (
        <form action={cancelAction} className="border-t border-red-200 bg-red-50 px-4 py-3 space-y-3">
          <input type="hidden" name="referralId" value={row.referralId} />
          <p className="text-sm text-red-900">
            ยืนยันยกเลิกนัดนี้แทนแพทย์ต้นทาง — คิวจะว่างกลับเข้าปฏิทินทันที
            และ <strong>บันทึกชื่อผู้กดไว้ใน status_log</strong>
          </p>
          {cancelState.message && !cancelState.ok && (
            <p role="alert" className="text-sm text-red-800">
              {cancelState.message}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={cancelling}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-wait transition-colors"
            >
              {cancelling ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              disabled={cancelling}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              ไม่ยกเลิก
            </button>
          </div>
        </form>
      )}

      {mode === "move" && (
        <form action={moveAction} className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 space-y-3">
          <input type="hidden" name="referralId" value={row.referralId} />
          <input type="hidden" name="clinicDate" value={picked?.date ?? ""} />
          <input type="hidden" name="fellowName" value={picked?.fellow ?? ""} />

          <p className="text-sm font-medium text-zinc-800">เลือกวันนัดใหม่</p>

          {days.length === 0 ? (
            <p className="text-sm text-zinc-600">ขณะนี้ไม่มีคิวว่างให้เลื่อนไป</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {days.map((day) => (
                <div key={day.date} className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
                  <p className="px-3 py-1.5 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-700">
                    {formatDateTh(day.date)}
                  </p>
                  {day.fellows.map((f) => {
                    const isPicked =
                      picked?.date === day.date && picked?.fellow === f.fellowName;
                    return (
                      <button
                        key={f.fellowName}
                        type="button"
                        onClick={() => setPicked({ date: day.date, fellow: f.fellowName })}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          isPicked ? "bg-blue-100" : "hover:bg-blue-50"
                        }`}
                      >
                        <span className="text-zinc-900">{f.fellowName}</span>
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900 tabular-nums">
                          {isPicked ? "เลือกแล้ว" : `ว่าง ${f.remaining}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {moveState.message && !moveState.ok && (
            <p role="alert" className="text-sm text-red-800">
              {moveState.message}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={moving || !picked}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
            >
              {moving ? "กำลังเลื่อน…" : "ยืนยันเลื่อนนัด"}
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              disabled={moving}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              ยกเลิกการเลื่อน
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
