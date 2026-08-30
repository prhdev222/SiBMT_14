import Link from "next/link";
import type { Metadata } from "next";
import { loadReferralByAnswerToken } from "@/lib/referral-repository";
import { REFERRAL_TYPE_META, STATUS_LABEL_TH } from "@/lib/referral-types";
import { LINE_OA } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "คำตอบการปรึกษา — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  // หน้านี้เปิดได้ด้วย token ที่เดาไม่ได้ ไม่ควรถูกเก็บเข้าดัชนีค้นหาเด็ดขาด
  robots: { index: false, follow: false, nocache: true },
};

/**
 * อ่านคำตอบจากลิงก์ในอีเมลหรือ LINE โดยไม่ต้องล็อกอิน
 *
 * ⚠️ token 32 ตัวอักษรคือสิ่งเดียวที่กั้นอยู่ — โมเดลเดียวกับลิงก์เลื่อน/ยกเลิกนัด
 * ของกลุ่ม 1 ที่ใช้งานอยู่แล้ว หน้านี้จึงแสดงเฉพาะสิ่งที่อยู่ในอีเมลฉบับเดิม
 * ไม่มากกว่านั้น และระบบไม่เคยเก็บชื่อหรือ HN ผู้ป่วยอยู่แล้ว
 */
export default async function AnswerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const referral = await loadReferralByAnswerToken(token);

  if (!referral || !referral.adviceRecord) {
    return (
      <div className="flex flex-col flex-1 bg-zinc-50">
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
          <div className="rounded-xl bg-white border border-zinc-200 p-6 text-sm">
            <h1 className="text-lg font-bold text-zinc-900">เปิดคำตอบไม่ได้</h1>
            <p className="text-zinc-600 mt-2">
              ลิงก์นี้ไม่ถูกต้อง หรือเคสนี้ยังไม่มีคำตอบ
              กรุณาตรวจว่าคัดลอกลิงก์มาครบทั้งบรรทัด
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex text-blue-600 hover:underline"
            >
              ← กลับหน้าแรก
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const meta = REFERRAL_TYPE_META[referral.referralType];

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <p className="text-xs font-medium text-blue-600">
            กลุ่มที่ {meta.groupNumber} · {STATUS_LABEL_TH[referral.status]}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1">
            คำตอบการปรึกษา
          </h1>
          <p className="font-mono text-sm text-zinc-500 mt-1">
            {referral.referralId}
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
        {referral.clinicalQuestion && (
          <section className="rounded-xl bg-white border border-zinc-200 p-5">
            <h2 className="text-sm font-medium text-zinc-500 mb-1">
              คำถามของท่าน
            </h2>
            <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
              {referral.clinicalQuestion}
            </p>
          </section>
        )}

        <section className="rounded-xl bg-white border-2 border-blue-200 p-5">
          <h2 className="font-semibold text-zinc-900 mb-2">คำตอบ</h2>
          <p className="text-zinc-900 whitespace-pre-wrap leading-relaxed">
            {referral.adviceRecord}
          </p>
        </section>

        {referral.appointmentDate && (
          <section className="rounded-xl bg-green-50 border border-green-200 p-5 text-sm">
            <h2 className="font-semibold text-green-900 mb-1">
              นัดมาประเมินความพร้อมที่ OPD 700
            </h2>
            <p className="text-green-900">
              {referral.appointmentNote || referral.appointmentDate}
            </p>
            <p className="text-xs text-green-800 mt-2">
              กรุณาเขียนวันนัดนี้บนหัวกระดาษใบ refer —
              ธุรการ OPD 700 คัดกรองจากหัวกระดาษ ไม่ได้เปิดหน้านี้ดู
            </p>
          </section>
        )}

        {/*
          ชวนผูก LINE เฉพาะคนที่ยังเปิดหน้านี้จากอีเมล — คนที่กดมาจาก LINE
          ผูกอยู่แล้ว แต่หน้านี้ไม่รู้ว่ามาจากทางไหน จึงแสดงให้ทุกคนเห็น
          และเขียนให้คนที่ผูกแล้วอ่านผ่านได้โดยไม่สับสน
        */}
        <section className="rounded-xl bg-blue-50 border border-blue-200 p-5 text-sm">
          <h2 className="font-semibold text-blue-900 mb-1">
            ครั้งหน้าไม่ต้องเปิดอีเมล
          </h2>
          <p className="text-blue-900/90">
            ผูก LINE ครั้งเดียว แล้วคำตอบครั้งต่อไปจะเด้งเข้า LINE
            พร้อมปุ่มเปิดอ่านทันที — แอด{" "}
            <a
              href={LINE_OA.addFriendUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              LINE {LINE_OA.displayName}
            </a>{" "}
            แล้วกดปุ่ม &ldquo;ผูกบัญชี&rdquo;
          </p>
        </section>

        <p className="text-xs text-zinc-500 text-center pt-2">
          ลิงก์นี้เปิดได้เฉพาะผู้ที่มีลิงก์ ส่งต่อให้ทีมของท่านดูได้
          <br />
          กรุณาอย่าเผยแพร่ในที่สาธารณะ
        </p>
      </main>
    </div>
  );
}
