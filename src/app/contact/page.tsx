import Link from "next/link";
import type { Metadata } from "next";
import { isBookingConfigured } from "@/lib/apps-script-api";
import { REFERRAL_TYPE_META } from "@/lib/referral-types";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "ติดต่อแพทย์แอดมินกลาง — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/**
 * ช่องทางแจ้งแพทย์แอดมินกลางเมื่อระบบเองมีปัญหา
 *
 * ⚠️ ไม่ใช่ช่องทางปรึกษาเคส และตั้งใจให้ใช้ยากกว่าการส่งเคสปกติ
 *
 * เดิมหน้าแรกมีปุ่ม "ไม่แน่ใจว่าเข้ากลุ่มไหน" ที่พาไปหาธุรการ OPD 700
 * ซึ่งตอบเรื่องคลินิกไม่ได้ คำถามจึงวนกลับมาหาแพทย์อยู่ดี — เป็นภาระเดิม
 * ที่ระบบนี้ตั้งใจจะลด (มติ 29 ส.ค. 2569 ให้ย้ายคำถามคลินิกไปกลุ่มที่ 2)
 *
 * ที่เหลืออยู่ตรงนี้จึงมีแค่สองเรื่องที่กลุ่มที่ 2 รับไม่ได้จริง ๆ คือ
 * ส่งฟอร์มไม่สำเร็จ (ยังไม่มีเคสให้อ้างถึง) และเคสค้างเกินกรอบเวลา
 * (มีเคสแล้วแต่กระบวนการไม่เดิน) — ทั้งคู่เป็นปัญหาของระบบ ไม่ใช่คำถามทางคลินิก
 */
export default function ContactPage() {
  const group2 = REFERRAL_TYPE_META.REGIMEN_CONSULT;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← กลับหน้าแรก
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-3">
            ติดต่อแพทย์แอดมินกลาง
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            ข้อความจะถูกส่งถึงแพทย์แอดมินกลางโดยตรง ไม่ผ่านธุรการ
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm">
          <h2 className="font-semibold text-zinc-900 mb-2">
            ใช้ช่องทางนี้เมื่อ
          </h2>
          <ul className="space-y-1.5 text-zinc-700">
            <li className="flex gap-2">
              <span className="text-zinc-400">•</span>
              <span>ส่งข้อมูลเข้าระบบไม่ได้ เช่น ฟอร์มขึ้น error หรือกดส่งแล้วไม่มีอะไรเกิดขึ้น</span>
            </li>
            <li className="flex gap-2">
              <span className="text-zinc-400">•</span>
              <span>
                ต้องการสอบถามสถานะเคส{" "}
                <span className="font-medium text-zinc-900">
                  ที่เกินกรอบเวลาตอบกลับแล้ว
                </span>{" "}
                แต่ยังไม่ได้รับคำตอบ
              </span>
            </li>
          </ul>
        </section>

        {/*
          กันไม่ให้ช่องทางนี้กลายเป็นคิวที่สอง — บอกทางที่ถูกไว้ก่อนถึงฟอร์ม
          ถ้าคำถามคลินิกไหลมาที่นี่ มันจะไม่มีเลขที่อ้างอิง ไม่มี SLA
          และไม่มีใครถือเคส ซึ่งคือปัญหาที่เพิ่งแก้ไป
        */}
        <section className="rounded-xl bg-blue-50 border border-blue-200 p-5 text-sm">
          <h2 className="font-semibold text-blue-900 mb-1">
            ถ้าเป็นคำถามทางคลินิก ให้ใช้กลุ่มที่ 2 แทน
          </h2>
          <p className="text-blue-900/90">
            รวมถึงคำถามก่อนตัดสินใจส่งตัว เช่น ควร refer หรือไม่
            หรือมีการศึกษาวิจัย (clinical trial) ที่เหมาะกับผู้ป่วยหรือไม่ —
            ส่งทางนั้นแล้วคำถามจะได้เลขที่อ้างอิง เข้าคิว
            และมีแพทย์ประจำบ้านตอบตามกรอบเวลา ต่างจากหน้านี้ที่เป็นเพียงการแจ้งให้ทราบ
          </p>
          <Link
            href={group2.href}
            className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            {group2.emoji} ไปที่กลุ่มที่ {group2.groupNumber}
          </Link>
        </section>

        <section className="rounded-xl bg-white border border-zinc-200 p-5">
          {isBookingConfigured() ? (
            <ContactForm />
          ) : (
            <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
              <span className="font-semibold">ส่งข้อความไม่ได้</span> —
              ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบหลังบ้าน
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
