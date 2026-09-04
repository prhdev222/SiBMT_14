import type { Metadata } from "next";
import Link from "next/link";
import {
  isBookingConfigured,
  lookupBooking,
  type BookingDetail,
} from "@/lib/apps-script-api";
import { PrintButton } from "@/components/PrintButton";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // token อยู่ใน query — ห้ามเก็บเข้าดัชนีเด็ดขาด (โมเดลเดียวกับ /booking)
  robots: { index: false, follow: false },
  title: "ใบนัดหมาย — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
};

/**
 * ใบนัดหมายสำหรับพิมพ์ให้ผู้ป่วยถือมาศิริราช (กลุ่มที่ 1)
 *
 * เข้าถึงด้วย id + manage token ชุดเดียวกับหน้าจัดการนัด — แพทย์ต้นทาง
 * เปิดจากปุ่มบนหน้ายืนยัน/หน้าจัดการนัด หรือจากลิงก์ในอีเมลแล้วกดพิมพ์ซ้ำ
 * ได้เสมอ (เลื่อนนัดแล้วพิมพ์ใหม่ วันนัดบนใบจะเป็นวันล่าสุดเอง)
 *
 * ⚠️ จงใจไม่มีชื่อผู้ป่วยบนใบ — ระบบไม่เก็บชื่อ (PDPA-003) ใบนี้ระบุตัวด้วย
 * เลข HEM- คู่กับใบ refer จากแพทย์ต้นทาง
 */
export default async function SlipPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string }>;
}) {
  const { id, t } = await searchParams;

  let booking: BookingDetail | null = null;
  if (id && t && isBookingConfigured()) {
    try {
      booking = await lookupBooking({ referralId: id.trim(), token: t.trim() });
    } catch {
      booking = null;
    }
  }

  if (!booking) {
    return (
      <div className="flex-1 bg-zinc-50 px-4 py-10">
        <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 space-y-3">
          <h1 className="text-base font-semibold text-zinc-900">
            เปิดใบนัดไม่ได้
          </h1>
          <p>
            ลิงก์ไม่ถูกต้องหรือหมดอายุ — เปิดจากปุ่ม &ldquo;พิมพ์ใบนัด&rdquo;
            ในอีเมลยืนยันนัด หรือจากหน้าจัดการนัดอีกครั้ง
          </p>
          <Link href="/booking" className="inline-block font-medium text-blue-600 hover:underline">
            ไปหน้าจัดการนัด →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-zinc-50 print:bg-white px-4 py-8 print:p-0">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="print:hidden flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-600">
            พิมพ์ใบนี้ให้ผู้ป่วยถือมาในวันนัด พร้อมใบ refer และเอกสารตาม
            checklist
          </p>
          <PrintButton label="🖨️ พิมพ์ใบนัด" />
        </div>

        {/* ตัวใบนัด — ทุกอย่างในกรอบนี้คือสิ่งที่ออกกระดาษ */}
        <div className="rounded-xl border-2 border-zinc-800 bg-white p-6 space-y-4 print:rounded-none print:border-2">
          <header className="text-center border-b-2 border-zinc-800 pb-3">
            <h1 className="text-lg font-bold text-zinc-900">
              ใบนัดหมาย — คลินิกโลหิตวิทยา
            </h1>
            <p className="text-sm text-zinc-600">
              โรงพยาบาลศิริราช · ระบบส่งต่อผู้ป่วยนอก
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-800">
              เลขที่อ้างอิง {booking.referralId}
            </p>
          </header>

          <dl className="space-y-2">
            <div className="flex items-baseline gap-3">
              <dt className="w-24 shrink-0 text-sm text-zinc-500">วันนัด</dt>
              <dd className="text-xl font-bold text-zinc-900">
                {formatThaiDate(booking.clinicDate, true)}
              </dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="w-24 shrink-0 text-sm text-zinc-500">เวลา</dt>
              <dd className="font-semibold text-zinc-900">08:00 น.</dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="w-24 shrink-0 text-sm text-zinc-500">สถานที่</dt>
              <dd className="font-semibold text-zinc-900">
                OPD 700 โรงพยาบาลศิริราช
              </dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="w-24 shrink-0 text-sm text-zinc-500">พบแพทย์</dt>
              <dd className="font-semibold text-zinc-900">
                {booking.fellowName}{" "}
                <span className="font-normal text-zinc-500">
                  (fellow transplant)
                </span>
              </dd>
            </div>
          </dl>

          <div className="rounded-lg border border-blue-300 bg-blue-50 print:bg-white p-4 text-sm text-blue-950">
            {/* ถ้อยคำเกลาโดยผู้ใช้ 4 ก.ย. 2569 — ห้ามแก้โดยไม่ถาม */}
            <p className="font-semibold">หมายเหตุสำคัญ:</p>
            <p className="mt-1">
              หากวันนัดมีการสับเปลี่ยนแพทย์ผู้ออกตรวจ (แพทย์แลกเวรกัน)
              ชื่อแพทย์ที่ออกตรวจจริงอาจไม่ตรงกับชื่อในใบนัดนี้ —
              ผู้ป่วยเข้าตรวจกับแพทย์ที่ออกตรวจในวันนั้นได้
            </p>
          </div>

          <footer className="border-t border-zinc-300 pt-3 text-sm text-zinc-600 space-y-1">
            <p>
              เตรียมมาในวันนัด: บัตรโรงพยาบาลศิริราช · ใบส่งตัว (refer) ·
              เอกสารตาม checklist
            </p>
            <p>ใบนัดนี้ใช้คู่กับใบส่งตัวจากแพทย์ต้นทาง</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
