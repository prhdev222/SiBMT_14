import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  businessDaysText,
  REFERRAL_TYPE_BY_SLUG,
  REFERRAL_TYPE_META,
} from "@/lib/referral-types";
import { CHECKLIST_BY_TYPE, type ChecklistItem } from "@/lib/document-checklist";
import {
  TRANSPLANT_TYPE_LABEL_TH,
  type TransplantIndication,
} from "@/lib/transplant-indications";
import { loadTransplantIndications } from "@/lib/referral-repository";
import {
  BATCH_NOTIFICATION,
  CONTACT,
  FORM_URL,
  HOSPITAL_APPOINTMENT,
  LINE_OA,
} from "@/lib/config";

/**
 * เรนเดอร์ตอนมีคนเปิด ไม่ prerender ตอน build
 *
 * เพราะตารางเกณฑ์ปลูกถ่ายอ่านจากชีต เพื่อให้อาจารย์แก้ได้เองโดยไม่ต้อง deploy
 * ถ้า prerender ไว้ เกณฑ์ที่แก้ในชีตจะไม่ขึ้นจนกว่าจะ deploy ใหม่
 * ซึ่งทำให้การย้ายไปไว้ในชีตไม่มีประโยชน์อะไรเลย
 *
 * มีแค่กลุ่มที่ 1 ที่อ่านชีต อีกสามกลุ่มจึงเรนเดอร์เร็วเท่าเดิม
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type: slug } = await params;
  const type = REFERRAL_TYPE_BY_SLUG[slug];
  if (!type) return { title: "ไม่พบหน้าที่ต้องการ" };
  return { title: `${REFERRAL_TYPE_META[type].titleTh} — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช` };
}

export default async function ReferTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type: slug } = await params;
  const type = REFERRAL_TYPE_BY_SLUG[slug];
  if (!type) notFound();

  const meta = REFERRAL_TYPE_META[type];
  const checklist = CHECKLIST_BY_TYPE[type];
  const formUrl = FORM_URL[type];

  /**
   * แสดงหนังสือรับทราบ PDPA ตรงนี้หรือไม่ — ขึ้นกับว่าผู้ใช้กำลังจะออกจากเว็บไปไหน
   *
   * กลุ่ม 2 และ 3 กดปุ่มแล้วออกไปที่ Google Form ซึ่งเราคุมหน้าตาไม่ได้
   * หน้านี้จึงเป็นที่สุดท้ายที่ยื่นแบบฟอร์มให้พิมพ์ได้ ต้องมี
   *
   * กลุ่ม 1 ไม่ได้ออกไปไหน — ไปต่อที่หน้าจองคิวซึ่งมีช่องติ๊กยินยอมพร้อมลิงก์
   * เดียวกันอยู่แล้ว และบังคับใน Server Action ก่อนเขียนชีต (actions.ts)
   * การขึ้นซ้ำตรงนี้จึงเป็นการขอสิ่งเดียวกันสองครั้ง และขอ "ก่อน" ที่แพทย์
   * จะตัดสินใจด้วยซ้ำว่าจะจองหรือไม่
   *
   * ⚠️ กลุ่ม 1 ยังต้องมีความยินยอมอยู่ ส่งอายุ เพศ กลุ่มโรค และการวินิจฉัยจริง
   * และบันทึก consent_acknowledged_at ลงชีต — ที่ย้ายออกคือ "ตำแหน่งที่แสดง"
   * ไม่ใช่ตัวมาตรการ ถ้าวันหลังหน้าจองคิวเลิกมีช่องติ๊ก ต้องเอาการ์ดนี้กลับมา
   *
   * กลุ่ม 4 ไม่ส่งข้อมูลเข้าระบบนี้เลย จึงไม่เกี่ยวข้องตั้งแต่ต้น
   */
  const indications =
    type === "TRANSPLANT_APPOINTMENT" ? await loadTransplantIndications() : [];

  const showConsentCard =
    type === "REGIMEN_CONSULT" || type === "CHEMO_ADMISSION";

  // มีแค่กลุ่ม 2 และ 3 ที่ต้องรอทีมอ่านแล้วตอบกลับ
  // กลุ่ม 1 จองคิวเองได้ทันที กลุ่ม 4 ไปใช้ระบบนัดหมายของโรงพยาบาล
  // การแสดงกรอบเวลาตอบกลับกับสองกลุ่มนั้นจะสัญญาสิ่งที่ไม่มีอยู่จริง
  const waitsForTeam =
    type === "REGIMEN_CONSULT" || type === "CHEMO_ADMISSION";

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline"
          >
            ← กลับหน้าแรก
          </Link>
          <div className="flex items-start gap-3 mt-3">
            <span className="text-3xl leading-none shrink-0">{meta.emoji}</span>
            <div>
              <p className="text-xs font-medium text-blue-600">
                กลุ่มที่ {meta.groupNumber}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
                {meta.titleTh}
              </h1>
              <p className="text-sm text-zinc-600 mt-1">{meta.purposeTh}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
        {/* กรอบเวลาตอบกลับ */}
        {waitsForTeam && (
        <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm">
          <h2 className="font-semibold text-zinc-900 mb-2">
            กรอบเวลาตอบกลับและผู้รับผิดชอบ
          </h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">ผู้ดูแลเรื่องนี้</dt>
              <dd className="text-zinc-800 font-medium">{meta.handlerTh}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">ตอบกลับภายใน</dt>
              <dd className="text-zinc-800 font-medium">
                {businessDaysText(meta.slaBusinessHours)}
                <span className="font-normal text-zinc-500">
                  {" "}
                  (ไม่นับวันหยุด)
                </span>
              </dd>
            </div>
          </dl>
          {meta.automation === "SEMI_AUTOMATED" ? (
            <p className="text-zinc-600 mt-3">
              ทีมจะรับเรื่องในรอบแจ้งเตือนประจำวันเวลา {BATCH_NOTIFICATION.labelTh}{" "}
              ของทุกวันทำการ ช่องทางนี้ใช้สำหรับผู้ป่วยนอกเท่านั้น
              หากผู้ป่วยมีภาวะฉุกเฉิน กรุณาใช้ช่องทางส่งต่อฉุกเฉินระหว่างโรงพยาบาลตามปกติ
            </p>
          ) : (
            <p className="text-zinc-600 mt-3">
              เรื่องนี้ระบบตอบกลับอัตโนมัติทั้งหมด ไม่ผ่านการคัดกรองของแพทย์ประจำบ้าน
              หากไม่แน่ใจว่าเคสควรอยู่กลุ่มนี้จริงหรือไม่ กรุณาติดต่อเจ้าหน้าที่ก่อน
            </p>
          )}
        </section>
        )}

        {/* Checklist สำหรับแพทย์ต้นทาง */}
        {checklist.forReferrer.length > 0 && (
          <ChecklistCard
            title="ขั้นตอนสำหรับแพทย์ผู้ส่งตัว"
            items={checklist.forReferrer}
          />
        )}

        {/* Checklist สำหรับผู้ป่วย */}
        {checklist.forPatient.length > 0 && (
          <ChecklistCard
            title="สิ่งที่ผู้ป่วยต้องเตรียมมา"
            subtitle="กรุณาเน้นย้ำผู้ป่วยให้เตรียมให้ครบ เพื่อไม่ต้องเสียเวลากลับไปกลับมา"
            items={checklist.forPatient}
          />
        )}

        {/* แบบฟอร์มรับทราบ PDPA */}
        {showConsentCard && (
        <section className="rounded-xl bg-blue-50 border border-blue-200 p-5 text-sm">
          <h2 className="font-semibold text-blue-900 mb-1">
            ก่อนส่งข้อมูล: หนังสือรับทราบสำหรับผู้ป่วย
          </h2>
          <p className="text-blue-900/80">
            กรุณาพิมพ์แบบฟอร์มให้ผู้ป่วยหรือผู้แทนโดยชอบธรรมลงนามรับทราบ
            แล้วเก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง (ไม่ต้องส่งกลับมาศิริราช)
          </p>
          <Link
            href="/consent"
            className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            เปิดแบบฟอร์มเพื่อพิมพ์
          </Link>
        </section>
        )}

        {type === "TRANSPLANT_APPOINTMENT" && (
          <IndicationCriteriaCard indications={indications} />
        )}

        {/* กลุ่มที่ 1 จองคิวเองได้ กลุ่มที่ 4 ไปใช้ระบบนัดหมายของโรงพยาบาล */}
        {type === "GENERAL_OPD" ? (
          <HospitalAppointmentCard />
        ) : type === "TRANSPLANT_APPOINTMENT" ? (
          <BookSlotCard />
        ) : (
        /* ปุ่มส่งฟอร์ม */
        <section className="rounded-xl bg-white border border-zinc-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-2">ส่งข้อมูล</h2>
          {formUrl ? (
            <a
              href={formUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              กรอกแบบฟอร์มกลุ่มที่ {meta.groupNumber}
            </a>
          ) : (
            <p className="text-sm text-zinc-600">
              ช่องทางส่งข้อมูลของกลุ่มนี้อยู่ระหว่างเปิดใช้งาน
              กรุณาติดต่อเจ้าหน้าที่ที่{" "}
              <a
                href={`tel:${CONTACT.phone}`}
                className="text-blue-600 hover:underline"
              >
                {CONTACT.phoneDisplay}
              </a>{" "}
              ในระหว่างนี้
            </p>
          )}

        </section>
        )}

        {/*
          เบอร์ธุรการแสดงเฉพาะกลุ่มที่ 1 และเฉพาะเรื่องวันที่ผู้ป่วยมาถึง

          กลุ่มเดียวที่ผู้ป่วยเดินทางมาที่ OPD 700 จริงคือกลุ่มที่ 1 คำถามแบบ
          "ไปที่ไหน" "มาสายทำอย่างไร" จึงมีเฉพาะกลุ่มนี้ กลุ่มอื่นไม่มีผู้ป่วย
          มาที่ OPD 700 การใส่เบอร์ไว้จึงชวนให้โทรมาถามเรื่องที่ธุรการตอบไม่ได้

          ⚠️ ห้ามเขียนว่าโทรมาเพื่อ "ยกเลิกหรือเลื่อนนัด" — ธุรการมองไม่เห็นว่า
          fellow แต่ละคนเหลือคิวกี่คน ค่านั้นเกิดจากการเอาตารางออกตรวจ (ไฟล์ B)
          มาหักลบกับเคสที่จองแล้ว (ไฟล์ A) การรับเรื่องทางโทรศัพท์จึงทำให้คิว
          ที่คืนมาไม่ปรากฏในปฏิทินของแพทย์โรงพยาบาลอื่น ให้ใช้ /booking แทน
        */}
        {type === "TRANSPLANT_APPOINTMENT" && (
          <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-600">
            <h2 className="font-semibold text-zinc-900 mb-2">
              สอบถามขั้นตอนวันที่ผู้ป่วยมาถึง
            </h2>
            <p className="text-zinc-600 mb-2">
              เช่น ไปที่จุดใดก่อน ต้องเตรียมเอกสารอะไรยื่นหน้างาน
            </p>
            <p className="font-medium text-zinc-800">{CONTACT.officeTh}</p>
            <p>
              โทร.{" "}
              <a
                href={`tel:${CONTACT.phone}`}
                className="text-blue-600 hover:underline"
              >
                {CONTACT.phoneDisplay}
              </a>{" "}
              ({CONTACT.hoursTh})
            </p>
            <p className="mt-3 text-zinc-600">
              ส่วนการ<strong className="text-zinc-800">เลื่อนหรือยกเลิกนัด</strong>{" "}
              ทำเองได้ที่{" "}
              <Link href="/booking" className="text-blue-600 hover:underline">
                หน้าจัดการนัด
              </Link>{" "}
              ไม่ต้องโทรแจ้ง — คิวที่ยกเลิกจะว่างกลับเข้าปฏิทินทันที
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * กลุ่มที่ 1 — เลือกวันนัดเองจากปฏิทิน ไม่ต้องรอแอดมิน
 *
 * มติอาจารย์ 2 ส.ค. 2569: ให้แพทย์ต้นทางเลือกวันจากคิวที่ว่างได้เลย
 * และไม่ต้องให้ระบบตรวจว่าเอกสารครบก่อน เพราะวันนัดอยู่ห่างออกไปหลายสัปดาห์
 * เอกสารทำทันอยู่แล้ว การกั้นตั้งแต่ตอนจองมีแต่ทำให้ผู้ป่วยต้องกลับไปกลับมา
 */
function BookSlotCard() {
  return (
    <section className="rounded-xl bg-white border-2 border-blue-600 p-5">
      <h2 className="font-semibold text-zinc-900">เลือกวันนัดได้เลย</h2>
      <p className="text-sm text-zinc-600 mt-1">
        ดูวันที่ fellow ยังมีคิวว่าง แล้วเลือกวันที่สะดวกได้ทันที
        ไม่ต้องรอเจ้าหน้าที่ติดต่อกลับ — ใช้เวลาไม่เกิน 2 นาที
      </p>

      <Link
        href="/book/transplant"
        className="mt-4 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
      >
        ดูคิวว่างและเลือกวันนัด
      </Link>

      <p className="text-sm text-zinc-600 mt-4">
        สำหรับโรงพยาบาลเครือข่าย SiAML: ติดต่อเรื่องส่งต่อปลูกถ่ายฯ (ทุกโรค) ผ่าน{" "}
        <a
          href={LINE_OA.siamlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          ลิงก์เครือข่าย SiAML
        </a>
      </p>
    </section>
  );
}

/**
 * กลุ่มที่ 4 — ไม่รับข้อมูลผู้ป่วยเข้าระบบนี้เลย
 *
 * มติอาจารย์ 2 ส.ค. 2569: ให้ผู้ป่วยนัด OPD เองผ่านระบบนัดหมายที่โรงพยาบาล
 * มีอยู่แล้ว เพื่อลดภาระแอดมินและไม่ทำงานซ้ำซ้อน หน้านี้จึงมีหน้าที่เดียว
 * คือบอกแพทย์ต้นทางว่าต้องแนะนำผู้ป่วยอย่างไร
 */
function HospitalAppointmentCard() {
  return (
    <section className="rounded-xl bg-white border-2 border-green-600 p-5">
      <h2 className="font-semibold text-zinc-900">
        กลุ่มนี้ไม่ต้องกรอกแบบฟอร์ม
      </h2>
      <p className="text-sm text-zinc-600 mt-1">
        ให้ผู้ป่วยทำนัดผู้ป่วยนอกเองผ่านระบบนัดหมายของโรงพยาบาล
        ซึ่งเปิดใช้งานอยู่แล้ว — แพทย์ต้นทางเพียงแจ้งผู้ป่วยให้ทำตามขั้นตอนนี้
      </p>

      <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4">
        <p className="text-sm font-semibold text-green-900">
          แจ้งผู้ป่วยว่า &ldquo;ให้เพิ่มเพื่อน LINE{" "}
          {HOSPITAL_APPOINTMENT.lineOaNameTh} แล้วทำนัดเองได้เลย&rdquo;
        </p>
        {HOSPITAL_APPOINTMENT.qrImagePath && (
          <div className="mt-3 flex flex-col items-center gap-2">
            {/*
              ใช้ <img> ธรรมดา ไม่ใช่ next/image โดยตั้งใจ — เว็บนี้รันบน
              Cloudflare Workers ที่ไม่ได้เปิด images binding ไว้ (ดู wrangler.jsonc)
              next/image จะพยายามเรียกตัวปรับขนาดภาพแล้วพัง

              width/height ต้องตรงกับสัดส่วนจริงของไฟล์ (620x435) ไม่ใช่จัตุรัส
              เพราะรูปมีแถบชื่อบัญชีอยู่ใต้ QR ถ้าใส่เป็นจัตุรัสภาพจะถูกบีบ
              แล้วกล้องมือถืออ่านโค้ดที่ผิดสัดส่วนไม่ออก

              กว้าง 260px คงที่ ไม่ยืดตามคอนเทนเนอร์ — บนจอกว้างถ้ารูปใหญ่เกินไป
              กล้องต้องถอยห่างจนโฟกัสยาก
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HOSPITAL_APPOINTMENT.qrImagePath}
              alt={`QR code เพิ่มเพื่อน LINE ${HOSPITAL_APPOINTMENT.lineOaNameTh}`}
              width={620}
              height={435}
              className="w-[260px] h-auto rounded-lg border border-green-300 bg-white"
            />
            <p className="text-xs text-green-900/80 text-center">
              ให้ผู้ป่วยสแกนจากหน้าจอนี้ได้เลย
              <br />
              หรือถ่ายรูปเก็บไว้สแกนทีหลัง
            </p>
          </div>
        )}

        {HOSPITAL_APPOINTMENT.lineOaUrl && (
          <a
            href={HOSPITAL_APPOINTMENT.lineOaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex rounded-lg bg-green-700 px-4 py-2 text-white text-sm font-semibold hover:bg-green-800 transition-colors"
          >
            เปิด LINE {HOSPITAL_APPOINTMENT.lineOaNameTh}
          </a>
        )}
      </div>

      <ol className="mt-4 space-y-2 text-sm text-zinc-700">
        {HOSPITAL_APPOINTMENT.stepsTh.map((step, index) => (
          <li key={step.text} className="flex gap-3">
            <span className="shrink-0 grid h-6 w-6 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 tabular-nums">
              {index + 1}
            </span>
            <span className="pt-0.5">
              {step.text}
              {step.link && (
                <>
                  {" "}
                  <a
                    href={step.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline whitespace-nowrap"
                  >
                    {step.link.labelTh} ↗
                  </a>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>

      {/*
        ไม่ให้เบอร์ OPD 700 ที่นี่ — กลุ่มนี้ไปที่ OPD อายุรศาสตร์โดยตรง
        เบอร์คลินิกโลหิตวิทยาจะพาผู้ป่วยไปหาหน่วยงานที่ไม่เห็นคิวของตัวเอง
        ดู HOSPITAL_APPOINTMENT.contactPhone ใน config.ts
      */}
      <p className="mt-4 text-sm text-zinc-600">
        ผู้ป่วยจะได้รับใบนัดหมายภายใน {HOSPITAL_APPOINTMENT.waitingDaysTh}{" "}
        หากไม่ได้รับ ติดต่อสอบถามได้ทางแชท LINE นั้น
        {HOSPITAL_APPOINTMENT.contactPhone && (
          <>
            {" "}
            หรือโทร{" "}
            <a
              href={`tel:${HOSPITAL_APPOINTMENT.contactPhone}`}
              className="text-blue-600 hover:underline"
            >
              {HOSPITAL_APPOINTMENT.contactPhone}
            </a>
          </>
        )}
      </p>

      <p className="mt-3 text-xs text-zinc-500">
        ระบบนัดหมายของโรงพยาบาลจะขอชื่อ-สกุลและเลข HN ของผู้ป่วยโดยตรง
        ซึ่งเป็นการเก็บข้อมูลของโรงพยาบาล ไม่ผ่านระบบส่งต่อนี้
      </p>
    </section>
  );
}

/**
 * ตารางเกณฑ์การส่งต่อเพื่อปลูกถ่ายเซลล์ต้นกำเนิด
 *
 * อาจารย์ขอให้ใส่ในกลุ่มที่ 1 "เพื่อให้แพทย์ต้นทางทราบเบื้องต้นว่าเกณฑ์ตอบสนอง
 * ในแต่ละโรคก่อนทำการส่งผู้ป่วยมา" (docs/I:CBMT.pdf)
 *
 * แสดงทั้งตารางตรงนี้ และแสดงเฉพาะข้อที่เลือกอีกครั้งในหน้าจองคิว
 * — ตรงนี้ไว้อ่านก่อนตัดสินใจ ส่วนตรงนั้นไว้ยืนยันตอนกำลังกรอก
 *
 * ⚠️ ไม่ใช่ด่านกั้น ระบบรับจองต่อแม้เกณฑ์ไม่ครบ (มติอาจารย์ 2 ส.ค. 2569)
 */
function IndicationCriteriaCard({
  indications,
}: {
  indications: TransplantIndication[];
}) {
  const byType = {
    AUTOLOGOUS: indications.filter((i) => i.type === "AUTOLOGOUS"),
    ALLOGENEIC: indications.filter((i) => i.type === "ALLOGENEIC"),
  };

  return (
    <section className="rounded-xl bg-white border border-zinc-200 p-5">
      <h2 className="font-semibold text-zinc-900">
        เกณฑ์การส่งต่อเพื่อเตรียมตัวปลูกถ่ายเซลล์ต้นกำเนิด
      </h2>
      <p className="text-sm text-zinc-600 mt-1">
        ใช้ประกอบการตัดสินใจก่อนส่งผู้ป่วย —
        ระบบไม่ได้ใช้กั้นการจอง หากไม่ตรงเกณฑ์แต่เห็นว่าควรส่ง จองได้ตามปกติ
      </p>

      <div className="mt-4 space-y-5">
        {(["AUTOLOGOUS", "ALLOGENEIC"] as const).map((groupType) => (
          <div key={groupType}>
            <h3 className="text-sm font-semibold text-blue-700">
              {TRANSPLANT_TYPE_LABEL_TH[groupType]}
            </h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="border-b border-zinc-200 py-1.5 pr-3 font-medium">
                      โรค
                    </th>
                    <th className="border-b border-zinc-200 py-1.5 pr-3 font-medium">
                      สถานะโรค
                    </th>
                    <th className="border-b border-zinc-200 py-1.5 font-medium whitespace-nowrap">
                      อายุ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byType[groupType].map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="border-b border-zinc-100 py-2 pr-3 font-medium text-zinc-900">
                        {item.diseaseTh}
                      </td>
                      <td className="border-b border-zinc-100 py-2 pr-3 text-zinc-600">
                        {item.statusTh || "—"}
                      </td>
                      <td className="border-b border-zinc-100 py-2 text-zinc-600">
                        {item.ageTh || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChecklistCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: ChecklistItem[];
}) {
  return (
    <section className="rounded-xl bg-white border border-zinc-200 p-5">
      <h2 className="font-semibold text-zinc-900">{title}</h2>
      {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
      <ul className="mt-3 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 rounded border border-zinc-400"
            />
            <div>
              {item.conditionTh && (
                <span className="mr-1.5 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                  {item.conditionTh}
                </span>
              )}
              <span className="text-zinc-800">{item.label}</span>
              {item.detail && (
                <p className="text-zinc-500 mt-0.5 break-words">{item.detail}</p>
              )}
              {item.link && (
                // เปิดแท็บใหม่ — คนอ่านหน้านี้กำลังไล่ checklist อยู่
                // ถ้าพาออกไปทั้งแท็บ ต้องกดย้อนกลับมาหาที่ค้างไว้ใหม่
                <a
                  href={item.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100 transition-colors break-all"
                >
                  {item.link.labelTh ?? item.link.href}
                  <span aria-hidden>↗</span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
