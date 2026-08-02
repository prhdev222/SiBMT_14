import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // ล็อกอินอยู่แล้วไม่ต้องให้กรอกซ้ำ
  if (await getSession()) redirect("/dashboard");

  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <p className="text-sm text-zinc-500">สาขาวิชาโลหิตวิทยา ศิริราช</p>
          <h1 className="text-xl font-bold text-zinc-900">
            หลังบ้านระบบส่งต่อผู้ป่วย
          </h1>
        </div>

        <div className="rounded-xl bg-white border border-zinc-200 p-6">
          {isAuthConfigured() ? (
            <LoginForm next={target} />
          ) : (
            <div className="text-sm text-zinc-700 space-y-2">
              <p className="font-semibold text-red-700">ยังไม่ได้ตั้งรหัสผ่าน</p>
              <p>
                ตอนนี้ dashboard เปิดให้ทุกคนที่รู้ลิงก์เข้าได้
                ตั้งค่า <code className="rounded bg-zinc-100 px-1">DASHBOARD_USERS</code>{" "}
                และ <code className="rounded bg-zinc-100 px-1">AUTH_SECRET</code>{" "}
                ก่อนเปิดใช้จริง — วิธีตั้งอยู่ใน docs/DEPLOYMENT.md
              </p>
              <Link
                href="/dashboard"
                className="inline-block font-medium text-blue-600 hover:underline"
              >
                เข้า dashboard →
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-500">
          ลืมรหัสผ่านให้ติดต่อแพทย์แอดมินกลาง — ระบบไม่มีการรีเซ็ตด้วยตัวเอง
        </p>
      </div>
    </div>
  );
}
