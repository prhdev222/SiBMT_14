import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import {
  loadResidentSchedule,
  loadResidents,
  type ResidentShift,
} from "@/lib/referral-repository";
import { DutyEditor } from "./DutyEditor";
import { SessionBar } from "@/components/SessionBar";
import { PageHeader } from "@/components/PageHeader";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "เวร resident/fellow นวม.23 — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/** วันนี้ตามเวลาไทยเป็น ISO — เซิร์ฟเวอร์ Cloudflare เดินเวลา UTC จะเหลื่อม 7 ชม. */
function todayBangkokIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date());
}

type ShiftPhase = "current" | "upcoming" | "past";

function phaseOf(shift: ResidentShift, today: string): ShiftPhase {
  if (shift.toDate < today) return "past";
  if (shift.fromDate > today) return "upcoming";
  return "current";
}

/**
 * ตารางเวร Chief resident ผู้ตอบคำปรึกษากลุ่ม 2/3
 *
 * คู่กันกับ "ตารางออกตรวจ Fellow" ของกลุ่ม 1 — ดูว่าใครอยู่เวร (กี่คน)
 * แก้/แลกเวรได้จากหน้านี้เลย และดึงตารางชุดใหม่จาก HSOS ได้ด้วยปุ่ม
 * (sync เป็นแบบสั่งเองเท่านั้น — ไม่มี trigger กลางคืนมาเขียนทับของที่แก้มือ)
 */
export default async function DutyPage() {
  const session = await requireSession("/dashboard/duty");
  const [shifts, residents] = await Promise.all([
    loadResidentSchedule(),
    loadResidents(),
  ]);
  const today = todayBangkokIso();

  const current = shifts.filter((s) => phaseOf(s, today) === "current");
  const upcoming = shifts.filter((s) => phaseOf(s, today) === "upcoming");
  const past = shifts.filter((s) => phaseOf(s, today) === "past");

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />
      <PageHeader
        eyebrow="กลุ่มที่ 2 และ 3 — ตอบคำปรึกษา"
        title="เวร resident/fellow นวม.23"
        links={[
          { href: "/dashboard/schedule", label: "ตารางออกตรวจ Fellow" },
          { href: "/dashboard", label: "กลับ Dashboard", muted: true },
        ]}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        {shifts.length === 0 ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-900 space-y-2">
            <p className="font-semibold">ยังไม่มีตารางเวรในระบบ</p>
            <p>
              กดปุ่มด้านล่างเพื่อดึงตารางเวรจาก HSOS หรือเพิ่มช่วงเวรเอง —
              ถ้ายังว่างหลังดึง ให้ตรวจว่ากรอกเวร resident/fellow ใน HSOS แล้ว
            </p>
            <DutyEditor shifts={[]} residents={residents} />
          </div>
        ) : (
          <>
            {/* เวรตอนนี้ — คำตอบของคำถาม "วันนี้ใครรับเคส และมีกี่คน" */}
            <section className="rounded-xl bg-green-50 border-2 border-green-600 p-5">
              <h2 className="font-bold text-green-900">
                เวรตอนนี้ — {current.length} คน
              </h2>
              {current.length === 0 ? (
                <p className="text-sm text-green-900/80 mt-1">
                  ⚠️ ช่วงนี้ไม่มีชื่อเวรในตาราง — เคสใหม่จะไม่ถูกมอบหมายอัตโนมัติ
                  กรุณาเติมเวรใน HSOS แล้ว sync
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {current.map((s, i) => (
                    <li
                      key={`${s.name}|${s.fromDate}|${i}`}
                      className="flex flex-wrap items-baseline gap-x-3 text-sm"
                    >
                      <span className="font-semibold text-green-950 text-base">
                        {s.name}
                      </span>
                      <span className="text-green-900/80">
                        {formatThaiDate(s.fromDate)} – {formatThaiDate(s.toDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl bg-white border border-zinc-200 p-5 space-y-3">
              <div>
                <h2 className="font-semibold text-zinc-900">
                  จัดการช่วงเวร (ปัจจุบันและถัดไป)
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  แลกเวรกัน = กด &ldquo;แก้ / แลกเวร&rdquo; แล้วเปลี่ยนชื่อหรือวันที่ —
                  การแก้ที่นี่อยู่ถาวร ไม่มีอะไรมาเขียนทับเอง
                </p>
              </div>
              <DutyEditor shifts={[...current, ...upcoming]} residents={residents} />
            </section>

            {past.length > 0 && (
              <details className="group rounded-xl bg-white border border-zinc-200 p-5">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden font-semibold text-zinc-900">
                  เวรที่ผ่านมา ({past.length} ช่วง)
                  <span className="ml-2 text-sm font-normal text-zinc-400 group-open:hidden">
                    กดเพื่อดู
                  </span>
                </summary>
                <ShiftTable shifts={[...past].reverse()} muted />
              </details>
            )}
          </>
        )}

        <p className="text-xs text-zinc-500">
          ตารางตั้งต้นมาจาก HSOS — ปุ่ม &ldquo;🔄 ดึงตารางจาก HSOS&rdquo;
          เขียนทับทั้งชุด (มี confirm ก่อน) ส่วนการแก้/แลกเวรในหน้านี้อยู่ถาวร
          · เคสกลุ่ม 2/3 ใหม่ถูกมอบหมายให้เวรช่วงนั้นโดยอัตโนมัติ
          (หลายคน = วนตามลำดับ)
        </p>
      </main>
    </div>
  );
}

function ShiftTable({
  shifts,
  muted = false,
}: {
  shifts: ResidentShift[];
  muted?: boolean;
}) {
  return (
    <table className={`mt-3 w-full text-sm ${muted ? "text-zinc-500" : "text-zinc-800"}`}>
      <thead>
        <tr className="text-left text-xs text-zinc-500">
          <th className="pb-2 font-medium">ช่วงเวร</th>
          <th className="pb-2 font-medium">resident / fellow</th>
        </tr>
      </thead>
      <tbody>
        {shifts.map((s) => (
          <tr key={s.name + s.fromDate} className="border-t border-zinc-100">
            <td className="py-2 whitespace-nowrap">
              {formatThaiDate(s.fromDate)} – {formatThaiDate(s.toDate)}
            </td>
            <td className="py-2 font-medium">{s.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
