import Link from "next/link";
import type { Metadata } from "next";
import { loadFellowSchedule, loadReferrals } from "@/lib/referral-repository";
import { buildSchedule } from "@/lib/fellow-schedule";
import { isBookingConfigured } from "@/lib/apps-script-api";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import { CONTACT } from "@/lib/config";
import { AppointmentList, type AppointmentRow } from "./AppointmentList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "นัดกลุ่มที่ 1 — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/** เลื่อนไปได้ไกลแค่ไหน — เท่ากับตอนจองครั้งแรก */
const HORIZON_WEEKS = 8;

export default async function AppointmentsPage() {
  const session = await requireSession("/dashboard/appointments");
  const [{ referrals, isSampleData }, source] = await Promise.all([
    loadReferrals(),
    loadFellowSchedule(),
  ]);

  const todayIso = toIso(new Date());

  /**
   * นัดที่ยังมีผลอยู่ เรียงวันใกล้ที่สุดขึ้นก่อน
   *
   * เอาเฉพาะ Appointment Confirmed — เคสที่ยกเลิกไปแล้วไม่ต้องแสดง
   * เพราะทำอะไรกับมันไม่ได้ และมีแต่ทำให้รายการยาวจนหาของจริงไม่เจอ
   */
  const appointments: AppointmentRow[] = referrals
    .filter(
      (r) =>
        r.referralType === "TRANSPLANT_APPOINTMENT" &&
        r.status === "Appointment Confirmed" &&
        r.appointmentDate,
    )
    .sort((a, b) => (a.appointmentDate ?? "").localeCompare(b.appointmentDate ?? ""))
    .map((r) => ({
      referralId: r.referralId,
      clinicDate: r.appointmentDate ?? "",
      fellowName: r.fellowAssigned ?? "—",
      referrerOrg: r.referrerOrg,
      referrerPhone: r.referrerPhone,
      diagnosis: r.diagnosis,
      isPast: (r.appointmentDate ?? "") < todayIso,
    }));

  const upcoming = appointments.filter((a) => !a.isPast).length;

  // วันว่างสำหรับเลือกตอนเลื่อนนัด — ตัดวันที่ผ่านมาแล้วออก
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + HORIZON_WEEKS * 7);
  const days = buildSchedule(source.days, referrals)
    .filter((d) => d.date >= todayIso && d.date <= toIso(horizon))
    .map((d) => ({
      date: d.date,
      fellows: d.fellows
        .filter((f) => !f.isFull)
        .map((f) => ({ fellowName: f.fellowName, remaining: f.remaining })),
    }))
    .filter((d) => d.fellows.length > 0);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />

      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">กลุ่มที่ 1</p>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
              นัดพบแพทย์ปลูกถ่ายฯ
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
            ยังไม่ได้ต่อ Google Sheet จริง การกดยกเลิกจะไม่มีผล
          </p>
        )}

        {!isBookingConfigured() && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
            <span className="font-semibold">แก้ไขนัดไม่ได้</span> —
            ยังไม่ได้ตั้งค่า <code>BOOKING_API_URL</code> และ{" "}
            <code>BOOKING_API_TOKEN</code>
          </p>
        )}

        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
          <p className="font-semibold">หน้านี้ใช้เมื่อแพทย์ต้นทางโทรมา</p>
          <p className="mt-1 text-blue-900/90">
            ปกติแพทย์เลื่อนหรือยกเลิกเองได้จากลิงก์ในอีเมลยืนยันนัด
            หน้านี้มีไว้สำหรับกรณีที่หาอีเมลไม่เจอและจำเลขที่อ้างอิงไม่ได้
            — กรุณายืนยันตัวตนทางโทรศัพท์ก่อนกด เพราะระบบไม่ได้ตรวจให้
            และจะบันทึกชื่อผู้กดไว้
          </p>
        </div>

        <p className="text-sm text-zinc-600">
          มีนัดที่ยืนยันแล้ว{" "}
          <span className="font-semibold text-zinc-900">{appointments.length}</span>{" "}
          รายการ (ยังไม่ถึงวันนัด {upcoming} รายการ)
        </p>

        <AppointmentList appointments={appointments} days={days} />

        <p className="text-xs text-zinc-500 text-center pt-2">
          ติดต่อ OPD 700 โทร {CONTACT.phoneDisplay} ({CONTACT.hoursTh})
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
