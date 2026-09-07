import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth";
import { isLineLoginConfigured } from "@/lib/line-login";
import { getSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * เหตุผลที่เข้าด้วย LINE ไม่สำเร็จ
 *
 * ⚠️ ข้อความต้องบอกว่า "ทำอะไรต่อ" ไม่ใช่แค่ "ผิดอะไร"
 *
 * คนที่เจอหน้านี้กำลังเข้าระบบไม่ได้และไม่มีทางรู้เองว่าเป็นเพราะยังไม่ได้ตั้งค่า
 * หรือเพราะไม่ได้อยู่ในกลุ่ม ถ้าบอกแค่ "ไม่สำเร็จ" ก็จะกดซ้ำอยู่อย่างนั้น
 */
const LINE_ERRORS: Record<string, string> = {
  line_not_configured:
    "ยังไม่ได้เปิดใช้การเข้าระบบด้วย LINE — กรุณาใช้ชื่อผู้ใช้และรหัสผ่านไปก่อน",
  line_cancelled: "ยกเลิกการเข้าสู่ระบบด้วย LINE แล้ว",
  line_state:
    "ลิงก์หมดอายุหรือถูกเปิดข้ามขั้นตอน กรุณากดปุ่มเข้าสู่ระบบด้วย LINE ใหม่",
  line_exchange: "ติดต่อ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  line_check_failed:
    "ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองใหม่ — หากยังไม่ได้ให้แจ้งแพทย์แอดมินกลาง",
  line_not_member:
    "บัญชี LINE นี้ไม่ได้อยู่ในกลุ่มงานที่มีสิทธิ์เข้าระบบ — หากเพิ่งเข้ากลุ่ม กรุณาลองใหม่อีกครั้ง หรือแจ้งแพทย์แอดมินกลางให้เพิ่มเข้ากลุ่ม",
  tg_expired:
    "ลิงก์เข้าระบบหมดอายุหรือถูกใช้ไปแล้ว — พิมพ์ /login ในกลุ่ม Telegram อีกครั้งเพื่อรับลิงก์ใหม่",
  tg_missing:
    "ลิงก์ไม่ถูกต้อง — พิมพ์ /login ในกลุ่ม Telegram เพื่อรับลิงก์เข้าระบบ",
  tg_failed: "เข้าระบบด้วย Telegram ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // ล็อกอินอยู่แล้วไม่ต้องให้กรอกซ้ำ
  if (await getSession()) redirect("/dashboard");

  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const errorMessage = error ? LINE_ERRORS[error] : undefined;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <p className="text-sm text-zinc-500">สาขาวิชาโลหิตวิทยา ศิริราช</p>
          <h1 className="text-xl font-bold text-zinc-900">
            หลังบ้านระบบส่งต่อผู้ป่วย
          </h1>
        </div>

        {errorMessage && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </p>
        )}

        <div className="rounded-xl bg-white border border-zinc-200 p-6 space-y-5">
          {/*
            ปุ่ม LINE อยู่เหนือช่องกรอก เพราะเป็นทางที่เจ้าหน้าที่ส่วนใหญ่จะใช้จริง
            — ช่องชื่อผู้ใช้เหลือไว้สำหรับคนที่ไม่ได้อยู่ในกลุ่ม LINE
            และเป็นทางสำรองเมื่อ LINE ล่ม
          */}
          {isLineLoginConfigured() && (
            <div className="space-y-2">
              <a
                href={`/login/line?next=${encodeURIComponent(target)}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-3 font-bold text-white hover:bg-[#05b34c] transition-colors"
              >
                เข้าสู่ระบบด้วย LINE
              </a>
              <p className="text-xs text-zinc-500 text-center">
                สำหรับผู้ที่อยู่ในกลุ่ม LINE ของหน่วยงาน
              </p>
            </div>
          )}

          {isLineLoginConfigured() && isAuthConfigured() && (
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-zinc-200" />
              <span className="text-xs text-zinc-400">หรือ</span>
              <span className="h-px flex-1 bg-zinc-200" />
            </div>
          )}

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
          เจ้าหน้าที่ในกลุ่ม Telegram: พิมพ์{" "}
          <code className="rounded bg-zinc-100 px-1">/login</code>{" "}
          ในกลุ่มเพื่อรับลิงก์เข้าระบบ
        </p>

        <p className="text-center text-xs text-zinc-500">
          ลืมรหัสผ่านให้ติดต่อแพทย์แอดมินกลาง — ระบบไม่มีการรีเซ็ตด้วยตัวเอง
        </p>
      </div>
    </div>
  );
}
