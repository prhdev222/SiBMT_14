import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { DocumentLibrary } from "@/components/DocumentLibrary";
import { Opd700Contact } from "@/components/Opd700Contact";
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
import {
  loadDocuments,
  loadTransplantIndications,
} from "@/lib/referral-repository";
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
  const [indications, documents] = await Promise.all([
    type === "TRANSPLANT_APPOINTMENT"
      ? loadTransplantIndications()
      : Promise.resolve([]),
    loadDocuments(),
  ]);

  const showConsentCard =
    type === "REGIMEN_CONSULT" || type === "CHEMO_ADMISSION";

  // มีแค่กลุ่ม 2 และ 3 ที่ต้องรอทีมอ่านแล้วตอบกลับ
  // กลุ่ม 1 จองคิวเองได้ทันที กลุ่ม 4 ไปใช้ระบบนัดหมายของโรงพยาบาล
  // การแสดงกรอบเวลาตอบกลับกับสองกลุ่มนั้นจะสัญญาสิ่งที่ไม่มีอยู่จริง
  const waitsForTeam =
    type === "REGIMEN_CONSULT" || type === "CHEMO_ADMISSION";

  // กลุ่มที่ทางไปต่อคือ Google Form — ปุ่มอยู่บนสุด + แถบลอยบนมือถือ
  const usesForm = waitsForTeam;
  const isTransplant = type === "TRANSPLANT_APPOINTMENT";
  // ทางไปต่อหลักของหน้า — โผล่ซ้ำเป็นแถบลอยขอบล่างบนมือถือ
  const stickyCta =
    usesForm && formUrl
      ? { href: formUrl, label: `กรอกแบบฟอร์มกลุ่มที่ ${meta.groupNumber} →`, external: true }
      : isTransplant
        ? { href: "/book/transplant", label: "ดูคิวว่างและเลือกวันนัด →", external: false }
        : null;
  const hasStickyCta = stickyCta !== null;
  // กลุ่มที่มีปุ่มไปต่อชัดเจน (ฟอร์ม / จองคิว) พับเช็กลิสต์ไว้ใต้ปุ่ม
  const collapseChecklist = usesForm || isTransplant;
  const checklistCount =
    checklist.forReferrer.length + checklist.forPatient.length;
  // สรุปสั้น ๆ ว่าต้องมีอะไรในมือ — ให้เห็นที่ปุ่มเลย ไม่ต้องกางเช็กลิสต์
  const prepSummary =
    type === "REGIMEN_CONSULT"
      ? "การวินิจฉัย · สูตรยาที่เคยได้ · ผล lab ล่าสุด · สิทธิการรักษา"
      : "การวินิจฉัย · การรักษาที่ผ่านมา · ผล lab · สิทธิการรักษา";

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <BackButton fallback="/" label="ย้อนกลับ" />
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

      <main
        className={`flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6 ${
          hasStickyCta ? "pb-28 sm:pb-6" : ""
        }`}
      >
        {/*
          ปุ่มส่งฟอร์มอยู่บนสุด ใต้หัวข้อทันที (คำขอผู้ใช้ 11 ก.ย. 2569)

          เดิมอยู่ล่างสุดหลังเช็กลิสต์สองชุดกับการ์ด PDPA — บนมือถือต้องเลื่อน
          2-3 หน้าจอถึงจะเจอ คนที่มาหน้านี้ส่วนใหญ่รู้อยู่แล้วว่าจะส่ง ไม่ได้มาอ่าน
          จึงให้ "ทางไปต่อ" อยู่ในจอแรก แล้วรายละเอียดตามหลัง
        */}
        {usesForm && (
          <section className="rounded-xl bg-blue-600 p-5 sm:p-6 shadow-sm">
            <h2 className="font-semibold text-white text-lg">ส่งข้อมูล</h2>
            {formUrl ? (
              <>
                <p className="text-sm text-blue-100 mt-1">
                  กรอกใน Google Form ใช้เวลาประมาณ 5 นาที ·
                  เตรียมไว้: {prepSummary}
                </p>
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-6 py-4 text-blue-700 text-base font-bold hover:bg-blue-50 transition-colors"
                >
                  กรอกแบบฟอร์มกลุ่มที่ {meta.groupNumber} →
                </a>
                <p className="text-xs text-blue-100 mt-3">
                  ส่งแล้วจะได้อีเมลรหัสเคสทันที พร้อมลิงก์แนบผล lab / ใบ refer เพิ่ม
                  โดยไม่ต้อง login
                </p>
              </>
            ) : (
              <p className="text-sm text-blue-50 mt-2">
                ช่องทางส่งข้อมูลของกลุ่มนี้อยู่ระหว่างเปิดใช้งาน
                กรุณาติดต่อเจ้าหน้าที่ที่{" "}
                <a
                  href={`tel:${CONTACT.phone}`}
                  className="font-semibold text-white underline"
                >
                  {CONTACT.phoneDisplay}
                </a>{" "}
                ในระหว่างนี้
              </p>
            )}
          </section>
        )}

        {/* กลุ่ม 1: ปุ่มจองคิวขึ้นบนสุดเช่นกัน แล้วตามด้วยเกณฑ์ปลูกถ่าย
            (เกณฑ์ยังกางไว้ เพราะเป็นตัวตัดสินว่าควรจองหรือไม่ ไม่ใช่ของประกอบ) */}
        {isTransplant && (
          <>
            <BookSlotCard />
            <IndicationCriteriaCard indications={indications} />
          </>
        )}

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

        {/* แบบฟอร์มรับทราบ PDPA — อยู่เหนือเช็กลิสต์ เพราะเป็นข้อบังคับ ไม่ใช่คำแนะนำ */}
        {showConsentCard && (
        <section className="rounded-xl bg-blue-50 border border-blue-200 p-5 text-sm">
          <h2 className="font-semibold text-blue-900 mb-1">
            ก่อนส่งข้อมูล: หนังสือรับทราบสำหรับผู้ป่วย
          </h2>

          {/*
            กลุ่มที่ 2 รับสองอย่างที่ต่างกันมากตั้งแต่ขยายขอบเขต (มติ 29 ส.ค. 2569)
            — ขอความเห็นสูตรยาของผู้ป่วยรายหนึ่ง กับถามคำถามทั่วไป

            อันแรกส่งข้อมูลคลินิกชุดเดียวกับกลุ่มที่ 3 ทุกประการ ต่างแค่ผู้ป่วย
            ไม่ได้เดินทางมา ซึ่งไม่ใช่สิ่งที่กฎหมายคุ้มครองข้อมูลสนใจ
            อันหลังอาจไม่มีข้อมูลของใครเลย

            ตัวแปรคือ "ส่งข้อมูลของผู้ป่วยรายใดรายหนึ่งไปหรือไม่" ไม่ใช่ "ผู้ป่วยมาหรือไม่"
            การบอกให้ชัดตรงนี้ลดภาระของคำถามทั่วไปได้ โดยไม่ลดการคุ้มครอง
            ของเคสที่ส่งข้อมูลจริง — ต่างจากการตัดการ์ดออกทั้งกลุ่ม
          */}
          {type === "REGIMEN_CONSULT" ? (
            <>
              <p className="text-blue-900/80">
                <span className="font-medium">
                  ถ้าเป็นคำถามเกี่ยวกับผู้ป่วยรายใดรายหนึ่ง
                </span>{" "}
                กรุณาพิมพ์แบบฟอร์มให้ผู้ป่วยหรือผู้แทนโดยชอบธรรมลงนามรับทราบ
                แล้วเก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง (ไม่ต้องส่งกลับมาศิริราช)
              </p>
              <p className="text-blue-900/80 mt-2">
                <span className="font-medium">
                  ถ้าเป็นคำถามทั่วไปที่ไม่ระบุผู้ป่วย
                </span>{" "}
                เช่น ถามว่าขณะนี้มีการศึกษาวิจัยใดเปิดรับอยู่บ้าง
                — ไม่ต้องใช้แบบฟอร์มนี้ และกรุณาอย่ากรอกข้อมูลผู้ป่วยลงในฟอร์ม
              </p>
            </>
          ) : (
            <p className="text-blue-900/80">
              กรุณาพิมพ์แบบฟอร์มให้ผู้ป่วยหรือผู้แทนโดยชอบธรรมลงนามรับทราบ
              แล้วเก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง (ไม่ต้องส่งกลับมาศิริราช)
            </p>
          )}

          {/*
            เป็นลิงก์ ไม่ใช่ปุ่มทึบ — ปุ่มทึบสีเข้มดึงสายตามากกว่าปุ่มส่งฟอร์มจริง
            ทั้งที่นี่เป็นขั้นเตรียมเอกสาร ไม่ใช่ทางไปต่อของหน้านี้
          */}
          <Link
            href="/consent"
            className="mt-3 inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
          >
            เปิดแบบฟอร์มเพื่อพิมพ์ →
          </Link>
        </section>
        )}

        {/*
          เช็กลิสต์ — กลุ่มที่กรอกฟอร์มพับไว้ใต้ปุ่ม เปิดดูเมื่ออยากรู้ว่าต้องเตรียมอะไร
          กลุ่ม 1/4 ยังกางไว้ เพราะเช็กลิสต์ "คือ" ขั้นตอนของกลุ่มนั้น ไม่ใช่ของประกอบ
        */}
        {collapseChecklist ? (
          checklistCount > 0 && (
            <details className="group rounded-xl bg-white border border-zinc-200 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="font-semibold text-zinc-900">
                    เตรียมอะไรบ้าง
                  </span>
                  <span className="ml-2 text-sm text-zinc-500">
                    {checklistCount} รายการ · กดเพื่อดู
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-zinc-400 transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <div className="border-t border-zinc-100 px-5 pb-5 divide-y divide-zinc-100">
                {checklist.forReferrer.length > 0 && (
                  <ChecklistCard
                    title="ขั้นตอนสำหรับแพทย์ผู้ส่งตัว"
                    items={checklist.forReferrer}
                    marker="number"
                    embedded
                  />
                )}
                {checklist.forPatient.length > 0 && (
                  <ChecklistCard
                    title="สิ่งที่ผู้ป่วยต้องเตรียมมา"
                    subtitle="กรุณาเน้นย้ำผู้ป่วยให้เตรียมให้ครบ เพื่อไม่ต้องเสียเวลากลับไปกลับมา"
                    items={checklist.forPatient}
                    embedded
                  />
                )}
              </div>
            </details>
          )
        ) : (
          <>
            {checklist.forReferrer.length > 0 && (
              <ChecklistCard
                title="ขั้นตอนสำหรับแพทย์ผู้ส่งตัว"
                items={checklist.forReferrer}
                marker="number"
              />
            )}
            {checklist.forPatient.length > 0 && (
              <ChecklistCard
                title="สิ่งที่ผู้ป่วยต้องเตรียมมา"
                subtitle="กรุณาเน้นย้ำผู้ป่วยให้เตรียมให้ครบ เพื่อไม่ต้องเสียเวลากลับไปกลับมา"
                items={checklist.forPatient}
              />
            )}
          </>
        )}

        {/* กลุ่มที่ 4 ไปใช้ระบบนัดหมายของโรงพยาบาล (กลุ่ม 1-3 ปุ่มไปต่ออยู่บนสุดแล้ว) */}
        {type === "GENERAL_OPD" && <HospitalAppointmentCard />}

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
              ทำเองได้ ไม่ต้องโทรแจ้ง — คิวที่ยกเลิกจะว่างกลับเข้าปฏิทินทันที
            </p>
            <Link
              href="/booking"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 font-medium text-blue-800 hover:bg-blue-100 transition-colors"
            >
              📅 เปิดหน้าจัดการนัด
            </Link>
          </section>
        )}

        {/* กลุ่มที่ 3 มีนัดประเมินความพร้อมที่ OPD 700 (ทีมเป็นผู้จัดนัด) —
            ให้แพทย์ต้นทางเช็กวันนัด/เปิดใบนัดซ้ำได้ แต่ไม่โชว์เลื่อน/ยกเลิก
            (เป็นสิทธิ์ของทีม) และไม่ใส่เบอร์ธุรการ (เหตุผลเดียวกับกลุ่ม 1) */}
        {type === "CHEMO_ADMISSION" && (
          <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-600">
            <h2 className="font-semibold text-zinc-900 mb-2">
              เช็กวันนัด / ใบนัด
            </h2>
            <p className="mb-3">
              หลังทีมนัดผู้ป่วยมาประเมินความพร้อมที่ OPD 700 แล้ว
              เช็กวันนัดหรือเปิด/บันทึกรูปใบนัดซ้ำได้ที่นี่ — กรอกเลขอ้างอิง
              และเบอร์ที่ลงทะเบียนไว้
            </p>
            <Opd700Contact className="mb-3" />
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 font-medium text-blue-800 hover:bg-blue-100 transition-colors"
            >
              📅 เช็กวันนัด / เปิดใบนัด
            </Link>
          </section>
        )}

        {/* กลุ่ม 2 ไม่มีผู้ป่วยเดินทางมา แต่แพทย์ต้นทางยังต้องรู้ว่าหน่วยอยู่ที่ไหน/โทรหาใคร
            (คำขอผู้ใช้ 11 ก.ย. 2569: ให้ทั้งกลุ่ม 1-3 เห็นที่อยู่และเบอร์ OPD 700 เต็ม) */}
        {type === "REGIMEN_CONSULT" && (
          <section className="rounded-xl bg-white border border-zinc-200 p-5">
            <h2 className="font-semibold text-zinc-900 mb-2">
              ติดต่อหน่วยโลหิตวิทยา
            </h2>
            <Opd700Contact />
          </section>
        )}

        <DocumentLibrary documents={documents} groupNumber={meta.groupNumber} />
      </main>

      {/*
        แถบปุ่มลอยขอบล่าง — มือถือเท่านั้น (จอกว้างเห็นปุ่มบนสุดอยู่แล้ว)
        ไม่ว่าเลื่อนไปอ่านตรงไหน ทางไปต่อยังกดได้ทุกเมื่อ
        เว้นขวาไว้ให้ปุ่ม Hemato Bot กับตัวปรับขนาดตัวหนังสือที่ลอยอยู่มุมขวาล่าง
      */}
      {stickyCta && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-blue-700/20 bg-white/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-28 print:hidden">
          {stickyCta.external ? (
            <a
              href={stickyCta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-white text-sm font-bold shadow-md shadow-blue-600/25 active:bg-blue-700"
            >
              {stickyCta.label}
            </a>
          ) : (
            <Link
              href={stickyCta.href}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-white text-sm font-bold shadow-md shadow-blue-600/25 active:bg-blue-700"
            >
              {stickyCta.label}
            </Link>
          )}
        </div>
      )}
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
        ระบบไม่ได้ใช้ในการปิดกั้นการจองผู้ป่วย หากไม่ตรงตามเกณฑ์
        แต่เห็นว่าควรส่งมาปรึกษา สามารถส่งจองได้
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

/**
 * รายการเตรียมตัว — ตัวนำหน้าเป็น "ลำดับขั้น" หรือ "จุด" ไม่ใช่กล่องสี่เหลี่ยม
 *
 * เดิมใช้ ☐ นำหน้าทุกรายการ แพทย์ต้นทางเข้าใจว่าต้องติ๊กก่อนถึงจะกดต่อได้
 * พอติ๊กไม่ได้ก็คิดว่าหน้าเสีย แล้วเลิกใช้ (รายงานผู้ใช้ 11 ก.ย. 2569)
 * กล่องสี่เหลี่ยมสื่อว่า "กดได้" เสมอ ต่อให้เขียนกำกับก็ไม่ช่วย
 */
function ChecklistCard({
  title,
  subtitle,
  items,
  marker = "bullet",
  embedded = false,
}: {
  title: string;
  subtitle?: string;
  items: ChecklistItem[];
  /** number = ขั้นตอนที่ต้องทำตามลำดับ · bullet = ของที่ต้องมี ไม่มีลำดับ */
  marker?: "number" | "bullet";
  /** อยู่ในกล่องพับได้แล้ว — ไม่ต้องมีกรอบซ้อนกรอบ */
  embedded?: boolean;
}) {
  const Wrapper = embedded ? "div" : "section";
  return (
    <Wrapper
      className={
        embedded ? "pt-4" : "rounded-xl bg-white border border-zinc-200 p-5"
      }
    >
      <h2 className="font-semibold text-zinc-900">{title}</h2>
      {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
      <ul className="mt-3 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm">
            {marker === "number" ? (
              <span
                aria-hidden
                className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold tabular-nums text-white"
              >
                {i + 1}
              </span>
            ) : (
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400"
              />
            )}
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
    </Wrapper>
  );
}
