import { PageHeader } from "@/components/PageHeader";
import { SessionBar } from "@/components/SessionBar";
import { requireSession } from "@/lib/session";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession("/dashboard");
  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />
      <PageHeader eyebrow="สำหรับบุคลากรภายใน" title="ระบบนัดหมาย" links={[{ href: "/", label: "กลับหน้าแรก", muted: true }]} />
      <main className="max-w-3xl mx-auto w-full px-4 py-6 grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/appointments" className="rounded-xl bg-white border p-5 hover:border-blue-500">
          <p className="font-semibold">รายการนัดหมาย</p><p className="text-sm text-zinc-600 mt-1">ดู เลื่อน หรือยกเลิกนัดหมาย</p>
        </Link>
        <Link href="/dashboard/schedule" className="rounded-xl bg-white border p-5 hover:border-blue-500">
          <p className="font-semibold">ตารางออกตรวจ Fellow</p><p className="text-sm text-zinc-600 mt-1">จัดการตารางและจำนวนคิว</p>
        </Link>
      </main>
    </div>
  );
}
