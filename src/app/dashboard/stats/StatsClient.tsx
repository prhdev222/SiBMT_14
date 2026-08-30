"use client";

import { downloadCsv, fileStamp, toCsv } from "@/lib/csv";
import type { CountRow, Statistics } from "@/lib/statistics";
import { businessDaysText } from "@/lib/referral-types";
import { CategoryBars } from "@/components/charts/CategoryBars";
import { MonthlyBars } from "@/components/charts/MonthlyBars";

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
  /** ชื่อไทยของประเภทคำถาม แปลงมาแล้วจากฝั่งเซิร์ฟเวอร์ */
  questionType: string;
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
  "clinical_question", "question_type", "advice_record", "advice_regimens",
  "answered_by", "attending", "elapsed_business_hours",
  "referrer_org", "referrer_phone", "appointment_date", "fellow_assigned",
];

const caseRow = (r: ExportRow) => [
  r.referralId, r.submittedAt, r.groupNumber, r.status, r.diseaseGroup,
  r.diagnosis, r.stage, r.insuranceScheme, r.comorbidity,
  r.clinicalQuestion, r.questionType, r.adviceRecord, r.adviceRegimens,
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
      ...section("ประเภทคำถาม", stats.byQuestionType),
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

      <Card title="จำนวนเคสที่ส่งเข้ามาแต่ละเดือน">
        <MonthlyBars data={stats.byMonth} />
      </Card>

      {/*
        กลุ่มงานเป็นตัวตนถาวร สีจึงผูกกับเลขกลุ่ม ไม่ใช่อันดับ —
        กลุ่มที่ 2 เป็นสีส้มเสมอ ไม่ว่าจะมีเคสมากหรือน้อยกว่ากลุ่มอื่น
      */}
      {/*
        อยู่นอกตารางสองคอลัมน์เพราะเป็นคำถามที่หน้านี้ตอบตรงที่สุด —
        "ที่ปรึกษาเข้ามาถามเรื่องอะไร" ซึ่งเป็นคนละเรื่องกับ "เป็นโรคอะไร"
      */}
      <Card title="ประเภทคำถามที่ปรึกษาเข้ามา">
        <CategoryBars
          data={stats.byQuestionType}
          emptyText="ยังไม่มีเคสที่บันทึกประเภทคำถาม — เคสที่ตอบก่อนมีช่องนี้จะไม่มีค่าย้อนหลัง"
        />
      </Card>

      <Card title="แยกตามกลุ่มงาน">
        <CategoryBars
          data={stats.byType.map((r, i) => ({ ...r, seriesIndex: i }))}
          max={stats.total}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="แยกตามสถานะ">
          <CategoryBars data={stats.byStatus} />
        </Card>
        <Card title="กลุ่มโรค">
          <CategoryBars data={stats.byDiseaseGroup} />
        </Card>
        <Card title="สิทธิการรักษา">
          <CategoryBars
            data={stats.byInsurance}
            emptyText="ยังไม่มีเคสที่ระบุสิทธิ — ฟอร์มเพิ่งเริ่มถามคำถามนี้"
          />
        </Card>
        <Card title="สูตรยาที่เลือกบ่อย">
          <CategoryBars
            data={stats.byRegimen}
            emptyText="ยังไม่มีเคสที่เลือกสูตรยาจากคลัง"
          />
        </Card>
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

function Card({
  title,
  note,
  children,
}: {
  title: string;
  /** คำอธิบายใต้กราฟ — ใช้เมื่อตัวเลขอาจถูกอ่านผิดถ้าไม่มีบริบท */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white border border-zinc-200 p-4">
      <h2 className="font-semibold text-zinc-900 text-sm mb-3">{title}</h2>
      {children}
      {note && <p className="text-xs text-zinc-500 mt-3">ⓘ {note}</p>}
    </section>
  );
}
