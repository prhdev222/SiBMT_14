import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-xl bg-white border border-zinc-200 p-6 space-y-5">
        <h1 className="text-xl font-bold text-zinc-900">เข้าสู่ระบบบุคลากร</h1>
        {isAuthConfigured() ? <LoginForm next={target} /> : <p className="text-sm text-red-700">กรุณาตั้งค่า AUTH_SECRET และ DASHBOARD_USERS</p>}
      </div>
    </main>
  );
}
