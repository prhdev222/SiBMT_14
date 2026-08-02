"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import {
  ALERT_COLOR,
  ALERT_LABEL_TH,
  DISEASE_GROUPS,
  DISEASE_GROUP_LABEL_TH,
  REFERRAL_TYPES_ORDERED,
  REFERRAL_TYPE_META,
  STAFF_MEMBERS,
  STATUSES,
  STATUS_COLOR,
  STATUS_LABEL_TH,
  URGENCY_COLOR,
  URGENCY_LABEL_TH,
  alertLevelFor,
  type AlertLevel,
  type DiseaseGroup,
  type Referral,
  type ReferralType,
  type Status,
  type Urgency,
} from "@/lib/referral-types";

const URGENCY_OPTIONS = Object.keys(URGENCY_LABEL_TH) as Urgency[];

/** ระดับแจ้งเตือนคำนวณจากเวลาที่ค้าง ไม่ได้เก็บไว้ในข้อมูล */
function alertOf(r: Referral): AlertLevel {
  return alertLevelFor(r.elapsedBusinessHours, r.status);
}

function toCsv(rows: Referral[]): string {
  const header = [
    "referral_id",
    "referral_type",
    "group_no",
    "submitted_at",
    "referrer_org",
    "referrer_phone",
    "disease_group",
    "urgency",
    "status",
    "assigned_to",
    "elapsed_business_hours",
    "alert_level",
    "follow_up_date",
    "possible_duplicate_of",
  ];
  const lines = rows.map((r) =>
    [
      r.referralId,
      r.referralType,
      REFERRAL_TYPE_META[r.referralType].groupNumber,
      r.submittedAt,
      r.referrerOrg,
      r.referrerPhone,
      r.diseaseGroup ?? "",
      r.urgency,
      r.status,
      r.assignedTo ?? "",
      r.elapsedBusinessHours,
      alertOf(r),
      r.followUpDate ?? "",
      r.possibleDuplicateOf ?? "",
    ]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function downloadCsv(rows: Referral[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `referrals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function DashboardClient({ referrals }: { referrals: Referral[] }) {
  const [search, setSearch] = useState("");
  const [referralType, setReferralType] = useState<ReferralType | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [diseaseGroup, setDiseaseGroup] = useState<DiseaseGroup | "all">("all");
  const [urgency, setUrgency] = useState<Urgency | "all">("all");
  const [assignedTo, setAssignedTo] = useState<string>("all");
  const [alertOnly, setAlertOnly] = useState(false);
  const [selected, setSelected] = useState<Referral | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return referrals.filter((r) => {
      if (
        q &&
        !r.referralId.toLowerCase().includes(q) &&
        !r.referrerOrg.toLowerCase().includes(q)
      )
        return false;
      if (referralType !== "all" && r.referralType !== referralType)
        return false;
      if (status !== "all" && r.status !== status) return false;
      if (diseaseGroup !== "all" && r.diseaseGroup !== diseaseGroup)
        return false;
      if (urgency !== "all" && r.urgency !== urgency) return false;
      if (assignedTo !== "all") {
        if (assignedTo === "unassigned" && r.assignedTo !== null) return false;
        if (assignedTo !== "unassigned" && r.assignedTo !== assignedTo)
          return false;
      }
      if (alertOnly && alertOf(r) === "none") return false;
      return true;
    });
  }, [
    referrals,
    search,
    referralType,
    status,
    diseaseGroup,
    urgency,
    assignedTo,
    alertOnly,
  ]);

  const stats = useMemo(() => {
    const red = referrals.filter((r) => alertOf(r) === "red").length;
    const yellow = referrals.filter((r) => alertOf(r) === "yellow").length;
    const incomplete = referrals.filter(
      (r) => r.status === "Incomplete",
    ).length;
    const duplicates = referrals.filter(
      (r) => r.possibleDuplicateOf !== null,
    ).length;
    return { total: referrals.length, red, yellow, incomplete, duplicates };
  }, [referrals]);

  /** จำนวนเคสที่ยังไม่จบ แยกตามกลุ่มงาน — ใช้ดูภาระงานแต่ละทีม */
  const openByType = useMemo(() => {
    const counts = {} as Record<ReferralType, number>;
    for (const type of REFERRAL_TYPES_ORDERED) counts[type] = 0;
    for (const r of referrals) {
      if (r.status !== "Closed") counts[r.referralType] += 1;
    }
    return counts;
  }, [referrals]);

  return (
    <div className="space-y-6">
      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Case ทั้งหมด" value={stats.total} />
        <StatCard label="Red Alert (48 ชม.)" value={stats.red} tone="red" />
        <StatCard
          label="Yellow Alert (24 ชม.)"
          value={stats.yellow}
          tone="amber"
        />
        <StatCard label="ข้อมูลไม่ครบ" value={stats.incomplete} tone="red" />
        <StatCard label="สงสัยเคสซ้ำ" value={stats.duplicates} tone="amber" />
      </div>

      {/* workload per group */}
      <div className="grid gap-3 sm:grid-cols-4">
        {REFERRAL_TYPES_ORDERED.map((type) => {
          const meta = REFERRAL_TYPE_META[type];
          const active = referralType === type;
          return (
            <button
              key={type}
              onClick={() => setReferralType(active ? "all" : type)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active
                  ? "border-blue-500 bg-blue-50"
                  : "border-zinc-200 bg-white hover:border-zinc-400"
              }`}
            >
              <p className="text-xs text-zinc-500">
                <span className="mr-1">{meta.emoji}</span>
                กลุ่มที่ {meta.groupNumber}
              </p>
              <p className="text-sm font-medium text-zinc-800 mt-0.5 line-clamp-2">
                {meta.titleTh}
              </p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">
                {openByType[type]}
                <span className="text-xs font-normal text-zinc-500 ml-1">
                  เคสที่ยังไม่ปิด
                </span>
              </p>
            </button>
          );
        })}
      </div>

      {/* filters */}
      <div className="rounded-xl bg-white border border-zinc-200 p-4 grid gap-3 sm:grid-cols-6">
        <input
          type="text"
          placeholder="ค้นหา referral ID หรือหน่วยงาน"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          value={referralType}
          onChange={(e) =>
            setReferralType(e.target.value as ReferralType | "all")
          }
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">ทุกกลุ่มงาน</option>
          {REFERRAL_TYPES_ORDERED.map((t) => (
            <option key={t} value={t}>
              กลุ่ม {REFERRAL_TYPE_META[t].groupNumber} —{" "}
              {REFERRAL_TYPE_META[t].titleTh}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "all")}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">สถานะทั้งหมด</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL_TH[s]}
            </option>
          ))}
        </select>
        <select
          value={diseaseGroup}
          onChange={(e) =>
            setDiseaseGroup(e.target.value as DiseaseGroup | "all")
          }
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">กลุ่มโรคทั้งหมด</option>
          {DISEASE_GROUPS.map((d) => (
            <option key={d} value={d}>
              {DISEASE_GROUP_LABEL_TH[d]}
            </option>
          ))}
        </select>
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as Urgency | "all")}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">ความเร่งด่วนทั้งหมด</option>
          {URGENCY_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {URGENCY_LABEL_TH[u]}
            </option>
          ))}
        </select>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="sm:col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">ผู้รับผิดชอบทั้งหมด</option>
          <option value="unassigned">ยังไม่มอบหมาย</option>
          {STAFF_MEMBERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={alertOnly}
            onChange={(e) => setAlertOnly(e.target.checked)}
            className="rounded border-zinc-300"
          />
          แสดงเฉพาะเคสที่มีการแจ้งเตือน
        </label>

        <div className="sm:col-span-2 flex justify-end">
          <button
            onClick={() => downloadCsv(filtered)}
            className="rounded-md bg-zinc-900 text-white text-sm px-4 py-2 font-medium hover:bg-zinc-700"
          >
            Export CSV ({filtered.length} รายการ)
          </button>
        </div>
      </div>

      {/* table */}
      <div className="rounded-xl bg-white border border-zinc-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Referral ID</th>
              <th className="px-4 py-3 font-medium">กลุ่ม</th>
              <th className="px-4 py-3 font-medium">วันที่ส่ง</th>
              <th className="px-4 py-3 font-medium">หน่วยงานผู้ส่ง</th>
              <th className="px-4 py-3 font-medium">ความเร่งด่วน</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">ผู้รับผิดชอบ</th>
              <th className="px-4 py-3 font-medium">แจ้งเตือน</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const alert = alertOf(r);
              const meta = REFERRAL_TYPE_META[r.referralType];
              return (
                <tr
                  key={r.referralId}
                  onClick={() => setSelected(r)}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    {r.referralId}
                    {r.possibleDuplicateOf && (
                      <span
                        title={`อาจซ้ำกับ ${r.possibleDuplicateOf}`}
                        className="ml-1.5 text-amber-600"
                      >
                        ⧉
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    <span className="mr-1">{meta.emoji}</span>
                    กลุ่ม {meta.groupNumber}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {r.submittedAt}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{r.referrerOrg}</td>
                  <td className="px-4 py-3">
                    <Badge
                      label={URGENCY_LABEL_TH[r.urgency]}
                      colorClass={URGENCY_COLOR[r.urgency]}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      label={STATUS_LABEL_TH[r.status]}
                      colorClass={STATUS_COLOR[r.status]}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {r.assignedTo ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {alert === "none" ? (
                      <span className="text-zinc-400">—</span>
                    ) : (
                      <Badge
                        label={ALERT_LABEL_TH[alert]}
                        colorClass={ALERT_COLOR[alert]}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                  ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* case detail */}
      {selected && (
        <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-3">
          <div className="flex items-start justify-between">
            <h2 className="font-semibold text-zinc-900">
              รายละเอียด {selected.referralId}
            </h2>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-zinc-400 hover:text-zinc-700"
            >
              ปิด
            </button>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Detail
              label="กลุ่มงาน"
              value={`กลุ่มที่ ${
                REFERRAL_TYPE_META[selected.referralType].groupNumber
              } — ${REFERRAL_TYPE_META[selected.referralType].titleTh}`}
            />
            <Detail
              label="ผู้ดูแลตามกลุ่ม"
              value={REFERRAL_TYPE_META[selected.referralType].handlerTh}
            />
            <Detail label="วันที่ส่ง" value={selected.submittedAt} />
            <Detail label="หน่วยงานผู้ส่ง" value={selected.referrerOrg} />
            <Detail
              label="เบอร์ติดต่อกลับแพทย์ต้นทาง"
              value={selected.referrerPhone}
            />
            <Detail
              label="กลุ่มโรค"
              value={
                selected.diseaseGroup
                  ? DISEASE_GROUP_LABEL_TH[selected.diseaseGroup]
                  : "ยังไม่ระบุ"
              }
            />
            <Detail
              label="ความเร่งด่วน"
              value={URGENCY_LABEL_TH[selected.urgency]}
            />
            <Detail label="สถานะ" value={STATUS_LABEL_TH[selected.status]} />
            <Detail
              label="ผู้รับผิดชอบ"
              value={selected.assignedTo ?? "ยังไม่มอบหมาย"}
            />
            <Detail
              label="เวลาที่ใช้ไป"
              value={`${selected.elapsedBusinessHours} ชั่วโมงทำการ (SLA ${
                REFERRAL_TYPE_META[selected.referralType].slaBusinessHours
              } ชม.)`}
            />
            <Detail label="วันติดตาม" value={selected.followUpDate ?? "—"} />
          </dl>

          {selected.possibleDuplicateOf && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
              ระบบตรวจพบว่าอาจเป็นเคสเดียวกับ{" "}
              <span className="font-medium">{selected.possibleDuplicateOf}</span>{" "}
              — กรุณาตรวจสอบก่อนดำเนินการต่อ
            </div>
          )}

          {selected.note && (
            <div className="text-sm">
              <p className="text-zinc-500">หมายเหตุ</p>
              <p className="text-zinc-800">{selected.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "red" | "amber";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "amber"
        ? "text-amber-600"
        : "text-zinc-900";
  return (
    <div className="rounded-xl bg-white border border-zinc-200 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="text-zinc-800 font-medium">{value}</p>
    </div>
  );
}
