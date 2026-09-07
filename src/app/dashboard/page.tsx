import { DashboardClient } from "@/components/DashboardClient";
import { SessionBar } from "@/components/SessionBar";
import { PageHeader } from "@/components/PageHeader";
import {
  loadConfigValues,
  loadFellows,
  loadReferrals,
  loadReferralIdsWithFiles,
  loadResidents,
} from "@/lib/referral-repository";
import { requireSession } from "@/lib/session";

/**
 * ข้อมูลต้องสดเสมอ ไม่ cache — เจ้าหน้าที่ต้องเห็นสถานะปัจจุบัน
 * ตาม NFR-002 ที่กำหนดให้เห็นเคสใหม่ภายใน 10 วินาทีหลังส่งฟอร์ม
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // ตรวจก่อนโหลดข้อมูล — ไม่มี proxy.ts แล้ว ด่านนี้คือด่านเดียว
  const session = await requireSession("/dashboard");

  const [
    { referrals, isSampleData, error },
    config,
    residents,
    fellows,
    filesCaseIds,
  ] = await Promise.all([
    loadReferrals(),
    loadConfigValues(),
    loadResidents(),
    loadFellows(),
    loadReferralIdsWithFiles(),
  ]);

  return (
    <div className="flex flex-col flex-1 bg-zinc-50">
      <SessionBar username={session.username} />

        <PageHeader
          eyebrow="สำหรับบุคลากรภายใน"
          title="Dashboard — Referral Queue"
          links={[
            { href: "/dashboard/appointments", label: "นัดกลุ่มที่ 1" },
            { href: "/dashboard/review", label: "ตอบคำปรึกษา" },
            { href: "/dashboard/opd", label: "นัดตรวจ OPD" },
            { href: "/dashboard/stats", label: "สถิติและรายงาน" },
            { href: "/dashboard/schedule", label: "ตารางออกตรวจ Fellow" },
            { href: "/dashboard/duty", label: "เวร resident/fellow" },
            { href: "/dashboard/line-groups", label: "กลุ่ม LINE/Telegram" },
            { href: "/dashboard/settings", label: "ตั้งค่า" },
            { href: "/", label: "กลับหน้าแรก", muted: true },
          ]}
        />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">อ่านข้อมูลจาก Google Sheet ไม่สำเร็จ</p>
            <p className="mt-1">
              ข้อมูลที่แสดงด้านล่างเป็นข้อมูลตัวอย่าง ไม่ใช่เคสจริง
              กรุณาแจ้งผู้ดูแลระบบ
            </p>
            <p className="mt-1 font-mono text-xs text-red-700 break-all">
              {error}
            </p>
          </div>
        )}

        {!error && isSampleData && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">กำลังแสดงข้อมูลตัวอย่าง</span> —
            ยังไม่ได้เชื่อมต่อ Google Sheet ตั้งค่า environment variable
            ตามขั้นตอนใน docs/DEPLOYMENT.md เพื่อใช้ข้อมูลจริง
          </div>
        )}

        <DashboardClient
          referrals={referrals}
          residents={residents}
          fellows={fellows}
          username={session.username}
          filesCaseIds={filesCaseIds}
        />

        <ResponsibleContacts config={config} />
      </main>
    </div>
  );
}

/**
 * ผู้รับผิดชอบระบบ — อ่านจากชีต `config` ไม่ได้ฝังในโค้ด
 *
 * แสดงไว้ให้เจ้าหน้าที่รู้ว่าเคสค้างต้องแจ้งใคร และเพื่อให้เห็นชัดว่า
 * ช่องไหนยังไม่ได้กรอก โดยเฉพาะผู้สำรองของแอดมินกลางซึ่งเป็น
 * จุดเสี่ยงเดียวที่เหลืออยู่ของ escalation matrix
 */
function ResponsibleContacts({ config }: { config: Record<string, string> }) {
  const rows = [
    { label: "แพทย์แอดมินกลาง", name: config["central_admin_name"], contact: config["central_admin_contact"], critical: true },
    { label: "ผู้สำรองแอดมินกลาง", name: config["central_admin_backup_name"], contact: config["central_admin_backup_contact"], critical: true },
    { label: "ผู้ดูแลคลังสูตรยา", name: config["template_library_owner"], contact: "" },
    { label: "ผู้กรอกตารางออกตรวจ fellow", name: config["fellow_schedule_owner"], contact: "" },
  ];

  const missingCritical = rows.filter((r) => r.critical && !r.name);
  const hasSheet = Object.keys(config).length > 0;

  return (
    <section className="rounded-xl bg-white border border-zinc-200 p-5">
      <h2 className="font-semibold text-zinc-900 text-sm">ผู้รับผิดชอบระบบ</h2>
      <p className="text-xs text-zinc-500 mt-0.5">
        แก้ไขได้ที่ชีต <code className="rounded bg-zinc-100 px-1">config</code>{" "}
        โดยไม่ต้องแก้โค้ด
      </p>

      {!hasSheet ? (
        <p className="mt-3 text-sm text-zinc-500">
          ยังไม่ได้เชื่อมชีต <code className="rounded bg-zinc-100 px-1">config</code>{" "}
          — รัน <code className="rounded bg-zinc-100 px-1">setupSheets()</code> ใน Apps Script
        </p>
      ) : (
        <>
          {missingCritical.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
              ยังไม่ได้ระบุ{" "}
              <span className="font-medium">
                {missingCritical.map((r) => r.label).join(" และ ")}
              </span>{" "}
              — ต้องมีก่อนเปิดใช้จริง มิฉะนั้นเคสที่ค้างครบ 3 วันทำการจะไม่มีผู้รับแจ้ง
            </div>
          )}

          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="text-sm">
                <dt className="text-zinc-500 text-xs">{r.label}</dt>
                <dd
                  className={
                    r.name ? "text-zinc-800 font-medium" : "text-amber-700"
                  }
                >
                  {r.name || "— ยังไม่ได้ระบุ —"}
                  {r.contact && (
                    <span className="font-normal text-zinc-500"> · {r.contact}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
