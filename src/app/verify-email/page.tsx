import Link from "next/link";
import type { Metadata } from "next";
import { BackButton } from "@/components/BackButton";
import { confirmEmail, isBookingConfigured } from "@/lib/apps-script-api";
import { CONTACT } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ยืนยันอีเมล — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  // URL นี้มีเลขที่อ้างอิงและ token อยู่ใน query string ห้ามเก็บเข้าดัชนีค้นหา
  robots: { index: false, follow: false },
};

/**
 * หน้าปลายทางของลิงก์ยืนยันอีเมลใน OnFormSubmit
 *
 * ⚠️ Apps Script (`confirmEmail`) ตอบข้อความเดียวกันทุกสาเหตุที่ล้มเหลว —
 * ไม่มี id/token, id ไม่มีในระบบ, หรือ token ผิด — เพื่อกันการไล่เดา referralId
 * (anti-enumeration) หน้านี้จึงต้องแสดงข้อความล้มเหลวแบบเดียวเสมอ
 * ห้ามพยายามแยกแยะสาเหตุ ห้ามแสดง error ดิบหรือ token กลับไปบนหน้า
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string }>;
}) {
  const { id, t } = await searchParams;
  const referralId = (id ?? "").trim();
  const token = (t ?? "").trim();

  let verified = false;
  if (referralId && token && isBookingConfigured()) {
    try {
      const result = await confirmEmail({ referralId, token });
      verified = Boolean(result?.ok);
    } catch {
      verified = false;
    }
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <BackButton fallback="/" label="กลับหน้าแรก" />
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-3">
            ยืนยันอีเมล
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        {verified ? (
          <div className="rounded-xl bg-white border-2 border-green-200 p-6 text-sm">
            <h2 className="text-lg font-bold text-green-900">
              ยืนยันอีเมลเรียบร้อยแล้ว ✓
            </h2>
            <p className="text-zinc-700 mt-2 leading-relaxed">
              ระบบบันทึกไว้แล้วว่าอีเมลที่ท่านกรอกเป็นของจริง —
              แพทย์ผู้ตอบคำปรึกษาจะเห็นเครื่องหมายนี้กำกับอยู่ที่เคสของท่าน
              และมั่นใจได้ว่าคำตอบจะส่งถึงอีเมลที่ถูกต้อง
              ไม่ต้องทำอะไรเพิ่มเติมอีก
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex text-blue-600 hover:underline"
            >
              ← กลับหน้าแรก
            </Link>
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-zinc-200 p-6 text-sm">
            <h2 className="text-lg font-bold text-zinc-900">
              ลิงก์ไม่ถูกต้องหรือหมดอายุ
            </h2>
            <p className="text-zinc-600 mt-2 leading-relaxed">
              กรุณาตรวจว่าคัดลอกลิงก์จากอีเมลมาครบทั้งบรรทัด
              หากยังยืนยันไม่ได้ กรุณาติดต่อเจ้าหน้าที่ที่
            </p>
            <p className="text-zinc-800 mt-3">
              <a
                href={`tel:${CONTACT.phone}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {CONTACT.phoneDisplay}
              </a>{" "}
              ({CONTACT.hoursTh})
            </p>
            <p className="text-zinc-600 mt-1">{CONTACT.officeTh}</p>
            <Link
              href="/"
              className="mt-4 inline-flex text-blue-600 hover:underline"
            >
              ← กลับหน้าแรก
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
