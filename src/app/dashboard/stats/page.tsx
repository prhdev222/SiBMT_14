import Link from "next/link";
import type { Metadata } from "next";
import { loadReferrals } from "@/lib/referral-repository";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import { StatsClient } from "./StatsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "สถิติและรายงาน — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/** ช่วงที่ resident วางแผนงานล่วงหน้า — ตรงกับรอบขึ้นวอร์ดสองสัปดาห์ */
const QUEUE_WEEKS = 2;

/**
 * สถิติและรายงาน
 *
 * ⚠️ ส่งเคสทั้งชุดไปให้ฝั่งเบราว์เซอร์คิดเอง ไม่ได้สรุปมาจากเซิร์ฟเวอร์
 *
 * เพราะช่วงวันที่เป็นตัวกรองที่ผู้ใช้ปรับไปมาระหว่างทำรายงาน ถ้าคิดที่เซิร์ฟเวอร์
 * ต้องโหลดหน้าใหม่ทุกครั้งที่ขยับวันที่ ซึ่งแต่ละครั้งคืออ่านทั้งชีตใหม่หมด
 * ข้อมูลที่ส่งไปเป็นชุดเดียวกับที่ไฟล์ CSV มีอยู่แล้ว จึงไม่ได้เปิดอะไรเพิ่ม
 */
export default async function StatsPage() {
  const session = await requireSession("/dashboard/stats");
  const { referrals, isSampleData } = await loadReferrals();

  // คิดวันที่ที่เซิร์ฟเวอร์แล้วส่งไปเป็นค่าคงที่ ไม่ให้ฝั่งเบราว์เซอร์เรียก
  // new Date() เอง — ค่าที่ต่างกันตอน render กับตอน hydrate ทำให้ React เตือน
  // และตัวเลขกระพริบเปลี่ยนต่อหน้าผู้ใช้
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + QUEUE_WEEKS * 7);

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
          referrals={referrals}
          todayIso={toIso(new Date())}
          horizonIso={toIso(horizon)}
        />

        <p className="text-xs text-zinc-500 pt-2">
          ตัวเลขครอบคลุม <span className="font-medium">กลุ่มที่ 1–3</span>{" "}
          ที่ยังอยู่ในระบบ — กลุ่มที่ 4 ให้ผู้ป่วยนัด OPD
          เองผ่านระบบนัดหมายของโรงพยาบาล ไม่ได้ส่งข้อมูลเข้าระบบนี้
        </p>
        <p className="text-xs text-zinc-500">
          เคสที่จบมาแล้วครบ <span className="font-medium">12 เดือน</span>{" "}
          ถูกย้ายเข้าคลังถาวรแบบถอดชื่อ จึงไม่ถูกนับที่นี่ — กลุ่มที่ 2 และ 3
          นับจากวันที่ตอบ กลุ่มที่ 1 นับจากวันนัด คลังเก็บเดือนที่เคสเข้ามา
          กลุ่มโรค ช่วงอายุ และคำถาม–คำตอบไว้ถาวร
          แต่ไม่มีชื่อผู้ส่ง เบอร์ วันนัด และชื่อ fellow
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
