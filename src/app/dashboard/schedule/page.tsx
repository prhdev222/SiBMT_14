import Link from "next/link";
import {
  loadFellowSchedule,
  loadFellows,
  loadReferrals,
  loadTransplantIndications,
  type FellowScheduleSource,
} from "@/lib/referral-repository";
import { canWriteSchedule } from "@/lib/google-sheets";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import {
  buildSchedule,
  filterMonth,
  formatMonthTh,
  monthsAvailable,
  type ScheduleDay,
} from "@/lib/fellow-schedule";
import { ScheduleCalendar, type DayBooking } from "./ScheduleCalendar";
import { indicationLabel } from "@/lib/transplant-indications";

export const dynamic = "force-dynamic";

/**
 * เดือนที่ให้เลือกได้
 *
 * โหมดอ่านอย่างเดียวแสดงเฉพาะเดือนที่มีตารางอยู่แล้ว
 * แต่ถ้ากรอกได้ ต้องเดินไปข้างหน้าได้ล่วงหน้าทั้งปีการศึกษา
 * ไม่งั้นเดือนที่ยังว่างจะกดเข้าไปไม่ได้เลย
 */
function monthOptions(scheduleMonths: string[], canEdit: boolean): string[] {
  if (!canEdit) return scheduleMonths;

  const now = new Date();
  const ahead: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    ahead.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return [...new Set([...scheduleMonths, ...ahead])].sort();
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession("/dashboard/schedule");

  const { month } = await searchParams;
  const [{ referrals }, source, fellows, indications] = await Promise.all([
    loadReferrals(),
    loadFellowSchedule(),
    loadFellows(),
    loadTransplantIndications(),
  ]);

  const canEdit = canWriteSchedule();
  const schedule = buildSchedule(source.days, referrals);
  const months = monthOptions(monthsAvailable(schedule), canEdit);
  const selected =
    month && months.includes(month)
      ? month
      : months.includes(currentMonth())
        ? currentMonth()
        : months[0];
  const daysThisMonth = selected ? filterMonth(schedule, selected) : [];

  /**
   * เคสที่นัดไว้ แยกตามวันที่ — ส่งให้ปฏิทินไว้แสดงตอนกดเลือกวัน
   *
   * เอาเฉพาะที่ยังยืนยันนัดอยู่ เคสที่ยกเลิกแล้วไม่ต้องแสดง เพราะคิวคืนไปแล้ว
   * และ fellow ไม่ต้องเตรียมตัวสำหรับคนที่ไม่มา
   */
  const indicationName = new Map(indications.map((i) => [i.id, i.diseaseTh]));
  const bookings: Record<string, DayBooking[]> = {};
  for (const r of referrals) {
    if (r.referralType !== "TRANSPLANT_APPOINTMENT") continue;
    if (r.status !== "Appointment Confirmed") continue;
    if (!r.appointmentDate) continue;

    (bookings[r.appointmentDate] ??= []).push({
      referralId: r.referralId,
      fellowName: r.fellowAssigned ?? "—",
      diagnosis: r.diagnosis,
      indicationTh:
        indicationName.get(r.transplantIndication) ??
        indicationLabel(r.transplantIndication),
      referrerOrg: r.referrerOrg,
      referrerName: r.referrerName,
      referrerPhone: r.referrerPhone,
    });
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />

      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">กลุ่มที่ 1 — ปลูกถ่ายเซลล์ต้นกำเนิด</p>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
              ตารางออกตรวจ Fellow และคิวว่าง
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
          >
            กลับ Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
        {source.skippedRows > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">
              มี {source.skippedRows} แถวในชีตที่ระบบใช้ไม่ได้
            </p>
            <p className="mt-1">
              มักเกิดจาก <code className="rounded bg-amber-100 px-1">clinic_date</code>{" "}
              ไม่ใช่รูปแบบวันที่ หรือ{" "}
              <code className="rounded bg-amber-100 px-1">fellow_name</code> ว่าง
              — แถวเหล่านี้จะไม่ขึ้นบนปฏิทิน
            </p>
          </div>
        )}

        {!canEdit && source.days.length === 0 ? (
          <EmptyState source={source} />
        ) : (
          <>
            {source.days.length === 0 && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900">
                ยังไม่มีตารางออกตรวจ — คลิกวันที่ในปฏิทินด้านล่างเพื่อเริ่มกรอกได้เลย
              </div>
            )}
            <MonthPicker months={months} selected={selected!} />
            <Legend canEdit={canEdit} />
            <ScheduleCalendar
              key={selected}
              yearMonth={selected!}
              days={daysThisMonth}
              fellows={fellows}
              bookings={bookings}
              canEdit={canEdit}
            />
            <Summary days={daysThisMonth} />
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ source }: { source: FellowScheduleSource }) {
  // แยกให้ชัดว่าติดตรงไหน — ทั้งสามกรณีหน้าตาเหมือนกันหมดถ้าไม่บอก
  const diagnosis = source.error
    ? {
        title: "อ่านชีตไม่สำเร็จ",
        body: `ระบบเปิดชีต fellow_schedule ไม่ได้ — มักเป็นเพราะยังไม่ได้รัน setupSheets() ใน Apps Script จึงยังไม่มีชีตนี้`,
        detail: source.error,
      }
    : source.rawRowCount === 0
      ? {
          title: "มีชีตแล้ว แต่ยังไม่ได้กรอกข้อมูล",
          body: "ชีต fellow_schedule ถูกสร้างเรียบร้อยแล้ว เหลือเพียงกรอกตารางออกตรวจ",
          detail: null,
        }
      : {
          title: "กรอกข้อมูลแล้ว แต่ระบบใช้ไม่ได้สักแถว",
          body: `อ่านได้ ${source.rawRowCount} แถว แต่ไม่มีแถวใดที่มีทั้งวันที่ที่ถูกต้องและชื่อ fellow`,
          detail: null,
        };

  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-6 text-sm text-zinc-600 space-y-3">
      <h2 className="font-semibold text-zinc-900 text-base">{diagnosis.title}</h2>
      <p>{diagnosis.body}</p>
      {diagnosis.detail && (
        <p className="font-mono text-xs text-red-700 break-all bg-red-50 border border-red-200 rounded p-2">
          {diagnosis.detail}
        </p>
      )}

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <p className="font-semibold text-blue-900">กรอกตารางได้ที่ไหน</p>
        <p className="text-blue-900/80 mt-1">
          ตอนนี้หน้านี้ยัง<strong>แสดงผลอย่างเดียว</strong> เพราะยังไม่ได้ตั้งค่า{" "}
          <code className="rounded bg-blue-100 px-1">GOOGLE_SCHEDULE_SHEET_ID</code>{" "}
          — ตารางเวรต้องอยู่ในไฟล์ Google Sheet คนละไฟล์กับข้อมูลผู้ป่วย
          เพื่อให้เว็บเขียนตารางเวรได้โดยไม่ต้องมีสิทธิ์แตะข้อมูลผู้ป่วย
          ดูขั้นตอนใน docs/DEPLOYMENT.md แล้วตรวจด้วย{" "}
          <code className="rounded bg-blue-100 px-1">node scripts/setup-schedule-sheet.mjs</code>
        </p>

        <ol className="mt-3 ml-4 list-decimal space-y-1 text-blue-900/80">
          <li>สร้าง Google Sheet ไฟล์ใหม่ (อย่าใช้ไฟล์เดียวกับข้อมูลผู้ป่วย)</li>
          <li>กด Share แชร์ไฟล์ให้อีเมล service account แบบ <strong>Editor</strong></li>
          <li>
            ใส่ ID ของไฟล์เป็น{" "}
            <code className="rounded bg-blue-100 px-1">GOOGLE_SCHEDULE_SHEET_ID</code>
          </li>
          <li>
            รัน{" "}
            <code className="rounded bg-blue-100 px-1">
              node scripts/setup-schedule-sheet.mjs
            </code>{" "}
            — สร้างแท็บและหัวตารางให้เอง แล้วตรวจว่าเขียนได้จริง
          </li>
        </ol>
      </div>

      <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
        <p className="font-medium text-zinc-800 mb-1.5">
          รูปแบบข้อมูล — หนึ่งแถวต่อ fellow หนึ่งท่านต่อวันออกตรวจ
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="pr-6 pb-1 text-left font-medium">clinic_date</th>
                <th className="pr-6 pb-1 text-left font-medium">fellow_name</th>
                <th className="pr-6 pb-1 text-left font-medium">max_slots</th>
                <th className="pr-6 pb-1 text-left font-medium">start_time</th>
                <th className="pb-1 text-left font-medium">end_time</th>
              </tr>
            </thead>
            <tbody className="font-mono text-zinc-700">
              <tr>
                <td className="pr-6">2026-08-05</td>
                <td className="pr-6">พญ. สุดา</td>
                <td className="pr-6">2</td>
                <td className="pr-6">09:00</td>
                <td>12:00</td>
              </tr>
              <tr>
                <td className="pr-6">2026-08-05</td>
                <td className="pr-6">นพ. ธนกร</td>
                <td className="pr-6">2</td>
                <td className="pr-6">13:00</td>
                <td>16:00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-zinc-500">
        เว้น <code className="rounded bg-zinc-100 px-1 py-0.5">max_slots</code> ว่างไว้
        ระบบจะใช้ค่าเริ่มต้น 2 คนต่อ fellow ต่อวันตามที่กำหนดไว้ในโครงการ
      </p>
    </div>
  );
}

function MonthPicker({ months, selected }: { months: string[]; selected: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {months.map((m) => (
        <Link
          key={m}
          href={`/dashboard/schedule?month=${m}`}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${
            m === selected
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
          }`}
        >
          {formatMonthTh(m)}
        </Link>
      ))}
    </div>
  );
}

function Legend({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-green-300 bg-green-50" />
        ยังนัดได้
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-zinc-300 bg-zinc-200" />
        เต็มแล้ว — ให้นัด fellow ท่านอื่นหรือวันอื่น
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-zinc-200 bg-white" />
        ไม่มีคลินิก
      </span>
      {canEdit && (
        <span className="text-blue-700 font-medium">คลิกวันที่เพื่อแก้ตาราง</span>
      )}
    </div>
  );
}

function Summary({ days }: { days: ScheduleDay[] }) {
  const clinicDays = days.length;
  const openDays = days.filter((d) => !d.allFull).length;
  const totalSlots = days.reduce(
    (sum, d) => sum + d.fellows.reduce((s, f) => s + f.maxSlots, 0),
    0,
  );
  const booked = days.reduce(
    (sum, d) => sum + d.fellows.reduce((s, f) => s + f.booked, 0),
    0,
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat label="วันที่มีคลินิก" value={clinicDays} />
      <Stat label="วันที่ยังนัดได้" value={openDays} />
      <Stat label="คิวทั้งหมด" value={totalSlots} />
      <Stat
        label="นัดไปแล้ว"
        value={booked}
        tone={booked >= totalSlots ? "full" : undefined}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "full";
}) {
  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`text-2xl font-bold mt-1 tabular-nums ${
          tone === "full" ? "text-amber-600" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
