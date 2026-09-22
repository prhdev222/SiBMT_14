"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { bookAction, type BookingState } from "./actions";
import { CONTACT } from "@/lib/config";
import { DISEASE_GROUPS } from "@/lib/referral-types";
import {
  INDICATION_OTHER,
  INDICATION_OTHER_LABEL_TH,
  TRANSPLANT_TYPE_LABEL_TH,
  type TransplantIndication,
} from "@/lib/transplant-indications";
import { DocButtons } from "@/components/DocButtons";
import { formatTimeRange } from "@/lib/fellow-schedule";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_DAY = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function formatDateTh(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
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

const INITIAL: BookingState = { ok: false, message: "" };

export function BookingFlow({
  days,
  indications,
  indicationUrl,
}: {
  days: OpenDay[];
  /** อ่านจากชีต transplant_indications เพื่อให้แก้เกณฑ์ได้โดยไม่ต้อง deploy */
  indications: TransplantIndication[];
  /** ลิงก์ IndicationBMT.pdf จากชีต config — ว่างได้ แล้วปุ่มจะไม่แสดง */
  indicationUrl: string;
}) {
  const [state, formAction, pending] = useActionState(bookAction, INITIAL);
  const [picked, setPicked] = useState<{ date: string; fellow: OpenFellow } | null>(
    null,
  );

  if (state.ok) {
    return (
      <Confirmation
        referralId={state.referralId!}
        clinicDate={state.clinicDate!}
        fellowName={state.fellowName!}
        manageToken={state.manageToken ?? ""}
      />
    );
  }

  if (!picked) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          เลือกวันและแพทย์ที่ต้องการ — ตัวเลขคือจำนวนคิวที่ยังว่างในวันนั้น
        </p>

        <ul className="space-y-3">
          {days.map((day) => (
            <li
              key={day.date}
              className="rounded-xl bg-white border border-zinc-200 overflow-hidden"
            >
              <p className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 text-sm font-semibold text-zinc-800">
                {formatDateTh(day.date)}
              </p>
              <div className="divide-y divide-zinc-100">
                {day.fellows.map((fellow) => (
                  <button
                    key={fellow.fellowName}
                    type="button"
                    onClick={() => setPicked({ date: day.date, fellow })}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors"
                  >
                    <span>
                      <span className="font-medium text-zinc-900">
                        {fellow.fellowName}
                      </span>
                      {formatTimeRange(fellow.startTime, fellow.endTime) && (
                        <span className="block text-xs text-zinc-500 tabular-nums mt-0.5">
                          {formatTimeRange(fellow.startTime, fellow.endTime)}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-900 tabular-nums">
                      ว่าง {fellow.remaining}
                    </span>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="clinicDate" value={picked.date} />
      <input type="hidden" name="fellowName" value={picked.fellow.fellowName} />

      <div className="rounded-xl bg-blue-50 border-2 border-blue-500 p-4">
        <p className="text-xs text-blue-700 font-medium">วันนัดที่เลือก</p>
        <p className="font-bold text-blue-950 mt-0.5">
          {formatDateTh(picked.date)}
        </p>
        <p className="text-sm text-blue-900">
          พบ {picked.fellow.fellowName}
          {formatTimeRange(picked.fellow.startTime, picked.fellow.endTime) &&
            ` · ${formatTimeRange(picked.fellow.startTime, picked.fellow.endTime)}`}
        </p>
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="mt-2 text-sm font-medium text-blue-700 hover:underline"
        >
          เปลี่ยนวัน
        </button>
      </div>

      <fieldset className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4">
        <legend className="px-2 text-sm font-semibold text-zinc-900">
          ข้อมูลผู้ส่งต่อ
        </legend>

        <Field name="referrerOrg" label="โรงพยาบาลต้นทาง" required />
        <Field name="referrerName" label="ชื่อแพทย์ผู้ส่ง" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="referrerPhone" label="เบอร์ติดต่อกลับ" type="tel" required />
          <Field
            name="referrerEmail"
            label="อีเมล"
            required
            type="email"
            hint="ใช้ส่งใบยืนยันนัด ลิงก์เลื่อน/ยกเลิกนัด และติดต่อขอข้อมูลเพิ่ม"
          />
        </div>
      </fieldset>

      <fieldset className="rounded-xl bg-white border border-zinc-200 p-5 space-y-4">
        <legend className="px-2 text-sm font-semibold text-zinc-900">
          ข้อมูลผู้ป่วย
        </legend>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          🔒 ห้ามกรอกชื่อ-สกุล เลข HN หรือเลขบัตรประชาชน — ระบบนี้ไม่เก็บข้อมูลที่ระบุตัวผู้ป่วย
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="patientAge" label="อายุ (ปี)" type="number" required />
          <label className="block text-sm">
            <span className="block font-medium text-zinc-700 mb-1">เพศ</span>
            <select
              name="patientSex"
              defaultValue="ชาย"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
            >
              <option>ชาย</option>
              <option>หญิง</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="block font-medium text-zinc-700 mb-1">
            กลุ่มโรค <span className="text-red-600">*</span>
          </span>
          <select
            name="diseaseGroup"
            required
            defaultValue=""
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          >
            <option value="" disabled>
              — เลือกกลุ่มโรค —
            </option>
            {DISEASE_GROUPS.map((group) => (
              <option key={group}>{group}</option>
            ))}
          </select>
        </label>

        <Field
          name="diagnosis"
          label="การวินิจฉัย"
          required
          hint="เช่น AML, relapsed after 1st CR"
        />

        <IndicationPicker indications={indications} indicationUrl={indicationUrl} />
        <Field name="note" label="หมายเหตุ (ไม่บังคับ)" />
      </fieldset>

      <label className="flex gap-3 rounded-xl bg-white border border-zinc-200 p-5 text-sm">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="text-zinc-700">
          ข้าพเจ้าได้แจ้งผู้ป่วยหรือผู้แทนโดยชอบธรรม
          และให้ลงนามรับทราบการส่งข้อมูลเรียบร้อยแล้ว
          โดยเก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง
        </span>
      </label>

      {state.message && !state.ok && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-300 transition-colors"
      >
        {pending ? "กำลังจองคิว…" : "ยืนยันการจองคิว"}
      </button>
    </form>
  );
}

/**
 * เลือกข้อบ่งชี้การปลูกถ่าย แล้วแสดงเกณฑ์ของข้อนั้นทันที
 *
 * ⚠️ ไม่ได้ใช้กั้นการจอง — ระบบรับจองต่อไม่ว่าเกณฑ์จะครบหรือไม่
 * ตามมติอาจารย์ 2 ส.ค. 2569 ที่ให้ความครบถ้วนเป็นหน้าที่ของแพทย์ต้นทาง
 * เหตุผลที่ต้องแสดงตรงนี้คือ **จังหวะ** — แพทย์กำลังตัดสินใจส่งผู้ป่วยอยู่พอดี
 * ถ้าเอาไปไว้หน้าอื่นหรือในเอกสารแนบ จะไม่มีใครเปิดดูตอนที่มันมีประโยชน์
 */
function IndicationPicker({
  indications,
  indicationUrl,
}: {
  indications: TransplantIndication[];
  indicationUrl: string;
}) {
  const [selected, setSelected] = useState("");
  const detail = indications.find((i) => i.id === selected) ?? null;
  const byType = {
    AUTOLOGOUS: indications.filter((i) => i.type === "AUTOLOGOUS"),
    ALLOGENEIC: indications.filter((i) => i.type === "ALLOGENEIC"),
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="block font-medium text-zinc-700 mb-1">
          ข้อบ่งชี้การปลูกถ่าย (I/C) <span className="text-red-600">*</span>
        </span>
        <select
          name="transplantIndication"
          required
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
        >
          <option value="" disabled>
            — เลือกข้อบ่งชี้ —
          </option>
          {(["AUTOLOGOUS", "ALLOGENEIC"] as const).map((type) => (
            <optgroup key={type} label={TRANSPLANT_TYPE_LABEL_TH[type]}>
              {byType[type].map((item) => (
                <option key={item.id} value={item.id}>
                  {item.diseaseTh}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={INDICATION_OTHER}>{INDICATION_OTHER_LABEL_TH}</option>
        </select>
      </label>

      {detail && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-900">
            เกณฑ์ของข้อบ่งชี้นี้
          </p>
          <dl className="mt-1.5 space-y-1 text-amber-900/90">
            {detail.statusTh && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-amber-800/70">สถานะโรค</dt>
                <dd>{detail.statusTh}</dd>
              </div>
            )}
            {detail.ageTh && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-amber-800/70">อายุ</dt>
                <dd>{detail.ageTh}</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs text-amber-800">
            เป็นข้อมูลประกอบการตัดสินใจ ระบบไม่ได้ใช้ในการปิดกั้นการจองผู้ป่วย —
            หากไม่ตรงตามเกณฑ์ แต่เห็นว่าควรส่งมาปรึกษา
            สามารถส่งจองได้แล้วระบุเหตุผลในหมายเหตุ
          </p>
        </div>
      )}

      {selected === INDICATION_OTHER && (
        <p className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
          กรุณาระบุรายละเอียดในช่องหมายเหตุด้านล่าง
          เพื่อให้ทีมเตรียมข้อมูลก่อนวันนัดได้
        </p>
      )}

      <DocButtons
        url={indicationUrl}
        label="เกณฑ์การส่งต่อเพื่อปลูกถ่ายฯ ฉบับเต็ม"
        hint="เปิดดูตารางเกณฑ์ทั้งหมด หรือดาวน์โหลดไปพิมพ์ติดไว้ที่หน่วยงาน"
      />
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block font-medium text-zinc-700 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
      />
      {hint && <span className="block text-xs text-zinc-500 mt-1">{hint}</span>}
    </label>
  );
}

/**
 * หน้ายืนยัน — ข้อความที่ต้องเขียนบนใบ refer อยู่ตรงนี้และคัดลอกได้
 *
 * ที่ต้องเน้นข้อความนี้เพราะพยาบาลคัดกรองด่านหน้าใช้บรรทัดนี้บรรทัดเดียว
 * ในการส่งผู้ป่วยถึงตัวแพทย์ ถ้าไม่มี ผู้ป่วยจะถูกส่งวนหาแผนก
 */
function Confirmation({
  referralId,
  clinicDate,
  fellowName,
  manageToken,
}: {
  referralId: string;
  clinicDate: string;
  fellowName: string;
  manageToken: string;
}) {
  const referLine = `ส่งพบ fellow transplant ชื่อ ${fellowName} ที่ OPD 700`;

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-green-50 border-2 border-green-600 p-5">
        <p className="font-bold text-green-900 text-lg">✅ จองคิวเรียบร้อยแล้ว</p>
        <p className="text-sm text-green-900/80 mt-1 font-mono">{referralId}</p>

        <dl className="mt-4 space-y-1.5 text-sm">
          <Row label="วันนัด" value={formatDateTh(clinicDate)} />
          <Row label="เวลา" value="08:00 น." />
          <Row label="สถานที่" value={CONTACT.officeTh} />
          <Row label="พบแพทย์" value={fellowName} />
          <Row
            label="สอบถาม"
            value={`โทร. ${CONTACT.phoneDisplay} (${CONTACT.hoursTh})`}
          />
        </dl>
      </div>

      <div className="rounded-xl bg-white border-2 border-amber-500 p-5">
        <h2 className="font-semibold text-zinc-900">
          ⚠️ เขียนข้อความนี้บนหัวใบ refer
        </h2>
        <p className="text-sm text-zinc-600 mt-1">
          พยาบาลคัดกรองด่านหน้าใช้บรรทัดนี้ส่งผู้ป่วยถึงตัวแพทย์ ถ้าไม่มี
          ผู้ป่วยจะต้องวนหาแผนกเอง
        </p>
        <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 font-semibold text-amber-950">
          {referLine}
        </p>
        <CopyButton text={referLine} />
      </div>

      <div className="rounded-xl bg-white border border-zinc-200 p-5 text-sm">
        <h2 className="font-semibold text-zinc-900 mb-2">
          สิ่งที่ต้องแจ้งผู้ป่วยก่อนวันนัด
        </h2>
        <ul className="space-y-2 text-zinc-700">
          <li>• ทำบัตรโรงพยาบาลศิริราชให้เรียบร้อยก่อนวันนัด</li>
          <li>• มาถึง OPD 700 โลหิตวิทยา ตึกผู้ป่วยนอก ชั้น 7 เวลา 08:00 น.</li>
          <li>• นำเอกสารตาม checklist มาให้ครบ</li>
        </ul>
        <Link
          href="/refer/transplant"
          className="mt-3 inline-block font-medium text-blue-600 hover:underline"
        >
          ดู checklist เอกสารทั้งหมด →
        </Link>
      </div>

      <div className="rounded-xl bg-white border border-zinc-200 p-5 text-sm">
        <h2 className="font-semibold text-zinc-900">
          ต้องเลื่อนหรือยกเลิกนัดภายหลัง
        </h2>
        <p className="text-zinc-600 mt-1">
          ทำเองได้ ไม่ต้องโทรแจ้ง — คิวที่ยกเลิกจะว่างกลับเข้าปฏิทินทันที
          ให้แพทย์ท่านอื่นจองต่อได้ ทำได้ถึงวันก่อนวันนัด
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {manageToken && (
            <Link
              href={`/booking/slip?id=${encodeURIComponent(referralId)}&t=${encodeURIComponent(manageToken)}`}
              className="inline-flex rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              🖨️ พิมพ์ใบนัดให้ผู้ป่วย
            </Link>
          )}
          <Link
            href={
              manageToken
                ? `/booking?id=${encodeURIComponent(referralId)}&t=${encodeURIComponent(manageToken)}`
                : "/booking"
            }
            className="inline-flex rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            เปิดหน้าจัดการนัด
          </Link>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          ลิงก์เดียวกันนี้อยู่ในอีเมลยืนยันนัดด้วย
          หากเปิดหน้านี้ไม่ทันให้ดูในอีเมลได้
        </p>
      </div>

      <p className="text-sm text-zinc-500 text-center">
        กรุณาบันทึกเลข {referralId} ไว้อ้างอิงเมื่อติดต่อเจ้าหน้าที่
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-green-900/60">{label}</dt>
      <dd className="font-medium text-green-950">{value}</dd>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="mt-3 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
    >
      {copied ? "คัดลอกแล้ว ✓" : "คัดลอกข้อความ"}
    </button>
  );
}
