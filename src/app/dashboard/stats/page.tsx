import Link from "next/link";
import type { Metadata } from "next";
import { loadReferrals } from "@/lib/referral-repository";
import { buildStatistics } from "@/lib/statistics";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import {
  REFERRAL_TYPE_META,
  STATUS_LABEL_TH,
  isTerminal,
  type Referral,
} from "@/lib/referral-types";
import { StatsClient, type ExportRow } from "./StatsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "สถิติและรายงาน — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/**
 * แปลงเคสเป็นแถวสำหรับไฟล์ CSV
 *
 * ⚠️ ไม่มีคอลัมน์ชื่อหรือ HN ผู้ป่วย เพราะระบบไม่เคยเก็บ
 * แต่มีเบอร์และชื่อแพทย์ต้นทาง ซึ่งเป็นข้อมูลส่วนบุคคลของบุคลากร
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

/** ช่วงที่ resident วางแผนงานล่วงหน้า — ตรงกับรอบขึ้นวอร์ดสองสัปดาห์ */
const QUEUE_WEEKS = 2;

export default async function StatsPage() {
  const session = await requireSession("/dashboard/stats");
  const { referrals, isSampleData } = await loadReferrals();

  const stats = buildStatistics(referrals);

  const todayIso = toIso(new Date());
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + QUEUE_WEEKS * 7);
  const horizonIso = toIso(horizon);

  /**
   * คิวที่ resident ต้องตอบ
   *
   * ไม่กรองด้วยวันที่ส่งเข้ามา แต่เอา "ทุกเคสที่ยังไม่จบ" เพราะเคสที่ค้าง
   * มาสามสัปดาห์ยิ่งต้องอยู่ในรายการที่พิมพ์ไปดู ไม่ใช่ตกหล่นเพราะเก่าเกินช่วง
   */
  const dueTwoWeeks = referrals
    .filter(
      (r) =>
        (r.referralType === "REGIMEN_CONSULT" ||
          r.referralType === "CHEMO_ADMISSION") &&
        !isTerminal(r.status),
    )
    .sort((a, b) => b.elapsedBusinessHours - a.elapsedBusinessHours)
    .map(toExportRow);

  /** นัดของ fellow ในสองสัปดาห์ข้างหน้า — ใช้เตรียมตัวก่อนออกตรวจ */
  const fellowAppointments = referrals
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
    .map(toExportRow);

  const answered = referrals
    .filter((r) => r.adviceRecord.trim().length > 0)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map(toExportRow);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />

      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">สำหรับบุคลากรภายใน</p>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
              สถิติและรายงาน
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/answers"
              className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
            >
              คำตอบที่ตอบแล้ว
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

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-4">
        {isSampleData && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">กำลังแสดงข้อมูลตัวอย่าง</span> —
            ยังไม่ได้ต่อ Google Sheet จริง ตัวเลขทั้งหมดเป็นข้อมูลสมมติ
          </p>
        )}

        <StatsClient
          stats={stats}
          all={referrals.map(toExportRow)}
          dueTwoWeeks={dueTwoWeeks}
          fellowAppointments={fellowAppointments}
          answered={answered}
        />

        <p className="text-xs text-zinc-500 pt-2">
          ตัวเลขครอบคลุม <span className="font-medium">กลุ่มที่ 1–3</span>{" "}
          ที่ยังอยู่ในระบบ — กลุ่มที่ 4 ให้ผู้ป่วยนัด OPD
          เองผ่านระบบนัดหมายของโรงพยาบาล ไม่ได้ส่งข้อมูลเข้าระบบนี้
          และเคสที่ปิดเกิน 12 เดือนถูกย้ายเข้าคลังถาวรแบบถอดชื่อแล้ว
          ตามนโยบายเก็บข้อมูล จึงไม่ถูกนับที่นี่
        </p>
      </main>
    </div>
  );
}

function toIso(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  );
}
