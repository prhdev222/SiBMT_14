import Link from "next/link";
import {
  REFERRAL_TYPES_ORDERED,
  REFERRAL_TYPE_META,
} from "@/lib/referral-types";
import { LINE_OA } from "@/lib/config";

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
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3">
          ระบบนี้ไม่ใช่ช่องทางฉุกเฉิน หากผู้ป่วยมีอาการวิกฤต
          โปรดติดต่อห้องฉุกเฉินของโรงพยาบาลต้นทางหรือโรงพยาบาลใกล้บ้านทันที
        </div>

        {/* จุดเข้าใช้งานเดียว — เลือกเรื่องที่ต้องการติดต่อ */}
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold text-zinc-900 text-lg">
              ต้องการติดต่อเรื่องอะไร
            </h2>
            <p className="text-sm text-zinc-600 mt-0.5">
              เลือก 1 หัวข้อ เพื่อดูเอกสารที่ต้องเตรียมและช่องทางส่งข้อมูลของเรื่องนั้น
            </p>
          </div>

          <div className="grid gap-3">
            {REFERRAL_TYPES_ORDERED.map((type) => {
              const meta = REFERRAL_TYPE_META[type];
              return (
                <Link
                  key={type}
                  href={meta.href}
                  className="group rounded-xl bg-white border border-zinc-300 p-4 shadow-sm hover:border-blue-500 hover:bg-blue-50/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none shrink-0 mt-0.5">
                      {meta.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-blue-600">
                        กลุ่มที่ {meta.groupNumber}
                      </p>
                      <p className="font-semibold text-zinc-900 group-hover:text-blue-700">
                        {meta.titleTh}
                      </p>
                      <p className="text-sm text-zinc-600 mt-1">
                        {meta.purposeTh}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/*
              เดิมมีปุ่มที่ 5 "ไม่แน่ใจว่าเข้ากลุ่มไหน หรืออยากสอบถามก่อนส่งตัว"
              ที่พาไปหาเจ้าหน้าที่ ตัดออกแล้วย้ายจุดประสงค์ไปอยู่ในกลุ่มที่ 2 แทน
              (มติ 29 ส.ค. 2569)

              ปุ่มนั้นสร้างช่องทางที่ไม่มีเลขที่อ้างอิง ไม่มี SLA และไม่มีใครถือเคส
              คำถามจิปาถะจึงไปกองที่ธุรการซึ่งตอบเรื่องคลินิกไม่ได้ แล้ววนกลับมาหา
              แพทย์อยู่ดี — ซึ่งเป็นภาระเดิมที่ระบบนี้ตั้งใจจะลด
              พอคำถามเข้ากลุ่มที่ 2 มันจะได้เลขที่อ้างอิง เข้าคิว และมีคนตอบตามกรอบเวลา
            */}
          </div>
        </section>

        {/* LINE OA — ช่องทางคู่ขนานสำหรับแพทย์ที่ใช้มือถือเป็นหลัก */}
        <section className="rounded-xl bg-white border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-2">
            ติดต่อผ่าน LINE (สะดวกบนมือถือ)
          </h2>
          <p className="text-sm text-zinc-600">
            แพทย์ต้นทางสามารถแอด LINE Official Account ของระบบ
            แล้วเลือกหัวข้อจากเมนูด้านล่างของแชทได้เลย
            เมนูจะตรงกับ 4 กลุ่มด้านบนทุกประการ
          </p>
          <a
            href={LINE_OA.addFriendUrl}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            แอด LINE {LINE_OA.displayName}
          </a>
        </section>

        {/* PDPA */}
        <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-600 space-y-2">
          <h2 className="font-semibold text-zinc-900 mb-1">
            คำแจ้งเกี่ยวกับข้อมูลส่วนบุคคล (Privacy Notice)
          </h2>
          <p>
            ข้อมูลผู้ป่วยที่ท่านส่งเข้าระบบเป็นข้อมูลสุขภาพตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล
            (PDPA) จะถูกใช้เพื่อการคัดกรองและประสานการส่งต่อผู้ป่วยเท่านั้น
            เข้าถึงได้เฉพาะบุคลากรที่เกี่ยวข้องกับกระบวนการรับ refer
            และเก็บรักษาตามนโยบายของโรงพยาบาลศิริราช
          </p>
          {/*
            แท็บ line_links เก็บ LINE id + เบอร์ + อีเมลของแพทย์ต้นทาง
            เป็นข้อมูลส่วนบุคคลของบุคลากร ไม่ใช่ของผู้ป่วย แต่ต้องแจ้งและถอนได้
          */}
          <p>
            หากท่านเลือกผูกบัญชี LINE เพื่อรับลิงก์คำตอบ
            ระบบจะเก็บรหัสผู้ใช้ LINE พร้อมเบอร์โทรและอีเมลที่ท่านใช้ยืนยัน
            เพื่อส่งลิงก์คำตอบให้เท่านั้น — ไม่มีการส่งข้อมูลผู้ป่วยทาง LINE
            และยกเลิกได้ตลอดเวลาโดยพิมพ์ &ldquo;เลิกผูก&rdquo; ในแชท
          </p>
          <p className="font-medium text-zinc-800">
            ก่อนส่งข้อมูล กรุณาให้ผู้ป่วยลงนามหนังสือรับทราบ
            และเก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง (ไม่ต้องส่งกลับมาศิริราช)
          </p>
          <Link
            href="/consent"
            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
          >
            ดูและพิมพ์แบบฟอร์มรับทราบสำหรับผู้ป่วย →
          </Link>
        </section>

        {/* ติดต่อ */}
        <section
          id="contact"
          className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-600"
        >
          <h2 className="font-semibold text-zinc-900 mb-2">
            ติดต่อแพทย์แอดมินกลาง
          </h2>
          {/*
            เดิมชี้ไปที่ธุรการ OPD 700 ซึ่งตอบเรื่องคลินิกและเรื่องระบบไม่ได้
            คำถามจึงวนกลับมาหาแพทย์อยู่ดี (มติ 29 ส.ค. 2569)
            สองเรื่องที่เหลืออยู่ตรงนี้เป็นปัญหาของระบบ ไม่ใช่คำถามทางคลินิก
            จึงส่งตรงถึงแพทย์แอดมินกลาง ส่วนคำถามคลินิกย้ายไปกลุ่มที่ 2 หมดแล้ว
          */}
          <p>
            หากส่งข้อมูลเข้าระบบไม่ได้
            หรือต้องการสอบถามสถานะเคสที่เกินกรอบเวลาตอบกลับแล้ว
            ข้อความจะถูกส่งถึงแพทย์แอดมินกลางโดยตรง
          </p>
          <Link
            href="/contact"
            className="mt-3 inline-flex rounded-lg bg-zinc-800 px-4 py-2 text-white font-semibold hover:bg-zinc-900 transition-colors"
          >
            เขียนข้อความถึงแพทย์แอดมินกลาง
          </Link>
        </section>

        {/* ทางเข้าสำหรับบุคลากร */}
        <section className="text-center">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-500 hover:text-blue-600 hover:underline"
          >
            เข้าสู่ Dashboard สำหรับบุคลากรภายใน →
          </Link>
        </section>
      </main>
    </div>
  );
}
