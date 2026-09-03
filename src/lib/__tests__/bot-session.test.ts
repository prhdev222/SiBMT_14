import { describe, expect, it } from "vitest";
import { readBotPayload, signBotPayload } from "../bot-session";

const SECRET = "test-secret";

describe("bot session token", () => {
  it("เซ็นแล้วอ่านกลับได้", async () => {
    const token = await signBotPayload(
      { phone: "0812345678", exp: Date.now() + 60_000 }, SECRET);
    const back = await readBotPayload<{ phone: string }>(token, SECRET);
    expect(back?.phone).toBe("0812345678");
  });
  it("แก้ token แล้วต้องอ่านไม่ออก", async () => {
    const token = await signBotPayload(
      { phone: "0812345678", exp: Date.now() + 60_000 }, SECRET);
    expect(await readBotPayload(token.slice(0, -2) + "xx", SECRET)).toBeNull();
  });
  it("หมดอายุแล้วคืน null", async () => {
    const token = await signBotPayload(
      { phone: "0812345678", exp: Date.now() - 1 }, SECRET);
    expect(await readBotPayload(token, SECRET)).toBeNull();
  });
  it("token ว่างคืน null", async () => {
    expect(await readBotPayload(undefined, SECRET)).toBeNull();
  });
});
