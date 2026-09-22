import {
  cancelGroup1Booking, createGroup1Booking, findGroup1Booking,
  isGroup1BookingDbConfigured, rescheduleGroup1Booking,
} from "./group1-booking-db";
import { loadFellowSchedule } from "./referral-repository";

export function isBookingConfigured(): boolean { return isGroup1BookingDbConfigured(); }
export const isGroup1BookingConfigured = isBookingConfigured;

export interface BookingInput {
  clinicDate: string; fellowName: string; referrerOrg: string; referrerName: string;
  referrerPhone: string; referrerEmail: string; diseaseGroup: string; diagnosis: string;
  patientAge: string; patientSex: string; note: string; transplantIndication: string;
}
export interface BookingResult { referralId: string; clinicDate: string; fellowName: string; remainingAfter: number; manageToken: string; }
export interface BookingCredentials { referralId: string; token?: string; phone?: string; staffUser?: string; }
export interface BookingDetail {
  referralId: string; status: string; clinicDate: string; fellowName: string;
  referrerOrg: string; diagnosis: string; canChange: boolean; manageToken?: string;
  referralType?: string; appointmentNote?: string;
}
export interface CancelResult { referralId: string; clinicDate: string; fellowName: string; }
export interface RescheduleResult {
  referralId: string; clinicDate: string; fellowName: string; previousDate: string; previousFellow: string;
}

export async function bookTransplantSlot(payload: BookingInput): Promise<BookingResult> {
  const day = (await loadFellowSchedule()).days.find((item) => item.clinicDate === payload.clinicDate && item.fellowName === payload.fellowName);
  if (!day) throw new Error("ไม่พบวันออกตรวจหรือชื่อ fellow นี้ในตาราง");
  const booking = await createGroup1Booking({ ...payload, capacity: day.maxSlots });
  return {
    referralId: booking.referralId, clinicDate: booking.clinicDate, fellowName: booking.fellowName,
    remainingAfter: Math.max(0, day.maxSlots - booking.slotNumber), manageToken: booking.manageToken,
  };
}
export async function lookupBooking(input: BookingCredentials): Promise<BookingDetail> {
  return findGroup1Booking(input.referralId, input.token, input.phone);
}
export async function cancelBooking(input: BookingCredentials): Promise<CancelResult> {
  const booking = await cancelGroup1Booking(input.referralId, input.token, input.phone);
  return { referralId: booking.referralId, clinicDate: booking.clinicDate, fellowName: booking.fellowName };
}
export async function rescheduleBooking(input: BookingCredentials & { clinicDate: string; fellowName: string }): Promise<RescheduleResult> {
  const day = (await loadFellowSchedule()).days.find((item) => item.clinicDate === input.clinicDate && item.fellowName === input.fellowName);
  if (!day) throw new Error("ไม่พบวันออกตรวจหรือชื่อ fellow นี้ในตาราง");
  const current = await findGroup1Booking(input.referralId, input.token, input.phone);
  const booking = await rescheduleGroup1Booking(input.referralId, input.token, input.phone, input.clinicDate, input.fellowName, day.maxSlots);
  return {
    referralId: booking.referralId, clinicDate: booking.clinicDate, fellowName: booking.fellowName,
    previousDate: current.clinicDate, previousFellow: current.fellowName,
  };
}
