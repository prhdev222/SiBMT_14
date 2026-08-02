import Link from "next/link";
import { DashboardClient } from "@/components/DashboardClient";
import { loadReferrals } from "@/lib/referral-repository";

/**
 * ข้อมูลต้องสดเสมอ ไม่ cache — เจ้าหน้าที่ต้องเห็นสถานะปัจจุบัน
 * ตาม NFR-002 ที่กำหนดให้เห็นเคสใหม่ภายใน 10 วินาทีหลังส่งฟอร์ม
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { referrals, isSampleData, error } = await loadReferrals();

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500">สำหรับบุคลากรภายใน</p>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
              Dashboard — Referral Queue
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/schedule"
              className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
            >
              ตารางออกตรวจ Fellow
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-500 hover:text-blue-600 hover:underline whitespace-nowrap"
            >
              กลับหน้าแรก
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">อ่านข้อมูลจาก Google Sheet ไม่สำเร็จ</p>
            <p className="mt-1">
              ข้อมูลที่แสดงด้านล่างเป็นข้อมูลตัวอย่าง ไม่ใช่เคสจริง
              กรุณาแจ้งผู้ดูแลระบบ
            </p>
            <p className="mt-1 font-mono text-xs text-red-700 break-all">
              {error}
            </p>
          </div>
        )}

        {!error && isSampleData && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">กำลังแสดงข้อมูลตัวอย่าง</span> —
            ยังไม่ได้เชื่อมต่อ Google Sheet ตั้งค่า environment variable
            ตามขั้นตอนใน docs/DEPLOYMENT.md เพื่อใช้ข้อมูลจริง
          </div>
        )}

        <DashboardClient referrals={referrals} />
      </main>
    </div>
  );
}
