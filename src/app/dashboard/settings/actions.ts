"use server";

import { requireSession } from "@/lib/session";
import {
  checkStructure,
  isBookingConfigured,
  protectHeaders,
  unprotectHeaders,
} from "@/lib/apps-script-api";

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

/** ล็อกหัวคอลัมน์ทุกแท็บ — กันแอดมินใหม่แก้หัวคอลัมน์แล้วระบบพัง */
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
