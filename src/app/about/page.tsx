import type { Metadata } from "next";
import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { Opd700Contact } from "@/components/Opd700Contact";
import { CREDITS, LINE_OA } from "@/lib/config";

export const metadata: Metadata = {
  title: "เกี่ยวกับระบบ — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
};

/**
 * หน้าเครดิตและขอบเขตของระบบ — ลิงก์จาก footer ทุกหน้า
 *
 * มีไว้ให้แพทย์ต้นทางเห็นว่าใครรับผิดชอบ (ความน่าเชื่อถือ) และให้ที่วางเครดิต
 * เต็ม ๆ โดยไม่ต้องยัดทุกอย่างลง footer บรรทัดเดียว (11 ก.ย. 2569)
 */
export default function AboutPage() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <BackButton fallback="/" label="ย้อนกลับ" />
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-3">
            เกี่ยวกับระบบ
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            ระบบส่งต่อผู้ป่วยนอก OPD โลหิตวิทยา · สาขาวิชาโลหิตวิทยา
            ภาควิชาอายุรศาสตร์ คณะแพทยศาสตร์ศิริราชพยาบาล
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        <section className="rounded-xl bg-white border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900">ทีมงาน</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr] text-sm">
            <dt className="text-zinc-500">{CREDITS.directorsLabelTh}</dt>
            <dd className="text-zinc-900">
              <ul className="space-y-0.5">
                {CREDITS.directors.map((name) => (
                  <li key={name} className="font-medium">
                    {name}
                  </li>
                ))}
              </ul>
              <p className="text-zinc-500 mt-1">
                สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช
              </p>
            </dd>
            <dt className="text-zinc-500">{CREDITS.developerLabelTh}</dt>
            <dd className="text-zinc-900 font-medium">{CREDITS.developer}</dd>
          </dl>
        </section>

        <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-700 space-y-2">
          <h2 className="font-semibold text-zinc-900">ระบบนี้ทำอะไร</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              รับเรื่องส่งต่อผู้ป่วยนอกจากแพทย์ต้นทาง แยกตามลักษณะงาน (นัดปลูกถ่ายฯ ·
              ขอความเห็นสูตรยาเคมี · ขอส่งตัวมาให้ยาเคมี)
            </li>
            <li>
              ให้เลขที่อ้างอิงทุกเรื่อง เข้าคิวถึงแพทย์ผู้รับผิดชอบ และตอบกลับภายในกรอบเวลา
              โดยมีอาจารย์รับรองทุกคำตอบ
            </li>
            <li>แพทย์ต้นทางติดตามสถานะ อ่านคำตอบ และแนบเอกสารเพิ่มได้เองทางเว็บ อีเมล และ LINE</li>
          </ul>
          <h2 className="font-semibold text-zinc-900 pt-2">ระบบนี้ไม่ใช่</h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>ไม่ใช่ช่องทางฉุกเฉิน — ผู้ป่วยวิกฤตให้ใช้ช่องทางส่งต่อฉุกเฉินระหว่างโรงพยาบาล</li>
            <li>ไม่ใช่เวชระเบียน — ไม่เก็บชื่อและเลขประจำตัวผู้ป่วย (PDPA)</li>
          </ul>
        </section>

        <section className="rounded-xl bg-white border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-2">ติดต่อ</h2>
          <Opd700Contact />
          <p className="text-sm text-zinc-600 mt-3">
            LINE Official Account:{" "}
            <a
              href={LINE_OA.addFriendUrl}
              className="text-blue-600 hover:underline"
            >
              {LINE_OA.displayName}
            </a>
            {" · "}
            <Link href="/contact" className="text-blue-600 hover:underline">
              เขียนข้อความถึงแพทย์แอดมินกลาง
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
