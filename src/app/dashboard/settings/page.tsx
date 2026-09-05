import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { mainSheetUrl, scheduleSheetUrl } from "@/lib/google-sheets";
import { SessionBar } from "@/components/SessionBar";
import { PageHeader } from "@/components/PageHeader";
import { StructureCheck } from "./StructureCheck";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ตั้งค่าระบบ — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/**
 * หน้าตั้งค่าสำหรับแอดมิน — ลิงก์เปิด Google Sheet เพื่อแก้รายชื่อ/ตาราง
 *
 * เจตนา: ข้อมูลพวกนี้อยู่ในชีตอยู่แล้วและแก้เดือนละครั้ง จึงไม่ทำ UI แก้ในเว็บ
 * (งานใหญ่ + ต้องเปิดสิทธิ์เขียนไฟล์ผู้ป่วย) — เปิดชีตตรงคือ UI ตารางที่ดีสุด
 * ที่มีอยู่แล้ว ฟรี พร้อม version history
 *
 * กันแอดมินใหม่แก้พัง: (1) ให้ Protect แถวหัวคอลัมน์ในชีต (ทำครั้งเดียว —
 * ดูกล่องเตือนด้านล่าง) (2) ปุ่มตรวจโครงสร้างให้กดเช็กเองหลังแก้
 */
const CARDS = [
  {
    emoji: "👨‍⚕️",
    title: "ตารางออกตรวจ Fellow (วัน OPD)",
    tab: "fellow_schedule",
    which: "schedule" as const,
    desc: "แก้วันออกตรวจและโควตาคิวของ fellow แต่ละวัน",
    warn: "ไฟล์นี้แยกจากข้อมูลผู้ป่วย · แก้เฉพาะค่าในเซลล์ ห้ามแตะแถวหัวคอลัมน์ และคงรูปแบบวันที่ (ปี-เดือน-วัน) ไว้ ไม่งั้นการนับคิวเพี้ยน",
  },
  {
    emoji: "🎓",
    title: "รายชื่ออาจารย์ผู้ให้คำปรึกษา",
    tab: "attendings",
    which: "main" as const,
    desc: "เพิ่ม/แก้ชื่ออาจารย์ที่ resident เลือกตอนตอบคำปรึกษา",
    warn: 'เพิ่มชื่อ = พิมพ์แถวใหม่ · เลิกใช้ = พิมพ์ "no" ในคอลัมน์ active (ไม่ต้องลบแถว)',
  },
  {
    emoji: "🩺",
    title: "รายชื่อ Resident",
    tab: "residents",
    which: "main" as const,
    desc: "รายชื่อ resident ที่ตอบกลุ่ม 2/3 — sync จาก HSOS อัตโนมัติ เพิ่มมือได้",
    warn: 'ปกติมาจาก HSOS · เพิ่มชื่อนอกเหนือได้โดยพิมพ์แถวใหม่ · เลิกใช้พิมพ์ "no" ในคอลัมน์ active',
  },
];

export default async function SettingsPage() {
  const session = await requireSession("/dashboard/settings");
  const mainUrl = mainSheetUrl();
  const schedUrl = scheduleSheetUrl();

  const urlFor = (which: "main" | "schedule") =>
    which === "main" ? mainUrl : schedUrl;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />
      <PageHeader
        eyebrow="สำหรับผู้ดูแลระบบ"
        title="ตั้งค่าระบบ"
        links={[{ href: "/dashboard", label: "กลับ Dashboard", muted: true }]}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        {/* คำเตือนกันแก้พัง — วางบนสุดให้เห็นก่อนกดเข้าชีต */}
        <section className="rounded-xl bg-amber-50 border border-amber-300 p-5 text-sm text-amber-900 space-y-2">
          <h2 className="font-semibold">ก่อนแก้ — อ่านสักครู่</h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              แก้ได้เฉพาะ <strong>ค่าในเซลล์</strong> (ชื่อ, วันที่) —{" "}
              <strong>ห้ามแตะแถวหัวคอลัมน์ (แถวบนสุด)</strong> เด็ดขาด
              เพราะระบบอ่านข้อมูลตามชื่อหัวคอลัมน์
            </li>
            <li>
              ป้องกันถาวร: ในแต่ละแท็บ คลิกขวาแถวหัว → Protect range →
              ให้แก้ได้เฉพาะเจ้าของ (ทำครั้งเดียว แอดมินใหม่จะแตะหัวไม่ได้อีก)
            </li>
            <li>
              แก้พลาด? เปิด File → Version history → กู้คืนเวอร์ชันก่อนหน้าได้
            </li>
            <li>
              แก้เสร็จทุกครั้ง กด{" "}
              <strong>&ldquo;ตรวจโครงสร้างชีต&rdquo;</strong> ด้านล่าง
              เพื่อยืนยันว่าไม่มีอะไรพัง
            </li>
          </ul>
        </section>

        <section className="grid gap-4">
          {CARDS.map((c) => {
            const url = urlFor(c.which);
            return (
              <div
                key={c.tab}
                className="rounded-xl bg-white border border-zinc-200 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-zinc-900">
                      <span className="mr-1.5" aria-hidden>
                        {c.emoji}
                      </span>
                      {c.title}
                    </h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{c.desc}</p>
                  </div>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      เปิดชีต →
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-zinc-400">
                      ยังไม่ตั้งค่า
                    </span>
                  )}
                </div>
                <p className="mt-3 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                  เปิดแล้วคลิกแท็บ{" "}
                  <code className="rounded bg-zinc-200 px-1">{c.tab}</code>{" "}
                  ด้านล่าง · {c.warn}
                </p>
              </div>
            );
          })}

          {/* เวร Chief แก้บนเว็บได้เลย ไม่ต้องเปิดชีต */}
          <div className="rounded-xl bg-white border border-zinc-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-zinc-900">
                  <span className="mr-1.5" aria-hidden>
                    🗓️
                  </span>
                  เวร Chief Resident
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  แก้/แลกเวรได้บนเว็บโดยตรง ไม่ต้องเปิดชีต
                </p>
              </div>
              <Link
                href="/dashboard/duty"
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                ไปหน้าเวร →
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white border border-zinc-200 p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-zinc-900">
              ตรวจความถูกต้องหลังแก้
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              กดเพื่อตรวจว่าหัวคอลัมน์และโครงสร้างชีตยังถูกต้อง — บอกทันทีถ้ามี
              อะไรพัง โดยไม่ต้องรอ dashboard ว่าง
            </p>
          </div>
          <StructureCheck />
        </section>
      </main>
    </div>
  );
}
