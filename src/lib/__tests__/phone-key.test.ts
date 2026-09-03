import { describe, expect, it } from "vitest";
import { phoneKey } from "../phone-key";

describe("phoneKey", () => {
  it("ตัดขีดและช่องว่าง", () => {
    expect(phoneKey("081-234-5678")).toBe("0812345678");
  });
  it("เติม 0 ที่ชีตตัดทิ้ง", () => {
    expect(phoneKey("812345678")).toBe("0812345678");
  });
  it("เบอร์บ้าน 9 หลักผ่านได้", () => {
    expect(phoneKey("02-419-7000")).toBe("024197000");
  });
  it("สั้นเกินไป = ว่าง", () => {
    expect(phoneKey("1234")).toBe("");
  });
  it("ค่าว่าง/undefined-string = ว่าง", () => {
    expect(phoneKey("")).toBe("");
  });
});
