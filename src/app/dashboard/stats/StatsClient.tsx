"use client";

import { downloadCsv, fileStamp, toCsv } from "@/lib/csv";
import type { CountRow, Statistics } from "@/lib/statistics";
import { businessDaysText } from "@/lib/referral-types";

export interface ExportRow {
  referralId: string;
  submittedAt: string;
  groupNumber: number;
  status: string;
  diseaseGroup: string;
  diagnosis: string;
  stage: string;
  insuranceScheme: string;
  comorbidity: string;
  clinicalQuestion: string;
  adviceRecord: string;
  adviceRegimens: string;
  answeredBy: string;
  attending: string;
  elapsedBusinessHours: number;
  referrerOrg: string;
  referrerPhone: string;
  appointmentDate: string;
  fellowAssigned: string;
}

const CASE_HEADERS = [
  "referral_id", "submitted_at", "group", "status", "disease_group",
  "diagnosis", "stage", "insurance_scheme", "comorbidity",
  "clinical_question", "advice_record", "advice_regimens",
  "answered_by", "attending", "elapsed_business_hours",
  "referrer_org", "referrer_phone", "appointment_date", "fellow_assigned",
];

const caseRow = (r: ExportRow) => [
  r.referralId, r.submittedAt, r.groupNumber, r.status, r.diseaseGroup,
  r.diagnosis, r.stage, r.insuranceScheme, r.comorbidity,
  r.clinicalQuestion, r.adviceRecord, r.adviceRegimens,
  r.answeredBy, r.attending, r.elapsedBusinessHours,
  r.referrerOrg, r.referrerPhone, r.appointmentDate, r.fellowAssigned,
];

export function StatsClient({
  stats,
  all,
  dueTwoWeeks,
  fellowAppointments,
  answered,
}: {
  stats: Statistics;
  all: ExportRow[];
  dueTwoWeeks: ExportRow[];
  fellowAppointments: ExportRow[];
  answered: ExportRow[];
}) {
  const cases = (name: string, rows: ExportRow[]) => () =>
    downloadCsv(
      `${name}-${fileStamp()}`,
      toCsv(CASE_HEADERS, rows.map(caseRow)),
    );

  /** สถิติออกเป็นตารางยาวแนวตั้ง เปิดใน Excel แล้วทำ pivot ต่อได้ทันที */
  const downloadStats = () => {
    const rows: (string | number)[][] = [
      ["ภาพรวม", "เคสทั้งหมด", stats.total],
      ["ภาพรวม", "ยังไม่จบ", stats.open],
      ["ภาพรวม", "ตอบแล้ว", stats.answered],
      ["ภาพรวม", "มัธยฐานชั่วโมงทำการที่ใช้ตอบ", stats.medianBusinessHours ?? ""],
      ["ภาพรวม", "จบภายในกรอบเวลา", stats.withinSla],
      ["ภาพรวม", "เกินกรอบเวลา", stats.overSla],
      ...section("กลุ่มงาน", stats.byType),
      ...section("สถานะ", stats.byStatus),
      ...section("กลุ่มโรค", stats.byDiseaseGroup),
      ...section("สิทธิการรักษา", stats.byInsurance),
      ...section("สูตรยาที่เลือก", stats.byRegimen),
      ...section("รายเดือน", stats.byMonth),
    ];
    downloadCsv(
      `สถิติ-${fileStamp()}`,
      toCsv(["หมวด", "รายการ", "จำนวน"], rows),
    );
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="เคสทั้งหมด" value={stats.total} />
        <Stat label="ยังไม่จบ" value={stats.open} tone="amber" />
        <Stat label="ตอบแล้ว" value={stats.answered} tone="green" />
        <Stat
          label="เวลาที่ใช้ตอบ (ค่ากลาง)"
          value={
            stats.medianBusinessHours === null
              ? "—"
              : businessDaysText(stats.medianBusinessHours)
          }
        />
        <Stat label="จบในกรอบเวลา" value={stats.withinSla} tone="green" />
        <Stat label="เกินกรอบเวลา" value={stats.overSla} tone="red" />
      </section>

      {/* ปุ่มดาวน์โหลดอยู่บนสุด เพราะคนที่เข้าหน้านี้ส่วนใหญ่มาเอาไฟล์ ไม่ได้มาอ่าน */}
      <section className="rounded-xl bg-white border border-zinc-200 p-5 print:hidden">
        <h2 className="font-semibold text-zinc-900 mb-1">ดาวน์โหลด</h2>
        <p className="text-sm text-zinc-600 mb-3">
          ไฟล์ CSV เปิดได้ทั้ง Excel, Numbers และ Google Sheets
        </p>
        <div className="flex flex-wrap gap-2">
          <Download onClick={downloadStats} label="สถิติทั้งหมด" />
          <Download
            onClick={cases("คิวตอบ-2สัปดาห์", dueTwoWeeks)}
            label={`คิวที่ต้องตอบใน 2 สัปดาห์ (${dueTwoWeeks.length})`}
          />
          <Download
            onClick={cases("นัด-fellow", fellowAppointments)}
            label={`นัดของ fellow (${fellowAppointments.length})`}
          />
          <Download
            onClick={cases("คำตอบที่ตอบแล้ว", answered)}
            label={`คำตอบที่ตอบแล้ว (${answered.length})`}
          />
          <Download onClick={cases("เคสทั้งหมด", all)} label={`เคสทั้งหมด (${all.length})`} />
        </div>
        <p className="text-xs text-amber-800 mt-3">
          ⚠️ ไฟล์เหล่านี้มีข้อมูลคลินิกและเบอร์ติดต่อแพทย์ต้นทาง —
          เก็บในเครื่องของหน่วยงาน ไม่อัปโหลดขึ้นบริการภายนอก
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Table title="แยกตามกลุ่มงาน" rows={stats.byType} total={stats.total} />
        <Table title="แยกตามสถานะ" rows={stats.byStatus} total={stats.total} />
        <Table title="กลุ่มโรค" rows={stats.byDiseaseGroup} total={stats.total} />
        <Table
          title="สิทธิการรักษา"
          rows={stats.byInsurance}
          total={stats.total}
          empty="ยังไม่มีเคสที่ระบุสิทธิ — ฟอร์มเพิ่งเริ่มถามคำถามนี้"
        />
        <Table
          title="สูตรยาที่เลือกบ่อย"
          rows={stats.byRegimen}
          total={stats.answered}
          empty="ยังไม่มีเคสที่เลือกสูตรยาจากคลัง"
        />
        <Table title="เคสต่อเดือน" rows={stats.byMonth} total={stats.total} />
      </div>
    </div>
  );
}

function section(name: string, rows: CountRow[]): (string | number)[][] {
  return rows.map((r) => [name, r.label, r.count]);
}

function Stat({
  label,
  value,
  tone = "zinc",
}: {
  label: string;
  value: number | string;
  tone?: "zinc" | "amber" | "green" | "red";
}) {
  const color = {
    zinc: "text-zinc-900",
    amber: "text-amber-700",
    green: "text-green-700",
    red: "text-red-700",
  }[tone];

  return (
    <div className="rounded-xl bg-white border border-zinc-200 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Download({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
    >
      ⬇ {label}
    </button>
  );
}

function Table({
  title,
  rows,
  total,
  empty = "ยังไม่มีข้อมูล",
}: {
  title: string;
  rows: CountRow[];
  total: number;
  empty?: string;
}) {
  return (
    <section className="rounded-xl bg-white border border-zinc-200 p-4">
      <h2 className="font-semibold text-zinc-900 text-sm mb-2">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 10).map((r) => (
            <li key={r.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-700 min-w-0 truncate">{r.label}</span>
                <span className="text-zinc-900 font-medium tabular-nums shrink-0">
                  {r.count}
                </span>
              </div>
              {/* แถบสัดส่วน — อ่านเร็วกว่าตัวเลขเมื่อเทียบกันหลายรายการ */}
              <div className="h-1 bg-zinc-100 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
          {rows.length > 10 && (
            <li className="text-xs text-zinc-500 pt-1">
              และอีก {rows.length - 10} รายการ — ดูครบในไฟล์ CSV
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
