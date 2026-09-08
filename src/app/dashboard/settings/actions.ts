"use server";

import { requireSession } from "@/lib/session";
import {
  checkStructure,
  deleteDocument,
  isBookingConfigured,
  protectHeaders,
  saveAttending,
  saveDocument,
  setAttendingActive,
  setConfig,
  setDocumentActive,
  unprotectHeaders,
} from "@/lib/apps-script-api";
import {
  loadAttendingRows,
  loadDocumentRows,
  type AttendingRow,
  type DocumentRow,
} from "@/lib/referral-repository";

type ActionResult = { ok: boolean; error?: string };

/** ห่อ action ที่เขียนชีต — กันไม่ให้ error ดิบหลุดไปหน้าจอ และบังคับ login */
async function runWrite(fn: () => Promise<unknown>): Promise<ActionResult> {
  await requireSession();
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

/**
 * ตรวจโครงสร้างชีต — ให้แอดมินกดหลังแก้ตารางในชีต เพื่อรู้ทันทีว่าหัวคอลัมน์/
 * โครงสร้างยังถูกต้องไหม ไม่ต้องรอ dashboard พังแล้วค่อยรู้
 */
export async function checkStructureAction(): Promise<{
  ok: boolean;
  problems?: string[];
  error?: string;
}> {
  await requireSession();
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }
  try {
    const result = await checkStructure();
    return { ok: true, problems: result.problems ?? [] };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "ตรวจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    };
  }
}

/** ล็อกหัวคอลัมน์ทุกแท็บ — กันการแก้หัวคอลัมน์โดยไม่ตั้งใจ ให้ระบบอ่านข้อมูลถูก */
export async function protectHeadersAction(): Promise<{
  ok: boolean;
  locked?: string[];
  error?: string;
}> {
  await requireSession();
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }
  try {
    const r = await protectHeaders();
    return { ok: true, locked: r.locked ?? [] };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "ล็อกไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

/** ปลดล็อกหัวคอลัมน์ */
export async function unprotectHeadersAction(): Promise<{
  ok: boolean;
  unlocked?: string[];
  error?: string;
}> {
  await requireSession();
  if (!isBookingConfigured()) {
    return { ok: false, error: "โหมดสาธิต — ยังไม่ได้เชื่อม Apps Script" };
  }
  try {
    const r = await unprotectHeaders();
    return { ok: true, unlocked: r.unlocked ?? [] };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "ปลดล็อกไม่สำเร็จ กรุณาลองใหม่",
    };
  }
}

/* ---------------- อาจารย์ที่ปรึกษา ---------------- */

/** โหลดรายชื่ออาจารย์ล่าสุด (รวมที่ปิดใช้งาน) — เรียกหลังบันทึกเพื่อรีเฟรช */
export async function refreshAttendingsAction(): Promise<AttendingRow[]> {
  await requireSession();
  return loadAttendingRows();
}

export async function saveAttendingAction(
  name: string,
  originalName: string,
): Promise<ActionResult> {
  return runWrite(() => saveAttending({ name, originalName }));
}

export async function setAttendingActiveAction(
  name: string,
  active: boolean,
): Promise<ActionResult> {
  return runWrite(() => setAttendingActive({ name, active }));
}

/* ---------------- คลังเอกสาร ---------------- */

/** โหลดเอกสารล่าสุด (รวมที่ซ่อน) — เรียกหลังบันทึกเพื่อรีเฟรช */
export async function refreshDocumentsAction(): Promise<DocumentRow[]> {
  await requireSession();
  return loadDocumentRows();
}

export async function saveDocumentAction(payload: {
  title: string;
  url: string;
  groups: string;
  description: string;
  originalTitle: string;
  originalUrl: string;
}): Promise<ActionResult> {
  return runWrite(() => saveDocument(payload));
}

export async function setDocumentActiveAction(
  title: string,
  url: string,
  active: boolean,
): Promise<ActionResult> {
  return runWrite(() => setDocumentActive({ title, url, active }));
}

export async function deleteDocumentAction(
  title: string,
  url: string,
): Promise<ActionResult> {
  return runWrite(() => deleteDocument({ title, url }));
}

/** เปิด/ปิด LINE push อัตโนมัติ (สวิตช์ line_push ในชีต config) */
export async function setLinePushAction(on: boolean): Promise<ActionResult> {
  return runWrite(() => setConfig({ key: "line_push", value: on ? "on" : "off" }));
}

/**
 * รหัสผูกกลุ่ม LINE (line_group_code ในชีต config) — พิมพ์ "ผูกกลุ่ม <รหัส>"
 * ในกลุ่ม LINE ที่เชิญบอทเข้าไป กลุ่มนั้นจะถามบอทและเข้า dashboard ได้
 */
export async function setLineGroupCodeAction(
  code: string,
): Promise<ActionResult> {
  const value = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(value)) {
    return {
      ok: false,
      error: "รหัสต้องเป็นตัวอักษรอังกฤษ/ตัวเลข 4-12 ตัว ไม่มีช่องว่าง",
    };
  }
  return runWrite(() => setConfig({ key: "line_group_code", value }));
}
