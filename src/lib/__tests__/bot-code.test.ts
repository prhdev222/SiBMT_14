import { describe, expect, it } from "vitest";
import { hashCode } from "../bot-code";

describe("hashCode", () => {
  it("คืน HMAC-SHA256 hex 64 ตัวอักษร", async () => {
    const hash = await hashCode("123456", "secret-1");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("รหัสเดียวกัน กุญแจเดียวกัน ได้ hash เดียวกันเสมอ", async () => {
    expect(await hashCode("123456", "secret-1")).toBe(
      await hashCode("123456", "secret-1"),
    );
  });
  it("รหัสต่างกันได้ hash ต่างกัน", async () => {
    expect(await hashCode("123456", "secret-1")).not.toBe(
      await hashCode("654321", "secret-1"),
    );
  });
  it("รหัสเดียวกันแต่กุญแจต่างกันได้ hash ต่างกัน — กันคำนวณล่วงหน้าแบบไม่มีกุญแจ", async () => {
    expect(await hashCode("123456", "secret-1")).not.toBe(
      await hashCode("123456", "secret-2"),
    );
  });
  it("ไม่ใช่รหัสดิบที่โผล่ใน hash", async () => {
    expect(await hashCode("123456", "secret-1")).not.toContain("123456");
  });
});
