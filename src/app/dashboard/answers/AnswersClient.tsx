"use client";

import { useMemo, useState } from "react";
import { downloadCsv, fileStamp, toCsv } from "@/lib/csv";
import { ChartCard } from "@/components/charts/ChartCard";

export interface AnsweredCase {
  referralId: string;
  submittedAt: string;
  groupNumber: number;
  diseaseGroup: string;
  diagnosis: string;
  stage: string;
  insuranceScheme: string;
  comorbidity: string;
  treatmentSummary: string;
  clinicalQuestion: string;
  adviceRecord: string;
  adviceRegimens: string;
  /** ชื่อไทยของประเภทคำถาม แปลงมาแล้วจากฝั่งเซิร์ฟเวอร์ — ว่างได้ */
  questionType: string;
  answeredBy: string;
  attending: string;
  referrerOrg: string;
}

const HEADERS = [
  "referral_id", "submitted_at", "group", "disease_group", "diagnosis",
  "stage", "insurance_scheme", "comorbidity", "treatment_summary",
  "clinical_question", "question_type", "advice_record", "advice_regimens",
  "answered_by", "attending", "referrer_org",
];

/**
 * คำตอบที่ตอบไปแล้ว สำหรับทำรายงานหรือ present
 *
 * ⚠️ ไม่สร้าง PDF เอง — ใช้ระบบพิมพ์ของเบราว์เซอร์ (Save as PDF)
 *
 * ได้ผลเหมือนกัน ทำงานได้ทุกเครื่องโดยไม่ต้องพึ่งไลบรารีที่ต้องคอยอัปเดต
 * และผู้ใช้ควบคุมขนาดกระดาษกับระยะขอบได้เองจากหน้าต่างพิมพ์
 * สไตล์ print: ในหน้านี้จัดการเรื่องซ่อนปุ่มและไม่ให้เคสถูกตัดกลางหน้าแล้ว
 */
export function AnswersClient({ cases }: { cases: AnsweredCase[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"all" | 2 | 3>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      if (group !== "all" && c.groupNumber !== group) return false;
      if (!q) return true;
      return (
        c.referralId.toLowerCase().includes(q) ||
        c.diagnosis.toLowerCase().includes(q) ||
        c.diseaseGroup.toLowerCase().includes(q) ||
        c.adviceRecord.toLowerCase().includes(q) ||
        c.adviceRegimens.toLowerCase().includes(q) ||
        c.questionType.toLowerCase().includes(q)
      );
    });
  }, [cases, query, group]);

  const download = () =>
    downloadCsv(
      `คำตอบ-${fileStamp()}`,
      toCsv(
        HEADERS,
        filtered.map((c) => [
          c.referralId, c.submittedAt, c.groupNumber, c.diseaseGroup,
          c.diagnosis, c.stage, c.insuranceScheme, c.comorbidity,
          c.treatmentSummary, c.clinicalQuestion, c.questionType, c.adviceRecord,
          c.adviceRegimens, c.answeredBy, c.attending, c.referrerOrg,
        ]),
      ),
    );

  return (
    <>
      <section className="rounded-xl bg-white border border-zinc-200 p-4 space-y-3 print:hidden">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหา — รหัสเคส, การวินิจฉัย, สูตรยา, ข้อความในคำตอบ"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <select
            value={group}
            onChange={(e) =>
              setGroup(e.target.value === "all" ? "all" : (Number(e.target.value) as 2 | 3))
            }
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="all">ทุกกลุ่ม</option>
            <option value="2">กลุ่มที่ 2</option>
            <option value="3">กลุ่มที่ 3</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            🖨 พิมพ์ / บันทึกเป็น PDF
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
          >
            ⬇ ดาวน์โหลด CSV
          </button>
          <span className="text-sm text-zinc-600">
            {filtered.length} จาก {cases.length} เคส
          </span>
        </div>

        <p className="text-xs text-zinc-500">
          พิมพ์และดาวน์โหลดตามผลการค้นหาที่แสดงอยู่ —
          กรองก่อนแล้วค่อยกด จะได้เฉพาะเคสที่ต้องการ
        </p>
      </section>

      <Analysis cases={filtered} />

      {filtered.length === 0 ? (
        <p className="rounded-xl bg-white border border-zinc-200 p-8 text-center text-sm text-zinc-600">
          ไม่พบเคสที่ตรงกับที่ค้น
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <article
              key={c.referralId}
              className="rounded-xl bg-white border border-zinc-200 p-4 print:break-inside-avoid print:border-zinc-400"
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="font-semibold text-zinc-900">
                  {c.diagnosis || c.diseaseGroup || "ไม่ระบุการวินิจฉัย"}
                </h2>
                <span className="font-mono text-xs text-zinc-500">
                  {c.referralId}
                </span>
              </div>

              <p className="text-xs text-zinc-500 mt-0.5">
                กลุ่มที่ {c.groupNumber} · {c.submittedAt}
                {c.questionType && ` · ${c.questionType}`}
                {c.insuranceScheme && ` · ${c.insuranceScheme}`}
                {c.adviceRegimens && ` · ${c.adviceRegimens}`}
              </p>

              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-sm mt-2">
                <Field label="กลุ่มโรค" value={c.diseaseGroup} />
                <Field label="ระยะ / ความเสี่ยง" value={c.stage} />
                <Field label="โรคร่วม" value={c.comorbidity} />
                <Field label="ส่งมาจาก" value={c.referrerOrg} />
              </dl>

              {c.treatmentSummary && (
                <Block label="การรักษาที่ได้รับมาแล้ว" value={c.treatmentSummary} />
              )}
              {c.clinicalQuestion && (
                <Block label="คำถาม" value={c.clinicalQuestion} />
              )}

              <div className="mt-2 rounded-lg bg-zinc-50 border border-zinc-200 p-3 print:bg-white">
                <p className="text-xs font-medium text-zinc-500 mb-1">คำตอบ</p>
                <p className="text-sm text-zinc-900 whitespace-pre-wrap leading-relaxed">
                  {c.adviceRecord}
                </p>
              </div>

              {(c.answeredBy || c.attending) && (
                <p className="text-xs text-zinc-500 mt-2">
                  {c.answeredBy && `ผู้ตอบ: ${c.answeredBy}`}
                  {c.answeredBy && c.attending && " · "}
                  {c.attending && `อาจารย์: ${c.attending}`}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * สรุปภาพรวมของคำตอบที่กำลังดูอยู่
 *
 * ⚠️ คิดจากผลที่กรองอยู่ ไม่ใช่ทั้งคลัง โดยตั้งใจ
 *
 * ประโยชน์ของหน้านี้คือ "กรองเฉพาะ Lymphoma แล้วดูว่าเราตอบอะไรไปบ้าง"
 * ถ้าสรุปยอดจากทั้งคลังเสมอ ตัวเลขจะไม่เกี่ยวกับสิ่งที่อยู่ตรงหน้าเลย
 *
 * พับไว้เพราะคนที่เข้ามาพิมพ์รายงานไม่ได้ต้องการเห็นตัวเลขก่อน
 * และตอนพิมพ์ก็ซ่อนทั้งกล่อง — รายงานควรมีเนื้อคำตอบ ไม่ใช่แผงวิเคราะห์
 */
function Analysis({ cases }: { cases: AnsweredCase[] }) {
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    const tally = (values: string[]) => {
      const map = new Map<string, number>();
      for (const v of values) {
        const k = v.trim();
        if (k) map.set(k, (map.get(k) ?? 0) + 1);
      }
      return [...map.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
    };

    return {
      byGroup: [2, 3]
        .map((n) => ({
          label: `กลุ่มที่ ${n}`,
          count: cases.filter((c) => c.groupNumber === n).length,
          // n - 1 ไม่ใช่ลำดับที่วน — กลุ่มที่ 2 ต้องเป็นสีส้มเหมือนหน้าสถิติ
          // ไม่ใช่สีน้ำเงินเพราะบังเอิญมาก่อนในรายการนี้
          seriesIndex: n - 1,
        }))
        .filter((r) => r.count > 0),
      byQuestionType: tally(cases.map((c) => c.questionType)),
      byDisease: tally(cases.map((c) => c.diseaseGroup)),
      byRegimen: tally(
        cases.flatMap((c) => c.adviceRegimens.split(",").map((x) => x.trim())),
      ),
      byInsurance: tally(cases.map((c) => c.insuranceScheme)),
    };
  }, [cases]);

  if (cases.length === 0) return null;

  return (
    <section className="rounded-xl bg-white border border-zinc-200 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left flex items-center justify-between gap-2 hover:bg-zinc-50 transition-colors rounded-xl"
      >
        <span className="font-semibold text-zinc-900 text-sm">
          วิเคราะห์คำตอบที่แสดงอยู่ ({cases.length} เคส)
        </span>
        <span className="text-xs text-blue-600 shrink-0">
          {open ? "ย่อ ▲" : "ดู ▼"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 grid gap-3 sm:grid-cols-2">
          <ChartCard
            dense
            title="แยกตามกลุ่มงาน"
            data={summary.byGroup}
            max={cases.length}
          />
          <ChartCard
            dense
            title="ประเภทคำถาม"
            data={summary.byQuestionType}
            emptyText="ยังไม่มีเคสที่บันทึกประเภทคำถาม"
          />
          <ChartCard dense title="กลุ่มโรค" data={summary.byDisease} />
          {/* เคสเดียวเลือกได้หลายสูตร ผลรวมจึงไม่ใช่จำนวนเคส — วงกลมใช้ไม่ได้ */}
          <ChartCard
            dense
            pie={false}
            title="สูตรยาที่แนะนำบ่อย"
            data={summary.byRegimen}
            emptyText="ยังไม่มีเคสที่เลือกสูตรยาจากคลัง"
          />
          <ChartCard
            dense
            title="สิทธิการรักษา"
            data={summary.byInsurance}
            emptyText="ยังไม่มีเคสที่ระบุสิทธิ"
          />
        </div>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-800 min-w-0">{value}</dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
        {value}
      </p>
    </div>
  );
}
