import { describe, expect, it } from "vitest";
import {
  casesForPhone, findByReferralId, latestEmailForPhone, shapeStatus,
} from "../bot-lookup";

const rows = [
  { referral_id: "HEM-0001", referral_type: "TRANSPLANT_APPOINTMENT",
    status: "New", submitted_at: "2026-08-01", referrer_phone: "0812345678",
    referrer_email: "a@hosp.go.th", advice_record: "", answer_token: "" },
  { referral_id: "HEM-0002", referral_type: "REGIMEN_CONSULT",
    status: "Answered", submitted_at: "2026-08-20", referrer_phone: "812345678",
    referrer_email: "b@hosp.go.th", advice_record: "ให้ R-CHOP ต่อ",
    answer_token: "tok1234567890tok1234567890tok123" },
];

describe("findByReferralId", () => {
  it("เจอแบบไม่สนตัวพิมพ์/ช่องว่าง", () => {
    expect(findByReferralId(rows, " hem-0002 ")?.referral_id).toBe("HEM-0002");
  });
  it("ไม่เจอคืน null", () => {
    expect(findByReferralId(rows, "HEM-9999")).toBeNull();
  });
});

describe("shapeStatus", () => {
  it("เปิดเผยแค่ 4 field และแปลกลุ่ม/สถานะเป็นไทย", () => {
    const s = shapeStatus(rows[1]);
    expect(s.groupNumber).toBe(2);
    expect(Object.keys(s).sort()).toEqual(
      ["groupNumber", "referralId", "statusLabelTh", "submittedTh"]);
    expect(JSON.stringify(s)).not.toContain("R-CHOP");
  });
});

describe("casesForPhone", () => {
  it("เบอร์ชีตตัด 0 ก็ยังเจอ และเรียงใหม่สุดก่อน", () => {
    const found = casesForPhone(rows, "081-234-5678");
    expect(found.map((r) => r.referral_id)).toEqual(["HEM-0002", "HEM-0001"]);
  });

  it("รูปแบบวันที่ปนกัน (8/5/2026 กับ 2026-08-05) ก็ยังเรียงใหม่สุดก่อนถูกต้อง", () => {
    const mixed = [
      { referral_id: "HEM-A", referral_type: "REGIMEN_CONSULT",
        status: "Submitted", submitted_at: "8/1/2026", // 1 ส.ค. 2569 (M/D/Y)
        referrer_phone: "0812345678", referrer_email: "", advice_record: "",
        answer_token: "" },
      { referral_id: "HEM-B", referral_type: "REGIMEN_CONSULT",
        status: "Submitted", submitted_at: "2026-08-20", // 20 ส.ค. 2569 (Y-M-D)
        referrer_phone: "0812345678", referrer_email: "", advice_record: "",
        answer_token: "" },
      { referral_id: "HEM-C", referral_type: "REGIMEN_CONSULT",
        status: "Submitted", submitted_at: "8/10/2026", // 10 ส.ค. 2569 (M/D/Y)
        referrer_phone: "0812345678", referrer_email: "", advice_record: "",
        answer_token: "" },
    ];
    const found = casesForPhone(mixed, "0812345678");
    expect(found.map((r) => r.referral_id)).toEqual(["HEM-B", "HEM-C", "HEM-A"]);
  });

  it("วันที่อ่านไม่ออกให้ตกไปอยู่ท้ายสุด", () => {
    const rowsWithInvalid = [
      { referral_id: "HEM-VALID", referral_type: "REGIMEN_CONSULT",
        status: "Submitted", submitted_at: "2026-08-20",
        referrer_phone: "0812345678", referrer_email: "", advice_record: "",
        answer_token: "" },
      { referral_id: "HEM-INVALID", referral_type: "REGIMEN_CONSULT",
        status: "Submitted", submitted_at: "ไม่ทราบวันที่",
        referrer_phone: "0812345678", referrer_email: "", advice_record: "",
        answer_token: "" },
    ];
    const found = casesForPhone(rowsWithInvalid, "0812345678");
    expect(found.map((r) => r.referral_id)).toEqual(["HEM-VALID", "HEM-INVALID"]);
  });
});

describe("latestEmailForPhone", () => {
  it("เอาอีเมลจากเคสล่าสุด", () => {
    expect(latestEmailForPhone(rows, "0812345678")).toBe("b@hosp.go.th");
  });
  it("ไม่พบคืนว่าง", () => {
    expect(latestEmailForPhone(rows, "0999999999")).toBe("");
  });
});
