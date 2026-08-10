"use client";

import { useActionState, useState } from "react";
import { saveAdviceAction, type AdviceState } from "./actions";
import {
  STATUS_LABEL_TH,
  STATUS_COLOR,
  URGENCY_LABEL_TH,
  URGENCY_COLOR,
  alertLevelFor,
  type Status,
  type Urgency,
} from "@/lib/referral-types";

export interface ReviewCase {
  referralId: string;
  groupNumber: 1 | 2 | 3 | 4;
  groupTitle: string;
  status: Status;
  urgency: Urgency;
  elapsedBusinessHours: number;
  submittedAt: string;
  referrerOrg: string;
  referrerPhone: string;
  diseaseGroup: string | null;
  diagnosis: string;
  stage: string;
  treatmentSummary: string;
  comorbidity: string;
  clinicalQuestion: string;
  adviceRecord: string;
  note: string;
}

/**
 * ทางออกที่อาจารย์เลือกได้หลังอ่านเคส
 *
 * ไม่ได้เอามาจาก STATUSES_BY_TYPE ทั้งชุด เพราะสถานะอย่าง Submitted /
 * Pending Review เป็นสถานะระหว่างทางที่ระบบตั้งให้เอง ไม่ใช่คำตัดสินของคนตอบ
 */
const ANSWER_OPTIONS: {
  value: Status;
  labelTh: string;
  onlyGroup3?: boolean;
}[] = [
  { value: "Advice Sent", labelTh: "ตอบคำแนะนำกลับ — จบเคส" },
  {
    value: "Readiness Visit Scheduled",
    labelTh: "นัดมาประเมินความพร้อมที่ OPD",
    onlyGroup3: true,
  },
  { value: "Incomplete", labelTh: "ขอข้อมูลเพิ่ม — ยังไม่จบเคส" },
  {
    value: "Rejected / Redirected",
    labelTh: "ไม่เข้าเกณฑ์ / แนะนำช่องทางอื่น",
  },
];

export function ReviewList({ cases }: { cases: ReviewCase[] }) {
  return (
    <ul className="space-y-3">
      {cases.map((item) => (
        <li key={item.referralId}>
          <ReviewCard item={item} />
        </li>
      ))}
    </ul>
  );
}

const INITIAL: AdviceState = { ok: false, message: "" };

function ReviewCard({ item }: { item: ReviewCase }) {
  const [state, formAction, pending] = useActionState(
    saveAdviceAction,
    INITIAL,
  );
  const [open, setOpen] = useState(false);

  const alert = alertLevelFor(item.elapsedBusinessHours, item.status);
  const options = ANSWER_OPTIONS.filter(
    (o) => !o.onlyGroup3 || item.groupNumber === 3,
  );

  return (
    <div
      className={`rounded-xl bg-white border overflow-hidden ${
        alert === "red" ? "border-red-300" : "border-zinc-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-zinc-500">{item.referralId}</p>
            <p className="font-semibold text-zinc-900 mt-0.5 truncate">
              {item.diagnosis || item.diseaseGroup || item.groupTitle}
            </p>
            <p className="text-sm text-zinc-600 truncate">
              กลุ่มที่ {item.groupNumber} · {item.referrerOrg}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[item.status]}`}
            >
              {STATUS_LABEL_TH[item.status]}
            </span>
            <span
              className={`text-xs tabular-nums ${
                alert === "red"
                  ? "font-semibold text-red-700"
                  : alert === "yellow"
                    ? "font-medium text-amber-700"
                    : "text-zinc-500"
              }`}
            >
              รอมา {item.elapsedBusinessHours} ชม.ทำการ
            </span>
          </div>
        </div>

        {/* คำถามคือสิ่งเดียวที่ต้องอ่านก่อนตัดสินใจว่าจะเปิดเคสไหน จึงอยู่นอกส่วนพับ */}
        {item.clinicalQuestion && (
          <p
            className={`mt-2 text-sm text-zinc-800 ${open ? "" : "line-clamp-2"}`}
          >
            <span className="font-medium text-zinc-500">คำถาม: </span>
            {item.clinicalQuestion}
          </p>
        )}

        <p className="mt-2 text-xs font-medium text-blue-600">
          {open ? "ย่อรายละเอียด ▲" : "อ่านรายละเอียดและตอบ ▼"}
        </p>
      </button>

      {open && (
        <div className="border-t border-zinc-200 px-4 py-4 space-y-4">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
            <Row label="กลุ่มโรค" value={item.diseaseGroup} />
            <Row
              label="ความเร่งด่วน"
              value={
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_COLOR[item.urgency]}`}
                >
                  {URGENCY_LABEL_TH[item.urgency]}
                </span>
              }
            />
            <Row label="การวินิจฉัย" value={item.diagnosis} />
            <Row label="ระยะ / ความเสี่ยง" value={item.stage} />
            <Row label="โรคร่วม" value={item.comorbidity} />
            <Row label="ส่งข้อมูลเมื่อ" value={item.submittedAt} />
            <Row
              label="ติดต่อกลับ"
              value={
                item.referrerPhone ? (
                  <a
                    href={`tel:${item.referrerPhone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {item.referrerPhone}
                  </a>
                ) : null
              }
            />
          </dl>

          <Block label="การรักษาที่ให้ไปแล้ว" value={item.treatmentSummary} />
          <Block label="คำถามที่ต้องการปรึกษา" value={item.clinicalQuestion} />
          <Block label="หมายเหตุ" value={item.note} />

          {item.adviceRecord ? (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-xs font-semibold text-green-900">
                มีคำตอบบันทึกไว้แล้ว
              </p>
              <p className="text-sm text-green-950 whitespace-pre-wrap mt-1">
                {item.adviceRecord}
              </p>
              <p className="text-xs text-green-800 mt-2">
                ระบบไม่เขียนทับคำตอบเดิม — หากต้องแก้ไข กรุณาแก้ใน Google Sheet
              </p>
            </div>
          ) : (
            <form action={formAction} className="space-y-3">
              {/* อยู่นอก fieldset เพราะช่องที่ถูก disabled จะไม่ถูกส่งไปกับฟอร์ม */}
              <input type="hidden" name="referralId" value={item.referralId} />

              {/*
                ล็อกช่องกรอกระหว่างรอบันทึก — การบันทึกใช้เวลา 2-3 วินาที
                ถ้าปล่อยให้แก้ข้อความต่อได้ สิ่งที่พิมพ์เพิ่มจะไม่ถูกส่งไปด้วย
                แต่หน้าจอยังแสดงอยู่ ทำให้เข้าใจผิดว่าบันทึกไปแล้ว
              */}
              <fieldset
                disabled={pending}
                className={`space-y-3 transition-opacity ${pending ? "opacity-50" : ""}`}
              >
                <label className="block text-sm">
                  <span className="block font-medium text-zinc-700 mb-1">
                    คำตอบถึงแพทย์ต้นทาง <span className="text-red-600">*</span>
                  </span>
                  <textarea
                    name="advice"
                    required
                    rows={6}
                    placeholder="เช่น แนะนำให้ R-CHOP ครบ 6 cycles ก่อน แล้วประเมินซ้ำด้วย PET-CT หากยังมี residual disease จึงส่งปรึกษาการปลูกถ่าย"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 leading-relaxed"
                  />
                  <span className="block text-xs text-zinc-500 mt-1">
                    ข้อความนี้จะถูกส่งอีเมลกลับแพทย์ต้นทางตามที่กรอกไว้
                    และลงชื่อผู้ตอบให้อัตโนมัติ
                  </span>
                </label>

                <label className="block text-sm">
                  <span className="block font-medium text-zinc-700 mb-1">
                    ผลการพิจารณา
                  </span>
                  <select
                    name="status"
                    defaultValue="Advice Sent"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                  >
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.labelTh}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>

              {state.message && (
                <p
                  role="alert"
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    state.ok
                      ? "bg-green-50 border-green-200 text-green-900"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}
                >
                  {state.message}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait transition-colors"
              >
                {pending && <Spinner />}
                {pending ? "กำลังบันทึก…" : "บันทึกและส่งกลับแพทย์ต้นทาง"}
              </button>

              {/*
                บอกให้ชัดว่ายังทำงานอยู่และใช้เวลาเท่าไร — การบันทึกวิ่งผ่าน
                Apps Script ซึ่งช้ากว่าที่คนคาดจากการกดปุ่มบนเว็บทั่วไป
                ถ้าไม่บอก คนกดจะคิดว่าค้างแล้วกดซ้ำหรือปิดหน้าไปเสียก่อน
              */}
              {pending && (
                <p
                  role="status"
                  className="flex items-start gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3"
                >
                  <span aria-hidden="true">⏳</span>
                  <span>
                    กำลังบันทึกลง Google Sheet และส่งอีเมลกลับแพทย์ต้นทาง —
                    ใช้เวลาประมาณ 2–3 วินาที กรุณาอย่าปิดหน้านี้
                  </span>
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/** วงกลมหมุน — บอกว่าระบบยังทำงานอยู่ ไม่ได้ค้าง */
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-900 min-w-0">{value || "—"}</dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-900 whitespace-pre-wrap mt-0.5 leading-relaxed">
        {value}
      </p>
    </div>
  );
}
