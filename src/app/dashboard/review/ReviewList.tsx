"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { saveAdviceAction, type AdviceState } from "./actions";
import { DocButtons } from "@/components/DocButtons";
import type { ChemoRegimen } from "@/lib/referral-repository";
import {
  STATUS_LABEL_TH,
  STATUS_COLOR,
  alertLevelFor,
  type Status,
} from "@/lib/referral-types";

export interface ReviewCase {
  referralId: string;
  groupNumber: 1 | 2 | 3 | 4;
  groupTitle: string;
  status: Status;
  elapsedBusinessHours: number;
  submittedAt: string;
  referrerOrg: string;
  referrerPhone: string;
  insuranceScheme: string;
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

export interface ReviewTools {
  /** ชื่อผู้ใช้ที่ล็อกอิน — เติมให้ล่วงหน้าแต่แก้ได้ */
  defaultAnsweredBy: string;
  /** เบอร์วอร์ดจากชีต config — ไม่ต้องพิมพ์ใหม่ทุกครั้ง */
  defaultWardPhone: string;
  /** คลังสูตรยาจากชีต — ว่างได้ แล้วตัวช่วยแทรกสูตรยาจะไม่แสดง */
  regimens: ChemoRegimen[];
  /** ลิงก์ Pool_CMT_Regimens_Library.pdf จากชีต config — ว่างได้ */
  regimenLibraryUrl: string;
  /** รายชื่ออาจารย์จากชีต — ว่างได้ แล้วจะให้พิมพ์ชื่อเองแทน */
  attendings: string[];
}

export function ReviewList({
  cases,
  ...tools
}: { cases: ReviewCase[] } & ReviewTools) {
  return (
    <ul className="space-y-3">
      {cases.map((item) => (
        <li key={item.referralId}>
          <ReviewCard item={item} {...tools} />
        </li>
      ))}
    </ul>
  );
}

const INITIAL: AdviceState = { ok: false, message: "" };

function ReviewCard({
  item,
  defaultAnsweredBy,
  defaultWardPhone,
  regimens,
  regimenLibraryUrl,
  attendings,
}: { item: ReviewCase } & ReviewTools) {
  const [state, formAction, pending] = useActionState(
    saveAdviceAction,
    INITIAL,
  );
  const [open, setOpen] = useState(false);
  const adviceRef = useRef<HTMLTextAreaElement>(null);

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
            <Row label="การวินิจฉัย" value={item.diagnosis} />
            <Row label="ระยะ / ความเสี่ยง" value={item.stage} />
            <Row label="โรคร่วม" value={item.comorbidity} />
            {/*
              สิทธิการรักษาอยู่ในกลุ่มเดียวกับข้อมูลคลินิก ไม่ใช่ข้อมูลติดต่อ
              เพราะมันเปลี่ยนคำตอบ — ยานอกบัญชียาหลักแนะนำไปก็ให้ไม่ได้
            */}
            <Row
              label="สิทธิการรักษา"
              value={
                item.insuranceScheme || (
                  <span className="text-zinc-400">ไม่ได้ระบุ</span>
                )
              }
            />
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
                    ref={adviceRef}
                    name="advice"
                    required
                    rows={6}
                    placeholder="เช่น แนะนำให้ R-CHOP ครบ 6 cycles ก่อน แล้วประเมินซ้ำด้วย PET-CT หากยังมี residual disease จึงส่งปรึกษาการปลูกถ่าย"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 leading-relaxed"
                  />
                  <span className="block text-xs text-zinc-500 mt-1">
                    ข้อความนี้จะถูกส่งอีเมลกลับแพทย์ต้นทางตามที่กรอกไว้
                  </span>
                </label>

                <RegimenPicker
                  regimens={regimens}
                  onInsert={(snippet) => {
                    const el = adviceRef.current;
                    if (!el) return;

                    // แทรกที่ตำแหน่งเคอร์เซอร์ ไม่ใช่ต่อท้ายเสมอ เพราะคำตอบส่วนใหญ่
                    // พูดถึงสูตรยากลางประโยค เช่น "แนะนำให้ ___ ก่อน แล้วประเมินซ้ำ"
                    const start = el.selectionStart ?? el.value.length;
                    const end = el.selectionEnd ?? start;

                    el.value =
                      el.value.slice(0, start) + snippet + el.value.slice(end);
                    el.focus();
                    el.selectionStart = el.selectionEnd = start + snippet.length;
                  }}
                />

                <DocButtons
                  url={regimenLibraryUrl}
                  label="คลังสูตรยาเคมีบำบัดฉบับเต็ม"
                  hint="เปิดดูรายละเอียดขนาดยาและตารางการให้ หรือดาวน์โหลดไปพิมพ์"
                />

                <AttachmentField />

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">
                      ช่องทางให้แพทย์ต้นทางติดต่อกลับ
                    </p>
                    <p className="text-xs text-zinc-500">
                      แนบไปกับอีเมลคำตอบ เผื่ออ่านแล้วยังไม่เข้าใจ
                    </p>
                  </div>

                  <label className="block text-sm">
                    <span className="block font-medium text-zinc-700 mb-1">
                      ชื่อผู้ตอบ <span className="text-red-600">*</span>
                    </span>
                    <input
                      name="answeredBy"
                      required
                      defaultValue={defaultAnsweredBy}
                      placeholder="เช่น พญ. ชนิกา (R2 วอร์ดเคโม)"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="block font-medium text-zinc-700 mb-1">
                      เบอร์วอร์ดเคมีบำบัด <span className="text-red-600">*</span>
                    </span>
                    <input
                      name="wardPhone"
                      required
                      type="tel"
                      defaultValue={defaultWardPhone}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                    />
                    <span className="block text-xs text-zinc-500 mt-1">
                      ถ้าติดเรียนหรือไม่อยู่วอร์ด พยาบาลจะรับเรื่องไว้ให้ —
                      เบอร์ที่มีคนรับแน่นอนมีค่ากว่าเบอร์ที่อาจไม่มีคนรับ
                    </span>
                  </label>

                  <label className="block text-sm">
                    <span className="block font-medium text-zinc-700 mb-1">
                      เบอร์ติดต่อผู้ตอบโดยตรง (ไม่บังคับ)
                    </span>
                    <input
                      name="directPhone"
                      type="tel"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
                    />
                    <span className="block text-xs text-zinc-500 mt-1">
                      กรอกเฉพาะกรณีที่สะดวกให้ติดต่อโดยตรง เว้นว่างได้
                    </span>
                  </label>
                </div>

                <AttendingApproval attendings={attendings} />

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
                    ใช้เวลาประมาณ 2–3 วินาที
                    <strong className="font-semibold">
                      {" "}
                      หากแนบไฟล์ด้วยจะนานกว่านั้น ขึ้นกับขนาดไฟล์
                    </strong>{" "}
                    กรุณาอย่าปิดหน้านี้
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

/**
 * เลือกอาจารย์ผู้ให้คำปรึกษา แล้วยืนยันว่าท่านให้ความเห็นแล้ว
 *
 * ⚠️ เป็น "คำรับรองของ resident" ไม่ใช่การอนุมัติจริง
 * ระบบพิสูจน์ไม่ได้ว่าอาจารย์เห็นคำตอบนี้ เพราะคนที่กดคือ resident เอง
 * — โมเดลเดียวกับใบ consult กระดาษที่ resident เซ็นชื่ออาจารย์กำกับ
 * ถ้าวันหนึ่งต้องการการอนุมัติจริง ต้องให้อาจารย์ล็อกอินมากดเอง
 * ซึ่งเปลี่ยนเป็นงานสองขั้นและเคสจะค้างถ้าอาจารย์ไม่ว่าง
 *
 * ที่ได้จริงคือความรับผิดชอบที่ตามรอยได้ — แพทย์ต้นทางเห็นชื่อทั้งสองฝ่าย
 * และชีตเก็บไว้ว่าเคสไหนอาจารย์ท่านใดเป็นผู้ให้ความเห็น
 */
function AttendingApproval({ attendings }: { attendings: string[] }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-800">
          อาจารย์ผู้ให้คำปรึกษา
        </p>
        <p className="text-xs text-zinc-600">
          แพทย์ต้นทางจะเห็นทั้งชื่อผู้ตอบและชื่ออาจารย์ในอีเมล
        </p>
      </div>

      {attendings.length > 0 ? (
        <select
          name="attending"
          required
          defaultValue=""
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white"
        >
          <option value="" disabled>
            — เลือกอาจารย์ —
          </option>
          {attendings.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      ) : (
        <>
          {/*
            แท็บ attendings ยังว่าง — ให้พิมพ์เองแทนการล็อกไม่ให้ตอบ
            รายชื่อที่ยังไม่ได้กรอกไม่ควรทำให้ทั้งระบบตอบคำปรึกษาไม่ได้
          */}
          <input
            name="attending"
            required
            placeholder="เช่น ศ.นพ. …"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
          <p className="text-xs text-amber-800">
            ยังไม่มีรายชื่ออาจารย์ในระบบ — กรอกชื่อในแท็บ{" "}
            <code>attendings</code> ของ Google Sheet แล้วจะเลือกจากรายการได้
          </p>
        </>
      )}

      <label className="flex gap-2.5 items-start text-sm cursor-pointer">
        <input
          type="checkbox"
          name="attendingApproved"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
        />
        <span className="text-zinc-800">
          ข้าพเจ้ายืนยันว่า{" "}
          <span className="font-semibold">
            อาจารย์ท่านนี้ได้ให้ความเห็นและเห็นชอบคำตอบนี้แล้ว
          </span>{" "}
          <span className="text-red-600">*</span>
        </span>
      </label>
    </div>
  );
}

const MAX_ATTACHMENT_MB = 10;

/**
 * ช่องแนบไฟล์ประกอบคำตอบ เช่น protocol chemotherapy
 *
 * ไฟล์ไม่ได้แนบไปกับอีเมลจริง แต่ขึ้น Google Drive ของหน่วยงานแล้วส่งลิงก์ไปแทน
 * ทำให้ส่งไฟล์ใหญ่ได้โดยอีเมลไม่ตีกลับ (Gmail จำกัดไฟล์แนบ 25 MB)
 *
 * ⚠️ แลกมาด้วยการที่ไฟล์ถูกตั้งเป็น "ผู้ที่มีลิงก์ → ผู้อ่าน"
 * คำเตือนเรื่องห้ามแนบเอกสารที่มีชื่อหรือ HN ผู้ป่วยจึงต้องเห็นตอนกำลังจะเลือกไฟล์
 * ไม่ใช่ไปอยู่ในคู่มือที่ไม่มีใครเปิดตอนนั้น
 */
function AttachmentField() {
  const [picked, setPicked] = useState<{ name: string; mb: string } | null>(
    null,
  );
  const [tooBig, setTooBig] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
      <div>
        <p className="text-sm font-medium text-zinc-800">
          แนบไฟล์ประกอบ (ไม่บังคับ)
        </p>
        <p className="text-xs text-zinc-500">
          เช่น protocol chemotherapy — รับ PDF, JPG, PNG, DOC, DOCX, XLS, XLSX
          ไม่เกิน {MAX_ATTACHMENT_MB} MB
        </p>
      </div>

      <input
        type="file"
        name="attachment"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) {
            setPicked(null);
            setTooBig(false);
            return;
          }
          setPicked({ name: f.name, mb: (f.size / 1024 / 1024).toFixed(1) });
          setTooBig(f.size > MAX_ATTACHMENT_MB * 1024 * 1024);
        }}
        className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-100"
      />

      {picked && (
        <p
          className={`text-xs ${tooBig ? "text-red-700 font-medium" : "text-zinc-600"}`}
        >
          {tooBig ? "⚠️ " : "📎 "}
          {picked.name} · {picked.mb} MB
          {tooBig && ` — เกินเพดาน ${MAX_ATTACHMENT_MB} MB บันทึกไม่ได้`}
        </p>
      )}

      <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
        <span className="font-semibold">
          🔒 ห้ามแนบเอกสารที่มีชื่อ-สกุล เลข HN หรือเลขบัตรประชาชนของผู้ป่วย
        </span>{" "}
        — ไฟล์จะถูกอัปโหลดขึ้น Google Drive
        และตั้งให้เปิดได้ด้วยลิงก์เพื่อให้แพทย์ต้นทางที่ไม่มีบัญชีของหน่วยงานเปิดได้
      </p>
    </div>
  );
}

/**
 * ตัวช่วยแทรกชื่อสูตรยาลงในคำตอบ
 *
 * เป็นตัวช่วยพิมพ์เท่านั้น ไม่ได้บังคับให้เลือก — resident ยังพิมพ์สูตรที่ไม่มี
 * ในคลังได้ตามปกติ ระบบจึงไม่ล็อกการตอบไว้กับรายการที่คนดูแลชีตนึกออก
 */
function RegimenPicker({
  regimens,
  onInsert,
}: {
  regimens: ChemoRegimen[];
  onInsert: (snippet: string) => void;
}) {
  const [group, setGroup] = useState("");
  const [abbr, setAbbr] = useState("");

  // ชีตเรียงตามกลุ่มโรคอยู่แล้ว — ใช้ลำดับนั้น ไม่เรียงใหม่
  // คนดูแลชีตจะได้ควบคุมลำดับที่เห็นในหน้าจอได้เอง
  const groups = useMemo(() => {
    const seen: string[] = [];
    for (const r of regimens) {
      if (!seen.includes(r.diseaseGroup)) seen.push(r.diseaseGroup);
    }
    return seen;
  }, [regimens]);

  const inGroup = useMemo(
    () => regimens.filter((r) => r.diseaseGroup === group),
    [regimens, group],
  );

  if (regimens.length === 0) return null;

  const chosen = inGroup.find((r) => r.abbr === abbr);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
      <div>
        <p className="text-sm font-medium text-zinc-800">แทรกสูตรยาจากคลัง</p>
        <p className="text-xs text-zinc-500">
          ตัวช่วยพิมพ์เท่านั้น — พิมพ์สูตรอื่นที่ไม่มีในรายการได้ตามปกติ
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          aria-label="กลุ่มโรค"
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
            setAbbr("");
          }}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white"
        >
          <option value="">— เลือกกลุ่มโรค —</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          aria-label="สูตรยา"
          value={abbr}
          onChange={(e) => setAbbr(e.target.value)}
          disabled={!group}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white disabled:bg-zinc-100"
        >
          <option value="">— เลือกสูตรยา —</option>
          {inGroup.map((r) => (
            <option key={r.abbr} value={r.abbr}>
              {r.abbr}
            </option>
          ))}
        </select>
      </div>

      {chosen && (
        <p className="text-xs text-zinc-700 bg-white border border-zinc-200 rounded-lg px-3 py-2">
          {chosen.components}
        </p>
      )}

      <button
        type="button"
        onClick={() => chosen && onInsert(`${chosen.abbr} (${chosen.components})`)}
        disabled={!chosen}
        className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        แทรกลงในคำตอบ
      </button>
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
