import { describe, expect, it } from "vitest";
import { hashCode } from "../bot-code";

describe("hashCode", () => {
  it("คืน SHA-256 hex 64 ตัวอักษร", async () => {
    const hash = await hashCode("123456");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("รหัสเดียวกันได้ hash เดียวกันเสมอ", async () => {
    expect(await hashCode("123456")).toBe(await hashCode("123456"));
  });
  it("รหัสต่างกันได้ hash ต่างกัน", async () => {
    expect(await hashCode("123456")).not.toBe(await hashCode("654321"));
  });
  it("ไม่ใช่รหัสดิบที่โผล่ใน hash", async () => {
    expect(await hashCode("123456")).not.toContain("123456");
  });
});
