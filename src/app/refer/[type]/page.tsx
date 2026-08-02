import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  REFERRAL_TYPES,
  REFERRAL_TYPE_BY_SLUG,
  REFERRAL_TYPE_META,
} from "@/lib/referral-types";
import { CHECKLIST_BY_TYPE, type ChecklistItem } from "@/lib/document-checklist";
import { BATCH_NOTIFICATION, CONTACT, FORM_URL, LINE_OA } from "@/lib/config";

export function generateStaticParams() {
  return REFERRAL_TYPES.map((type) => ({
    type: REFERRAL_TYPE_META[type].href.replace("/refer/", ""),
  }));
}

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
                {meta.slaBusinessHours} ชั่วโมงทำการ
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

        {/* ปุ่มส่งฟอร์ม */}
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

          {type === "TRANSPLANT_APPOINTMENT" && (
            <p className="text-sm text-zinc-600 mt-3">
              สำหรับโรงพยาบาลเครือข่าย SiAML: ติดต่อเรื่องส่งต่อปลูกถ่ายฯ (ทุกโรค)
              ผ่าน{" "}
              <a
                href={LINE_OA.siamlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                ลิงก์เครือข่าย SiAML
              </a>
            </p>
          )}
        </section>

        <section className="rounded-xl bg-white border border-zinc-200 p-5 text-sm text-zinc-600">
          <h2 className="font-semibold text-zinc-900 mb-2">ติดต่อเจ้าหน้าที่</h2>
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
        </section>
      </main>
    </div>
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
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
