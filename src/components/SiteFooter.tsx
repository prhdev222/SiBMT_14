/**
 * ท้ายหน้าที่ใช้ร่วมกันทุกหน้า
 *
 * อยู่ใน root layout จึงขึ้นทุกหน้าโดยไม่ต้องไปเติมทีละหน้า
 *
 * ⚠️ print:hidden — หน้าที่ออกแบบมาให้พิมพ์ (หนังสือรับทราบ, คลังคำตอบ)
 * ไม่ควรมีบรรทัดเครดิตติดไปบนกระดาษที่เข้าแฟ้มผู้ป่วยหรือใช้ present
 */
import Link from "next/link";
import { CREDITS } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 py-4 px-4 text-center text-[11px] leading-relaxed text-zinc-400 print:hidden">
      {/*
        สองประโยคนี้เป็นคนละใจความ — "ระบบนี้คืออะไร" กับ "ไม่ใช่อะไร"
        ประโยคหลังคือส่วนที่สำคัญกว่า จึงต้องไม่ถูกตัดกลางคำเวลาจอแคบ

        จอกว้างวางเรียงกันโดยมีจุดคั่น ไม่ให้ดูโหรงเหรง
        จอมือถือแยกคนละบรรทัดเสมอ ไม่ปล่อยให้ตัดตรงไหนก็ได้ตามความกว้าง
      */}
      <p className="flex flex-col sm:flex-row sm:justify-center sm:gap-x-2">
        <span>ระบบสนับสนุน workflow การส่งต่อผู้ป่วย</span>
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <span>ไม่ใช่ระบบวินิจฉัยโรคหรือเวชระเบียนหลัก</span>
      </p>
      {/* เครดิต — อาจารย์เป็นผู้ริเริ่มและกำกับ ต้องเห็นชื่อบน footer เลย ไม่ซ่อนหลังลิงก์
          (ความน่าเชื่อถือกับแพทย์ต้นทาง) รายละเอียดเต็มอยู่หน้า /about · ชื่อแก้ที่ CREDITS */}
      <p className="mt-1.5 flex flex-col sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-2">
        <span>
          {CREDITS.directorsLabelTh} {CREDITS.directors.join(", ")}
        </span>
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <span>
          {CREDITS.developerLabelTh} {CREDITS.developer} · © {CREDITS.yearTh}
        </span>
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <Link href="/about" className="text-blue-600 hover:underline">
          เกี่ยวกับระบบ
        </Link>
      </p>
    </footer>
  );
}
