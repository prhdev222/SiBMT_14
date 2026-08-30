"use client";

import { useMemo, useState } from "react";
import { downloadCsv, fileStamp, toCsv } from "@/lib/csv";
import { buildStatistics, type CountRow } from "@/lib/statistics";
import { questionTypeLabel } from "@/lib/question-types";
import {
  REFERRAL_TYPE_META,
  STATUS_LABEL_TH,
  businessDaysText,
  isTerminal,
  type Referral,
} from "@/lib/referral-types";
import { ChartCard } from "@/components/charts/ChartCard";

interface ExportRow {
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

/**
 * แปลงเคสเป็นแถวสำหรับไฟล์ CSV
 *
 * ⚠️ ไม่มีคอลัมน์ชื่อหรือ HN ผู้ป่วย เพราะระบบไม่เคยเก็บ
 * แต่มีเบอร์และชื่อโรงพยาบาลต้นทาง ซึ่งเป็นข้อมูลส่วนบุคคลของบุคลากร
 * หน้าเว็บจึงเตือนว่าไฟล์ที่โหลดไปต้องเก็บในเครื่องของหน่วยงาน
 */
function toExportRow(r: Referral): ExportRow {
  return {
    referralId: r.referralId,
    submittedAt: r.submittedAt,
    groupNumber: REFERRAL_TYPE_META[r.referralType].groupNumber,
    status: STATUS_LABEL_TH[r.status],
    diseaseGroup: r.diseaseGroup ?? "",
    diagnosis: r.diagnosis,
    stage: r.stage,
    insuranceScheme: r.insuranceScheme,
    comorbidity: r.comorbidity,
    clinicalQuestion: r.clinicalQuestion,
    questionType: questionTypeLabel(r.questionType),
    adviceRecord: r.adviceRecord,
    adviceRegimens: r.adviceRegimens,
    answeredBy: r.answeredBy,
    attending: r.adviceAttending,
    elapsedBusinessHours: r.elapsedBusinessHours,
    referrerOrg: r.referrerOrg,
    referrerPhone: r.referrerPhone,
    appointmentDate: r.appointmentDate ?? "",
    fellowAssigned: r.fellowAssigned ?? "",
  };
}

type DatasetId = "stats" | "all" | "answered" | "due" | "fellow";

const DATASETS: { id: DatasetId; label: string; hint: string }[] = [
  {
    id: "stats",
    label: "สถิติสรุป — ตัวเลขทุกหมวดในหน้านี้",
    hint: "ตารางแนวตั้ง หมวด/รายการ/จำนวน เปิดใน Excel แล้วทำ pivot ต่อได้ทันที",
  },
  {
    id: "all",
    label: "เคสทั้งหมด",
    hint: "ทุกเคสที่ส่งเข้ามาในช่วงที่เลือก ไม่ว่าจะจบแล้วหรือยัง",
  },
  {
    id: "answered",
    label: "คำตอบที่ตอบแล้ว",
    hint: "เฉพาะเคสที่มีคำตอบบันทึกไว้ — ใช้ทำรายงานหรือทบทวนวิชาการ",
  },
  {
    id: "due",
    label: "คิวที่ต้องตอบ (ยังไม่จบ)",
    hint: "เรียงจากเคสที่ค้างนานที่สุด — เคสเก่ายิ่งต้องอยู่ต้นรายการ",
  },
  {
    id: "fellow",
    label: "นัดของ fellow (2 สัปดาห์ข้างหน้า)",
    hint: "⚠️ ใช้วันนัด ไม่ใช่วันที่ส่งเข้ามา จึงไม่ขึ้นกับช่วงวันที่ที่เลือกไว้",
  },
];

export function StatsClient({
  referrals,
  todayIso,
  horizonIso,
}: {
  referrals: Referral[];
  /** วันนี้ตามเวลาเซิร์ฟเวอร์ — ส่งมาเป็น prop เพื่อไม่ให้ค่าต่างกันตอน hydrate */
  todayIso: string;
  /** ขอบท้ายของช่วงนัด fellow ที่ให้เตรียมตัวล่วงหน้า */
  horizonIso: string;
}) {
  const [dataset, setDataset] = useState<DatasetId>("stats");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  /**
   * เคสที่อยู่ในช่วงวันที่ที่เลือก
   *
   * ⚠️ ช่วงวันที่คุมทั้งหน้า ทั้งตัวเลข กราฟ และไฟล์ที่โหลด
   *
   * เคยคิดจะให้คุมเฉพาะไฟล์ แต่แบบนั้นกราฟกับไฟล์จะเป็นคนละช่วงกัน
   * แล้ววันหนึ่งจะมีสไลด์ที่กราฟเป็นทั้งปีแต่ตัวเลขใต้กราฟเป็นไตรมาสเดียว
   * โดยไม่มีอะไรบอก — ตัวเลขถูกทุกตัวแต่สไลด์ผิด
   */
  const inRange = useMemo(() => {
    return (r: Referral) => {
      if (!from && !to) return true;
      const day = isoDay(r.submittedAt);
      if (!day) return false;
      return (!from || day >= from) && (!to || day <= to);
    };
  }, [from, to]);

  const cases = useMemo(
    () => referrals.filter(inRange),
    [referrals, inRange],
  );

  /**
   * เคสที่อ่านวันที่ไม่ออกจะหลุดออกไปเมื่อเลือกช่วง
   *
   * ต้องบอกให้เห็น ไม่ใช่หายเงียบ ๆ — ผลรวมที่น้อยกว่าความจริงโดยไม่มีคำอธิบาย
   * คือสิ่งที่ทำให้คนไม่เชื่อรายงานทั้งฉบับ
   */
  const undated = useMemo(
    () =>
      from || to
        ? referrals.filter((r) => !isoDay(r.submittedAt)).length
        : 0,
    [referrals, from, to],
  );

  const stats = useMemo(() => buildStatistics(cases), [cases]);

  const dueTwoWeeks = useMemo(
    () =>
      cases
        .filter(
          (r) =>
            (r.referralType === "REGIMEN_CONSULT" ||
              r.referralType === "CHEMO_ADMISSION") &&
            !isTerminal(r.status),
        )
        .sort((a, b) => b.elapsedBusinessHours - a.elapsedBusinessHours)
        .map(toExportRow),
    [cases],
  );

  // นัดของ fellow นับจากวันนัด ไม่ใช่วันที่ส่งเข้ามา — เป็นรายการงานข้างหน้า
  // ไม่ใช่รายงานย้อนหลัง จึงไม่ผูกกับช่วงวันที่ที่เลือกไว้ด้านบน
  const fellowAppointments = useMemo(
    () =>
      referrals
        .filter(
          (r) =>
            r.referralType === "TRANSPLANT_APPOINTMENT" &&
            r.status === "Appointment Confirmed" &&
            r.appointmentDate &&
            r.appointmentDate >= todayIso &&
            r.appointmentDate <= horizonIso,
        )
        .sort((a, b) =>
          (a.appointmentDate ?? "").localeCompare(b.appointmentDate ?? ""),
        )
        .map(toExportRow),
    [referrals, todayIso, horizonIso],
  );

  const answered = useMemo(
    () =>
      cases
        .filter((r) => r.adviceRecord.trim().length > 0)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .map(toExportRow),
    [cases],
  );

  const rowsFor = (id: DatasetId): ExportRow[] => {
    if (id === "all") return cases.map(toExportRow);
    if (id === "answered") return answered;
    if (id === "due") return dueTwoWeeks;
    if (id === "fellow") return fellowAppointments;
    return [];
  };

  const current = DATASETS.find((d) => d.id === dataset)!;
  // สถิติสรุปนับจาก stats.total ไม่ใช่ cases.length — buildStatistics ตัดกลุ่มที่ 4
  // ออกไปก่อนแล้ว ถ้าโชว์ cases.length ตัวเลขบนปุ่มจะไม่ตรงกับตัวเลขในไฟล์
  const count = dataset === "stats" ? stats.total : rowsFor(dataset).length;

  /**
   * ต่อท้ายชื่อไฟล์ให้รู้ว่าเป็นข้อมูลช่วงไหน โดยไม่ต้องเปิดไฟล์ดู
   *
   * ไม่ใส่ทั้งช่วงข้อมูลและวันที่โหลดพร้อมกัน — ชื่อไฟล์ที่มีสามวันที่
   * อ่านไม่ออกว่าอันไหนคืออะไร เลือกอย่างเดียวที่ตอบคำถามได้มากกว่า
   */
  const rangeTag =
    dataset === "fellow"
      ? `${todayIso}-ถึง-${horizonIso}`
      : from || to
        ? `${from || "เริ่มต้น"}-ถึง-${to || "ล่าสุด"}`
        : fileStamp();

  const download = () => {
    if (dataset === "stats") {
      downloadCsv(
        `สถิติ-${rangeTag}`,
        toCsv(["หมวด", "รายการ", "จำนวน"], [
          ["ช่วงข้อมูล", "ตั้งแต่", from || "ไม่จำกัด"],
          ["ช่วงข้อมูล", "ถึง", to || "ไม่จำกัด"],
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
        ]),
      );
      return;
    }

    downloadCsv(
      `${current.label.replace(/\s*[(—].*$/, "").trim()}-${rangeTag}`,
      toCsv(CASE_HEADERS, rowsFor(dataset).map(caseRow)),
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white border border-zinc-200 p-5 print:hidden">
        <h2 className="font-semibold text-zinc-900">เลือกข้อมูลที่ต้องการ</h2>
        <p className="text-sm text-zinc-600 mt-0.5 mb-3">
          ช่วงวันที่ที่เลือกมีผลกับทั้งหน้า — ทั้งตัวเลข กราฟ และไฟล์ที่โหลด
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="block text-sm sm:col-span-3">
            <span className="block text-zinc-600 mb-1">ข้อมูล</span>
            <select
              value={dataset}
              onChange={(e) => setDataset(e.target.value as DatasetId)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              {DATASETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <label className="block text-sm">
              <span className="block text-zinc-600 mb-1">ตั้งแต่วันที่</span>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-zinc-600 mb-1">ถึงวันที่</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
            </label>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={download}
              disabled={count === 0}
              className="w-full sm:w-auto rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50 disabled:hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              ⬇ ดาวน์โหลด CSV
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-zinc-500">ช่วงที่ใช้บ่อย</span>
          <Preset label="ทั้งหมด" onClick={() => { setFrom(""); setTo(""); }} />
          <Preset
            label="30 วันล่าสุด"
            onClick={() => { setFrom(daysBefore(todayIso, 30)); setTo(todayIso); }}
          />
          <Preset
            label="3 เดือนล่าสุด"
            onClick={() => { setFrom(daysBefore(todayIso, 90)); setTo(todayIso); }}
          />
          <Preset
            label="ปีนี้"
            onClick={() => { setFrom(`${todayIso.slice(0, 4)}-01-01`); setTo(todayIso); }}
          />
        </div>

        <p className="text-sm text-zinc-700 mt-3">
          {dataset === "stats"
            ? `จะได้สถิติสรุปของ ${count.toLocaleString()} เคส`
            : `จะได้ ${count.toLocaleString()} แถว`}
          {count === 0 && " — ไม่มีข้อมูลในเงื่อนไขนี้"}
        </p>
        <p className="text-xs text-zinc-500 mt-1">{current.hint}</p>

        {undated > 0 && (
          <p className="text-xs text-amber-800 mt-2">
            ⚠️ ไม่ได้นับ {undated} เคสที่อ่านวันที่ส่งเข้ามาไม่ได้ —
            กด &ldquo;ทั้งหมด&rdquo; เพื่อดูรวมทุกเคส
          </p>
        )}

        <p className="text-xs text-amber-800 mt-3">
          ⚠️ ไฟล์เหล่านี้มีข้อมูลคลินิกและเบอร์ติดต่อแพทย์ต้นทาง —
          เก็บในเครื่องของหน่วยงาน ไม่อัปโหลดขึ้นบริการภายนอก
        </p>
      </section>

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

      {stats.total === 0 ? (
        <p className="rounded-xl bg-white border border-zinc-200 p-8 text-center text-sm text-zinc-600">
          ไม่มีเคสในช่วงวันที่ที่เลือก
        </p>
      ) : (
        <>
          <ChartCard
            title="จำนวนเคสที่ส่งเข้ามาแต่ละเดือน"
            kind="monthly"
            data={stats.byMonth}
          />

          {/*
            อยู่นอกตารางสองคอลัมน์เพราะเป็นคำถามที่หน้านี้ตอบตรงที่สุด —
            "ที่ปรึกษาเข้ามาถามเรื่องอะไร" ซึ่งเป็นคนละเรื่องกับ "เป็นโรคอะไร"
          */}
          <ChartCard
            title="ประเภทคำถามที่ปรึกษาเข้ามา"
            data={stats.byQuestionType}
            emptyText="ยังไม่มีเคสที่บันทึกประเภทคำถาม — เคสที่ตอบก่อนมีช่องนี้จะไม่มีค่าย้อนหลัง"
          />

          {/*
            กลุ่มงานเป็นตัวตนถาวร สีจึงผูกกับเลขกลุ่ม ไม่ใช่อันดับ —
            กลุ่มที่ 2 เป็นสีส้มเสมอ ไม่ว่าจะมีเคสมากหรือน้อยกว่ากลุ่มอื่น
          */}
          <ChartCard
            title="แยกตามกลุ่มงาน"
            data={stats.byType.map((r, i) => ({ ...r, seriesIndex: i }))}
            max={stats.total}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <ChartCard title="แยกตามสถานะ" data={stats.byStatus} />
            <ChartCard title="กลุ่มโรค" data={stats.byDiseaseGroup} />
            <ChartCard
              title="สิทธิการรักษา"
              data={stats.byInsurance}
              emptyText="ยังไม่มีเคสที่ระบุสิทธิ — ฟอร์มเพิ่งเริ่มถามคำถามนี้"
            />
            {/*
              ไม่มีวงกลมให้เลือก — เคสเดียวเลือกได้หลายสูตร ผลรวมของทุกสูตร
              จึงมากกว่าจำนวนเคส วงกลมจะอ่านเป็น "ร้อยละของเคส" ทันทีทั้งที่ไม่ใช่
            */}
            <ChartCard
              pie={false}
              title="สูตรยาที่เลือกบ่อย"
              data={stats.byRegimen}
              emptyText="ยังไม่มีเคสที่เลือกสูตรยาจากคลัง"
            />
          </div>
        </>
      )}
    </div>
  );
}

function section(name: string, rows: CountRow[]): (string | number)[][] {
  return rows.map((r) => [name, r.label, r.count]);
}

/**
 * วันที่แบบ yyyy-MM-dd จากค่า submittedAt
 *
 * formatSubmittedAt() คืน "yyyy-MM-dd HH:mm" จึงตัดสิบตัวแรกได้เลย
 * คืนค่าว่างเมื่อรูปแบบไม่ตรง เพื่อให้ผู้เรียกตัดสินใจเองว่าจะทำอย่างไร
 * — ดีกว่าเดาวันที่ให้เคสที่ไม่รู้วันที่จริง
 */
function isoDay(submittedAt: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(submittedAt) ? submittedAt.slice(0, 10) : "";
}

/** ย้อนหลัง n วันจากวันที่ yyyy-MM-dd — คิดเป็น UTC เพื่อไม่ให้เขตเวลาทำวันเพี้ยน */
function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-zinc-300 px-3 py-1.5 sm:py-1 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
    >
      {label}
    </button>
  );
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
