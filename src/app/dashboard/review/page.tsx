import Link from "next/link";
import type { Metadata } from "next";
import { loadReferrals } from "@/lib/referral-repository";
import { isBookingConfigured } from "@/lib/apps-script-api";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import { CONTACT } from "@/lib/config";
import {
  REFERRAL_TYPE_META,
  isTerminal,
  type Referral,
} from "@/lib/referral-types";
import { ReviewList } from "./ReviewList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ตอบคำปรึกษา — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/** เฉพาะกลุ่มที่ต้องให้แพทย์ตอบ — กลุ่ม 1 จองเองแล้ว กลุ่ม 4 ไม่เข้าระบบนี้ */
function needsAnswer(referral: Referral): boolean {
  const isConsultGroup =
    referral.referralType === "REGIMEN_CONSULT" ||
    referral.referralType === "CHEMO_ADMISSION";
  return isConsultGroup && !isTerminal(referral.status);
}

export default async function ReviewPage() {
  const session = await requireSession("/dashboard/review");
  const { referrals, isSampleData } = await loadReferrals();

  // ค้างนานสุดขึ้นก่อน — เคสที่รอมานานที่สุดคือเคสที่ควรได้รับความสนใจก่อน
  const open = referrals
    .filter(needsAnswer)
    .sort((a, b) => b.elapsedBusinessHours - a.elapsedBusinessHours);

  const answered = referrals.filter(
    (r) =>
      (r.referralType === "REGIMEN_CONSULT" ||
        r.referralType === "CHEMO_ADMISSION") &&
      isTerminal(r.status),
  ).length;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />

      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">กลุ่มที่ 2 และ 3</p>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
              ตอบคำปรึกษา
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
          >
            กลับ Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        {isSampleData && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">กำลังแสดงข้อมูลตัวอย่าง</span> —
            ยังไม่ได้ต่อ Google Sheet จริง คำตอบที่บันทึกจะไม่ถูกเก็บ
          </p>
        )}

        {!isBookingConfigured() && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
            <span className="font-semibold">บันทึกคำตอบไม่ได้</span> —
            ยังไม่ได้ตั้งค่า <code>BOOKING_API_URL</code> และ{" "}
            <code>BOOKING_API_TOKEN</code>
          </p>
        )}

        {open.length === 0 ? (
          <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
            <p className="text-lg font-semibold text-zinc-900">
              ไม่มีเคสรอตอบ 🎉
            </p>
            <p className="text-sm text-zinc-600 mt-1">
              ตอบไปแล้วทั้งหมด {answered} เคส
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-600">
              มี <span className="font-semibold text-zinc-900">{open.length}</span>{" "}
              เคสรอตอบ — เรียงจากที่รอนานที่สุด
            </p>
            <ReviewList
              cases={open.map((r) => ({
                referralId: r.referralId,
                groupNumber: REFERRAL_TYPE_META[r.referralType].groupNumber,
                groupTitle: REFERRAL_TYPE_META[r.referralType].titleTh,
                status: r.status,
                urgency: r.urgency,
                elapsedBusinessHours: r.elapsedBusinessHours,
                submittedAt: r.submittedAt,
                referrerOrg: r.referrerOrg,
                referrerPhone: r.referrerPhone,
                diseaseGroup: r.diseaseGroup,
                diagnosis: r.diagnosis,
                stage: r.stage,
                treatmentSummary: r.treatmentSummary,
                comorbidity: r.comorbidity,
                clinicalQuestion: r.clinicalQuestion,
                adviceRecord: r.adviceRecord,
                note: r.note,
              }))}
            />
          </>
        )}

        <p className="text-xs text-zinc-500 text-center pt-2">
          ติดต่อธุรการ OPD 700 โทร {CONTACT.phoneDisplay} ({CONTACT.hoursTh})
        </p>
      </main>
    </div>
  );
}
