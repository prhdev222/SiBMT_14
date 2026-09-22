import {
  addGroup1Fellow, addGroup1Schedule, deactivateGroup1Fellow, isGroup1BookingDbConfigured,
  removeGroup1Schedule, listGroup1Fellows, renameGroup1Fellow,
} from "./group1-booking-db";
import { DEFAULT_SLOTS_PER_FELLOW } from "./fellow-schedule";

export async function listFellows(): Promise<string[]> { return listGroup1Fellows(); }
export async function addFellow(name: string): Promise<void> {
  if (!isGroup1BookingDbConfigured()) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูลกลุ่ม 1");
  const clean = name.trim(); if (!clean) throw new Error("กรุณากรอกชื่อ"); await addGroup1Fellow(clean);
}
export async function renameFellow(oldName: string, newName: string): Promise<void> {
  if (!isGroup1BookingDbConfigured()) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูล");
  await renameGroup1Fellow(oldName, newName);
}
export async function deactivateFellow(name: string): Promise<void> { await deactivateGroup1Fellow(name.trim()); }

export interface AddClinicDaysInput {
  fellowName: string; startDate: string; repeatWeeks: number; maxSlots: number;
  note: string; startTime: string; endTime: string;
}

export async function addClinicDays(input: AddClinicDaysInput): Promise<{ added: number; skipped: number }> {
  if (!isGroup1BookingDbConfigured()) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูลกลุ่ม 1");
  if (!input.fellowName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new Error("ข้อมูลวันออกตรวจไม่ถูกต้อง");
  const slots = Number.isFinite(input.maxSlots) && input.maxSlots > 0 ? Math.min(Math.floor(input.maxSlots), 10) : DEFAULT_SLOTS_PER_FELLOW;
  const weeks = Math.max(1, Math.min(52, Math.floor(input.repeatWeeks) || 1));
  const [year, month, day] = input.startDate.split("-").map(Number);
  const days = Array.from({ length: weeks }, (_, week) => {
    const date = new Date(year, month - 1, day + week * 7);
    return {
      clinicDate: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"),
      fellowName: input.fellowName.trim(), maxSlots: slots, note: input.note.trim(),
      startTime: input.startTime, endTime: input.endTime,
    };
  });
  return addGroup1Schedule(days);
}

export async function removeClinicDay(input: { rowNumber: number; clinicDate: string; fellowName: string }): Promise<void> {
  await removeGroup1Schedule(input.clinicDate.trim(), input.fellowName.trim());
}
