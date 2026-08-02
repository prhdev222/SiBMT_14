#!/usr/bin/env node
/**
 * เตรียมไฟล์ชีตตารางเวรให้พร้อมใช้งาน
 *
 * ใช้:  node scripts/setup-schedule-sheet.mjs
 *
 * สร้างแท็บและหัวตารางที่ยังไม่มีให้เอง แล้วทดสอบว่าเขียนไฟล์ได้จริง
 * ต่อเติมอย่างเดียว ไม่ลบไม่ทับข้อมูลเดิม รันซ้ำได้ปลอดภัย
 */

import { readFileSync } from "node:fs";
import dns from "node:dns";

/**
 * บังคับให้ต่อผ่าน IPv4 ก่อน
 *
 * เครื่องที่ IPv6 ตั้งค่าไว้แต่ใช้จริงไม่ได้ (พบบ่อยในเครือข่ายโรงพยาบาล)
 * จะทำให้ Node วิ่งไปหา IPv6 ก่อนแล้วรอจนหมดเวลา ขึ้นเป็น "fetch failed"
 * ทั้งที่เครือข่ายใช้งานได้ปกติ — สลับลำดับให้ลอง IPv4 ก่อนจึงข้ามปัญหานี้ไป
 */
dns.setDefaultResultOrder("ipv4first");

const REQUIRED = {
  fellows: ["fellow_name", "active", "note"],
  fellow_schedule: [
    "clinic_date",
    "fellow_name",
    "max_slots",
    "note",
    "start_time",
    "end_time",
  ],
};

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trimStart().startsWith("#")) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const fileId = env.GOOGLE_SCHEDULE_SHEET_ID;

if (!fileId) {
  console.error("❌ ยังไม่ได้ตั้ง GOOGLE_SCHEDULE_SHEET_ID ใน .env.local\n");
  console.error("   1. สร้าง Google Sheet ไฟล์ใหม่ (แยกจากไฟล์ข้อมูลผู้ป่วย)");
  console.error("   2. คัดลอก ID จาก URL — ส่วนที่อยู่ระหว่าง /d/ กับ /edit");
  console.error("   3. ใส่เป็น GOOGLE_SCHEDULE_SHEET_ID ใน .env.local");
  process.exit(1);
}

/* ---------- ขอ access token ---------- */

const b64u = (b) => Buffer.from(b).toString("base64url");
const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));

const now = Math.floor(Date.now() / 1000);
const unsigned =
  enc({ alg: "RS256", typ: "JWT" }) +
  "." +
  enc({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });

const pem = (env.GOOGLE_PRIVATE_KEY || "")
  .replace(/\\n/g, "\n")
  .replace(/^"|"$/g, "")
  .replace(/-----[A-Z ]+-----/g, "")
  .replace(/\s+/g, "");

const key = await crypto.subtle.importKey(
  "pkcs8",
  Uint8Array.from(Buffer.from(pem, "base64")),
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  false,
  ["sign"],
);
const sig = await crypto.subtle.sign(
  "RSASSA-PKCS1-v1_5",
  key,
  new TextEncoder().encode(unsigned),
);

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: unsigned + "." + b64u(new Uint8Array(sig)),
  }),
});

if (!tokenRes.ok) {
  console.error("❌ ขอ access token ไม่สำเร็จ — ตรวจ GOOGLE_PRIVATE_KEY");
  process.exit(1);
}
const { access_token } = await tokenRes.json();

/* ---------- ตรวจไฟล์ ---------- */

const api = "https://sheets.googleapis.com/v4/spreadsheets";
const metaRes = await fetch(
  `${api}/${fileId}?fields=properties.title,sheets.properties.title`,
  { headers: { Authorization: `Bearer ${access_token}` } },
);

if (metaRes.status === 403 || metaRes.status === 404) {
  console.error("❌ เปิดไฟล์ตารางเวรไม่ได้\n");
  console.error("   แชร์ไฟล์ให้อีเมลนี้แบบ Editor ก่อน:");
  console.error("   " + clientEmail + "\n");
  console.error("   (เปิดไฟล์ → ปุ่ม Share → วางอีเมล → เลือก Editor → Send)");
  process.exit(1);
}
if (!metaRes.ok) {
  console.error("❌ อ่านไฟล์ไม่สำเร็จ (" + metaRes.status + ")");
  process.exit(1);
}

const meta = await metaRes.json();
console.log('✓ เปิดไฟล์ "' + meta.properties.title + '" ได้');

const tabs = meta.sheets.map((s) => s.properties.title);
let problems = 0;

/** สร้างแท็บที่ยังไม่มี */
const missingTabs = Object.keys(REQUIRED).filter((t) => !tabs.includes(t));
if (missingTabs.length > 0) {
  const res = await fetch(`${api}/${fileId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: missingTabs.map((title) => ({ addSheet: { properties: { title } } })),
    }),
  });

  if (!res.ok) {
    console.error("❌ สร้างแท็บไม่สำเร็จ — สิทธิ์ที่แชร์ต้องเป็น Editor");
    console.error("   แชร์ไฟล์ให้ " + clientEmail + " แบบ Editor");
    process.exit(1);
  }
  console.log("✓ สร้างแท็บ: " + missingTabs.join(", "));
}

/** เติมหัวตารางที่ยังขาด — ต่อท้ายอย่างเดียว ไม่แตะคอลัมน์เดิม */
for (const [tab, columns] of Object.entries(REQUIRED)) {
  const res = await fetch(
    `${api}/${fileId}/values/${encodeURIComponent(tab + "!1:1")}`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  const headers = ((await res.json()).values?.[0] ?? []).map((h) =>
    String(h).trim(),
  );
  const missing = columns.filter((c) => !headers.includes(c));

  if (missing.length === 0) {
    console.log(`✓ แท็บ "${tab}" มีคอลัมน์ครบ`);
    continue;
  }

  const startColumn = columnLetter(headers.length);
  const endColumn = columnLetter(headers.length + missing.length - 1);
  const write = await fetch(
    `${api}/${fileId}/values/` +
      encodeURIComponent(`${tab}!${startColumn}1:${endColumn}1`) +
      "?valueInputOption=RAW",
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [missing] }),
    },
  );

  if (write.ok) {
    console.log(`✓ แท็บ "${tab}" เติมคอลัมน์: ${missing.join(", ")}`);
  } else {
    console.error(`❌ เติมคอลัมน์ในแท็บ "${tab}" ไม่สำเร็จ`);
    problems++;
  }
}

/** 0 → A, 25 → Z, 26 → AA */
function columnLetter(index) {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/* ---------- ตรวจว่าเขียนได้จริง ---------- */

if (problems === 0) {
  // เขียนลงเซลล์ที่ไกลจากข้อมูลจริง แล้วล้างทิ้งทันที
  const probe = "fellows!Z999";
  const write = await fetch(
    `${api}/${fileId}/values/${encodeURIComponent(probe)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [["test"]] }),
    },
  );

  if (write.ok) {
    await fetch(`${api}/${fileId}/values/${encodeURIComponent(probe)}:clear`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}` },
    });
    console.log("✓ เขียนไฟล์ได้ (ทดสอบแล้วล้างทิ้งเรียบร้อย)");
    console.log("\n🎉 พร้อมใช้งาน — เปิด /dashboard/schedule ได้เลย");
  } else {
    console.error("\n❌ อ่านได้แต่เขียนไม่ได้");
    console.error("   สิทธิ์ที่แชร์ให้ " + clientEmail);
    console.error("   ต้องเป็น Editor ไม่ใช่ Viewer หรือ Commenter");
    problems++;
  }
}

process.exit(problems === 0 ? 0 : 1);
