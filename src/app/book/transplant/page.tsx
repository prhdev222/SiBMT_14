import Link from "next/link";
import type { Metadata } from "next";
import { loadFellowSchedule, loadReferrals } from "@/lib/referral-repository";
import { buildSchedule } from "@/lib/fellow-schedule";
import { isBookingConfigured } from "@/lib/apps-script-api";
import { CONTACT } from "@/lib/config";
import { BookingFlow } from "./BookingFlow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "เลือกวันนัดพบแพทย์ปลูกถ่ายฯ — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/** จองล่วงหน้าได้ไกลแค่ไหน — เสนอไว้ 8 สัปดาห์ รอมติอาจารย์ */
const BOOKING_HORIZON_WEEKS = 8;

export default async function BookTransplantPage() {
  const [{ referrals }, source] = await Promise.all([
    loadReferrals(),
    loadFellowSchedule(),
  ]);

  const today = new Date();
  const todayIso = toIso(today);
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + BOOKING_HORIZON_WEEKS * 7);
  const horizonIso = toIso(horizon);

  // แสดงเฉพาะวันที่ยังนัดได้จริง — วันที่ผ่านมาแล้วหรือเต็มแล้วไม่ต้องให้เห็น
  // ผู้ใช้หน้านี้คือแพทย์ต้นทาง ไม่ใช่แอดมิน จึงไม่ควรเห็นวันที่กดไม่ได้
  const openDays = buildSchedule(source.days, referrals)
    .filter((day) => day.date >= todayIso && day.date <= horizonIso)
    .map((day) => ({
      date: day.date,
      fellows: day.fellows
        .filter((f) => !f.isFull)
        .map((f) => ({
          fellowName: f.fellowName,
          remaining: f.remaining,
          startTime: f.startTime,
          endTime: f.endTime,
        })),
    }))
    .filter((day) => day.fellows.length > 0);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <Link href="/refer/transplant" className="text-sm text-blue-600 hover:underline">
            ← กลับหน้ารายละเอียดกลุ่มที่ 1
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-3">
            เลือกวันนัดพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            เลือกวันที่ว่างได้เลย ไม่ต้องรอเจ้าหน้าที่ติดต่อกลับ
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {!isBookingConfigured() ? (
          <Unavailable
            title="ระบบจองคิวยังไม่เปิดใช้งาน"
            body="ยังไม่ได้ตั้งค่า BOOKING_API_URL และ BOOKING_API_TOKEN"
          />
        ) : openDays.length === 0 ? (
          <Unavailable
            title="ขณะนี้ยังไม่มีคิวว่าง"
            body={`ยังไม่มีวันออกตรวจที่ว่างในช่วง ${BOOKING_HORIZON_WEEKS} สัปดาห์ข้างหน้า กรุณาโทรติดต่อเจ้าหน้าที่เพื่อนัดหมาย`}
          />
        ) : (
          <BookingFlow days={openDays} />
        )}
      </main>
    </div>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-6 text-sm">
      <h2 className="font-semibold text-zinc-900 text-base">{title}</h2>
      <p className="text-zinc-600 mt-2">{body}</p>
      <p className="text-zinc-600 mt-3">
        ธุรการ OPD 700 โทร{" "}
        <a href={`tel:${CONTACT.phone}`} className="text-blue-600 hover:underline">
          {CONTACT.phoneDisplay}
        </a>{" "}
        ({CONTACT.hoursTh})
      </p>
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
