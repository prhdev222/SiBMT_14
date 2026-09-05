import Link from "next/link";
import type { Metadata } from "next";
import { loadCaseByToken } from "@/lib/referral-repository";
import { REFERRAL_TYPE_META, STATUS_LABEL_TH } from "@/lib/referral-types";
import { ReferrerThread } from "./ReferrerThread";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "คุยกับทีม — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  // เปิดได้ด้วย token ที่เดาไม่ได้ ไม่ควรถูกเก็บเข้าดัชนีค้นหา
  robots: { index: false, follow: false, nocache: true },
};

/**
 * หน้าคุยต่อเนื่องต่อเคสสำหรับแพทย์ต้นทาง — เปิดจากลิงก์ในอีเมล/LINE
 *
 * ⚠️ case_token 32 ตัวคือสิ่งเดียวที่กั้นอยู่ — โมเดลเดียวกับลิงก์อ่านคำตอบ
 * จึงไม่แสดงชื่อ/HN ผู้ป่วย มีแค่รหัสอ้างอิง กลุ่มงาน สถานะ และบทสนทนา
 */
export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;
  const thread = await loadCaseByToken(token);

  if (!thread) {
    return (
      <div className="flex flex-col flex-1 bg-zinc-50">
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
          <div className="rounded-xl bg-white border border-zinc-200 p-6 text-sm">
            <h1 className="text-lg font-bold text-zinc-900">เปิดหน้าไม่ได้</h1>
            <p className="text-zinc-600 mt-2">
              ลิงก์นี้ไม่ถูกต้อง หรือเคสนี้ถูกปิดไปแล้ว
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

  const meta = REFERRAL_TYPE_META[thread.referralType];

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <p className="text-xs text-zinc-500">
            {meta ? `กลุ่มที่ ${meta.groupNumber} — ${meta.titleTh}` : "เคสส่งต่อ"}
          </p>
          <h1 className="mt-1 text-lg font-bold text-zinc-900">
            คุยกับทีม · {thread.referralId}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-700">
              สถานะ: {STATUS_LABEL_TH[thread.status] ?? thread.status}
            </span>
            {thread.submittedAt && (
              <span className="text-zinc-400">ส่งเมื่อ {thread.submittedAt}</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
        <div className="rounded-xl bg-white border border-zinc-200 p-4 sm:p-5">
          <p className="mb-3 text-xs text-zinc-500">
            พิมพ์สอบถาม/ส่งข้อมูลเพิ่มถึงทีมโลหิตวิทยาได้ที่นี่ — ทีมจะเห็นและตอบกลับ
            คุณจะได้รับแจ้งเตือนทาง LINE/อีเมลเมื่อมีข้อความใหม่
          </p>
          <ReferrerThread
            caseToken={thread.caseToken}
            referrerOrg={thread.referrerOrg}
            initialMessages={thread.messages}
            initiallyClosed={thread.status === "Closed"}
            autoPromptClose={done === "1"}
          />
        </div>
        <p className="mt-4 text-center text-xs text-zinc-400">
          กรณีเร่งด่วน กรุณาโทรติดต่อเจ้าหน้าที่โดยตรง — ช่องทางนี้ตอบในเวลาทำการ
        </p>
      </main>
    </div>
  );
}
