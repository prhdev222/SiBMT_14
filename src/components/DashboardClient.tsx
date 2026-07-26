"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import {
  DISEASE_GROUP_LABEL_TH,
  MOCK_REFERRALS,
  STAFF_MEMBERS,
  STATUS_COLOR,
  STATUS_LABEL_TH,
  URGENCY_COLOR,
  URGENCY_LABEL_TH,
  type DiseaseGroup,
  type Referral,
  type Status,
  type Urgency,
} from "@/lib/mock-referrals";

const STATUS_OPTIONS = Object.keys(STATUS_LABEL_TH) as Status[];
const DISEASE_GROUP_OPTIONS = Object.keys(
  DISEASE_GROUP_LABEL_TH,
) as DiseaseGroup[];
const URGENCY_OPTIONS = Object.keys(URGENCY_LABEL_TH) as Urgency[];

function toCsv(rows: Referral[]): string {
  const header = [
    "referral_id",
    "submitted_at",
    "referrer_org",
    "disease_group",
    "urgency",
    "status",
    "assigned_to",
    "sla_overdue",
    "follow_up_date",
  ];
  const lines = rows.map((r) =>
    [
      r.referralId,
      r.submittedAt,
      r.referrerOrg,
      r.diseaseGroup,
      r.urgency,
      r.status,
      r.assignedTo ?? "",
      r.slaOverdue ? "yes" : "no",
      r.followUpDate ?? "",
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

export function DashboardClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "all">("all");
  const [diseaseGroup, setDiseaseGroup] = useState<DiseaseGroup | "all">(
    "all",
  );
  const [urgency, setUrgency] = useState<Urgency | "all">("all");
  const [assignedTo, setAssignedTo] = useState<string>("all");
  const [slaOnly, setSlaOnly] = useState(false);
  const [selected, setSelected] = useState<Referral | null>(null);

  const filtered = useMemo(() => {
    return MOCK_REFERRALS.filter((r) => {
      if (
        search &&
        !r.referralId.toLowerCase().includes(search.toLowerCase()) &&
        !r.referrerOrg.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (status !== "all" && r.status !== status) return false;
      if (diseaseGroup !== "all" && r.diseaseGroup !== diseaseGroup)
        return false;
      if (urgency !== "all" && r.urgency !== urgency) return false;
      if (assignedTo !== "all") {
        if (assignedTo === "unassigned" && r.assignedTo !== null)
          return false;
        if (assignedTo !== "unassigned" && r.assignedTo !== assignedTo)
          return false;
      }
      if (slaOnly && !r.slaOverdue) return false;
      return true;
    });
  }, [search, status, diseaseGroup, urgency, assignedTo, slaOnly]);

  const stats = useMemo(() => {
    const total = MOCK_REFERRALS.length;
    const incomplete = MOCK_REFERRALS.filter(
      (r) => r.status === "Incomplete",
    ).length;
    const overdue = MOCK_REFERRALS.filter((r) => r.slaOverdue).length;
    const unassigned = MOCK_REFERRALS.filter(
      (r) => r.assignedTo === null && r.status !== "Closed",
    ).length;
    return { total, incomplete, overdue, unassigned };
  }, []);

  return (
    <div className="space-y-6">
      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Case ทั้งหมด" value={stats.total} />
        <StatCard label="ข้อมูลไม่ครบ" value={stats.incomplete} tone="red" />
        <StatCard label="ค้างเกิน SLA" value={stats.overdue} tone="red" />
        <StatCard label="ยังไม่มอบหมาย" value={stats.unassigned} tone="amber" />
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
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "all")}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">สถานะทั้งหมด</option>
          {STATUS_OPTIONS.map((s) => (
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
          {DISEASE_GROUP_OPTIONS.map((d) => (
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
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
            checked={slaOnly}
            onChange={(e) => setSlaOnly(e.target.checked)}
            className="rounded border-zinc-300"
          />
          แสดงเฉพาะที่ค้างเกิน SLA
        </label>

        <div className="sm:col-span-4 flex justify-end">
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
              <th className="px-4 py-3 font-medium">วันที่ส่ง</th>
              <th className="px-4 py-3 font-medium">หน่วยงานผู้ส่ง</th>
              <th className="px-4 py-3 font-medium">กลุ่มโรค</th>
              <th className="px-4 py-3 font-medium">ความเร่งด่วน</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">ผู้รับผิดชอบ</th>
              <th className="px-4 py-3 font-medium">SLA</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.referralId}
                onClick={() => setSelected(r)}
                className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                  {r.referralId}
                </td>
                <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                  {r.submittedAt}
                </td>
                <td className="px-4 py-3 text-zinc-600">{r.referrerOrg}</td>
                <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                  {DISEASE_GROUP_LABEL_TH[r.diseaseGroup]}
                </td>
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
                  {r.slaOverdue ? (
                    <Badge label="เกิน SLA" colorClass="bg-red-100 text-red-800" />
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-zinc-400"
                >
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
            <Detail label="วันที่ส่ง" value={selected.submittedAt} />
            <Detail label="หน่วยงานผู้ส่ง" value={selected.referrerOrg} />
            <Detail
              label="กลุ่มโรค"
              value={DISEASE_GROUP_LABEL_TH[selected.diseaseGroup]}
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
              label="วันติดตาม"
              value={selected.followUpDate ?? "—"}
            />
          </dl>
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
