import { isGroup1BookingDbConfigured, listGroup1Bookings, listGroup1Fellows, listGroup1Schedule } from "./group1-booking-db";
import { TRANSPLANT_INDICATIONS, type TransplantIndication } from "./transplant-indications";
import { DEFAULT_SLOTS_PER_FELLOW, type FellowClinicDay } from "./fellow-schedule";
import type { Referral } from "./referral-types";

export interface ReferralSource { referrals: Referral[]; isSampleData: boolean; error: string | null; }
export interface FellowScheduleSource { days: FellowClinicDay[]; rawRowCount: number; skippedRows: number; isSampleData: boolean; error: string | null; }

export async function loadReferrals(): Promise<ReferralSource> {
  if (!isGroup1BookingDbConfigured()) return { referrals: [], isSampleData: false, error: "ยังไม่ได้ตั้งค่าฐานข้อมูลกลุ่ม 1" };
  try {
    return { referrals: (await listGroup1Bookings()).map(toReferral), isSampleData: false, error: null };
  } catch (error) {
    return { referrals: [], isSampleData: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function loadFellowSchedule(): Promise<FellowScheduleSource> {
  if (!isGroup1BookingDbConfigured()) return { days: [], rawRowCount: 0, skippedRows: 0, isSampleData: false, error: "ยังไม่ได้ตั้งค่าฐานข้อมูลกลุ่ม 1" };
  try {
    const rows = await listGroup1Schedule();
    const days = rows.map((row, index) => ({
      clinicDate: row.clinic_date || "", fellowName: row.fellow_name || "",
      maxSlots: Number(row.max_slots) || DEFAULT_SLOTS_PER_FELLOW, note: row.note || "",
      startTime: row.start_time || "", endTime: row.end_time || "", rowNumber: index + 2,
    })).filter((day) => day.clinicDate && day.fellowName);
    return { days, rawRowCount: rows.length, skippedRows: rows.length - days.length, isSampleData: false, error: null };
  } catch (error) {
    return { days: [], rawRowCount: 0, skippedRows: 0, isSampleData: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function loadFellows(): Promise<string[]> { return isGroup1BookingDbConfigured() ? listGroup1Fellows() : []; }
export async function loadTransplantIndications(): Promise<TransplantIndication[]> { return TRANSPLANT_INDICATIONS; }
export async function loadConfigValues(): Promise<Record<string, string>> { return {}; }

function toReferral(row: Record<string, string>): Referral {
  return {
    referralId: row.referral_id || "", referralType: "TRANSPLANT_APPOINTMENT",
    diseaseGroup: (row.disease_group || null) as Referral["diseaseGroup"], submittedAt: row.submitted_at || "",
    referrerOrg: row.referrer_org || "—", referrerName: row.referrer_name || "", referrerPhone: row.referrer_phone || "—",
    insuranceScheme: "", urgency: "Routine", status: (row.status || "Appointment Confirmed") as Referral["status"],
    assignedTo: null, elapsedBusinessHours: 0, followUpDate: null, possibleDuplicateOf: null,
    appointmentDate: row.clinic_date || null, fellowAssigned: row.fellow_name || null, appointmentNote: "",
    transplantIndication: row.transplant_indication || "", note: row.note || "", diagnosis: row.diagnosis || "",
    stage: "", treatmentSummary: "", comorbidity: "", clinicalQuestion: "", adviceRecord: "", adviceRegimens: "",
    questionType: "", answeredBy: "", adviceAttending: "", emailUnverified: false,
  };
}
