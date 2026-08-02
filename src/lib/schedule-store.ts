/**
 * แก้ตารางออกตรวจ fellow โดยเขียนลง Google Sheets ตรง ๆ
 *
 * เดิมคำสั่งเหล่านี้วิ่งผ่าน Apps Script Web App เพราะตารางเวรอยู่ไฟล์เดียว
 * กับข้อมูลผู้ป่วย และสิทธิ์ของ Sheets จำกัดเป็นรายแท็บไม่ได้
 * วัดแล้วพบว่า Apps Script ใช้เวลา 1–10 วินาทีต่อครั้ง (cold start)
 * เทียบกับ Sheets API ตรง ๆ ที่ราว 400 มิลลิวินาที
 *
 * พอย้ายตารางเวรไปไฟล์ของตัวเอง ข้อจำกัดนั้นก็หมดไป — service account
 * เป็น Editor เฉพาะไฟล์ตารางเวร ส่วนไฟล์ข้อมูลผู้ป่วยยังเป็น Viewer
 *
 * ⚠️ server-only — ห้าม import จาก client component
 */

import {
  appendRows,
  deleteRow,
  readSheetRows,
  scheduleSpreadsheetId,
  updateValues,
} from "./google-sheets";
import { DEFAULT_SLOTS_PER_FELLOW } from "./fellow-schedule";

const FELLOWS_SHEET = "fellows";
const SCHEDULE_SHEET = "fellow_schedule";

/** คอลัมน์ต้องเรียงตรงกับหัวตารางในชีต — ดู apps-script/Config.gs */
const FELLOWS_COLUMNS = ["fellow_name", "active", "note"] as const;
const SCHEDULE_COLUMNS = [
  "clinic_date",
  "fellow_name",
  "max_slots",
  "note",
  "start_time",
  "end_time",
] as const;

function requireFileId(): string {
  const id = scheduleSpreadsheetId();
  if (!id) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า GOOGLE_SCHEDULE_SHEET_ID — ดูวิธีสร้างไฟล์ตารางเวรใน docs/DEPLOYMENT.md",
    );
  }
  return id;
}

/**
 * เรียงค่าตามลำดับหัวตารางจริงในชีต ไม่ใช่ลำดับที่เราคิดเอง
 *
 * ถ้าใครสลับคอลัมน์ในชีตแล้วเรายังเขียนตามตำแหน่งตายตัว ข้อมูลจะลงผิดช่อง
 * แบบเงียบ ๆ — อ่านหัวตารางมาก่อนเสมอจึงปลอดภัยกว่า
 */
async function rowFor(
  sheetName: string,
  values: Record<string, string>,
  fallbackOrder: readonly string[],
): Promise<string[]> {
  const headers = await readHeaders(sheetName, fallbackOrder);
  return headers.map((header) => values[header] ?? "");
}

async function readHeaders(
  sheetName: string,
  fallbackOrder: readonly string[],
): Promise<string[]> {
  const rows = await readSheetRows(sheetName, requireFileId());
  // ชีตที่ยังไม่มีข้อมูลอ่านหัวตารางไม่ได้ ใช้ลำดับมาตรฐานแทน
  if (rows.length === 0) return [...fallbackOrder];
  return Object.keys(rows[0]);
}

/* ------------------------------------------------------------------ */
/* รายชื่อ fellow                                                       */
/* ------------------------------------------------------------------ */

function isActive(row: Record<string, string>): boolean {
  const active = (row["active"] ?? "").trim().toLowerCase();
  // เว้นว่างถือว่ายังใช้งาน — ต้องพิมพ์ no ถึงจะปิด
  return active !== "no" && active !== "ไม่" && active !== "false";
}

export async function listFellows(): Promise<string[]> {
  const rows = await readSheetRows(FELLOWS_SHEET, requireFileId());
  return rows
    .filter((row) => (row["fellow_name"] ?? "").trim() && isActive(row))
    .map((row) => row["fellow_name"].trim());
}

export async function addFellow(name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("กรุณากรอกชื่อ");

  const fileId = requireFileId();
  const rows = await readSheetRows(FELLOWS_SHEET, fileId);

  const existing = rows.findIndex(
    (row) => (row["fellow_name"] ?? "").trim() === clean,
  );

  if (existing !== -1) {
    if (isActive(rows[existing])) {
      throw new Error(`มีชื่อ "${clean}" อยู่แล้ว`);
    }
    // เคยปิดไว้แล้วเพิ่มใหม่ = ตั้งใจเปิดกลับ ไม่ใช่สร้างแถวซ้ำ
    await setActive(fileId, rows, existing, "yes");
    return;
  }

  await appendRows(fileId, FELLOWS_SHEET, [
    await rowFor(
      FELLOWS_SHEET,
      { fellow_name: clean, active: "yes" },
      FELLOWS_COLUMNS,
    ),
  ]);
}

export async function deactivateFellow(name: string): Promise<void> {
  const clean = name.trim();
  const fileId = requireFileId();
  const rows = await readSheetRows(FELLOWS_SHEET, fileId);

  const index = rows.findIndex(
    (row) => (row["fellow_name"] ?? "").trim() === clean,
  );
  if (index === -1) throw new Error(`ไม่พบชื่อ "${clean}"`);

  await setActive(fileId, rows, index, "no");
}

async function setActive(
  fileId: string,
  rows: Record<string, string>[],
  index: number,
  value: string,
): Promise<void> {
  const headers = Object.keys(rows[0]);
  const column = headers.indexOf("active");
  if (column === -1) throw new Error('ชีต fellows ไม่มีคอลัมน์ "active"');

  // แถวแรกของชีตเป็นหัวตาราง ข้อมูลแถวแรกจึงอยู่แถวที่ 2
  const cell = `${FELLOWS_SHEET}!${columnLetter(column)}${index + 2}`;
  await updateValues(fileId, cell, [[value]]);
}

/** 0 → A, 25 → Z, 26 → AA */
function columnLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/* ------------------------------------------------------------------ */
/* วันออกตรวจ                                                          */
/* ------------------------------------------------------------------ */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** รับเฉพาะ HH:mm — ค่าอื่นถือว่าไม่ได้ระบุเวลา */
function cleanTime(value: string): string {
  const raw = value.trim();
  return TIME_PATTERN.test(raw) ? raw : "";
}

export interface AddClinicDaysInput {
  fellowName: string;
  /** yyyy-MM-dd */
  startDate: string;
  repeatWeeks: number;
  maxSlots: number;
  note: string;
  startTime: string;
  endTime: string;
}

/**
 * เพิ่มวันออกตรวจ รองรับการทำซ้ำรายสัปดาห์
 *
 * การกรอกตารางทั้งปีการศึกษาทีละวันเป็นงานที่ทรมาน จึงรับจำนวนสัปดาห์
 * เพื่อสร้างทั้งเทอมได้ในครั้งเดียว และข้ามวันที่มีอยู่แล้วของ fellow คนเดิม
 * เพื่อให้กดซ้ำได้โดยไม่เกิดแถวซ้ำ
 */
export async function addClinicDays(
  input: AddClinicDaysInput,
): Promise<{ added: number; skipped: number }> {
  const fellowName = input.fellowName.trim();
  const startDate = input.startDate.trim();
  const startTime = cleanTime(input.startTime);
  const endTime = cleanTime(input.endTime);

  if (!fellowName) throw new Error("กรุณาเลือกชื่อ fellow");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
  }
  if (startTime && endTime && endTime <= startTime) {
    throw new Error("เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
  }

  const slots = Number.isFinite(input.maxSlots) && input.maxSlots > 0
    ? Math.min(Math.floor(input.maxSlots), 10)
    : DEFAULT_SLOTS_PER_FELLOW;
  const weeks = Math.max(1, Math.min(52, Math.floor(input.repeatWeeks) || 1));

  const fileId = requireFileId();
  const existingRows = await readSheetRows(SCHEDULE_SHEET, fileId);
  const taken = new Set(
    existingRows.map(
      (row) =>
        `${normaliseDate(row["clinic_date"])}|${(row["fellow_name"] ?? "").trim()}`,
    ),
  );

  const headers =
    existingRows.length > 0
      ? Object.keys(existingRows[0])
      : [...SCHEDULE_COLUMNS];

  const [year, month, day] = startDate.split("-").map(Number);
  const rows: string[][] = [];
  let skipped = 0;

  for (let week = 0; week < weeks; week++) {
    const date = new Date(year, month - 1, day + week * 7);
    const iso =
      `${date.getFullYear()}-` +
      `${String(date.getMonth() + 1).padStart(2, "0")}-` +
      `${String(date.getDate()).padStart(2, "0")}`;

    if (taken.has(`${iso}|${fellowName}`)) {
      skipped++;
      continue;
    }

    const values: Record<string, string> = {
      clinic_date: iso,
      fellow_name: fellowName,
      max_slots: String(slots),
      note: input.note.trim(),
      start_time: startTime,
      end_time: endTime,
    };
    rows.push(headers.map((header) => values[header] ?? ""));
  }

  await appendRows(fileId, SCHEDULE_SHEET, rows);
  return { added: rows.length, skipped };
}

/** ค่าที่คนพิมพ์เองในชีตอาจมาเป็น 8/5/2026 ต้องเทียบในรูปแบบเดียวกัน */
function normaliseDate(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}-` +
    `${String(date.getDate()).padStart(2, "0")}`
  );
}

/**
 * ลบวันออกตรวจหนึ่งแถว
 *
 * ตรวจก่อนว่าแถวนั้นยังเป็นแถวที่หน้าจอเห็นตอนกด เพราะเลขแถวจะเลื่อน
 * เมื่อมีคนแทรกหรือลบแถวในชีต แล้วการลบตามเลขเปล่า ๆ จะไปลบเวรของคนอื่น
 */
export async function removeClinicDay(input: {
  rowNumber: number;
  clinicDate: string;
  fellowName: string;
}): Promise<void> {
  const fileId = requireFileId();
  const rows = await readSheetRows(SCHEDULE_SHEET, fileId);

  const index = input.rowNumber - 2;
  const row = rows[index];

  if (
    !row ||
    normaliseDate(row["clinic_date"]) !== input.clinicDate.trim() ||
    (row["fellow_name"] ?? "").trim() !== input.fellowName.trim()
  ) {
    throw new Error("ข้อมูลในชีตเปลี่ยนไปแล้ว — กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง");
  }

  await deleteRow(fileId, SCHEDULE_SHEET, input.rowNumber);
}
