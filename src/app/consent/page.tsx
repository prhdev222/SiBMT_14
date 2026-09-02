import { BackButton } from "@/components/BackButton";
import type { Metadata } from "next";
import { CONTACT } from "@/lib/config";
import { PrintButton } from "@/components/PrintButton";

export const metadata: Metadata = {
  title: "หนังสือรับทราบการส่งข้อมูลเพื่อส่งต่อผู้ป่วย — ศิริราช",
};

export default function ConsentPage() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 print:bg-white">
      {/* แถบเครื่องมือ — ไม่แสดงตอนพิมพ์ */}
      <div className="bg-white border-b border-zinc-200 print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <BackButton fallback="/" label="ย้อนกลับ" />
          <PrintButton />
        </div>
      </div>

      <div className="print:hidden max-w-3xl mx-auto w-full px-4 pt-6">
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3">
          <p className="font-medium">วิธีใช้แบบฟอร์มนี้</p>
          <p className="mt-1">
            พิมพ์เอกสารนี้ให้ผู้ป่วยหรือผู้แทนโดยชอบธรรมลงนามรับทราบก่อนส่งข้อมูลเข้าระบบ
            แล้ว <strong>เก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง</strong>{" "}
            ไม่ต้องส่งกลับมาที่ศิริราช (เพื่อลดการเก็บข้อมูลซ้ำซ้อนตามหลัก Data
            Minimization)
          </p>
          <p className="mt-2 text-amber-800">
            ร่างนี้ยังไม่ผ่านการตรวจจาก DPO/ฝ่ายกฎหมาย — ต้องได้รับการยืนยันถ้อยคำ
            และฐานทางกฎหมายก่อนนำไปใช้จริง
          </p>
        </div>
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        <article className="rounded-xl bg-white border border-zinc-200 p-6 sm:p-10 print:border-0 print:p-0 text-zinc-800 leading-relaxed space-y-5">
          <header className="text-center space-y-1 border-b border-zinc-200 pb-4">
            <p className="text-sm text-zinc-500">
              ภาควิชาอายุรศาสตร์ สาขาโลหิตวิทยา คณะแพทยศาสตร์ศิริราชพยาบาล
            </p>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
              หนังสือรับทราบการส่งข้อมูลเพื่อส่งต่อผู้ป่วยผ่านระบบอิเล็กทรอนิกส์
            </h1>
          </header>

          <FillLine label="ข้าพเจ้า (ผู้ป่วย / ผู้แทนโดยชอบธรรม) ชื่อ" />
          <FillLine label="ความเกี่ยวข้องกับผู้ป่วย (กรณีผู้แทน)" />
          <FillLine label="โรงพยาบาลต้นทาง" />

          <p>
            ได้รับทราบจากแพทย์ผู้ดูแลว่า ข้อมูลประวัติการรักษาบางส่วน (เช่น
            การวินิจฉัยโรค ผลตรวจทางห้องปฏิบัติการ ผลภาพถ่ายทางการแพทย์
            และสรุปการรักษา) จะถูกบันทึกและส่งผ่านระบบแบบฟอร์มออนไลน์
            ไปยังคณะแพทยศาสตร์ศิริราชพยาบาล
            เพื่อวัตถุประสงค์ในการประเมินและนัดหมายส่งต่อการรักษาเท่านั้น
          </p>

          <p>
            ข้าพเจ้ารับทราบว่าระบบดังกล่าวใช้บริการของผู้ให้บริการภายนอก
            ซึ่งมีความเสี่ยงด้านความปลอดภัยของข้อมูลตามเงื่อนไขการให้บริการของผู้ให้บริการนั้น
            แม้หน่วยงานจะมีมาตรการจำกัดสิทธิ์การเข้าถึงข้อมูลไว้แล้วก็ตาม
          </p>

          <p>
            ข้าพเจ้ายินยอมให้ส่งข้อมูลดังกล่าวเพื่อวัตถุประสงค์การรักษาต่อเนื่อง
            และทราบว่าข้าพเจ้ามีสิทธิสอบถามรายละเอียด ขอเข้าถึง แก้ไข
            หรือถอนความยินยอมได้ในภายหลัง
            โดยติดต่อผ่านโรงพยาบาลต้นทางที่ให้ข้อมูลนี้
          </p>

          <div className="grid gap-6 sm:grid-cols-2 pt-6">
            <SignatureBlock role="ลงชื่อผู้ป่วย / ผู้แทนโดยชอบธรรม" />
            <SignatureBlock role="ลงชื่อแพทย์ผู้แจ้งและผู้ส่งต่อ" />
          </div>

          <footer className="pt-6 mt-2 border-t border-zinc-200 text-xs text-zinc-500 space-y-1">
            <p>
              เอกสารฉบับนี้ให้เก็บรักษาไว้ที่โรงพยาบาลต้นทางตามระยะเวลาที่นโยบายเวชระเบียนกำหนด
              ไม่ต้องจัดส่งมายังโรงพยาบาลศิริราช
            </p>
            <p>
              สอบถามเพิ่มเติมเกี่ยวกับระบบส่งต่อ: {CONTACT.officeTh} โทร.{" "}
              {CONTACT.phoneDisplay} ({CONTACT.hoursTh})
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}

function FillLine({ label }: { label: string }) {
  return (
    <p className="flex flex-wrap items-end gap-x-2">
      <span className="shrink-0">{label}</span>
      <span className="flex-1 min-w-[10rem] border-b border-dotted border-zinc-400" />
    </p>
  );
}

function SignatureBlock({ role }: { role: string }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="border-b border-dotted border-zinc-400 h-10" />
      <p className="text-center text-zinc-600">{role}</p>
      <p className="flex items-end gap-2 text-zinc-600">
        <span className="shrink-0">วันที่</span>
        <span className="flex-1 border-b border-dotted border-zinc-400" />
      </p>
    </div>
  );
}
