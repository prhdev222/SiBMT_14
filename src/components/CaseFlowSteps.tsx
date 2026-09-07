import type { ReferralType, Status } from "@/lib/referral-types";

/**
 * แถบสถานะเคสแบบ "ติดตามพัสดุ" — เห็นทันทีว่าเคสอยู่ขั้นไหน
 *
 * แต่ละกลุ่มมีเส้นทางต่างกัน (ดู STATUSES_BY_TYPE) จึงกำหนดขั้นแยกตามกลุ่ม
 * แล้ว map สถานะจริง → ขั้นที่กำลังอยู่ (current) · ขั้นก่อนหน้า = เสร็จแล้ว
 * เคสคำปรึกษา: ช่วง "รออาจารย์ ↔ ตอบแล้ว" วนได้ (เส้นประ) จนกว่าจะปิด
 */

type FlowStep = { label: string };

const TRANSPLANT_STEPS: FlowStep[] = [
  { label: "รับเรื่อง" },
  { label: "ยืนยันนัด" },
  { label: "จบเคส" },
];

const GENERAL_STEPS: FlowStep[] = [
  { label: "รับเรื่อง" },
  { label: "ตอบอัตโนมัติ" },
  { label: "จบเคส" },
];

function flowFor(
  type: ReferralType,
  status: Status,
  hasAssignee: boolean,
): {
  steps: FlowStep[];
  current: number;
  ended: boolean;
  loopAt: number;
  isChemo: boolean;
} {
  const ended =
    status === "Closed" ||
    status === "Rejected / Redirected" ||
    status === "Cancelled by Referrer";

  if (type === "TRANSPLANT_APPOINTMENT") {
    const current = ended ? 2 : status === "Appointment Confirmed" ? 1 : 0;
    return { steps: TRANSPLANT_STEPS, current, ended, loopAt: -1, isChemo: false };
  }

  if (type === "GENERAL_OPD") {
    const current = ended ? 2 : status === "Auto Replied" ? 1 : 0;
    return { steps: GENERAL_STEPS, current, ended, loopAt: -1, isChemo: false };
  }

  // กลุ่ม 2/3 (คำปรึกษา)
  let current: number;
  if (status === "Closed" || status === "Rejected / Redirected") current = 4;
  else if (status === "Advice Sent" || status === "Readiness Visit Scheduled")
    current = 3;
  else if (
    status === "Awaiting Attending" ||
    status === "Pending Review" ||
    status === "Incomplete"
  )
    current = 2;
  else current = hasAssignee ? 1 : 0; // Submitted

  // กลุ่ม 3 มี 2 ทางออก — ขั้นผลลัพธ์บอกด้วยว่า "นัด OPD" หรือ "ตอบแล้ว (ไม่นัด)"
  const isChemo = type === "CHEMO_ADMISSION";
  const outcome = !isChemo
    ? "ตอบแล้ว"
    : status === "Readiness Visit Scheduled"
      ? "นัด OPD"
      : status === "Advice Sent"
        ? "ตอบแล้ว"
        : "ตอบ/นัด";
  const steps: FlowStep[] = [
    { label: "รับเรื่อง" },
    { label: "มอบหมาย" },
    { label: "รออาจารย์" },
    { label: outcome },
    { label: "จบเคส" },
  ];
  // ช่วง "รออาจารย์"(2) → ผลลัพธ์(3) วนได้
  return { steps, current, ended, loopAt: 2, isChemo };
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M5 10.5l3.2 3.2L15 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CaseFlowSteps({
  referralType,
  status,
  hasAssignee,
}: {
  referralType: ReferralType;
  status: Status;
  hasAssignee: boolean;
}) {
  const { steps, current, ended, loopAt, isChemo } = flowFor(
    referralType,
    status,
    hasAssignee,
  );
  const isConsult = loopAt >= 0;
  const last = steps.length - 1;

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-4">
      <div className="overflow-x-auto">
        <div className="flex min-w-[300px] items-start">
          {steps.map((s, i) => {
            const done = i < current;
            const isCurrent = i === current;
            const loopSeg = i === loopAt; // เส้นช่วงที่วนได้ = เส้นประ

            return (
              <div
                key={s.label}
                className="relative flex flex-1 flex-col items-center"
              >
                {/* เส้นเชื่อมไปโหนดถัดไป (ยกเว้นตัวสุดท้าย) */}
                {i < last && (
                  <span
                    className={
                      "absolute left-1/2 top-[15px] w-full border-t-2 " +
                      (loopSeg ? "border-dashed " : "border-solid ") +
                      (done ? "border-emerald-400" : "border-zinc-200")
                    }
                  />
                )}

                {/* วงกลมสถานะ */}
                <span
                  className={
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors " +
                    (done
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "border-2 border-zinc-200 bg-white text-zinc-400")
                  }
                >
                  {done ? (
                    <Check />
                  ) : isCurrent ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : (
                    i + 1
                  )}
                </span>

                <span
                  className={
                    "mt-1.5 text-center text-[11px] leading-tight " +
                    (isCurrent
                      ? "font-semibold text-blue-700"
                      : done
                        ? "text-emerald-700"
                        : "text-zinc-400")
                  }
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isConsult && !ended && (
        <p className="mt-3 flex items-start gap-1.5 border-t border-zinc-100 pt-2.5 text-[11px] leading-relaxed text-zinc-500">
          <span aria-hidden>🔄</span>
          <span>
            ตอบแล้วยังไม่จบ — แพทย์ต้นทางถามเพิ่มได้ (วน รออาจารย์ ↔ ตอบแล้ว)
            เคสจบเมื่อกด &ldquo;ปิดเคส&rdquo; หรือแพทย์ต้นทางจบเอง ·
            คำตอบเพิ่มทุกครั้งต้องมีอาจารย์รับรอง
            {isChemo &&
              " · กลุ่ม 3 อาจ “นัดมาประเมินที่ OPD 700” หรือ “ตอบให้ดูแลเอง (ไม่นัด)” ก็ได้"}
          </span>
        </p>
      )}
    </div>
  );
}
