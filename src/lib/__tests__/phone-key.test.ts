import { describe, expect, it } from "vitest";
import { phoneKey } from "../phone-key";

describe("phoneKey", () => {
  it("ตัดขีด/ช่องว่าง แล้วตัด 0 นำหน้าทิ้ง — ตรงกับเบอร์ที่ชีตตัด 0 แล้ว", () => {
    expect(phoneKey("081-234-5678")).toBe("812345678");
  });
  it("เบอร์ที่ชีตตัด 0 ไปแล้วก็ได้ key เดียวกัน", () => {
    expect(phoneKey("812345678")).toBe("812345678");
  });
  it("+66 นำหน้าก็ได้ key เดียวกับเบอร์ 0 นำหน้า", () => {
    expect(phoneKey("+66812345678")).toBe(phoneKey("0812345678"));
    expect(phoneKey("+66812345678")).toBe("812345678");
  });
  it("เบอร์บ้าน 9 หลักตัด 0 นำหน้าแล้วเหลือ 8 ตัวท้าย", () => {
    expect(phoneKey("02-419-7000")).toBe("24197000");
  });
  it("สั้นเกินไป (ต่ำกว่า 9 หลักดิบ) = ว่าง", () => {
    expect(phoneKey("1234")).toBe("");
  });
  it("ค่าว่าง/undefined-string = ว่าง", () => {
    expect(phoneKey("")).toBe("");
  });
});
