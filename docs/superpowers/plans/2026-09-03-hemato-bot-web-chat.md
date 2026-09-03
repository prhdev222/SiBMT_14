# Hemato Bot Web Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปุ่มมาสคอต Hemato Bot บนเว็บเดิม เปิดเป็นแชท rule-based (ไม่มี LLM) ให้แพทย์ต้นทางเช็กสถานะ ดูเคสตัวเอง อ่านคำตอบ (LINE Login หรือรหัสอีเมล) ค้นสูตรเคมี ดู transplant indications และถูกพาไปจอง/เลื่อนนัด

**Architecture:** widget เป็น client component ตัวเดียวถือ state decision tree; ฝั่ง server เป็น Server Actions ที่อ่านชีตผ่าน `referral-repository` เดิม; การยืนยันตัวตนใช้ signed cookie (HMAC ผ่าน Web Crypto แบบเดียวกับ `auth.ts`) จาก 2 ทาง — LINE Login เทียบชีต `line_links` หรือรหัส 6 หลักที่ Apps Script ส่งเข้าอีเมลลงทะเบียน; Apps Script เพิ่ม action ใน `Api.gs` (ห้ามสร้าง doPost ใหม่)

**Tech Stack:** Next.js 16 (App Router, Server Actions) บน OpenNext/Cloudflare, Tailwind 4, Google Sheets ผ่าน REST+JWT (โค้ดเดิม), Apps Script, vitest (ใหม่ — เฉพาะ pure logic)

**Spec:** `docs/superpowers/specs/2026-09-03-hemato-bot-web-chat-design.md`

## Global Constraints

- อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด Next ทุกครั้ง (คำสั่ง AGENTS.md — Next รุ่นนี้มี breaking changes)
- Apps Script เข้าถึงคอลัมน์ด้วยชื่อ header ผ่าน `headerMap_()` เท่านั้น ห้ามใช้ index
- ห้ามประกาศ `doPost` ตัวที่สอง — เพิ่ม action ใน `Api.gs:doPost` เดิม
- การเปิดเผยต่อคนยังไม่ยืนยันตัวตน: เลข HEM- / กลุ่ม / สถานะ / วันที่ส่ง เท่านั้น ห้ามมีเนื้อหาคลินิก ห้ามยืนยันหรือปฏิเสธอีเมล
- ข้อความ UI เป็นภาษาไทย โทนเดียวกับ LINE bot (ดูตัวอย่างใน `LineWebhook.gs`)
- commit บ่อย ทีละ task, ข้อความ commit ลงท้าย `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- อย่าแตะ flow จอง/เลื่อนนัดเดิม — widget แค่ลิงก์ไป `/book/transplant` และ `/booking`

---

### Task 1: vitest + ฟังก์ชัน phoneKey

**Files:**
- Create: `vitest.config.ts`, `src/lib/phone-key.ts`, `src/lib/__tests__/phone-key.test.ts`
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)

**Interfaces:**
- Produces: `phoneKey(value: string): string` — ตัวเลขล้วน เติม 0 นำหน้าถ้าชีตตัดทิ้ง (`"812345678"` → `"0812345678"`), คืน `""` ถ้าสั้นกว่า 9 หลัก

- [ ] **Step 1:** `npm i -D vitest` แล้วสร้าง `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 2: เขียนเทสต์ให้ตกก่อน** — `src/lib/__tests__/phone-key.test.ts`:

```ts
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
```

- [ ] **Step 3:** รัน `npx vitest run` — ต้อง FAIL (โมดูลยังไม่มี)
- [ ] **Step 4: implement** — `src/lib/phone-key.ts`:

```ts
/**
 * ทำเบอร์โทรให้เทียบกันได้: "081-234-5678" กับ "812345678" (ชีตตัด 0) ต้องตรงกัน
 * ตรรกะเดียวกับ phoneKey_ ใน apps-script/LineWebhook.gs — แก้ฝั่งหนึ่งต้องแก้อีกฝั่ง
 */
export function phoneKey(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 9) return "";
  return /^[1-9]\d{7,8}$/.test(digits) ? `0${digits}` : digits;
}
```

- [ ] **Step 5:** `npx vitest run` → PASS, `npm run lint` → ผ่าน
- [ ] **Step 6:** commit `test: vitest setup + phoneKey normalizer`

---

### Task 2: bot session — signed cookie (Web Crypto)

**Files:**
- Create: `src/lib/bot-session.ts`, `src/lib/__tests__/bot-session.test.ts`

**Interfaces:**
- Produces:
  - `signBotPayload(payload: object, secret: string): Promise<string>` — `base64url(json).hmac`
  - `readBotPayload<T>(token: string | undefined, secret: string): Promise<T | null>` — null ถ้า HMAC ไม่ตรง/หมดอายุ (payload ต้องมี `exp: number` epoch ms)
  - ค่าคงที่ `BOT_VERIFIED_COOKIE = "sibmt_bot_verified"` (อายุ 30 วัน), `BOT_CODE_COOKIE = "sibmt_bot_code"` (อายุ 10 นาที)
- หมายเหตุ: ใช้ `crypto.subtle` ล้วน (แบบ `auth.ts`) — ไม่ import `next/headers` ในไฟล์นี้ เพื่อให้ vitest รันได้ตรง ๆ; การอ่าน/เขียน cookie ทำในไฟล์ actions (Task 4)

- [ ] **Step 1: เทสต์ก่อน** — `src/lib/__tests__/bot-session.test.ts`:

```ts
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
```

- [ ] **Step 2:** รันให้ FAIL
- [ ] **Step 3: implement** — `src/lib/bot-session.ts` (ดูวิธี HMAC จาก `auth.ts` แล้วใช้ท่าเดียวกัน):

```ts
/** cookie ยืนยันตัวตนของ Hemato Bot — แยกจาก session dashboard โดยสิ้นเชิง */
export const BOT_VERIFIED_COOKIE = "sibmt_bot_verified";
export const BOT_CODE_COOKIE = "sibmt_bot_code";
export const BOT_VERIFIED_MAX_AGE = 30 * 24 * 60 * 60; // วินาที
export const BOT_CODE_MAX_AGE = 10 * 60;

const enc = new TextEncoder();

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Buffer.from(sig).toString("base64url");
}

export async function signBotPayload(
  payload: object, secret: string): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${await hmac(body, secret)}`;
}

export async function readBotPayload<T extends { exp: number }>(
  token: string | undefined, secret: string): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if ((await hmac(body, secret)) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4:** เทสต์ PASS (ถ้า `Buffer` ไม่มีใน edge runtime ของ opennext ให้สลับเป็น `btoa`/`atob` + `Uint8Array` — เช็กว่า `auth.ts` ใช้ท่าไหนแล้วตามนั้น)
- [ ] **Step 5:** commit `feat(bot): signed cookie helpers for Hemato Bot sessions`

---

### Task 3: โหลดข้อมูลจากชีตสำหรับ bot

**Files:**
- Modify: `src/lib/referral-repository.ts`
- Create: `src/lib/bot-lookup.ts`, `src/lib/__tests__/bot-lookup.test.ts`

**Interfaces:**
- Consumes: `loadReferrals()` (`ReferralSource.referrals: Referral[]`), `phoneKey` (Task 1)
- Produces ใน `referral-repository.ts` (ตามแพตเทิร์น `loadRegimens`):
  - `loadRawReferralRows(): Promise<Record<string, string>[]>` — แถวดิบ (ต้องมี `referral_id`, `referral_type`, `status`, `submitted_at`, `referrer_phone`, `referrer_email`, `advice_record`, `answer_token`) — ใช้ฝั่ง server เท่านั้น
  - `loadLineLink(userId: string): Promise<{ phone: string } | null>` — อ่านชีต `line_links` เอาเฉพาะแถว `active === "yes"` และ `line_user_id` ตรง
- Produces ใน `bot-lookup.ts` (pure — รับแถวดิบเป็น argument เพื่อเทสต์ได้):
  - `shapeStatus(row): BotCaseStatus` — `{ referralId, groupNumber: 1|2|3|4|null, statusLabelTh, submittedTh }` (ห้ามมี field อื่น — นี่คือเพดานการเปิดเผยต่อคนไม่ยืนยันตัวตน)
  - `findByReferralId(rows, id): Record<string,string> | null` — เทียบแบบ trim + toUpperCase
  - `casesForPhone(rows, phone): Record<string,string>[]` — เทียบด้วย `phoneKey` ทั้งสองฝั่ง เรียงใหม่สุดก่อน ตัด 10 แถวแรก
  - `latestEmailForPhone(rows, phone): string` — อีเมลจากเคสล่าสุดที่มีอีเมล (ตรรกะเดียวกับ `findEmailByPhone_` ใน LineWebhook.gs) คืน `""` ถ้าไม่มี

- [ ] **Step 1: เทสต์ pure functions ก่อน** — `src/lib/__tests__/bot-lookup.test.ts`:

```ts
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
});

describe("latestEmailForPhone", () => {
  it("เอาอีเมลจากเคสล่าสุด", () => {
    expect(latestEmailForPhone(rows, "0812345678")).toBe("b@hosp.go.th");
  });
  it("ไม่พบคืนว่าง", () => {
    expect(latestEmailForPhone(rows, "0999999999")).toBe("");
  });
});
```

- [ ] **Step 2:** FAIL → implement `src/lib/bot-lookup.ts`:

```ts
import { phoneKey } from "./phone-key";
import { STATUS_LABEL_TH, type Status } from "./referral-types";

/** เลขกลุ่มตามค่าที่ชีตเก็บ — คู่กับ GROUP_NUMBER ใน apps-script/Config.gs */
const GROUP_NUMBER: Record<string, 1 | 2 | 3 | 4> = {
  TRANSPLANT_APPOINTMENT: 1,
  REGIMEN_CONSULT: 2,
  ADMIT_TRANSFER: 3,
  OTHER_OPD: 4,
};

export interface BotCaseStatus {
  referralId: string;
  groupNumber: 1 | 2 | 3 | 4 | null;
  statusLabelTh: string;
  submittedTh: string;
}

const t = (v: string | undefined) => String(v ?? "").trim();

/** ⚠️ เพดานการเปิดเผยต่อคนที่ยังไม่ยืนยันตัวตน — ห้ามเพิ่ม field โดยไม่แก้ spec */
export function shapeStatus(row: Record<string, string>): BotCaseStatus {
  const status = t(row["status"]);
  return {
    referralId: t(row["referral_id"]),
    groupNumber: GROUP_NUMBER[t(row["referral_type"])] ?? null,
    statusLabelTh: STATUS_LABEL_TH[status as Status] ?? status,
    submittedTh: t(row["submitted_at"]),
  };
}

export function findByReferralId(
  rows: Record<string, string>[], id: string,
): Record<string, string> | null {
  const key = t(id).toUpperCase();
  return rows.find((r) => t(r["referral_id"]).toUpperCase() === key) ?? null;
}

export function casesForPhone(
  rows: Record<string, string>[], phone: string,
): Record<string, string>[] {
  const key = phoneKey(phone);
  if (!key) return [];
  return rows
    .filter((r) => t(r["referral_id"]) && phoneKey(r["referrer_phone"]) === key)
    .sort((a, b) => t(b["submitted_at"]).localeCompare(t(a["submitted_at"])))
    .slice(0, 10);
}

export function latestEmailForPhone(
  rows: Record<string, string>[], phone: string,
): string {
  return (
    casesForPhone(rows, phone)
      .map((r) => t(r["referrer_email"]))
      .find((email) => email.length > 0) ?? ""
  );
}
```

หมายเหตุ: `submitted_at` ในชีตอาจเป็น `8/5/2026` — ถ้า sort ตาม string ทำให้เทสต์รูปแบบวันที่ปนกันพัง ให้ใช้ `new Date(...)` เทียบแบบ `handleMyCasesPhone_` แทน (เพิ่มเทสต์เคสนั้นด้วย)

- [ ] **Step 3:** เทสต์ PASS
- [ ] **Step 4:** เพิ่ม 2 ฟังก์ชันใน `referral-repository.ts` ตามแพตเทิร์นของ `loadRegimens` (คืนค่าว่างเมื่อไม่มี credentials, `try/catch` คืนว่างเมื่อชีตอ่านไม่ได้):

```ts
/** แถวดิบสำหรับ Hemato Bot — ใช้ฝั่ง server เท่านั้น อย่าส่งทั้งแถวให้ client */
export async function loadRawReferralRows(): Promise<Record<string, string>[]> {
  if (!readCredentials()) return [];
  try {
    return await readSheetRows(REFERRALS_SHEET);
  } catch {
    return [];
  }
}

const LINE_LINKS_SHEET = "line_links";

export async function loadLineLink(
  userId: string,
): Promise<{ phone: string } | null> {
  if (!readCredentials() || !userId) return null;
  try {
    const rows = await readSheetRows(LINE_LINKS_SHEET);
    const hit = rows.find(
      (r) =>
        text(r["line_user_id"]) === userId &&
        text(r["active"]).toLowerCase() === "yes",
    );
    return hit ? { phone: text(hit["referrer_phone"]) } : null;
  } catch {
    return null;
  }
}
```

(ชื่อคงที่ `REFERRALS_SHEET` — ใช้ชื่อที่ไฟล์นี้ใช้อ่านชีต referrals อยู่แล้ว; ถ้าใน `dev:demo` ไม่มี credentials ให้ `loadRawReferralRows` คืนแถวจาก `mock-referrals` แปลงเป็นแถวดิบ เพื่อให้ demo ใช้แชทได้ — ดูว่า `loadReferrals()` fallback ยังไงแล้วทำท่าเดียวกัน)

- [ ] **Step 5:** `npm run lint` + `npx tsc --noEmit` ผ่าน
- [ ] **Step 6:** commit `feat(bot): sheet loaders + pure lookup/shaping helpers`

---

### Task 4: Server Actions ของแชท

**Files:**
- Create: `src/app/hemato-bot/actions.ts`
- Modify: `src/lib/rate-limit.ts`, `src/lib/apps-script-api.ts`

**Interfaces:**
- Consumes: Task 1–3 ทั้งหมด, `loadRegimens()`, `TRANSPLANT_INDICATIONS`
- Produces (ทุกตัว `"use server"`; คืน discriminated union ไม่ throw):
  - `lookupStatusAction(referralId: string): Promise<{ ok: true; found: BotCaseStatus | null } | { ok: false; error: string }>`
  - `listCasesAction(phone: string): Promise<{ ok: true; cases: (BotCaseStatus & { hasAnswer: boolean })[] } | { ok: false; error: string }>`
  - `requestCodeAction(phone: string): Promise<{ ok: boolean; error?: string }>` — สุ่มรหัส 6 หลัก, เซ็ต `BOT_CODE_COOKIE` เก็บ `{ codeHmac, phone, exp }`, เรียก Apps Script ส่งอีเมล; **ตอบสำเร็จเสมอแม้เบอร์ไม่พบ** (ไม่เผยว่าเบอร์ไหนมีเคส)
  - `verifyCodeAction(code: string): Promise<{ ok: boolean; error?: string }>` — เทียบ HMAC ของรหัสกับ cookie, ถูกต้อง → เซ็ต `BOT_VERIFIED_COOKIE` `{ phone, exp }` แล้วลบ code cookie
  - `verifiedCasesAction(): Promise<{ ok: true; verified: boolean; cases: (BotCaseStatus & { answerUrl: string | null })[] } | { ok: false; error: string }>` — ต้องมี `BOT_VERIFIED_COOKIE`; `answerUrl = "/answer/" + answer_token` เมื่อมีคำตอบ
  - `resendAnswerAction(referralId: string): Promise<{ ok: boolean; error?: string }>` — เรียก Apps Script `resendAdvice` (Task 5); ข้อความตอบไม่เผยอีเมลปลายทาง
  - `searchRegimensAction(query: string): Promise<{ diseaseGroup: string; abbr: string; components: string }[]>` — substring ไม่สนตัวพิมพ์บน abbr/components/diseaseGroup; query ว่าง = คืนทั้งหมด (จัดกลุ่มฝั่ง client)
- ใน `rate-limit.ts` เพิ่มตามแพตเทิร์น `allowAdminContact`:

```ts
/** เช็กสถานะ/รายการเคสจากแชทเว็บ — เพดานเดียวกับหน้าจัดการนัด */
export async function allowBotLookup(): Promise<boolean> {
  return allowAttempt("MANAGE_RATE_LIMIT", "bot");
}
/** ขอรหัสอีเมล — แยกถังเพราะยิงอีเมลออกจริง สแปมได้ */
export async function allowBotCode(): Promise<boolean> {
  return allowAttempt("MANAGE_RATE_LIMIT", "botcode");
}
```

- ใน `apps-script-api.ts` เพิ่ม (ตามแพตเทิร์น `contactAdmin` ที่ใช้ `callAppsScript`):

```ts
export async function sendBotCodeEmail(payload: {
  email: string; code: string;
}): Promise<{ ok: boolean }> {
  return callAppsScript("sendBotCode", payload);
}
export async function resendAdviceEmail(payload: {
  referralId: string;
}): Promise<{ ok: boolean; error?: string }> {
  return callAppsScript("resendAdvice", payload);
}
```

- [ ] **Step 1:** เขียน `actions.ts` — โครงของทุก action: เช็ก rate limit ก่อน (`ค้นบ่อยเกินไป กรุณารออีกสักครู่`), `phoneKey`/trim input, โหลดแถวผ่าน `loadRawReferralRows`, ใช้ pure functions จาก Task 3 เท่านั้นในการกรอง/ตัดรูป ตัวอย่าง action ที่ยากสุด (ขอรหัส):

```ts
"use server";

import { cookies } from "next/headers";
import {
  BOT_CODE_COOKIE, BOT_CODE_MAX_AGE, BOT_VERIFIED_COOKIE,
  BOT_VERIFIED_MAX_AGE, readBotPayload, signBotPayload,
} from "@/lib/bot-session";
import { latestEmailForPhone } from "@/lib/bot-lookup";
import { loadRawReferralRows } from "@/lib/referral-repository";
import { allowBotCode } from "@/lib/rate-limit";
import { sendBotCodeEmail } from "@/lib/apps-script-api";
import { phoneKey } from "@/lib/phone-key";

const secret = () => process.env.AUTH_SECRET ?? "";

export async function requestCodeAction(
  phone: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await allowBotCode())) {
    return { ok: false, error: "ขอรหัสบ่อยเกินไป กรุณารออีกสักครู่" };
  }
  const key = phoneKey(phone);
  if (!key) return { ok: false, error: "เบอร์โทรไม่ครบ กรุณาพิมพ์ใหม่ เช่น 081-234-5678" };

  const email = latestEmailForPhone(await loadRawReferralRows(), key);
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // เบอร์ไม่พบ/ไม่มีอีเมล: ไม่ส่งจริงแต่ตอบเหมือนส่งแล้ว — ไม่เผยว่าเบอร์ไหนมีเคส
  if (email) await sendBotCodeEmail({ email, code });

  const token = await signBotPayload(
    { code, phone: key, exp: Date.now() + BOT_CODE_MAX_AGE * 1000 }, secret());
  (await cookies()).set(BOT_CODE_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: true, maxAge: BOT_CODE_MAX_AGE,
    path: "/",
  });
  return { ok: true };
}
```

`verifyCodeAction` อ่าน cookie ด้วย `readBotPayload<{ code: string; phone: string; exp: number }>` เทียบ `code` แบบตรงตัว ผิดคืน `{ ok: false, error: "รหัสไม่ถูกต้อง กรุณาพิมพ์ใหม่" }`; ถูกเซ็ต `BOT_VERIFIED_COOKIE` ด้วย payload `{ phone, exp: Date.now() + BOT_VERIFIED_MAX_AGE * 1000 }` แล้ว `.delete(BOT_CODE_COOKIE)`
`verifiedCasesAction` อ่าน verified cookie → `casesForPhone` → map เป็น `shapeStatus(row)` + `answerUrl: row["advice_record"] && row["answer_token"] ? \`/answer/\${row["answer_token"]}\` : null`
`lookupStatusAction` / `listCasesAction` เช็ก `allowBotLookup()` แล้วใช้ `findByReferralId`/`casesForPhone` + `shapeStatus` (`hasAnswer = advice_record ไม่ว่าง`)
`searchRegimensAction`: `loadRegimens()` แล้ว filter `q` lower-case กับสามฟิลด์

- [ ] **Step 2:** `npx tsc --noEmit` + `npm run lint` ผ่าน
- [ ] **Step 3:** ทดสอบมือใน dev: `npm run dev:demo` แล้วเรียก action ผ่านหน้า scratch (หรือรอ Task 6 แล้วทดสอบรวม) — อย่างน้อยยืนยันว่า import ทุกตัว resolve และหน้าแรกยัง build ได้
- [ ] **Step 4:** commit `feat(bot): chat server actions (status, cases, code verify, regimens)`

---

### Task 5: Apps Script — sendBotCode, resendAdvice, ยืนยันอีเมลตอน submit

**Files:**
- Modify: `apps-script/Api.gs`, `apps-script/OnFormSubmit.gs`, `apps-script/Config.gs`, `apps-script/README.md`

**Interfaces:**
- Consumes: `sendAdviceCopyEmail_(row)` (มีอยู่ใน LineWebhook.gs), `headerMap_()`, `readRows_`, `getSheet_`, `SHEETS`
- Produces (action ใหม่ใน `doPost` เดิม — ทุกตัวต้องผ่านการเช็ก token แบบ action อื่น):
  - `sendBotCode {email, code}` → เมลหัวข้อ "รหัสยืนยัน Hemato Bot" เนื้อความบอกว่ารหัสใช้ได้ 10 นาที และถ้าไม่ได้ขอให้เพิกเฉย
  - `resendAdvice {referralId}` → หาแถว, เรียก `sendAdviceCopyEmail_`, คืน `{ ok }` (ไม่คืนอีเมล)
  - `confirmEmail {referralId, token}` → เทียบคอลัมน์ `email_verify_token` ตรงแล้วเขียน `email_verified_at = new Date()` คืน `{ ok }`
- `OnFormSubmit.gs`:
  - สร้าง `email_verify_token` (สุ่ม 32 ตัวอักษร ท่าเดียวกับ answer_token เดิม) ลงคอลัมน์ใหม่
  - อีเมลตอบรับเดิมเพิ่มปุ่ม/ลิงก์ "ยืนยันอีเมลของท่าน" → `WEB_BASE_URL + '/verify-email?id=' + referralId + '&t=' + token`
  - ถ้าฟอร์มมีคำถาม "ยืนยันอีเมล (พิมพ์ซ้ำ)" และค่าสองช่องไม่ตรง (เทียบ trim+lower) เขียน `email_mismatch = 'yes'`
- คอลัมน์ใหม่ทั้งหมดผ่าน `headerMap_()`/`ensureColumns_` ห้าม index

- [ ] **Step 1:** เพิ่มสาม action ใน `Api.gs` ก่อนบรรทัด "ไม่รู้จักคำสั่ง" ตามรูปแบบ action เดิมเป๊ะ (ดู `contactAdmin` เป็นแม่แบบการ validate + ตอบ JSON)
- [ ] **Step 2:** แก้ `OnFormSubmit.gs` + เพิ่มชื่อคอลัมน์ใน `Config.gs` (ตาราง REFERRAL columns)
- [ ] **Step 3: ทดสอบใน Apps Script editor** — เขียน function ชั่วคราว `testBotCode_()` เรียก handler ตรง ๆ กับชีตทดสอบ ยืนยันอีเมลถึงจริง แล้วลบ function ทิ้ง (Apps Script ไม่มี test runner — บันทึกผลที่ทดสอบใน commit message)
- [ ] **Step 4:** อัปเดต `apps-script/README.md`: action ใหม่ 3 ตัว + คอลัมน์ใหม่ 3 คอลัมน์ + ขั้น deploy
- [ ] **Step 5:** commit `feat(apps-script): bot code email, advice resend, email verification`

---

### Task 6: หน้า /verify-email

**Files:**
- Create: `src/app/verify-email/page.tsx`, `src/app/verify-email/actions.ts`
- Modify: `src/lib/apps-script-api.ts` (เพิ่ม `confirmEmail`)

**Interfaces:**
- Consumes: Apps Script `confirmEmail` (Task 5)
- Produces: หน้า server component อ่าน `searchParams { id, t }` → เรียก `confirmEmail({ referralId: id, token: t })` → แสดง "ยืนยันอีเมลเรียบร้อยแล้ว ✓" หรือ "ลิงก์ไม่ถูกต้องหรือหมดอายุ" พร้อมช่องทางติดต่อ (`CONTACT` จาก `@/lib/config`); `robots: { index: false, follow: false }` แบบหน้า `/booking`

- [ ] **Step 1:** เพิ่มใน `apps-script-api.ts`:

```ts
export async function confirmEmail(payload: {
  referralId: string; token: string;
}): Promise<{ ok: boolean }> {
  return callAppsScript("confirmEmail", payload);
}
```

- [ ] **Step 2:** เขียนหน้า (ดูโครง `/answer/[token]/page.tsx` เป็นแม่แบบ: server component, ไม่มี client JS)
- [ ] **Step 3:** ทดสอบใน dev: เปิด `/verify-email?id=HEM-0001&t=wrong` เห็นข้อความ error สุภาพ ไม่มี stack trace
- [ ] **Step 4:** commit `feat(web): email verification landing page`

---

### Task 7: LINE Login เข้าแชท

**Files:**
- Create: `src/app/hemato-bot/line/route.ts`, `src/app/hemato-bot/line/callback/route.ts`

**Interfaces:**
- Consumes: `authorizeUrl`, `callbackUrl`, `exchangeCodeForProfile`, `randomToken`, `LINE_STATE_COOKIE` จาก `line-login.ts`; `loadLineLink` (Task 3); cookie helpers (Task 2)
- Produces: GET `/hemato-bot/line` → redirect ไป LINE authorize (state cookie ท่าเดียวกับ `/login/line/route.ts`); GET `/hemato-bot/line/callback` → แลก code เป็น profile → `loadLineLink(userId)`:
  - เจอ → เซ็ต `BOT_VERIFIED_COOKIE` `{ phone: phoneKey(link.phone), exp: ... }` → redirect `/?bot=verified`
  - ไม่เจอ → redirect `/?bot=unlinked` (widget อ่าน query แล้วแสดงคำแนะนำผูกบัญชี)

- [ ] **Step 1:** คัดโครงจาก `/login/line/route.ts` + `/login/line/callback/route.ts` (แพตเทิร์น state/CSRF เดิม) เปลี่ยนปลายทาง: ไม่เรียก `checkDashboardMember` แต่เรียก `loadLineLink`
- [ ] **Step 2:** ทดสอบใน dev ด้วย `dev:demo:line` (มี channel demo) — เส้นทาง redirect ทำงาน, กรณี unlinked กลับมาที่ `/?bot=unlinked`
- [ ] **Step 3:** commit `feat(bot): LINE Login path into the web chat`

---

### Task 8: Widget UI — โครง + เมนู + เช็กสถานะ/เคสของฉัน

**Files:**
- Create: `src/components/hemato-bot/HematoBotWidget.tsx` (launcher + panel + state machine), `src/components/hemato-bot/flows.ts` (นิยามเมนู/ข้อความ — แยกไฟล์ให้แก้ copy ได้โดยไม่แตะ logic), `public/hemato-bot.png` (ย่อจาก `docs/Hemato_bot.png` ให้ ≤ 100 KB ด้วย `sips -Z 256`)
- Modify: `src/app/layout.tsx` (mount ก่อน `<SiteFooter />`)

**Interfaces:**
- Consumes: ทุก action จาก Task 4
- Produces: `<HematoBotWidget />` client component:
  - state: `{ step: BotStep; messages: BotMessage[] }` โดย `BotMessage = { from: "bot" | "user"; text: string; chips?: { label: string; go: BotStep }[]; links?: { label: string; href: string }[] }`
  - `BotStep` (string union): `"menu" | "status.ask" | "status.result" | "cases.ask" | "cases.result" | "answers.entry" | "answers.phone" | "answers.code" | "answers.list" | "regimens.ask" | "regimens.result" | "indications.type" | "indications.disease" | "booking" | "reschedule" | "group4" | "contact"`
  - ซ่อนตัวเองเมื่อ `usePathname()` ขึ้นต้นด้วย `/dashboard`, `/login`, `/answer`
  - เปิดอัตโนมัติพร้อมข้อความที่เหมาะสมเมื่อ URL มี `?bot=verified` หรือ `?bot=unlinked` (Task 7)
  - ทุก step มี chip "⌂ เมนูหลัก"; ปุ่ม input เป็น `<input inputMode="numeric">` สำหรับเบอร์/รหัส
  - แผงสูงไม่เกิน `70vh`, กว้าง `min(24rem, calc(100vw - 2rem))`, `position: fixed; bottom: 1rem; right: 1rem; z-index` สูงกว่า FontSizeControl

- [ ] **Step 1:** สร้าง `flows.ts` — เมนูหลัก 8 ปุ่มตาม spec (ลำดับ: เช็กสถานะ, เคสของฉัน, อ่านคำตอบ, จองนัด, เลื่อน/ยกเลิกนัด, สูตรเคมี, transplant indication, กลุ่ม 4/ติดต่อแอดมิน) + ข้อความทักทาย "สวัสดีครับ ผม Hemato Bot ถามอะไรผมได้เลย 🩸"
- [ ] **Step 2:** สร้าง widget: launcher เป็น `<button>` รูปมาสคอต (มี `aria-label="เปิดแชท Hemato Bot"`), แผงแชทเป็น `<div role="dialog">`; flow เช็กสถานะ: กด chip → พิมพ์เลข → เรียก `lookupStatusAction` → bubble ผลลัพธ์ (ไม่พบ = "ไม่พบเลขที่อ้างอิงนี้ ตรวจรูปแบบ เช่น HEM-0001") ; flow เคสของฉัน: พิมพ์เบอร์ → `listCasesAction` → รายการพร้อมสถานะ
- [ ] **Step 3:** mount ใน `layout.tsx` ก่อน `<SiteFooter />`
- [ ] **Step 4:** ตรวจใน dev (`npm run dev:demo`) ผ่าน browser tools: เปิด widget, เดินทั้งสอง flow ด้วย mock data, เช็ก console ไม่มี error, `resize_window` mobile 375px แล้วแผงไม่ล้นจอ
- [ ] **Step 5:** commit `feat(bot): widget shell with status and my-cases flows`

---

### Task 9: Widget — flow อ่านคำตอบ (LINE + รหัสอีเมล)

**Files:**
- Modify: `src/components/hemato-bot/HematoBotWidget.tsx`, `src/components/hemato-bot/flows.ts`

**Interfaces:**
- Consumes: `requestCodeAction`, `verifyCodeAction`, `verifiedCasesAction`, `resendAnswerAction`, เส้นทาง `/hemato-bot/line` (Task 7)
- Produces: step `answers.*`:
  1. `answers.entry`: เรียก `verifiedCasesAction()` ก่อน — ถ้า verified อยู่แล้วข้ามไปแสดงรายการทันที; ไม่ก็เสนอ 2 ปุ่ม: "เข้าด้วย LINE" (`<a href="/hemato-bot/line">`) / "รับรหัสทางอีเมล"
  2. `answers.phone` → `requestCodeAction` → bubble "ส่งรหัส 6 หลักไปที่อีเมลที่ลงทะเบียนไว้แล้ว (ใช้ได้ 10 นาที) ตรวจโฟลเดอร์จดหมายขยะด้วย" (ข้อความเดียวกันทั้งกรณีส่งจริง/เบอร์ไม่พบ)
  3. `answers.code` → `verifyCodeAction` → ผิดพิมพ์ใหม่ได้, ถูกไป `answers.list`
  4. `answers.list`: เคสที่มี `answerUrl` → ลิงก์ "เปิดอ่านคำตอบ" (target `_self`) + chip "ส่งสำเนาเข้าอีเมลเดิม" (→ `resendAnswerAction` → "ส่งสำเนาไปที่อีเมลที่ลงทะเบียนไว้แล้ว ✓"); เคสยังไม่ตอบ → "ยังไม่มีคำตอบ"; กรณี `?bot=unlinked` → bubble อธิบาย + ลิงก์ LINE OA (`LINE_OA` จาก `@/lib/config`) ให้พิมพ์ "ผูกบัญชี"

- [ ] **Step 1:** implement ตามลำดับข้างบน
- [ ] **Step 2:** ตรวจใน dev: เดินครบทั้งเส้นรหัส (mock: `requestCodeAction` ใน demo ไม่มี Apps Script ให้ log code ลง server console เพื่อทดสอบ — dev เท่านั้น ห้าม log ใน production ตรวจด้วย `process.env.NODE_ENV !== "production"`), เส้น LINE ทดสอบเฉพาะ redirect
- [ ] **Step 3:** commit `feat(bot): read-answers flow via LINE or email code`

---

### Task 10: Widget — สูตรเคมี + transplant indications + เมนูลิงก์

**Files:**
- Modify: `src/components/hemato-bot/HematoBotWidget.tsx`, `src/components/hemato-bot/flows.ts`

**Interfaces:**
- Consumes: `searchRegimensAction` (Task 4), `TRANSPLANT_INDICATIONS`, `TRANSPLANT_TYPE_LABEL_TH` (import ตรงเข้า client ได้ — เป็นข้อมูล static ในโค้ด)
- Produces:
  - `regimens.ask`: ช่องพิมพ์คำค้น + chips กลุ่มโรคเด่น (สร้างจากคำตอบครั้งแรกของ `searchRegimensAction("")` — unique `diseaseGroup`) → `regimens.result` แสดง `abbr` ตัวหนา + `components` ตัวรอง สูงสุด 15 รายการ + บรรทัดท้าย "ต้องการความเห็นสูตรยา → ส่งเคสกลุ่ม 2" ลิงก์ `/refer/regimen-consult` (เช็ก slug จริงจาก `REFERRAL_TYPE_BY_SLUG` ตอน implement)
  - `indications.type`: ปุ่ม Auto/Allo → `indications.disease`: ปุ่มรายโรค → bubble เกณฑ์ `statusTh` + `ageTh` + ข้อความกำกับ "ข้อมูลประกอบการตัดสินใจ ไม่ใช่ด่านกั้น — ส่งเคสได้แม้เกณฑ์ยังไม่ครบ" + ลิงก์ "จองนัดกลุ่ม 1" → `/book/transplant`
  - เมนู `booking` / `reschedule` / `group4` / `contact`: bubble อธิบายสั้น + ลิงก์ `/book/transplant`, `/booking`, ข้อความกลุ่ม 4 (คัด copy จาก `/refer/[type]/page.tsx` ส่วนกลุ่ม 4: Siriraj Connect + เบอร์) , `/contact`

- [ ] **Step 1:** implement ทั้งสาม flow
- [ ] **Step 2:** ตรวจใน dev: ค้น "CHOP" เจอสูตร, เลือก Auto → Multiple myeloma เห็นเกณฑ์ตรงกับ `transplant-indications.ts`, ลิงก์ทุกเมนูกดแล้วไปหน้าถูก
- [ ] **Step 3:** commit `feat(bot): regimen search, transplant indications, nav menus`

---

### Task 11: ธง "อีเมลยังไม่ยืนยัน" บน dashboard

**Files:**
- Modify: `src/lib/referral-repository.ts` (เพิ่ม field ใน `Referral` + `toReferral`), `src/app/dashboard/page.tsx` หรือ `src/components/DashboardClient.tsx` (จุดที่วาดรายการเคส — ดูโครงจริงตอน implement), `src/components/Badge.tsx` (ถ้ารองรับ variant อยู่แล้วใช้เลย)

**Interfaces:**
- Consumes: คอลัมน์ `email_verified_at`, `email_mismatch` (Task 5)
- Produces: `Referral.emailUnverified: boolean` — จริงเมื่อ (`email_verified_at` ว่าง และเคสอายุเกิน 24 ชม.) หรือ `email_mismatch === "yes"`; แสดง badge เหลือง "⚠️ อีเมลยังไม่ยืนยัน" ในรายการเคสกลุ่ม 2/3 ที่ยังไม่ตอบ

- [ ] **Step 1:** เพิ่มใน `toReferral`:

```ts
emailUnverified:
  text(row["email_mismatch"]).toLowerCase() === "yes" ||
  (!text(row["email_verified_at"]) &&
    number(row["elapsed_business_hours"]) >= 8),
```

(8 ชั่วโมงทำการ = 1 วันทำการ — ใช้คอลัมน์ชั่วโมงทำการที่มีอยู่แทนคำนวณเอง)

- [ ] **Step 2:** วาด badge ในรายการเคส (ตามแพตเทิร์น badge สถานะเดิม)
- [ ] **Step 3:** ตรวจใน dev ด้วย mock (เพิ่ม mock 1 เคสที่ mismatch ใน `mock-referrals.ts`)
- [ ] **Step 4:** commit `feat(dashboard): unverified-email flag on group 2/3 cases`

---

### Task 12: เอกสาร + ตรวจก่อนปล่อย

**Files:**
- Create: `docs/HEMATO_BOT.md` (ผู้ดูแลระบบ: เมนูทั้งหมด, การเปิดเผยข้อมูล, วิธีเพิ่มคำถาม "ยืนยันอีเมล (พิมพ์ซ้ำ)" ใน Google Form ทีละขั้น, เช็กลิสต์ LINE console — ช่อง Login กับ Messaging API ต้องอยู่ provider เดียวกัน)
- Modify: `README.md` (ย่อหน้าเดียว: มี Hemato Bot + ชี้ไป docs), `docs/LINE_TEMPLATES.md` (ถ้าข้อความอีเมลรหัส/ยืนยันควรแก้ได้จาก config sheet ตาม NFR-005 — ระบุ key ใหม่)

- [ ] **Step 1:** เขียนเอกสารทั้งสอง
- [ ] **Step 2: ตรวจรวมก่อนปล่อย** — รัน `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run cf:build` ผ่านทั้งหมด; เดินทุก flow ใน browser (desktop + mobile 375px + dark mode ถ้าธีมรองรับ); เช็กว่า widget ไม่บัง FontSizeControl และปุ่ม BackButton
- [ ] **Step 3:** ใช้ skill `anthropic-skills:website-auditor` ตรวจ security/PDPA ของ flow ใหม่ก่อน deploy
- [ ] **Step 4:** commit `docs: Hemato Bot admin guide` แล้วสรุปรายการที่ต้องทำมือ (Google Form, LINE console, deploy Apps Script) ให้ผู้ใช้

---

## Self-Review (ทำแล้ว)

- Spec coverage: เมนูทั้ง 9 → Task 8–10; ข้อ B → Task 3–4; ข้อ C ทางหลัก → Task 7, ทางรอง → Task 4+5+9; ข้อ F → Task 5+6+11 + คู่มือฟอร์มใน Task 12; ข้อ H → Task 10; ข้อ G ถูกตัดตาม spec — ไม่มี task (ถูกต้อง)
- Placeholder scan: ทุก task มีโค้ด/ขั้นตอนจริง; จุดที่ให้ "ดูของเดิมเป็นแม่แบบ" ระบุไฟล์แม่แบบชัดทุกจุด
- Type consistency: `BotCaseStatus`, ชื่อ action, ชื่อ cookie ตรงกันทุก task ที่อ้างถึง
