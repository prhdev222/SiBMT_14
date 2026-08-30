import Link from "next/link";
import type { Metadata } from "next";
import { loadReferrals } from "@/lib/referral-repository";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import { REFERRAL_TYPE_META } from "@/lib/referral-types";
import { questionTypeLabel } from "@/lib/question-types";
import { AnswersClient, type AnsweredCase } from "./AnswersClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "คำตอบที่ตอบแล้ว — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/**
 * คลังคำตอบของ resident สำหรับทบทวนและทำรายงาน
 *
 * ⚠️ ไม่มีชื่อหรือ HN ผู้ป่วย เพราะระบบไม่เคยเก็บ — แต่มีชื่อโรงพยาบาลต้นทาง
 * ซึ่งพอรวมกับวันที่และการวินิจฉัยอาจแคบลงจนใกล้ระบุตัวได้ในโรคที่พบยาก
 * เอกสารที่พิมพ์ออกไปจึงต้องดูแลเหมือนเวชระเบียน ไม่ใช่เอกสารทั่วไป
 */
export default async function AnswersPage() {
  const session = await requireSession("/dashboard/answers");
  const { referrals, isSampleData } = await loadReferrals();

  const cases: AnsweredCase[] = referrals
    .filter(
      (r) =>
        (r.referralType === "REGIMEN_CONSULT" ||
          r.referralType === "CHEMO_ADMISSION") &&
        r.adviceRecord.trim().length > 0,
    )
    // ใหม่สุดขึ้นก่อน — คนทำรายงานมักเริ่มจากรอบล่าสุด
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map((r) => ({
      referralId: r.referralId,
      submittedAt: r.submittedAt,
      groupNumber: REFERRAL_TYPE_META[r.referralType].groupNumber,
      diseaseGroup: r.diseaseGroup ?? "",
      diagnosis: r.diagnosis,
      stage: r.stage,
      insuranceScheme: r.insuranceScheme,
      comorbidity: r.comorbidity,
      treatmentSummary: r.treatmentSummary,
      clinicalQuestion: r.clinicalQuestion,
      adviceRecord: r.adviceRecord,
      adviceRegimens: r.adviceRegimens,
      questionType: questionTypeLabel(r.questionType),
      answeredBy: r.answeredBy,
      attending: r.adviceAttending,
      referrerOrg: r.referrerOrg,
    }));

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 print:bg-white">
      <div className="print:hidden">
        <SessionBar username={session.username} />
      </div>

      <header className="bg-white border-b border-zinc-200 print:border-none">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">กลุ่มที่ 2 และ 3</p>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
              คำตอบที่ตอบแล้ว
            </h1>
          </div>
          <div className="flex items-center gap-4 print:hidden">
            <Link
              href="/dashboard/stats"
              className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
            >
              สถิติ
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
            >
              กลับ Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        {isSampleData && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 print:hidden">
            <span className="font-semibold">กำลังแสดงข้อมูลตัวอย่าง</span> —
            ยังไม่ได้ต่อ Google Sheet จริง
          </p>
        )}

        {cases.length === 0 ? (
          <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
            <p className="text-lg font-semibold text-zinc-900">
              ยังไม่มีคำตอบในระบบ
            </p>
            <p className="text-sm text-zinc-600 mt-1">
              คำตอบจะมาปรากฏที่นี่หลังบันทึกจากหน้าตอบคำปรึกษา
            </p>
          </div>
        ) : (
          <AnswersClient cases={cases} />
        )}

        <p className="text-xs text-zinc-500 pt-2">
          🔒 เอกสารที่พิมพ์หรือดาวน์โหลดจากหน้านี้มีข้อมูลทางคลินิก
          กรุณาเก็บรักษาตามระเบียบของโรงพยาบาล
          และอย่าอัปโหลดขึ้นบริการภายนอก
        </p>
      </main>
    </div>
  );
}
