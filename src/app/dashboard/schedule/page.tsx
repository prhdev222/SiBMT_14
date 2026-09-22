import Link from "next/link";
import { MonthNav } from "./MonthNav";
import {
  loadFellowSchedule,
  loadFellows,
  loadReferrals,
  loadTransplantIndications,
  type FellowScheduleSource,
} from "@/lib/referral-repository";
import { isGroup1BookingDbConfigured } from "@/lib/group1-booking-db";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import { PageHeader } from "@/components/PageHeader";
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

  const canEdit = isGroup1BookingDbConfigured();
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

        <PageHeader
          eyebrow="ตารางออกตรวจ — ปลูกถ่ายเซลล์ต้นกำเนิด"
          title="ตารางออกตรวจ Fellow และคิวว่าง"
          width="max-w-5xl"
          links={[
            { href: "/dashboard", label: "กลับ Dashboard" },
          ]}
        />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
        {source.skippedRows > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">
              มี {source.skippedRows} รายการในฐานข้อมูลที่ระบบใช้ไม่ได้
            </p>
            <p className="mt-1">
              มักเกิดจากข้อมูลวันที่หรือชื่อ fellow ไม่ครบ
              ไม่ใช่รูปแบบวันที่ หรือ{" "}
              — รายการเหล่านี้จะไม่ขึ้นบนปฏิทิน
            </p>
          </div>
        )}

        {!canEdit && source.days.length === 0 ? (
          <EmptyState source={source} canEdit={canEdit} />
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

function EmptyState({ source, canEdit }: { source: FellowScheduleSource; canEdit: boolean }) {
  const diagnosis = source.error
    ? {
        title: "อ่านฐานข้อมูลไม่สำเร็จ",
        body: "ตรวจสอบ GROUP1_DATABASE_URL และ GROUP1_DATABASE_AUTH_TOKEN",
        detail: source.error,
      }
    : source.rawRowCount === 0
      ? {
        title: "ยังไม่มีตารางออกตรวจ",
        body: "เพิ่มตารางออกตรวจจากปุ่มเพิ่มวันด้านล่าง",
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

      {!canEdit ? (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-900/80">
          <p className="font-semibold text-blue-900">ตั้งค่าฐานข้อมูลก่อนกรอกตาราง</p>
          <p className="mt-1">ตารางออกตรวจและรายการนัดใช้ Turso/libSQL ฐานข้อมูลเดียวกัน ไม่ใช้ Google Sheet</p>
          <p className="mt-2">ตั้งค่า <code className="rounded bg-blue-100 px-1">GROUP1_DATABASE_URL</code> และ <code className="rounded bg-blue-100 px-1">GROUP1_DATABASE_AUTH_TOKEN</code> ใน Cloudflare Worker แล้วเปิดหน้านี้ใหม่</p>
        </div>
      ) : (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-900/80">
          ตารางนี้ใช้ Turso/libSQL แล้ว ให้เลือกเดือนและคลิกวันที่ในปฏิทินเพื่อเพิ่มวันออกตรวจและกำหนดจำนวนคิว
        </div>
      )}
      <p className="text-zinc-500">รูปแบบข้อมูลในฐานข้อมูล: วันที่ออกตรวจ, ชื่อ Fellow, จำนวนคิว, เวลาเริ่ม และเวลาสิ้นสุด</p>
    </div>
  );
}

function MonthPicker({ months, selected }: { months: string[]; selected: string }) {
  // ป้ายเดือนไทย format ฝั่ง server แล้วส่งให้ client — MonthNav ไม่ต้องรู้วิธีแปลง
  const labels: Record<string, string> = {};
  for (const m of months) labels[m] = formatMonthTh(m);

  return (
    <>
      {/* มือถือ: ลูกศรเลื่อนทีละเดือน + dropdown (ดูเหตุผลใน MonthNav.tsx) */}
      <div className="sm:hidden">
        <MonthNav months={months} selected={selected} formatLabel={labels} />
      </div>

      {/* desktop: เม็ดเดือนเห็นครบทุกเดือนเหมือนเดิม */}
      <div className="hidden sm:flex flex-wrap gap-2">
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
    </>
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
