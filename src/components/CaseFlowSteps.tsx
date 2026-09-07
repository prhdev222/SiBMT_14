import type { ReferralType, Status } from "@/lib/referral-types";

/**
 * แถบสถานะเคสแบบ "ติดตามพัสดุ" — เห็นทันทีว่าเคสอยู่ขั้นไหน
 *
 * แต่ละกลุ่มมีเส้นทางต่างกัน (ดู STATUSES_BY_TYPE) จึงกำหนดขั้นแยกตามกลุ่ม
 * แล้ว map สถานะจริง → ขั้นที่กำลังอยู่ (current) · ขั้นก่อนหน้า = เสร็จแล้ว
 */

type FlowStep = { icon: string; label: string };

const CONSULT_STEPS: FlowStep[] = [
  { icon: "📥", label: "รับเรื่อง" },
  { icon: "👤", label: "มอบหมาย" },
  { icon: "⏳", label: "รออาจารย์" },
  { icon: "✅", label: "ตอบแล้ว" },
  { icon: "📮", label: "จบเคส" },
];

const TRANSPLANT_STEPS: FlowStep[] = [
  { icon: "📥", label: "รับเรื่อง" },
  { icon: "📅", label: "ยืนยันนัด" },
  { icon: "📮", label: "จบเคส" },
];

const GENERAL_STEPS: FlowStep[] = [
  { icon: "📥", label: "รับเรื่อง" },
  { icon: "🤖", label: "ตอบอัตโนมัติ" },
  { icon: "📮", label: "จบเคส" },
];

function flowFor(
  type: ReferralType,
  status: Status,
  hasAssignee: boolean,
): { steps: FlowStep[]; current: number; ended: boolean } {
  const ended =
    status === "Closed" ||
    status === "Rejected / Redirected" ||
    status === "Cancelled by Referrer";

  if (type === "TRANSPLANT_APPOINTMENT") {
    const current = ended ? 2 : status === "Appointment Confirmed" ? 1 : 0;
    return { steps: TRANSPLANT_STEPS, current, ended };
  }

  if (type === "GENERAL_OPD") {
    const current = ended ? 2 : status === "Auto Replied" ? 1 : 0;
    return { steps: GENERAL_STEPS, current, ended };
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
  return { steps: CONSULT_STEPS, current, ended };
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
  const { steps, current, ended } = flowFor(referralType, status, hasAssignee);
  const isConsult =
    referralType === "REGIMEN_CONSULT" || referralType === "CHEMO_ADMISSION";

  return (
    <div className="border-t border-zinc-100 pt-3">
      <div className="flex items-start gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => {
          const done = i < current;
          const isCurrent = i === current;
          // ขาต่อระหว่าง "รออาจารย์"(2) กับ "ตอบแล้ว"(3) ของเคสคำปรึกษา = วนได้
          const loopHere = isConsult && (i === 2 || i === 3);
          return (
            <div key={s.label} className="flex shrink-0 items-start gap-1">
              <div className="flex w-16 flex-col items-center gap-1">
                <div
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm " +
                    (done
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-zinc-100 text-zinc-400")
                  }
                >
                  {done ? "✓" : s.icon}
                </div>
                <span
                  className={
                    "text-center text-[11px] leading-tight " +
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
              {i < steps.length - 1 && (
                <div className="mt-2 flex shrink-0 flex-col items-center">
                  {loopHere && i === 2 && (
                    <span className="text-[11px] leading-none" aria-hidden>
                      🔄
                    </span>
                  )}
                  <div
                    className={
                      "mt-1 h-0.5 w-5 rounded sm:w-8 " +
                      (i < current ? "bg-emerald-400" : "bg-zinc-200")
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isConsult && !ended && (
        <p className="mt-1 text-[11px] text-zinc-500">
          🔄 ตอบแล้วยังไม่จบ — แพทย์ต้นทางถามเพิ่มได้ (วน รออาจารย์ ↔ ตอบแล้ว)
          เคสจบเมื่อกด &ldquo;ปิดเคส&rdquo; หรือแพทย์ต้นทางจบเอง ·
          คำตอบเพิ่มทุกครั้งต้องมีอาจารย์รับรอง
        </p>
      )}
    </div>
  );
}
