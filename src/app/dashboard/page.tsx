import Link from "next/link";
import { DashboardClient } from "@/components/DashboardClient";

export default function DashboardPage() {
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
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            กลับหน้าแรก
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <DashboardClient />
      </main>
    </div>
  );
}
