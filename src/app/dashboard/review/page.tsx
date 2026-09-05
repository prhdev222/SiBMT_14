import type { Metadata } from "next";
import {
  loadConfigValues,
  loadReferrals,
  loadRegimens,
  loadAttendings,
  loadFellows,
  loadResidents,
} from "@/lib/referral-repository";
import { isBookingConfigured } from "@/lib/apps-script-api";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import { PageHeader } from "@/components/PageHeader";
import { CONTACT } from "@/lib/config";
import {
  REFERRAL_TYPE_META,
  isTerminal,
  type Referral,
} from "@/lib/referral-types";
import { findSimilarCases } from "@/lib/similar-cases";
import { ReviewList } from "./ReviewList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ตอบคำปรึกษา — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/** เฉพาะกลุ่มที่ต้องให้แพทย์ตอบ — กลุ่ม 1 จองเองแล้ว กลุ่ม 4 ไม่เข้าระบบนี้ */
function needsAnswer(referral: Referral): boolean {
  const isConsultGroup =
    referral.referralType === "REGIMEN_CONSULT" ||
    referral.referralType === "CHEMO_ADMISSION";
  return isConsultGroup && !isTerminal(referral.status);
}

export default async function ReviewPage() {
  const session = await requireSession("/dashboard/review");
  // อ่านขนานกัน — ทั้งสามชีตอยู่คนละแท็บและไม่ขึ้นต่อกัน
  // คลังสูตรยา 200 กว่าแถวจึงแทบไม่เพิ่มเวลารอ เพราะไปพร้อมกับสองอันแรก
  const [
    { referrals, isSampleData },
    config,
    regimens,
    attendings,
    residents,
    fellows,
  ] =
    await Promise.all([
      loadReferrals(),
      loadConfigValues(),
      loadRegimens(),
      loadAttendings(),
      loadResidents(),
      loadFellows(),
    ]);

  // ค้างนานสุดขึ้นก่อน — เคสที่รอมานานที่สุดคือเคสที่ควรได้รับความสนใจก่อน
  const open = referrals
    .filter(needsAnswer)
    .sort((a, b) => b.elapsedBusinessHours - a.elapsedBusinessHours);

  /**
   * คลังเคสที่ตอบไปแล้ว ใช้หาเคสคล้ายกัน
   *
   * ไม่ต้องอ่านชีตเพิ่ม — loadReferrals() ดึงมาทั้งหมดอยู่แล้ว
   * และหน้านี้เคยทิ้งเคสที่ตอบแล้วไปเปล่า ๆ
   *
   * คำนวณที่ฝั่งเซิร์ฟเวอร์แล้วส่งไปแค่ 3 เคสต่อรายการ ไม่ส่งคลังทั้งก้อน
   * ลงไปให้เบราว์เซอร์ — เล็กกว่ามาก และคำตอบเก่าของเคสที่ไม่เกี่ยวข้อง
   * ไม่ควรถูกส่งไปที่เครื่องผู้ใช้ตั้งแต่แรก
   */
  const pool = referrals.filter(
    (r) =>
      (r.referralType === "REGIMEN_CONSULT" ||
        r.referralType === "CHEMO_ADMISSION") &&
      r.adviceRecord.trim().length > 0,
  );

  const answered = referrals.filter(
    (r) =>
      (r.referralType === "REGIMEN_CONSULT" ||
        r.referralType === "CHEMO_ADMISSION") &&
      isTerminal(r.status),
  ).length;

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />

        <PageHeader
          eyebrow="กลุ่มที่ 2 และ 3"
          title="ตอบคำปรึกษา"
          width="max-w-3xl"
          links={[
            { href: "/dashboard", label: "กลับ Dashboard" },
          ]}
        />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        {isSampleData && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">กำลังแสดงข้อมูลตัวอย่าง</span> —
            ยังไม่ได้ต่อ Google Sheet จริง คำตอบที่บันทึกจะไม่ถูกเก็บ
          </p>
        )}

        {!isBookingConfigured() && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
            <span className="font-semibold">บันทึกคำตอบไม่ได้</span> —
            ยังไม่ได้ตั้งค่า <code>BOOKING_API_URL</code> และ{" "}
            <code>BOOKING_API_TOKEN</code>
          </p>
        )}

        {open.length === 0 ? (
          <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
            <p className="text-lg font-semibold text-zinc-900">
              ไม่มีเคสรอตอบ 🎉
            </p>
            <p className="text-sm text-zinc-600 mt-1">
              ตอบไปแล้วทั้งหมด {answered} เคส
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-600">
              มี <span className="font-semibold text-zinc-900">{open.length}</span>{" "}
              เคสรอตอบ — เรียงจากที่รอนานที่สุด
            </p>
            {/* ชื่อผู้ตอบจงใจเว้นว่าง — บัญชีล็อกอินเป็นของใช้ร่วม (เช่น "admin")
                ไม่ใช่ชื่อคน และค่าที่ค้างในช่องบัง dropdown รายชื่อ resident */}
            <ReviewList
              cases={open.map((r) => ({
                referralId: r.referralId,
                groupNumber: REFERRAL_TYPE_META[r.referralType].groupNumber,
                groupTitle: REFERRAL_TYPE_META[r.referralType].titleTh,
                status: r.status,
                elapsedBusinessHours: r.elapsedBusinessHours,
                submittedAt: r.submittedAt,
                referrerOrg: r.referrerOrg,
                referrerPhone: r.referrerPhone,
                insuranceScheme: r.insuranceScheme,
                diseaseGroup: r.diseaseGroup,
                diagnosis: r.diagnosis,
                stage: r.stage,
                treatmentSummary: r.treatmentSummary,
                comorbidity: r.comorbidity,
                clinicalQuestion: r.clinicalQuestion,
                adviceRecord: r.adviceRecord,
                note: r.note,
                similar: findSimilarCases(r, pool),
              }))}
              defaultAnsweredBy=""
              defaultWardPhone={config["chemo_ward_phone"] ?? ""}
              regimens={regimens}
              regimenLibraryUrl={config["regimen_library_url"] ?? ""}
              attendings={attendings}
              residents={residents}
              fellows={fellows}
            />
          </>
        )}

        <p className="text-xs text-zinc-500 text-center pt-2">
          ติดต่อ OPD 700 โทร {CONTACT.phoneDisplay} ({CONTACT.hoursTh})
        </p>
      </main>
    </div>
  );
}
