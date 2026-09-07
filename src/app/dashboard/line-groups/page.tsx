import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { loadConfigValues } from "@/lib/referral-repository";
import { SessionBar } from "@/components/SessionBar";
import { PageHeader } from "@/components/PageHeader";
import { GroupCard } from "./GroupCard";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "กลุ่มแจ้งเตือน Telegram / LINE — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/**
 * ศูนย์รวม QR เข้ากลุ่ม LINE ทั้งสามของระบบ
 *
 * ปัญหาที่หน้านี้แก้: ลิงก์เชิญกลุ่มไม่มีที่อยู่ถาวร แอดมินต้องขุดหาในแชท
 * ทุกครั้งที่ resident/fellow รอบใหม่เข้ามา — เก็บลิงก์ไว้ในชีต config
 * (แก้ได้เองไม่ต้องแตะโค้ด ตาม NFR-005) แล้วให้หน้านี้เป็นบ้านถาวร:
 * วันปฐมนิเทศเปิดจอเดียว ทุกคนสแกนกลุ่มของตัวเอง หรือกดปุ่ม 🖨️
 * พิมพ์เป็นกระดาษแปะบอร์ดวอร์ด
 *
 * ⚠️ ลิงก์เชิญ = ใครมีก็เข้ากลุ่มได้ หน้านี้จึงอยู่หลังล็อกอินเสมอ
 * และห้ามเอา QR ไปแปะหน้าเว็บสาธารณะ
 */
/**
 * กลุ่ม Telegram — ช่องทางหลักปัจจุบัน (แจ้งเตือนฟรีไม่จำกัด + เข้า dashboard /login)
 * ลิงก์เริ่มต้นฝังไว้ให้ใช้ได้ทันที · แก้/เปลี่ยนได้จากชีต config (key telegram_invite_)
 */
const TELEGRAM_GROUPS = [
  {
    key: "telegram_invite_resident",
    emoji: "🩺",
    title: "กลุ่ม Resident (เคสกลุ่ม 2/3)",
    audience:
      "resident + แพทย์แอดมิน — เด้งเคสกลุ่ม 2/3 ใหม่ทันที + สรุปเคสค้าง 10:00 น.",
    fallback: "https://t.me/+_prh3HSX4tgxOGE1",
  },
  {
    key: "telegram_invite_fellow",
    emoji: "👨‍⚕️",
    title: "กลุ่ม Fellow BMT",
    audience:
      "fellow + แพทย์แอดมิน — เด้งคิวนัดกลุ่ม 1 ทันที + นัดวันนี้/พรุ่งนี้ 10:00 น.",
    fallback: "https://t.me/+C9XzA7fb55dmZTdl",
  },
  {
    key: "telegram_invite_admin",
    emoji: "🛡️",
    title: "กลุ่มแพทย์แอดมินกลาง",
    audience:
      "แพทย์แอดมิน + ผู้ดูแล — เตือน SLA รอบ 10:00 + ข้อความติดต่อจากเว็บ",
    fallback: "https://t.me/+JA0S7D12WQY3MDU1",
  },
];

const GROUPS = [
  {
    key: "line_invite_resident",
    emoji: "🩺",
    title: "กลุ่ม Resident วอร์ดเคมีบำบัด",
    audience:
      "resident + แพทย์แอดมิน · กลุ่มสำรอง — แจ้งเตือนย้ายไป Telegram แล้ว",
  },
  {
    key: "line_invite_fellow",
    emoji: "👨‍⚕️",
    title: "กลุ่ม Fellow Transplant",
    audience:
      "fellow + แพทย์แอดมิน · กลุ่มสำรอง — แจ้งเตือนย้ายไป Telegram แล้ว",
  },
  {
    key: "line_invite_admin",
    emoji: "🛡️",
    title: "กลุ่มแพทย์แอดมินกลาง",
    audience:
      "แพทย์แอดมิน + ผู้ดูแล · กลุ่มสำรอง — แจ้งเตือนย้ายไป Telegram แล้ว",
  },
];

export default async function LineGroupsPage() {
  const session = await requireSession("/dashboard/line-groups");
  const config = await loadConfigValues();

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <div className="print:hidden">
        <SessionBar username={session.username} />
        <PageHeader
          eyebrow="สำหรับบุคลากรภายใน"
          title="กลุ่มแจ้งเตือน (Telegram / LINE)"
          links={[{ href: "/dashboard", label: "กลับ Dashboard" }]}
        />
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-4">
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-600">
            สแกน QR หรือกดปุ่มเพื่อเข้ากลุ่มของตัวเอง — resident/fellow
            รอบใหม่เข้าเองได้เลย ไม่ต้องรอใครเชิญ
          </p>
          <PrintButton label="🖨️ พิมพ์ติดบอร์ดวอร์ด" />
        </div>

        <section className="space-y-3">
          <h2 className="font-semibold text-zinc-900">
            <span className="mr-1.5" aria-hidden>
              ✈️
            </span>
            กลุ่ม Telegram (ช่องทางหลัก)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TELEGRAM_GROUPS.map((g) => (
              <GroupCard
                key={g.key}
                emoji={g.emoji}
                title={g.title}
                audience={g.audience}
                inviteLink={(config[g.key] ?? "").trim() || g.fallback}
                configKey={g.key}
                scanWith="Telegram"
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="print:hidden">
            <h2 className="font-semibold text-zinc-900">
              <span className="mr-1.5" aria-hidden>
                💬
              </span>
              กลุ่ม LINE (สำรอง)
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              แจ้งเตือนย้ายไป Telegram แล้ว — เปิดแจ้งเตือน LINE กลับได้จากสวิตช์
              &ldquo;แจ้งเตือน LINE&rdquo; ในหน้าตั้งค่า (จะกลับมาเสียโควตา LINE)
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GROUPS.map((g) => (
              <GroupCard
                key={g.key}
                emoji={g.emoji}
                title={g.title}
                audience={g.audience}
                inviteLink={(config[g.key] ?? "").trim()}
                configKey={g.key}
              />
            ))}
          </div>
        </section>

        <p className="print:hidden text-xs text-zinc-400">
          ลิงก์เชิญเก็บอยู่ในชีต config (key ขึ้นต้น line_invite_) — ถ้ากลุ่มไหน
          regenerate ลิงก์ใหม่ ให้วางลิงก์ล่าสุดทับใน value แล้วรีเฟรชหน้านี้
          · หน้านี้อยู่หลังล็อกอิน อย่านำ QR ไปเผยแพร่สาธารณะ
        </p>
      </main>
    </div>
  );
}
