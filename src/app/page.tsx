import Link from "next/link";
import { LINE_OA } from "@/lib/config";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <p className="text-sm text-zinc-500">ภาควิชาอายุรศาสตร์ สาขาโลหิตวิทยา โรงพยาบาลศิริราช</p>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1">ระบบส่งต่อผู้ป่วยนอก OPD โลหิตวิทยา</h1>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-8">
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3">ระบบนี้ไม่ใช่ช่องทางฉุกเฉิน หากผู้ป่วยมีอาการวิกฤต โปรดติดต่อห้องฉุกเฉินของโรงพยาบาลต้นทางหรือโรงพยาบาลใกล้บ้านทันที</div>
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold text-zinc-900 text-lg">ต้องการติดต่อเรื่องอะไร</h2>
            <p className="text-sm text-zinc-600 mt-0.5">เลือกหัวข้อเพื่อดูรายละเอียด เอกสารที่ต้องเตรียม และช่องทางนัดหมาย</p>
          </div>
          <div className="grid gap-3">
            <Link href="/refer/transplant" className="group rounded-xl bg-white border border-zinc-300 p-4 shadow-sm hover:border-blue-500 hover:bg-blue-50/40 transition-colors">
              <div className="flex items-start gap-3"><span className="text-2xl leading-none">🧬</span><div><p className="font-semibold text-zinc-900 group-hover:text-blue-700">ขอนัดหมายพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด</p><p className="text-sm text-zinc-600 mt-1">เลือกวันและแพทย์ที่ยังมีคิวว่าง</p></div></div>
            </Link>
            <Link href="/refer/general" className="group rounded-xl bg-white border border-zinc-300 p-4 shadow-sm hover:border-blue-500 hover:bg-blue-50/40 transition-colors">
              <div className="flex items-start gap-3"><span className="text-2xl leading-none">🌐</span><div><p className="font-semibold text-zinc-900 group-hover:text-blue-700">Refer ผู้ป่วยนอกด้วยเหตุผลอื่น</p><p className="text-sm text-zinc-600 mt-1">ให้ผู้ป่วยทำนัดกับระบบนัดหมายโรงพยาบาลโดยตรง</p></div></div>
            </Link>
          </div>
        </section>
        <section className="rounded-xl bg-white border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-2">ติดต่อผ่าน LINE (สะดวกบนมือถือ)</h2>
          <p className="text-sm text-zinc-600">แอด LINE Official Account ของระบบเพื่อเปิดเมนูนัดหมายและดูเกณฑ์ transplant candidate</p>
          <a href={LINE_OA.addFriendUrl} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-white text-sm font-semibold hover:bg-green-700">แอด LINE {LINE_OA.displayName}</a>
        </section>
        <section className="text-center"><Link href="/dashboard" className="text-sm font-medium text-zinc-500 hover:text-blue-600 hover:underline">เข้าสู่ Dashboard สำหรับบุคลากรภายใน →</Link></section>
      </main>
    </div>
  );
}
