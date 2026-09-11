"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  cancelBookingAction,
  findBookingAction,
  rescheduleBookingAction,
  type ManageState,
} from "./actions";
import type { BookingDetail } from "@/lib/apps-script-api";
import { CONTACT } from "@/lib/config";
import { formatTimeRange } from "@/lib/fellow-schedule";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function formatDateTh(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const weekday = TH_DAY[new Date(y, m - 1, d).getDay()];
  return `วัน${weekday}ที่ ${d} ${TH_MONTH[m - 1]} ${y + 543}`;
}

interface OpenFellow {
  fellowName: string;
  remaining: number;
  startTime: string;
  endTime: string;
}
interface OpenDay {
  date: string;
  fellows: OpenFellow[];
}

const INITIAL: ManageState = { ok: false, message: "" };

export function ManageBookingClient({
  initialBooking,
  token,
  days,
}: {
  /** มาจากลิงก์ในอีเมล — ถ้าไม่มีจะแสดงฟอร์มให้กรอกเอง */
  initialBooking: BookingDetail | null;
  token: string;
  days: OpenDay[];
}) {
  const [found, formAction, pending] = useActionState(
    findBookingAction,
    INITIAL,
  );

  const booking = found.booking ?? initialBooking;

  if (!booking) {
    return (
      <FindForm state={found} formAction={formAction} pending={pending} />
    );
  }

  return (
    <BookingPanel
      booking={booking}
      token={token}
      phone={found.phone ?? ""}
      days={days}
    />
  );
}

/* ------------------------------------------------------------------ */

function FindForm({
  state,
  formAction,
  pending,
}: {
  state: ManageState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4">
        <p className="text-sm text-zinc-600">
          กรอกเลขที่อ้างอิงกับเบอร์ติดต่อกลับที่ให้ไว้ตอนจอง
          หรือกดลิงก์จัดการนัดในอีเมลยืนยันนัดได้เลยโดยไม่ต้องกรอกอะไร
        </p>

        <label className="block text-sm">
          <span className="block font-medium text-zinc-700 mb-1">
            เลขที่อ้างอิง <span className="text-red-600">*</span>
          </span>
          <input
            name="referralId"
            required
            placeholder="HEM-20260826-0001"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 font-mono"
          />
        </label>

        <label className="block text-sm">
          <span className="block font-medium text-zinc-700 mb-1">
            เบอร์ติดต่อกลับ <span className="text-red-600">*</span>
          </span>
          <input
            name="phone"
            type="tel"
            required
            placeholder="081-234-5678"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          />
          <span className="block text-xs text-zinc-500 mt-1">
            ต้องเป็นเบอร์เดียวกับที่กรอกไว้ตอนจองคิว
          </span>
        </label>

        {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait transition-colors"
        >
          {pending ? "กำลังค้นหา…" : "ค้นหานัดของฉัน"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function BookingPanel({
  booking,
  token,
  phone,
  days,
}: {
  booking: BookingDetail;
  token: string;
  /** ว่างถ้าเข้ามาทางลิงก์ในอีเมล — ใช้ token แทน */
  phone: string;
  days: OpenDay[];
}) {
  const [mode, setMode] = useState<"view" | "reschedule" | "confirmCancel">(
    "view",
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    cancelBookingAction,
    INITIAL,
  );
  const [moveState, moveAction, moving] = useActionState(
    rescheduleBookingAction,
    INITIAL,
  );

  const finished = cancelState.done ?? moveState.done;

  // เปิดใบนัดซ้ำได้แม้ค้นด้วยเบอร์ (ไม่มี token ใน URL) — ใช้ token ที่ระบบคืนมา
  const slipToken = token || booking.manageToken || "";
  // กลุ่ม 3 = นัดมาประเมินความพร้อมที่ OPD 700 (ไม่ใช่นัดพบ fellow)
  const isReadinessVisit =
    booking.referralType === "CHEMO_ADMISSION" ||
    booking.status === "Readiness Visit Scheduled";

  if (finished) {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          {cancelState.done ? cancelState.message : moveState.message}
        </Alert>
        <Link
          href="/refer/transplant"
          className="inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          {cancelState.done ? "จองนัดใหม่" : "กลับหน้ากลุ่มที่ 1"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white border-2 border-blue-500 p-5">
        <p className="font-mono text-xs text-zinc-500">{booking.referralId}</p>
        <p className="text-lg font-bold text-zinc-900 mt-1">
          {formatDateTh(booking.clinicDate)}
        </p>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Row label="สถานที่" value={CONTACT.officeTh} />
          <Row
            label="สอบถาม"
            value={`โทร. ${CONTACT.phoneDisplay} (${CONTACT.hoursTh})`}
          />
          {isReadinessVisit ? (
            <Row
              label="รายละเอียด"
              value={booking.appointmentNote || "พบแพทย์ที่ OPD 700 โลหิตวิทยา"}
            />
          ) : (
            <>
              <Row label="เวลา" value="08:00 น." />
              <Row label="พบแพทย์" value={booking.fellowName} />
            </>
          )}
          <Row label="โรงพยาบาลต้นทาง" value={booking.referrerOrg} />
          {booking.diagnosis && (
            <Row label="การวินิจฉัย" value={booking.diagnosis} />
          )}
        </dl>
      </section>

      {/* เปิด/บันทึกใบนัดซ้ำ — แสดงเสมอเมื่อมี token (รวมกลุ่ม 3 และนัดที่แก้ไม่ได้แล้ว) */}
      {slipToken && (
        <a
          href={`/booking/slip?id=${encodeURIComponent(booking.referralId)}&t=${encodeURIComponent(slipToken)}`}
          className="block rounded-lg border-2 border-zinc-800 px-5 py-3 text-center font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors"
        >
          🎫 เปิดใบนัด (พิมพ์ / บันทึกรูปให้ผู้ป่วย)
        </a>
      )}

      {!booking.canChange ? (
        <Alert tone="warn">
          {isReadinessVisit ? (
            <>
              นัดประเมินความพร้อมนี้ทีมโลหิตวิทยาเป็นผู้จัดการ — เช็กวันนัดและ
              เปิด/บันทึกใบนัดได้จากปุ่มด้านบน หากต้องเลื่อนนัด กรุณาติดต่อทีม
              ผ่านช่องทางในอีเมล/LINE ของเคส
            </>
          ) : (
            <>
              นัดนี้แก้ไขผ่านหน้านี้ไม่ได้แล้ว —
              ยกเลิกหรือเลื่อนได้ถึงวันก่อนวันนัดเท่านั้น
              <br />
              หากจำเป็น กรุณาโทร {CONTACT.phoneDisplay} ({CONTACT.hoursTh})
            </>
          )}
        </Alert>
      ) : mode === "view" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("reschedule")}
              className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              เลื่อนนัดไปวันอื่น
            </button>
            <button
              type="button"
              onClick={() => setMode("confirmCancel")}
              className="rounded-lg border-2 border-red-300 px-5 py-3 font-semibold text-red-700 hover:bg-red-50 transition-colors"
            >
              ยกเลิกนัด
            </button>
          </div>
        </div>
      ) : mode === "confirmCancel" ? (
        <form action={cancelAction} className="rounded-xl bg-white border-2 border-red-300 p-5 space-y-3">
          <Credentials booking={booking} token={token} phone={phone} />
          <p className="font-semibold text-red-900">ยืนยันการยกเลิกนัด</p>
          <p className="text-sm text-zinc-700">
            คิวของ {booking.fellowName} วันที่{" "}
            {formatDateTh(booking.clinicDate)} จะว่างกลับเข้าระบบทันที
            และแพทย์ท่านอื่นจองต่อได้ — <strong>ยกเลิกแล้วกู้คืนเองไม่ได้</strong>{" "}
            ต้องจองใหม่ซึ่งวันเดิมอาจถูกจองไปแล้ว
          </p>

          {cancelState.message && !cancelState.ok && (
            <Alert tone="error">{cancelState.message}</Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              disabled={cancelling}
              className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-wait transition-colors"
            >
              {cancelling ? "กำลังยกเลิก…" : "ยืนยันยกเลิกนัด"}
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              disabled={cancelling}
              className="rounded-lg border border-zinc-300 px-5 py-3 font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              ไม่ยกเลิก กลับไป
            </button>
          </div>
        </form>
      ) : (
        <RescheduleForm
          booking={booking}
          token={token}
          phone={phone}
          days={days}
          state={moveState}
          formAction={moveAction}
          pending={moving}
          onBack={() => setMode("view")}
        />
      )}

      <p className="text-xs text-zinc-500 text-center">
        สอบถามขั้นตอนวันที่ผู้ป่วยมาถึง โทร {CONTACT.phoneDisplay} ({CONTACT.hoursTh})
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RescheduleForm({
  booking,
  token,
  phone,
  days,
  state,
  formAction,
  pending,
  onBack,
}: {
  booking: BookingDetail;
  token: string;
  phone: string;
  days: OpenDay[];
  state: ManageState;
  formAction: (formData: FormData) => void;
  pending: boolean;
  onBack: () => void;
}) {
  const [picked, setPicked] = useState<{ date: string; fellow: string } | null>(
    null,
  );

  return (
    <form action={formAction} className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4">
      <Credentials booking={booking} token={token} phone={phone} />
      <input type="hidden" name="clinicDate" value={picked?.date ?? ""} />
      <input type="hidden" name="fellowName" value={picked?.fellow ?? ""} />

      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-zinc-900">เลือกวันนัดใหม่</p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ยกเลิกการเลื่อน
        </button>
      </div>

      {days.length === 0 ? (
        <Alert tone="warn">
          ขณะนี้ไม่มีคิวว่างให้เลื่อนไป กรุณาลองใหม่ภายหลัง
          หรือโทร {CONTACT.phoneDisplay}
        </Alert>
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto">
          {days.map((day) => (
            <li key={day.date} className="rounded-lg border border-zinc-200 overflow-hidden">
              <p className="px-3 py-2 bg-zinc-50 border-b border-zinc-200 text-sm font-semibold text-zinc-800">
                {formatDateTh(day.date)}
              </p>
              <div className="divide-y divide-zinc-100">
                {day.fellows.map((fellow) => {
                  const isPicked =
                    picked?.date === day.date &&
                    picked?.fellow === fellow.fellowName;
                  return (
                    <button
                      key={fellow.fellowName}
                      type="button"
                      onClick={() =>
                        setPicked({ date: day.date, fellow: fellow.fellowName })
                      }
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        isPicked ? "bg-blue-100" : "hover:bg-blue-50"
                      }`}
                    >
                      <span>
                        <span className="font-medium text-zinc-900">
                          {fellow.fellowName}
                        </span>
                        {formatTimeRange(fellow.startTime, fellow.endTime) && (
                          <span className="block text-xs text-zinc-500 tabular-nums">
                            {formatTimeRange(fellow.startTime, fellow.endTime)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900 tabular-nums">
                        {isPicked ? "เลือกแล้ว" : `ว่าง ${fellow.remaining}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <p className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
          เลื่อนจาก {formatDateTh(booking.clinicDate)} ({booking.fellowName})
          <br />
          ไปเป็น <strong>{formatDateTh(picked.date)} ({picked.fellow})</strong>
        </p>
      )}

      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}

      <button
        type="submit"
        disabled={pending || !picked}
        className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "กำลังเลื่อนนัด…" : "ยืนยันเลื่อนนัด"}
      </button>
    </form>
  );
}

/**
 * ส่งข้อมูลพิสูจน์สิทธิ์ไปกับทุก action
 *
 * ต้องแนบไปทุกครั้ง ไม่ใช่จำไว้ฝั่งเซิร์ฟเวอร์หลังค้นเจอ เพราะ Server Action
 * ถูกยิงด้วย POST ตรง ๆ ได้ ถ้าไม่ตรวจซ้ำ ใครก็ยิงคำสั่งยกเลิกโดยข้ามขั้นค้นหาได้
 */
function Credentials({
  booking,
  token,
  phone,
}: {
  booking: BookingDetail;
  token: string;
  phone: string;
}) {
  return (
    <>
      <input type="hidden" name="referralId" value={booking.referralId} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="phone" value={phone} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "warn" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    error: "bg-red-50 border-red-200 text-red-900",
    warn: "bg-amber-50 border-amber-200 text-amber-900",
    success: "bg-green-50 border-green-300 text-green-900",
  }[tone];

  return (
    <p role="alert" className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}
