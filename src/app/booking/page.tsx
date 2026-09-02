import { BackButton } from "@/components/BackButton";
import type { Metadata } from "next";
import { loadFellowSchedule, loadReferrals } from "@/lib/referral-repository";
import { buildSchedule } from "@/lib/fellow-schedule";
import {
  isBookingConfigured,
  lookupBooking,
  type BookingDetail,
} from "@/lib/apps-script-api";
import { CONTACT } from "@/lib/config";
import { ManageBookingClient } from "./ManageBookingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "จัดการนัดของท่าน — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  /**
   * URL นี้มีเลขที่อ้างอิงและ token อยู่ใน query string
   * ห้ามให้เครื่องมือค้นหาเก็บเข้าดัชนีเด็ดขาด
   */
  robots: { index: false, follow: false },
};

/** เลื่อนนัดไปได้ไกลแค่ไหน — เท่ากับตอนจองครั้งแรก */
const HORIZON_WEEKS = 8;

export default async function ManageBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string }>;
}) {
  const { id, t } = await searchParams;
  const token = (t ?? "").trim();

  /**
   * มาจากลิงก์ในอีเมล — ค้นให้เลยตั้งแต่ฝั่งเซิร์ฟเวอร์ ไม่ต้องให้กรอกอะไร
   *
   * ถ้า token ผิดหรือหมดอายุ ปล่อยให้ตกไปที่ฟอร์มกรอกเองแทนการขึ้น error
   * เพราะสาเหตุที่พบบ่อยที่สุดคือโปรแกรมอ่านอีเมลตัดลิงก์ ไม่ใช่การโจมตี
   */
  let initialBooking: BookingDetail | null = null;
  if (id && token && isBookingConfigured()) {
    try {
      initialBooking = await lookupBooking({ referralId: id.trim(), token });
    } catch {
      initialBooking = null;
    }
  }

  const openDays = await loadOpenDays();

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <BackButton fallback="/refer/transplant" label="ย้อนกลับ" />
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-3">
            จัดการนัดของท่าน
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            เลื่อนหรือยกเลิกนัดได้เอง ไม่ต้องโทรแจ้ง —
            คิวที่ยกเลิกจะว่างกลับเข้าระบบทันที
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {!isBookingConfigured() ? (
          <div className="rounded-xl bg-white border border-zinc-200 p-6 text-sm">
            <h2 className="font-semibold text-zinc-900 text-base">
              ระบบจัดการนัดยังไม่เปิดใช้งาน
            </h2>
            <p className="text-zinc-600 mt-2">
              กรุณาโทรติดต่อเจ้าหน้าที่ที่{" "}
              <a href={`tel:${CONTACT.phone}`} className="text-blue-600 hover:underline">
                {CONTACT.phoneDisplay}
              </a>{" "}
              ({CONTACT.hoursTh})
            </p>
          </div>
        ) : (
          <ManageBookingClient
            initialBooking={initialBooking}
            token={token}
            days={openDays}
          />
        )}
      </main>
    </div>
  );
}

/**
 * วันที่ยังจองได้ สำหรับใช้ตอนเลือกวันใหม่
 *
 * ตัดวันที่ผ่านมาแล้วและวันนี้ออก เพราะเลื่อนมาเป็นวันนี้ไม่ได้อยู่แล้ว
 * (Apps Script จะปฏิเสธ) แสดงไว้ก็มีแต่ทำให้กดแล้วเจอ error
 */
async function loadOpenDays() {
  const [{ referrals }, source] = await Promise.all([
    loadReferrals(),
    loadFellowSchedule(),
  ]);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const horizon = new Date(today);
  horizon.setDate(today.getDate() + HORIZON_WEEKS * 7);

  const from = toIso(tomorrow);
  const to = toIso(horizon);

  return buildSchedule(source.days, referrals)
    .filter((day) => day.date >= from && day.date <= to)
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
}

function toIso(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  );
}
