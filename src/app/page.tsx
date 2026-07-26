import Link from "next/link";

const DOCUMENT_CHECKLIST: { group: string; documents: string }[] = [
  {
    group: "มะเร็งเม็ดเลือดขาวเฉียบพลัน (Acute Leukemia / SiAML)",
    documents:
      "CBC, ผลตรวจไขกระดูก, flow cytometry, chromosome, molecular mutation, สรุปการรักษา",
  },
  {
    group: "มะเร็งต่อมน้ำเหลือง (Lymphoma)",
    documents:
      "ผล pathology, สถานะ block/slide, ผลภาพถ่ายทางการแพทย์, staging, การรักษาเดิม",
  },
  {
    group: "มัยอิโลมา (Multiple Myeloma)",
    documents:
      "SPEP, serum free light chain, immunofixation, beta-2 microglobulin, ผลไขกระดูก, ผลภาพถ่ายทางการแพทย์",
  },
  {
    group: "ปลูกถ่ายไขกระดูก/สเต็มเซลล์ (Stem Cell Transplantation)",
    documents:
      "การวินิจฉัย, สถานะโรค, ข้อมูลผู้บริจาค/HLA, การรักษาเดิม, ข้อบ่งชี้การปลูกถ่าย",
  },
  {
    group: "โลหิตวิทยาอื่น ๆ",
    documents: "ใบส่งตัว, ผลตรวจทางห้องปฏิบัติการที่จำเป็น, สรุปคำถามทางคลินิก",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <p className="text-sm text-zinc-500">
            ภาควิชาอายุรศาสตร์ สาขาโลหิตวิทยา โรงพยาบาลศิริราช
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1">
            ระบบส่งต่อผู้ป่วยนอก OPD โลหิตวิทยา
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-8">
        {/* หมายเหตุฉุกเฉิน */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3">
          ระบบนี้ไม่ใช่ช่องทางฉุกเฉิน หากผู้ป่วยมีอาการวิกฤต โปรดติดต่อห้องฉุกเฉินของโรงพยาบาลต้นทางหรือโรงพยาบาลใกล้บ้านทันที
        </div>

        {/* ปุ่มหลัก */}
        <section className="grid gap-3 sm:grid-cols-3">
          <a
            href="#refer-form"
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-blue-600 text-white px-4 py-6 text-center font-semibold text-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            ส่ง Refer
            <span className="text-xs font-normal text-blue-100">
              กรอกข้อมูลผู้ป่วยเพื่อส่งต่อ
            </span>
          </a>
          <a
            href="#contact"
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white border border-zinc-300 text-zinc-800 px-4 py-6 text-center font-semibold text-lg shadow-sm hover:bg-zinc-100 transition-colors"
          >
            ตรวจสอบสถานะ
            <span className="text-xs font-normal text-zinc-500">
              สอบถามความคืบหน้า referral
            </span>
          </a>
          <Link
            href="/dashboard"
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white border border-zinc-300 text-zinc-800 px-4 py-6 text-center font-semibold text-lg shadow-sm hover:bg-zinc-100 transition-colors"
          >
            เข้าสู่ Dashboard
            <span className="text-xs font-normal text-zinc-500">
              สำหรับบุคลากรภายใน
            </span>
          </Link>
        </section>

        {/* ปุ่มส่ง refer ยังไม่เปิดใช้งานจริง */}
        <section
          id="refer-form"
          className="rounded-xl bg-white border border-zinc-200 p-5"
        >
          <h2 className="font-semibold text-zinc-900 mb-2">ส่งข้อมูล Referral</h2>
          <p className="text-sm text-zinc-600">
            ช่องทางส่ง refer ผ่าน Google Form อยู่ระหว่างเปิดใช้งาน กรุณาติดต่อเจ้าหน้าที่ตามช่องทางด้านล่างในระหว่างนี้
          </p>
        </section>

        {/* เอกสารที่ต้องเตรียม */}
        <section className="rounded-xl bg-white border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-3">
            เอกสารที่ต้องเตรียมตามกลุ่มโรค
          </h2>
          <div className="space-y-3">
            {DOCUMENT_CHECKLIST.map((item) => (
              <div key={item.group} className="text-sm">
                <p className="font-medium text-zinc-800">{item.group}</p>
                <p className="text-zinc-600">{item.documents}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy notice */}
        <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-600 space-y-2">
          <h2 className="font-semibold text-zinc-900 mb-1">
            คำแจ้งเกี่ยวกับข้อมูลส่วนบุคคล (Privacy Notice)
          </h2>
          <p>
            ข้อมูลผู้ป่วยที่ท่านส่งเข้าระบบเป็นข้อมูลสุขภาพตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล (PDPA)
            จะถูกใช้เพื่อการคัดกรองและประสานการส่งต่อผู้ป่วยเท่านั้น
            เข้าถึงได้เฉพาะบุคลากรที่เกี่ยวข้องกับกระบวนการรับ refer
            และเก็บรักษาตามนโยบายของโรงพยาบาลศิริราช
          </p>
          <p>
            การส่งข้อมูลถือว่าท่านมีหน้าที่หรือได้รับอนุญาตให้ส่งข้อมูลเพื่อการรักษา และได้แจ้งผู้ป่วยหรือผู้แทนตามกระบวนการของหน่วยงานต้นทางแล้วหากจำเป็น
          </p>
        </section>

        {/* ติดต่อ */}
        <section
          id="contact"
          className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-600"
        >
          <h2 className="font-semibold text-zinc-900 mb-2">ติดต่อเจ้าหน้าที่</h2>
          <p>หากส่งข้อมูลไม่ได้ หรือต้องการสอบถามสถานะ referral กรุณาติดต่อ:</p>
          <p className="mt-1 font-medium text-zinc-800">
            ธุรการ OPD โลหิตวิทยา ศิริราช — ในเวลาราชการ
          </p>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400">
        MVP — ระบบสนับสนุน workflow การส่งต่อผู้ป่วย ไม่ใช่ระบบวินิจฉัยโรคหรือเวชระเบียนหลัก
      </footer>
    </div>
  );
}
