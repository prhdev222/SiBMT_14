/**
 * เรียก Apps Script เพื่อแก้ตารางออกตรวจ fellow
 *
 * เว็บไม่ได้เขียนชีตเอง — ส่งคำสั่งให้ Apps Script เขียนแทน
 * ทำให้ service account ของเว็บยังเป็น Viewer และแตะข้อมูลผู้ป่วยไม่ได้
 * ดูเหตุผลเต็มใน apps-script/Api.gs
 *
 * ⚠️ server-only — token อยู่ใน environment ห้ามเรียกจาก client component
 */

const API_URL = process.env.SCHEDULE_API_URL;
const API_TOKEN = process.env.SCHEDULE_API_TOKEN;

export function isScheduleApiConfigured(): boolean {
  return Boolean(API_URL && API_TOKEN);
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function callApi<T>(payload: Record<string, unknown>): Promise<T> {
  if (!API_URL || !API_TOKEN) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า SCHEDULE_API_URL และ SCHEDULE_API_TOKEN ใน .env.local",
    );
  }

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, token: API_TOKEN }),
      // Apps Script ตอบด้วย 302 ไปยัง googleusercontent ก่อนเสมอ
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    // ข้อความดิบจาก fetch ("fetch failed") ไม่บอกอะไรกับคนกรอกตาราง
    throw new Error(
      "ติดต่อ Apps Script ไม่ได้ — ตรวจว่า SCHEDULE_API_URL ถูกต้อง " +
        "และ deploy web app ไว้แบบ Anyone แล้ว",
    );
  }

  if (!response.ok) {
    throw new Error(`เรียก Apps Script ไม่สำเร็จ (${response.status})`);
  }

  const result = (await response.json().catch(() => {
    // Apps Script ตอบเป็นหน้า HTML เมื่อ deployment ผิด เช่น ตั้ง access ไว้แคบไป
    throw new Error(
      "Apps Script ตอบกลับไม่ใช่ JSON — มักเป็นเพราะ deployment ตั้ง " +
        '"Who has access" ไว้ไม่ใช่ Anyone หรือ URL เป็นของ /dev ไม่ใช่ /exec',
    );
  })) as ApiResponse<T>;
  if (!result.ok) throw new Error(result.error || "Apps Script ตอบกลับว่าไม่สำเร็จ");

  return result.data as T;
}

export interface AddClinicDaysResult {
  added: number;
  skipped: number;
}

export function addClinicDays(payload: {
  fellowName: string;
  startDate: string;
  repeatWeeks: number;
  maxSlots: number;
  note: string;
  startTime: string;
  endTime: string;
}): Promise<AddClinicDaysResult> {
  return callApi<AddClinicDaysResult>({ action: "addClinicDays", payload });
}

/**
 * ลบวันออกตรวจหนึ่งแถว
 *
 * ส่งวันที่และชื่อไปด้วยเพื่อให้ Apps Script ตรวจก่อนลบว่าแถวนั้นยังเป็นแถวเดิม
 * — ถ้ามีใครแทรกหรือลบแถวในชีตหลังจากหน้านี้โหลดไป เลขแถวจะเลื่อน
 * และการลบตามเลขแถวเปล่า ๆ จะลบผิดวันของผิดคน
 */
export function removeClinicDay(input: {
  rowNumber: number;
  clinicDate: string;
  fellowName: string;
}): Promise<{ removed: boolean }> {
  return callApi({ action: "removeClinicDay", ...input });
}

export function addFellow(name: string): Promise<{ fellows: string[] }> {
  return callApi({ action: "addFellow", name });
}

export function deactivateFellow(name: string): Promise<{ fellows: string[] }> {
  return callApi({ action: "deactivateFellow", name });
}
