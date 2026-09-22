import Link from "next/link";
import { CONTACT, LINE_OA } from "@/lib/config";
import {
  TRANSPLANT_INDICATIONS,
  TRANSPLANT_TYPE_LABEL_TH,
} from "@/lib/transplant-indications";

export const metadata = { title: "นัดพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด" };

export default function TransplantPage() {
  const autologous = TRANSPLANT_INDICATIONS.filter((item) => item.type === "AUTOLOGOUS");
  const allogeneic = TRANSPLANT_INDICATIONS.filter((item) => item.type === "ALLOGENEIC");

  return (
    <main className="max-w-3xl mx-auto w-full min-w-0 px-4 py-6 sm:py-8 space-y-5 sm:space-y-6 overflow-x-hidden">
      <Link href="/" className="text-sm text-blue-600 hover:underline">← กลับหน้าแรก</Link>
      <header>
        <h1 className="text-xl sm:text-2xl font-bold mt-1">ขอนัดหมายพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด</h1>
        <p className="text-zinc-600 mt-2 break-words">นัดพบ fellow transplant ที่ {CONTACT.officeTh} เพื่อประเมินการปลูกถ่ายไขกระดูก/สเต็มเซลล์</p>
      </header>

      <section className="rounded-xl bg-white border-2 border-blue-600 p-5">
        <h2 className="font-semibold text-zinc-900">เลือกวันนัดได้เลย</h2>
        <p className="text-sm text-zinc-600 mt-1">ดูวันที่ fellow ยังมีคิวว่าง แล้วเลือกวันที่สะดวกได้ทันที ไม่ต้องรอเจ้าหน้าที่ติดต่อกลับ — ใช้เวลาไม่เกิน 2 นาที</p>
        <Link href="/book/transplant" className="mt-4 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700">ดูคิวว่างและเลือกวันนัด</Link>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
          <Link href="/booking" className="inline-flex rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium hover:border-blue-400 hover:bg-blue-50">📅 จัดการนัด <span className="text-zinc-500 font-normal">เลื่อน · ยกเลิก · ใบนัด</span></Link>
          <a href="#documents" className="inline-flex rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium hover:border-blue-400 hover:bg-blue-50">📚 เอกสาร / แบบฟอร์ม</a>
        </div>
        <p className="text-sm text-zinc-600 mt-4">สำหรับโรงพยาบาลเครือข่าย SiAML: ติดต่อเรื่องส่งต่อปลูกถ่ายฯ (ทุกโรค) ผ่าน <a href={LINE_OA.siamlUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ลิงก์เครือข่าย SiAML</a></p>
      </section>

      <section className="rounded-xl bg-white border border-zinc-200 p-5" id="criteria">
        <h2 className="font-semibold text-zinc-900">เกณฑ์การส่งต่อเพื่อเตรียมตัวปลูกถ่ายเซลล์ต้นกำเนิด</h2>
        <p className="text-sm text-zinc-600 mt-1">ใช้ประกอบการตัดสินใจก่อนส่งผู้ป่วย — ระบบไม่ได้ใช้ในการปิดกั้นการจองผู้ป่วย หากไม่ตรงตามเกณฑ์ แต่เห็นว่าควรส่งมาปรึกษา สามารถส่งจองได้</p>
        <CriteriaTable title={TRANSPLANT_TYPE_LABEL_TH.AUTOLOGOUS} rows={autologous} />
        <CriteriaTable title={TRANSPLANT_TYPE_LABEL_TH.ALLOGENEIC} rows={allogeneic} />
      </section>

      <section className="rounded-xl bg-white border border-zinc-200 p-5">
        <details className="group" open>
          <summary className="flex min-w-0 cursor-pointer list-none items-start justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden"><span className="min-w-0 break-words">ข้อมูลและเอกสารที่ต้องเตรียม <span className="block sm:inline text-sm font-normal text-zinc-500">11 รายการ · กดเพื่อดูรายละเอียด</span></span><span className="shrink-0 text-zinc-400 transition-transform group-open:rotate-180">▾</span></summary>
          <div className="mt-4 border-t border-zinc-100 pt-4 space-y-5 text-sm">
            <Checklist title="ขั้นตอนสำหรับแพทย์ผู้ส่งตัว" items={[
              "จองคิวและเลือกวันนัดจากปฏิทินในหน้านี้ — เลือกได้ทันที ไม่ต้องรอเจ้าหน้าที่ติดต่อกลับ",
              "เขียนข้อความที่ระบบให้มาบนหัวกระดาษใบ refer หลังจองคิว เพื่อให้พยาบาลคัดกรองส่งผู้ป่วยถึง fellow ได้ทันที",
              "แจ้งผู้ป่วยให้ทำบัตรโรงพยาบาลออนไลน์ให้เรียบร้อยก่อนวันนัด",
              "ให้ผู้ป่วยลงนามหนังสือรับทราบการส่งข้อมูลผ่านระบบอิเล็กทรอนิกส์ และเก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง",
            ]} />
            <Checklist title="สิ่งที่ผู้ป่วยต้องเตรียมมา" items={[
              "เอกสารสิทธิการรักษาของผู้ป่วย",
              "ข้อมูลการรักษาทั้งหมด: วันที่เริ่มต้น/สิ้นสุด สูตรยา และการประเมินโรคหลังรักษาจนถึงปัจจุบัน",
              "ผลตรวจ BM study แรกวินิจฉัยและล่าสุด / ผล Chromosome / ผล Molecular mutation",
              "ผล Imaging แรกวินิจฉัยและล่าสุด พร้อมแผ่น CD และ Official report",
              "Block slide + ผล Official report เดิม มา Review Patho ที่ศิริราช (กรณี Lymphoma)",
              "ผล SPEP, SFLC, immunofixation, Beta2-microglobulin (กรณี Multiple Myeloma)",
              "พาพี่น้องมาพร้อมผู้ป่วยเพื่อทำนัดตรวจ HLA และรับทราบค่าใช้จ่าย (กรณี Allogeneic)",
            ]} />
          </div>
        </details>
      </section>

      <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-600">
        <h2 className="font-semibold text-zinc-900 mb-2">สอบถามขั้นตอนวันที่ผู้ป่วยมาถึง</h2>
        <p>เช่น ไปที่จุดใดก่อน ต้องเตรียมเอกสารอะไรยื่นหน้างาน</p>
        <p className="font-medium text-zinc-800 mt-2">{CONTACT.officeTh}</p>
        <p>โทร. <a href={`tel:${CONTACT.phone}`} className="text-blue-600 hover:underline">{CONTACT.phoneDisplay}</a> ({CONTACT.hoursTh})</p>
        <p className="mt-3">ส่วนการ<strong className="text-zinc-800">เลื่อนหรือยกเลิกนัด</strong> ทำเองได้ ไม่ต้องโทรแจ้ง — คิวที่ยกเลิกจะว่างกลับเข้าปฏิทินทันที</p>
        <Link href="/booking" className="mt-3 inline-flex rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 font-medium text-blue-800 hover:bg-blue-100">📅 เปิดหน้าจัดการนัด</Link>
      </section>

      <section id="documents" className="rounded-xl bg-white border border-zinc-200 p-5">
        <h2 className="font-semibold text-zinc-900">📚 เอกสารสำคัญและอัปเดต (1 ไฟล์)</h2>
        <p className="text-sm text-zinc-600 mt-1">เกณฑ์ตอบสนอง/อายุ รายโรค</p>
        <div className="mt-3 flex flex-wrap gap-2"><a href="#criteria" className="inline-flex rounded-lg border border-blue-300 bg-blue-50 px-3.5 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100">📄 เปิด / พิมพ์</a><a href="#criteria" className="inline-flex rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">⬇ ดาวน์โหลด PDF</a></div>
      </section>
    </main>
  );
}

function CriteriaTable({ title, rows }: { title: string; rows: typeof TRANSPLANT_INDICATIONS }) {
  return <div className="mt-5"><h3 className="text-sm font-semibold text-blue-700">{title}</h3><div className="mt-2 overflow-hidden"><table className="w-full table-fixed text-xs sm:text-sm border-collapse"><thead><tr className="text-left text-zinc-500"><th className="w-[30%] border-b border-zinc-200 py-1.5 pr-2 font-medium">โรค</th><th className="w-[50%] border-b border-zinc-200 py-1.5 pr-2 font-medium">สถานะโรค</th><th className="w-[20%] border-b border-zinc-200 py-1.5 font-medium">อายุ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="align-top"><td className="border-b border-zinc-100 py-2 pr-2 font-medium text-zinc-900 break-words">{row.diseaseTh}</td><td className="border-b border-zinc-100 py-2 pr-2 text-zinc-600 break-words">{row.statusTh || "—"}</td><td className="border-b border-zinc-100 py-2 text-zinc-600 break-words">{row.ageTh || "—"}</td></tr>)}</tbody></table></div></div>;
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return <div><h3 className="font-semibold text-zinc-900">{title}</h3><ol className="mt-2 space-y-2 list-decimal list-inside text-zinc-700">{items.map((item) => <li key={item}>{item}</li>)}</ol></div>;
}
