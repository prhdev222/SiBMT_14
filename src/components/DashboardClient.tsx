"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import {
  updateAssignedToAction,
  updateStatusAction,
} from "@/app/dashboard/actions";
import { DentThread } from "@/components/DentThread";
import { CaseFlowSteps } from "@/components/CaseFlowSteps";
import { downloadCsv, fileStamp, toCsv } from "@/lib/csv";
import {
  ALERT_COLOR,
  ALERT_LABEL_TH,
  DISEASE_GROUPS,
  DISEASE_GROUP_LABEL_TH,
  REFERRAL_TYPES_ORDERED,
  REFERRAL_TYPE_META,
  STATUSES,
  STATUSES_BY_TYPE,
  STATUS_COLOR,
  STATUS_LABEL_TH,
  alertLevelFor,
  isTerminal,
  businessDaysText,
  needsEmailFlag,
  type AlertLevel,
  type DiseaseGroup,
  type Referral,
  type ReferralType,
  type Status,
} from "@/lib/referral-types";

/** ระดับแจ้งเตือนคำนวณจากเวลาที่ค้าง ไม่ได้เก็บไว้ในข้อมูล */
function alertOf(r: Referral): AlertLevel {
  return alertLevelFor(r.elapsedBusinessHours, r.status);
}

/**
 * ส่งออกเคสที่กรองอยู่เป็น CSV
 *
 * ใช้ตัวช่วยกลางใน lib/csv.ts — เดิมมีสำเนาของตัวเองที่ไม่ได้ใส่ BOM
 * ทำให้ Excel อ่านภาษาไทยเป็นอักขระขยะ ส่วน Numbers กับ Google Sheets
 * แสดงถูก จึงไม่มีใครเจอจนกว่าจะมีคนเปิดด้วย Excel จริง
 */
const CSV_HEADERS = [
  "referral_id", "referral_type", "group_no", "submitted_at",
  "referrer_org", "referrer_phone", "disease_group", "status",
  "assigned_to", "elapsed_business_hours", "alert_level",
  "follow_up_date", "possible_duplicate_of",
];

function exportCsv(rows: Referral[]) {
  downloadCsv(
    `referrals-${fileStamp()}`,
    toCsv(
      CSV_HEADERS,
      rows.map((r) => [
        r.referralId,
        r.referralType,
        REFERRAL_TYPE_META[r.referralType].groupNumber,
        r.submittedAt,
        r.referrerOrg,
        r.referrerPhone,
        r.diseaseGroup ?? "",
        r.status,
        r.assignedTo ?? "",
        r.elapsedBusinessHours,
        alertOf(r),
        r.followUpDate ?? "",
        r.possibleDuplicateOf ?? "",
      ]),
    ),
  );
}

export function DashboardClient({
  referrals,
  residents,
  fellows,
  username,
  filesCaseIds = [],
}: {
  referrals: Referral[];
  residents: string[];
  /** รายชื่อ fellow (จากตารางออกตรวจ) — ผู้รับผิดชอบของเคสกลุ่ม 1 */
  fellows: string[];
  /** ชื่อผู้ล็อกอิน — ใช้เป็นชื่อผู้ส่งในบทสนทนา */
  username: string;
  /** referral_id ที่มีไฟล์แนบในบทสนทนา — ขึ้นป้าย 📎 ถาวร */
  filesCaseIds?: string[];
}) {
  const hasFile = useMemo(() => new Set(filesCaseIds), [filesCaseIds]);
  const [search, setSearch] = useState("");
  const [referralType, setReferralType] = useState<ReferralType | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [diseaseGroup, setDiseaseGroup] = useState<DiseaseGroup | "all">("all");
  const [assignedTo, setAssignedTo] = useState<string>("all");
  const [alertOnly, setAlertOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filesOnly, setFilesOnly] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [selected, setSelected] = useState<Referral | null>(null);

  /** สถานะที่เพิ่งแก้ฝั่ง client (เช่น กดปิดเคส) — เห็นผลทันทีไม่ต้องโหลดใหม่ */
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, Status>
  >({});
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const statusOf = (r: Referral): Status =>
    statusOverrides[r.referralId] ?? r.status;

  async function changeStatus(referralId: string, next: Status) {
    setStatusSaving(true);
    setStatusError(null);
    const result = await updateStatusAction(referralId, next);
    if (result.ok) {
      setStatusOverrides((prev) => ({ ...prev, [referralId]: next }));
    } else {
      setStatusError(result.error ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    setStatusSaving(false);
  }

  /**
   * ผู้รับผิดชอบที่เพิ่งแก้จาก dropdown — ข้อมูลหลักมาจาก server ตอนโหลดหน้า
   * เก็บ override ฝั่ง client ไว้ให้เห็นผลทันทีโดยไม่ต้องโหลดหน้าใหม่
   */
  const [assignedOverrides, setAssignedOverrides] = useState<
    Record<string, string | null>
  >({});
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const assignedOf = (r: Referral): string | null => {
    if (r.referralId in assignedOverrides) return assignedOverrides[r.referralId];
    if (r.assignedTo) return r.assignedTo;
    // เคสกลุ่ม 1 ตอนจองคิวเขียนชื่อ fellow ไว้ที่ fellow_assigned ไม่ใช่
    // assigned_to — ไม่ fallback ตรงนี้ตารางจะขึ้น "—" ทั้งที่มีเจ้าของคิวจริง
    if (r.referralType === "TRANSPLANT_APPOINTMENT" && r.fellowAssigned) {
      return r.fellowAssigned;
    }
    return null;
  };

  async function changeAssigned(referralId: string, value: string) {
    setAssignSaving(true);
    setAssignError(null);
    const result = await updateAssignedToAction(referralId, value);
    if (result.ok) {
      setAssignedOverrides((prev) => ({
        ...prev,
        [referralId]: value || null,
      }));
    } else {
      setAssignError(result.error ?? "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    setAssignSaving(false);
  }

  // เคสล่าสุด — ไม่ผ่านตัวกรองใด ๆ โดยเจตนา (ตัวกรองมีไว้ค้น ส่วนนี้มีไว้เห็นทันที)
  const [recentLimit, setRecentLimit] = useState(5);
  const recent = useMemo(
    () =>
      [...referrals]
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .slice(0, recentLimit),
    [referrals, recentLimit],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // เห็นเคสที่ปิดแล้วเมื่อกดสวิตช์ หรือเมื่อเลือกกรองสถานะ "ปิดเคสแล้ว" ตรง ๆ
    const wantClosed = showClosed || status === "Closed";
    return referrals.filter((r) => {
      const st = statusOf(r);
      if (!wantClosed && st === "Closed") return false;
      if (
        q &&
        !r.referralId.toLowerCase().includes(q) &&
        !r.referrerOrg.toLowerCase().includes(q)
      )
        return false;
      if (referralType !== "all" && r.referralType !== referralType)
        return false;
      if (status !== "all" && st !== status) return false;
      if (diseaseGroup !== "all" && r.diseaseGroup !== diseaseGroup)
        return false;
      if (assignedTo !== "all") {
        const holder = assignedOf(r);
        if (assignedTo === "unassigned" && holder !== null) return false;
        if (assignedTo !== "unassigned" && holder !== assignedTo)
          return false;
      }
      if (alertOnly && alertOf(r) === "none") return false;
      if (unreadOnly && !r.dentUnread) return false;
      if (filesOnly && !hasFile.has(r.referralId)) return false;
      return true;
    });
  }, [
    referrals,
    search,
    referralType,
    status,
    diseaseGroup,
    assignedTo,
    alertOnly,
    unreadOnly,
    filesOnly,
    hasFile,
    showClosed,
    statusOverrides,
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

  /**
   * รายชื่อผู้รับผิดชอบสำหรับ dropdown — ดึงจากเคสจริงที่มีอยู่
   *
   * ไม่ใช้รายชื่อตายตัวในโค้ด เพราะ resident และ fellow หมุนเวียนทุกปี
   * รายชื่อที่ล้าสมัยจะทำให้กรองไม่เจอคนที่มีเคสอยู่จริง
   */
  const assignees = useMemo(() => {
    // ผู้รับผิดชอบต่างกันตามกลุ่ม: กลุ่ม 1 = fellow, กลุ่ม 2/3 = resident
    // (มติผู้ใช้ 5 ก.ย. 2569 — เดิมโชว์ resident ปนแม้กรองกลุ่ม 1 อยู่)
    const roster =
      referralType === "TRANSPLANT_APPOINTMENT"
        ? fellows
        : referralType === "REGIMEN_CONSULT" || referralType === "CHEMO_ADMISSION"
          ? residents
          : [...residents, ...fellows];
    const names = new Set<string>(roster);
    for (const r of referrals) {
      if (referralType !== "all" && r.referralType !== referralType) continue;
      const holder = assignedOf(r);
      if (holder) names.add(holder);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "th"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referrals, residents, fellows, referralType, assignedOverrides]);

  /** จำนวนเคสที่ยังไม่จบ แยกตามกลุ่มงาน — ใช้ดูภาระงานแต่ละทีม */
  const openByType = useMemo(() => {
    const counts = {} as Record<ReferralType, number>;
    for (const type of REFERRAL_TYPES_ORDERED) counts[type] = 0;
    for (const r of referrals) {
      // "ยังไม่ปิด" = ยังไม่ถึงสถานะจบ — ต้องใช้ isTerminal ไม่ใช่เทียบ "Closed"
      // เพราะ "ส่งคำแนะนำกลับแล้ว"/"นัด OPD"/"ปฏิเสธ" ก็คือจบแล้วเช่นกัน
      // (บั๊ก 5 ก.ย. 2569: การ์ดนับเคสที่ตอบไปแล้วเป็น "ยังไม่ปิด")
      if (!isTerminal(statusOf(r))) counts[r.referralType] += 1;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referrals, statusOverrides]);

  /**
   * ตัวเลือกสถานะใน dropdown — กรองตามกลุ่มที่เลือก ให้เห็นเฉพาะสถานะที่กลุ่มนั้น
   * ใช้จริง (กลุ่ม 2/3 จะได้ไม่เห็น "จองคิว fellow"/"ยืนยันวันนัด" ของกลุ่ม 1)
   * เลือก "ทุกกลุ่มงาน" = เห็นทุกสถานะตามเดิม
   */
  const statusOptions = useMemo<Status[]>(() => {
    if (referralType === "all") return STATUSES;
    return STATUSES_BY_TYPE[referralType];
  }, [referralType]);

  // เปลี่ยนกลุ่มแล้วสถานะที่กรองไว้ไม่อยู่ในกลุ่มใหม่ — รีเซ็ตเป็น "ทั้งหมด"
  // กันกรณีกรองค้างจนตารางว่างเปล่าโดยไม่รู้สาเหตุ
  useEffect(() => {
    if (status !== "all" && !statusOptions.includes(status)) {
      setStatus("all");
    }
  }, [statusOptions, status]);

  return (
    <div className="space-y-6">
      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Case ทั้งหมด" value={stats.total} />
        <StatCard label="Red Alert (3 วันทำการ)" value={stats.red} tone="red" />
        <StatCard
          label="Yellow Alert (2 วันทำการ)"
          value={stats.yellow}
          tone="amber"
        />
        <StatCard label="ข้อมูลไม่ครบ" value={stats.incomplete} tone="red" />
        <StatCard label="สงสัยเคสซ้ำ" value={stats.duplicates} tone="amber" />
      </div>

      {/* workload per group — กลุ่ม 4 อัตโนมัติทั้งสาย เคสจบทันทีไม่มีงานค้าง
          การ์ดจะเป็น 0 ตลอดกาล ตัดออก (มติผู้ใช้ 5 ก.ย. 2569) */}
      <div className="grid gap-3 sm:grid-cols-3">
        {REFERRAL_TYPES_ORDERED.filter((t) => t !== "GENERAL_OPD").map((type) => {
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

      {/* เคสล่าสุด — "เมื่อกี้มีอะไรเข้ามา" โดยไม่ต้องตั้งตัวกรอง (คำขอผู้ใช้ 11 ก.ย. 2569)
          ทุกกลุ่ม ทุกสถานะ เรียงจากใหม่ไปเก่า · กดแล้วเปิดรายละเอียดเคสด้านล่าง */}
      <div className="rounded-xl bg-white border border-zinc-200 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-semibold text-zinc-900">
            <span className="mr-1" aria-hidden>🆕</span>
            เคสที่เข้ามาล่าสุด
          </h2>
          <button
            type="button"
            onClick={() => setRecentLimit((n) => (n >= 15 ? 5 : n + 5))}
            className="text-xs text-blue-600 hover:underline"
          >
            {recentLimit >= 15 ? "ย่อ" : `ดูเพิ่ม (${recentLimit} → ${recentLimit + 5})`}
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">ยังไม่มีเคสในระบบ</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {recent.map((r) => {
              const meta = REFERRAL_TYPE_META[r.referralType];
              const st = statusOf(r);
              const open = !isTerminal(st);
              return (
                <li key={r.referralId}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-left text-sm hover:bg-zinc-50 rounded-lg px-1"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${open ? "bg-green-500" : "bg-zinc-300"}`}
                      title={open ? "ยังเปิดอยู่" : "จบแล้ว"}
                    />
                    <span className="font-medium text-zinc-900 whitespace-nowrap">
                      {r.referralId}
                    </span>
                    <span className="text-zinc-500 whitespace-nowrap">
                      {meta.emoji} กลุ่ม {meta.groupNumber}
                    </span>
                    <span className="text-zinc-500 whitespace-nowrap tabular-nums">
                      {r.submittedAt}
                    </span>
                    <span className="text-zinc-600 truncate">{r.referrerOrg}</span>
                    <span className="ml-auto flex items-center gap-2">
                      {r.dentUnread && (
                        <span className="text-xs text-blue-600" title="มีข้อความใหม่จากแพทย์ต้นทาง">
                          💬
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 whitespace-nowrap">
                        {assignedOf(r) ?? "ยังไม่มอบหมาย"}
                      </span>
                      <Badge label={STATUS_LABEL_TH[st]} colorClass={STATUS_COLOR[st]} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* filters */}
      {/*
        min-w-0 บนทุกช่องเลือกไม่ใช่ของประดับ

        ช่อง select มีความกว้างตามธรรมชาติของมันเองตามตัวเลือกที่ยาวที่สุด
        และคอลัมน์ของ grid จะขยายตามนั้นเสมอถ้าไม่สั่ง min-w-0
        — บนจอ 375px ตัวเลือกภาษาไทยยาว ๆ ดันช่องกว้าง 376px จนหน้าเลื่อนซ้ายขวาได้
      */}
      <div className="rounded-xl bg-white border border-zinc-200 p-4 grid gap-3 sm:grid-cols-6">
        <input
          type="text"
          placeholder="ค้นหา referral ID หรือหน่วยงาน"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:col-span-2 w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          value={referralType}
          onChange={(e) =>
            setReferralType(e.target.value as ReferralType | "all")
          }
          className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">ทุกกลุ่มงาน</option>
          {/* กลุ่ม 4 อัตโนมัติทั้งสาย ไม่มีเคสให้ใครจัดการ — ตัดออกจากตัวกรอง
              (มติผู้ใช้ 5 ก.ย. 2569) เคสกลุ่ม 4 ยังเห็นได้ใน "ทุกกลุ่มงาน" */}
          {REFERRAL_TYPES_ORDERED.filter((t) => t !== "GENERAL_OPD").map((t) => (
            <option key={t} value={t}>
              กลุ่ม {REFERRAL_TYPE_META[t].groupNumber} —{" "}
              {REFERRAL_TYPE_META[t].titleTh}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "all")}
          className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">สถานะทั้งหมด</option>
          {statusOptions.map((s) => (
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
          className="w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">กลุ่มโรคทั้งหมด</option>
          {DISEASE_GROUPS.map((d) => (
            <option key={d} value={d}>
              {DISEASE_GROUP_LABEL_TH[d]}
            </option>
          ))}
        </select>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="sm:col-span-2 w-full min-w-0 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">ผู้รับผิดชอบทั้งหมด</option>
          <option value="unassigned">ยังไม่มอบหมาย</option>
          {assignees.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={alertOnly}
            onChange={(e) => setAlertOnly(e.target.checked)}
            className="rounded border-zinc-300"
          />
          แสดงเฉพาะเคสที่มีการแจ้งเตือน
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded border-zinc-300"
          />
          💬 เฉพาะเคสที่มีข้อความใหม่
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={filesOnly}
            onChange={(e) => setFilesOnly(e.target.checked)}
            className="rounded border-zinc-300"
          />
          📎 เฉพาะเคสที่มีไฟล์แนบ
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            className="rounded border-zinc-300"
          />
          แสดงเคสที่ปิดแล้ว (ข้อมูลเก่า)
        </label>

        <div className="sm:col-span-2 flex justify-end">
          <button
            onClick={() =>
              exportCsv(
                filtered.map((r) => ({ ...r, assignedTo: assignedOf(r) })),
              )
            }
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
                    <div className="flex flex-col items-start gap-1">
                      <Badge
                        label={STATUS_LABEL_TH[statusOf(r)]}
                        colorClass={STATUS_COLOR[statusOf(r)]}
                      />
                      {needsEmailFlag(r) && (
                        <Badge
                          label="⚠️ อีเมลยังไม่ยืนยัน"
                          colorClass="bg-yellow-100 text-yellow-800"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {assignedOf(r) ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      {r.dentUnread && (
                        <Badge
                          label="💬 ข้อความใหม่"
                          colorClass="bg-blue-100 text-blue-800"
                        />
                      )}
                      {hasFile.has(r.referralId) && (
                        <Badge
                          label="📎 มีไฟล์แนบ"
                          colorClass="bg-violet-100 text-violet-800"
                        />
                      )}
                      {alert === "none" ? (
                        !r.dentUnread &&
                        !hasFile.has(r.referralId) && (
                          <span className="text-zinc-400">—</span>
                        )
                      ) : (
                        <Badge
                          label={ALERT_LABEL_TH[alert]}
                          colorClass={ALERT_COLOR[alert]}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
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
            <Detail label="สถานะ" value={STATUS_LABEL_TH[statusOf(selected)]} />
            <div>
              <p className="text-zinc-500">ผู้รับผิดชอบ</p>
              <select
                value={assignedOf(selected) ?? ""}
                disabled={assignSaving}
                onChange={(e) => changeAssigned(selected.referralId, e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:bg-zinc-100"
              >
                <option value="">ยังไม่มอบหมาย</option>
                {(() => {
                  // เคสกลุ่ม 1 มอบให้ fellow / กลุ่มอื่นมอบให้ resident
                  const roster =
                    selected.referralType === "TRANSPLANT_APPOINTMENT"
                      ? fellows
                      : residents;
                  const current = assignedOf(selected);
                  return (
                    <>
                      {current && !roster.includes(current) && (
                        <option value={current}>
                          {current} (นอกรายชื่อปัจจุบัน)
                        </option>
                      )}
                      {roster.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </>
                  );
                })()}
              </select>
              {assignError && (
                <p className="mt-1 text-xs text-red-600">{assignError}</p>
              )}
            </div>
            <Detail
              label="เวลาที่ใช้ไป"
              value={`${businessDaysText(selected.elapsedBusinessHours)} (SLA ${businessDaysText(
                REFERRAL_TYPE_META[selected.referralType].slaBusinessHours,
              )})`}
            />
            <Detail label="วันติดตาม" value={selected.followUpDate ?? "—"} />
          </dl>

          {/* แถบสถานะแบบติดตามพัสดุ — เห็นทันทีว่าเคสอยู่ขั้นไหน */}
          <CaseFlowSteps
            referralType={selected.referralType}
            status={statusOf(selected)}
            hasAssignee={Boolean(assignedOf(selected))}
          />

          {/* ขั้นตอนต่อไป: ยังไม่ตอบ → ไปตอบ · ตอบแล้ว → ปิดเคส */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
            {!isTerminal(statusOf(selected)) &&
              (selected.referralType === "REGIMEN_CONSULT" ||
                selected.referralType === "CHEMO_ADMISSION") && (
                <Link
                  href={`/dashboard/review#${selected.referralId}`}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  ✍️ ไปตอบคำปรึกษา
                </Link>
              )}
            {statusOf(selected) === "Closed" ? (
              <>
                <button
                  onClick={() =>
                    changeStatus(selected.referralId, "Advice Sent")
                  }
                  disabled={statusSaving}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  เปิดเคสกลับ
                </button>
                <span className="text-xs text-zinc-500">
                  เคสนี้ปิดแล้ว — ซ่อนจากลิสต์หลัก
                </span>
              </>
            ) : (
              <>
                <button
                  onClick={() => changeStatus(selected.referralId, "Closed")}
                  disabled={statusSaving}
                  className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-50"
                >
                  {statusSaving ? "กำลังปิด…" : "ปิดเคส"}
                </button>
                <span className="text-xs text-zinc-500">
                  ปิดแล้วเคสจะหายจากลิสต์หลัก (ดูย้อนหลังได้)
                </span>
              </>
            )}
          </div>
          {statusError && (
            <p className="text-xs text-red-600">{statusError}</p>
          )}

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

          {/* ห้องเคส — ขอ/ส่งเอกสารเพิ่มเติมกับแพทย์ต้นทาง (ไม่ใช่ถาม-ตอบทั่วไป) */}
          <div className="border-t border-zinc-100 pt-3">
            <p className="mb-2 text-sm font-semibold text-zinc-900">
              📎 เอกสารเพิ่มเติม / ขอข้อมูลจากแพทย์ต้นทาง
            </p>
            <DentThread
              referralId={selected.referralId}
              senderName={assignedOf(selected) ?? username}
            />
          </div>
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
