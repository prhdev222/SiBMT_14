import Link from "next/link";
import {
  loadFellowSchedule,
  loadReferrals,
} from "@/lib/referral-repository";
import {
  buildSchedule,
  dayOfMonth,
  filterMonth,
  formatMonthTh,
  monthsAvailable,
  type ScheduleDay,
} from "@/lib/fellow-schedule";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const [{ referrals }, clinicDays] = await Promise.all([
    loadReferrals(),
    loadFellowSchedule(),
  ]);

  const schedule = buildSchedule(clinicDays, referrals);
  const months = monthsAvailable(schedule);
  const selected = month && months.includes(month) ? month : months[0];
  const daysThisMonth = selected ? filterMonth(schedule, selected) : [];

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
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
        {clinicDays.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <MonthPicker months={months} selected={selected!} />
            <Legend />
            <MonthGrid yearMonth={selected!} days={daysThisMonth} />
            <Summary days={daysThisMonth} />
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-6 text-sm text-zinc-600 space-y-3">
      <h2 className="font-semibold text-zinc-900 text-base">ยังไม่มีตารางออกตรวจ</h2>
      <p>
        แพทย์แอดมินกลางต้องกรอกตารางออกตรวจของ fellow ลงในชีต{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5">fellow_schedule</code>{" "}
        ล่วงหน้าทั้งปีการศึกษา
      </p>
      <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
        <p className="font-medium text-zinc-800 mb-1.5">รูปแบบข้อมูล — หนึ่งแถวต่อ fellow หนึ่งท่านต่อวันออกตรวจ</p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="pr-6 pb-1 text-left font-medium">clinic_date</th>
                <th className="pr-6 pb-1 text-left font-medium">fellow_name</th>
                <th className="pr-6 pb-1 text-left font-medium">max_slots</th>
                <th className="pb-1 text-left font-medium">note</th>
              </tr>
            </thead>
            <tbody className="font-mono text-zinc-700">
              <tr>
                <td className="pr-6">2026-08-05</td>
                <td className="pr-6">พญ. สุดา</td>
                <td className="pr-6">2</td>
                <td>—</td>
              </tr>
              <tr>
                <td className="pr-6">2026-08-05</td>
                <td className="pr-6">นพ. ธนกร</td>
                <td className="pr-6">2</td>
                <td>—</td>
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

function MonthPicker({
  months,
  selected,
}: {
  months: string[];
  selected: string;
}) {
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

function Legend() {
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
    </div>
  );
}

/** สร้างช่องปฏิทินทั้งเดือน โดยเริ่มสัปดาห์ที่วันจันทร์ */
function buildCells(yearMonth: string, days: ScheduleDay[]) {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  // getDay(): 0 = อาทิตย์ → แปลงให้จันทร์ = 0
  const leading = (first.getDay() + 6) % 7;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const pad = (n: number) => String(n).padStart(2, "0");

  const cells: ({ date: string; day: ScheduleDay | undefined } | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    cells.push({ date, day: byDate.get(date) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function MonthGrid({
  yearMonth,
  days,
}: {
  yearMonth: string;
  days: ScheduleDay[];
}) {
  const cells = buildCells(yearMonth, days);

  return (
    <div className="rounded-xl bg-white border border-zinc-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium text-zinc-500"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={i} className="min-h-24 border-b border-r border-zinc-100 bg-zinc-50/50" />;
          }

          const { date, day } = cell;
          const isWeekend = i % 7 >= 5;

          return (
            <div
              key={date}
              className={`min-h-24 border-b border-r border-zinc-100 p-1.5 ${
                day?.allFull ? "bg-zinc-100" : isWeekend ? "bg-zinc-50/50" : "bg-white"
              }`}
            >
              <p
                className={`text-xs font-medium mb-1 ${
                  day?.allFull ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                {dayOfMonth(date)}
              </p>

              <div className="space-y-1">
                {day?.fellows.map((f) => (
                  <div
                    key={f.fellowName}
                    title={f.note || undefined}
                    className={`rounded px-1.5 py-1 text-[11px] leading-tight border ${
                      f.isFull
                        ? "border-zinc-300 bg-zinc-200 text-zinc-500"
                        : "border-green-300 bg-green-50 text-green-900"
                    }`}
                  >
                    <p className="font-medium truncate">{f.fellowName}</p>
                    <p className="tabular-nums">
                      {f.isFull ? "เต็ม" : `ว่าง ${f.remaining}`} ({f.booked}/
                      {f.maxSlots})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
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
      <Stat label="นัดไปแล้ว" value={booked} tone={booked >= totalSlots ? "full" : undefined} />
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
