import { describe, expect, it } from "vitest";
import { needsEmailFlag, type Referral } from "../referral-types";

/** เคสฐานที่ครบทุก field — แต่ละ test override เฉพาะที่ต้องการ */
function baseReferral(overrides: Partial<Referral> = {}): Referral {
  return {
    referralId: "HEM-TEST-0001",
    referralType: "REGIMEN_CONSULT",
    diseaseGroup: "Lymphoma",
    submittedAt: "2026-09-01 09:00",
    referrerOrg: "โรงพยาบาลทดสอบ",
    referrerName: "",
    referrerPhone: "0812345678",
    insuranceScheme: "",
    urgency: "Routine",
    status: "Awaiting Attending",
    assignedTo: null,
    elapsedBusinessHours: 10,
    followUpDate: null,
    possibleDuplicateOf: null,
    appointmentDate: null,
    fellowAssigned: null,
    appointmentNote: "",
    transplantIndication: "",
    note: "",
    diagnosis: "",
    stage: "",
    treatmentSummary: "",
    comorbidity: "",
    clinicalQuestion: "",
    adviceRecord: "",
    adviceRegimens: "",
    questionType: "",
    answeredBy: "",
    adviceAttending: "",
    emailUnverified: false,
    ...overrides,
  };
}

describe("needsEmailFlag", () => {
  it("อีเมลไม่ยืนยัน + กลุ่ม 2 + ยังไม่จบ = true", () => {
    const r = baseReferral({
      referralType: "REGIMEN_CONSULT",
      status: "Awaiting Attending",
      emailUnverified: true,
    });
    expect(needsEmailFlag(r)).toBe(true);
  });

  it("อีเมลไม่ยืนยัน + กลุ่ม 3 แต่จบแล้วด้วย Readiness Visit Scheduled = false", () => {
    // กรณีนี้คือบั๊กเดิม: adviceRecord ว่างเหมือนกัน แต่เคสจบแล้วด้วยการนัดตรวจ
    // ไม่ใช่การส่งคำแนะนำทางอีเมล จึงไม่ควรขึ้นธงเตือนอีก
    const r = baseReferral({
      referralType: "CHEMO_ADMISSION",
      status: "Readiness Visit Scheduled",
      adviceRecord: "",
      emailUnverified: true,
    });
    expect(needsEmailFlag(r)).toBe(false);
  });

  it("อีเมลยืนยันแล้ว ไม่ว่าสถานะไหนก็ไม่ขึ้นธง", () => {
    const r = baseReferral({
      referralType: "CHEMO_ADMISSION",
      status: "Awaiting Attending",
      emailUnverified: false,
    });
    expect(needsEmailFlag(r)).toBe(false);
  });

  it("กลุ่ม 1 ไม่เข้าเงื่อนไข แม้อีเมลไม่ยืนยันและยังไม่จบ", () => {
    const r = baseReferral({
      referralType: "TRANSPLANT_APPOINTMENT",
      status: "Slot Reserved",
      emailUnverified: true,
    });
    expect(needsEmailFlag(r)).toBe(false);
  });

  it("กลุ่ม 4 ไม่เข้าเงื่อนไขเช่นกัน", () => {
    const r = baseReferral({
      referralType: "GENERAL_OPD",
      status: "Submitted",
      emailUnverified: true,
    });
    expect(needsEmailFlag(r)).toBe(false);
  });
});
