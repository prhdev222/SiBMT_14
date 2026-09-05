"use server";

import { requireSession } from "@/lib/session";
import { checkStructure, isBookingConfigured } from "@/lib/apps-script-api";

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
