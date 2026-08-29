import Link from "next/link";
import type { Metadata } from "next";
import { loadReferrals } from "@/lib/referral-repository";
import { requireSession } from "@/lib/session";
import { SessionBar } from "@/components/SessionBar";
import { CONTACT } from "@/lib/config";
import { formatThaiDate } from "@/lib/thai-date";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "นัดตรวจ OPD โลหิตวิทยา — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/**
 * ผู้ป่วยกลุ่มที่ 3 ที่ resident นัดมาประเมินความพร้อมที่ OPD 700
 *
 * ⚠️ คนละเรื่องกับหน้า /dashboard/appointments ซึ่งเป็นคิว fellow ปลูกถ่ายของกลุ่ม 1
 * ที่นี่ไม่มีโควตาและไม่มีตารางเวร — resident พิมพ์วันนัดเองตอนตอบคำปรึกษา
 *
 * เป็นหน้าอ่านอย่างเดียว การแก้วันนัดต้องแก้ในชีต เพราะคำตอบที่ส่งอีเมล
 * ออกไปแล้วเขียนวันนัดไว้ การให้แก้จากหน้านี้จะทำให้สองที่ไม่ตรงกันเงียบ ๆ
 */
export default async function OpdVisitsPage() {
  const session = await requireSession("/dashboard/opd");
  const { referrals, isSampleData } = await loadReferrals();

  const todayIso = toIso(new Date());

  const visits = referrals
    .filter(
      (r) =>
        r.referralType === "CHEMO_ADMISSION" &&
        r.status === "Readiness Visit Scheduled" &&
        r.appointmentDate,
    )
    .sort((a, b) =>
      (a.appointmentDate ?? "").localeCompare(b.appointmentDate ?? ""),
    );

  const upcoming = visits.filter((v) => (v.appointmentDate ?? "") >= todayIso);
  const past = visits.filter((v) => (v.appointmentDate ?? "") < todayIso);

  // จัดกลุ่มตามวัน — resident อ่านเป็น "พรุ่งนี้มีกี่ราย" ไม่ใช่ไล่ทีละเคส
  const byDate = new Map<string, typeof upcoming>();
  for (const v of upcoming) {
    const date = v.appointmentDate ?? "";
    const list = byDate.get(date);
    if (list) list.push(v);
    else byDate.set(date, [v]);
  }

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />

      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">กลุ่มที่ 3</p>
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900">
              นัดตรวจ OPD โลหิตวิทยา
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

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
        {isSampleData && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">กำลังแสดงข้อมูลตัวอย่าง</span> —
            ยังไม่ได้ต่อ Google Sheet จริง
          </p>
        )}

        {upcoming.length === 0 ? (
          <div className="rounded-xl bg-white border border-zinc-200 p-8 text-center">
            <p className="text-lg font-semibold text-zinc-900">
              ยังไม่มีนัดที่กำลังจะถึง
            </p>
            <p className="text-sm text-zinc-600 mt-1">
              นัดจะขึ้นที่นี่เมื่อตอบคำปรึกษาด้วยสถานะ
              &ldquo;นัดมาประเมินความพร้อมที่ OPD&rdquo; และกรอกวันเวลาแล้ว
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-600">
              มีนัดที่กำลังจะถึง{" "}
              <span className="font-semibold text-zinc-900">
                {upcoming.length}
              </span>{" "}
              ราย ใน {byDate.size} วัน
            </p>

            {[...byDate.entries()].map(([date, cases]) => (
              <section
                key={date}
                className="rounded-xl bg-white border border-zinc-200 overflow-hidden"
              >
                <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2.5 flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold text-zinc-900">
                    {formatThaiDate(date, true)}
                    {date === todayIso && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        วันนี้
                      </span>
                    )}
                  </h2>
                  <span className="shrink-0 text-sm text-zinc-500 tabular-nums">
                    {cases.length} ราย
                  </span>
                </div>

                <ul className="divide-y divide-zinc-100">
                  {cases.map((c) => (
                    <li key={c.referralId} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900">
                            {c.appointmentNote || "ไม่ได้ระบุเวลา"}
                          </p>
                          <p className="font-mono text-xs text-zinc-500 mt-0.5">
                            {c.referralId}
                          </p>
                        </div>
                        {/* เบอร์ต้องกดโทรได้ทันที — จุดประสงค์หลักของหน้านี้
                            คือโทรถามข้อมูลเพิ่มก่อนวันที่ผู้ป่วยมา */}
                        {c.referrerPhone && c.referrerPhone !== "—" && (
                          <a
                            href={`tel:${c.referrerPhone}`}
                            className="shrink-0 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
                          >
                            📞 {c.referrerPhone}
                          </a>
                        )}
                      </div>

                      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-sm mt-2">
                        <Row label="การวินิจฉัย" value={c.diagnosis} />
                        <Row label="กลุ่มโรค" value={c.diseaseGroup} />
                        <Row label="สิทธิการรักษา" value={c.insuranceScheme} />
                        <Row label="โรคร่วม" value={c.comorbidity} />
                        <Row
                          label="ส่งมาจาก"
                          value={
                            c.referrerName
                              ? `${c.referrerOrg} (${c.referrerName})`
                              : c.referrerOrg
                          }
                        />
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}

        {past.length > 0 && (
          <details className="rounded-xl bg-white border border-zinc-200 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-zinc-700">
              นัดที่ผ่านไปแล้ว {past.length} ราย
            </summary>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-500">
              {past.map((c) => (
                <li key={c.referralId} className="flex gap-2">
                  <span className="tabular-nums shrink-0">
                    {formatThaiDate(c.appointmentDate ?? "")}
                  </span>
                  <span className="truncate">
                    {c.diagnosis || c.diseaseGroup} · {c.referrerOrg}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="rounded-lg bg-zinc-100 border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
          <p className="font-medium text-zinc-800">แก้วันนัดที่นี่ไม่ได้</p>
          <p className="mt-1">
            วันนัดถูกส่งไปในอีเมลถึงแพทย์ต้นทางแล้ว
            และแพทย์ต้นทางเขียนไว้บนหัวกระดาษใบ refer —
            การแก้ต้องแก้ในชีตและโทรแจ้งแพทย์ต้นทางเอง
            ไม่งั้นสองที่จะไม่ตรงกันโดยไม่มีใครรู้
          </p>
        </div>

        <p className="text-xs text-zinc-500 text-center pt-2">
          ติดต่อ OPD 700 โทร {CONTACT.phoneDisplay} ({CONTACT.hoursTh})
        </p>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-800 min-w-0">{value}</dd>
    </div>
  );
}

function toIso(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  );
}
