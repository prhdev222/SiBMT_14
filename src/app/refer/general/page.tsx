import Link from "next/link";
import { HOSPITAL_APPOINTMENT } from "@/lib/config";

export const metadata = { title: "นัด OPD อายุรศาสตร์" };

export default function GeneralOpdPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">← กลับหน้าแรก</Link>
      <h1 className="text-2xl font-bold mt-4">Refer ผู้ป่วยนอกด้วยเหตุผลอื่น</h1>
      <section className="rounded-xl bg-white border-2 border-green-600 p-5">
        <h2 className="font-semibold text-zinc-900">กลุ่มนี้ไม่ต้องกรอกแบบฟอร์ม</h2>
        <p className="text-sm text-zinc-600 mt-1">ให้ผู้ป่วยทำนัดผู้ป่วยนอกเองผ่านระบบนัดหมายของโรงพยาบาล ซึ่งเปิดใช้งานอยู่แล้ว — แพทย์ต้นทางเพียงแจ้งผู้ป่วยให้ทำตามขั้นตอนนี้</p>
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-semibold text-green-900">แจ้งผู้ป่วยว่า “ให้เพิ่มเพื่อน LINE {HOSPITAL_APPOINTMENT.lineOaNameTh} แล้วทำนัดเองได้เลย”</p>
          {HOSPITAL_APPOINTMENT.qrImagePath && (
            <div className="mt-3 flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HOSPITAL_APPOINTMENT.qrImagePath} alt={`QR code เพิ่มเพื่อน LINE ${HOSPITAL_APPOINTMENT.lineOaNameTh}`} width={620} height={435} className="w-[260px] h-auto rounded-lg border border-green-300 bg-white" />
              <p className="text-xs text-green-900/80 text-center">ให้ผู้ป่วยสแกนจากหน้าจอนี้ได้เลย<br />หรือถ่ายรูปเก็บไว้สแกนทีหลัง</p>
            </div>
          )}
          {HOSPITAL_APPOINTMENT.lineOaUrl && <a href={HOSPITAL_APPOINTMENT.lineOaUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-lg bg-green-700 px-4 py-2 text-white text-sm font-semibold hover:bg-green-800">เปิด LINE {HOSPITAL_APPOINTMENT.lineOaNameTh}</a>}
        </div>
        <ol className="mt-4 space-y-2 text-sm text-zinc-700">{HOSPITAL_APPOINTMENT.stepsTh.map((step, index) => <li key={step.text} className="flex gap-3"><span className="shrink-0 grid h-6 w-6 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{index + 1}</span><span className="pt-0.5">{step.text}{step.link && <> <a href={step.link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline whitespace-nowrap">{step.link.labelTh} ↗</a></>}</span></li>)}</ol>
        <p className="mt-4 text-sm text-zinc-600">ผู้ป่วยจะได้รับใบนัดหมายภายใน {HOSPITAL_APPOINTMENT.waitingDaysTh} หากไม่ได้รับ ติดต่อสอบถามได้ทางแชท LINE นั้น</p>
        <p className="mt-3 text-xs text-zinc-500">ระบบนัดหมายของโรงพยาบาลจะขอชื่อ-สกุลและเลข HN ของผู้ป่วยโดยตรง ซึ่งเป็นการเก็บข้อมูลของโรงพยาบาล ไม่ผ่านระบบส่งต่อนี้</p>
      </section>
    </main>
  );
}
