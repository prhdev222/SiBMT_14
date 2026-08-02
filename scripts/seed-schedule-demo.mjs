#!/usr/bin/env node
/**
 * ใส่ข้อมูลตัวอย่างลงไฟล์ชีตตารางเวร เพื่อดูหน้าตาปฏิทินเมื่อมีคนหลายคน
 *
 * ใส่:  node scripts/seed-schedule-demo.mjs
 * ลบ:   node scripts/seed-schedule-demo.mjs --undo
 *
 * ทุกแถวที่สคริปต์สร้างจะมีคำว่า "ตัวอย่าง" ในคอลัมน์ note
 * --undo ลบเฉพาะแถวที่มีเครื่องหมายนั้น จึงไม่แตะข้อมูลจริงที่กรอกเอง
 *
 * ⚠️ ต้องรัน --undo ก่อนเปิดใช้งานจริง ไม่งั้นตารางเวรปลอมจะปนกับของจริง
 */

import { readFileSync } from "node:fs";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

/** เครื่องหมายที่ใช้แยกแถวตัวอย่างออกจากแถวจริง */
const MARKER = "ตัวอย่าง";

/** fellow สมมุติ 4 คน พร้อมวันและเวลาที่ออกตรวจประจำ */
const DEMO = [
  { name: "พญ. ณัฐกานต์", weekday: 1, start: "09:00", end: "12:00", slots: 2 },
  { name: "นพ. ธนกฤต", weekday: 2, start: "13:00", end: "16:00", slots: 2 },
  { name: "พญ. ศิรินทิพย์", weekday: 3, start: "09:00", end: "12:00", slots: 1 },
  { name: "นพ. พีรพัฒน์", weekday: 4, start: "13:00", end: "16:00", slots: 2 },
];

/** จำนวนสัปดาห์ที่สร้างย้อนจากต้นเดือนนี้ */
const WEEKS = 8;

const undo = process.argv.includes("--undo");

/* ---------- อ่านค่าและขอ token ---------- */

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trimStart().startsWith("#")) {
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

const fileId = env.GOOGLE_SCHEDULE_SHEET_ID;
if (!fileId) {
  console.error("❌ ยังไม่ได้ตั้ง GOOGLE_SCHEDULE_SHEET_ID ใน .env.local");
  process.exit(1);
}

const b64u = (b) => Buffer.from(b).toString("base64url");
const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
const now = Math.floor(Date.now() / 1000);

const unsigned =
  enc({ alg: "RS256", typ: "JWT" }) +
  "." +
  enc({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
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
const { access_token } = await tokenRes.json();

const api = "https://sheets.googleapis.com/v4/spreadsheets";
const auth = { Authorization: `Bearer ${access_token}` };
const jsonAuth = { ...auth, "Content-Type": "application/json" };

/* ---------- ตัวช่วย ---------- */

async function readTab(tab) {
  const res = await fetch(
    `${api}/${fileId}/values/${encodeURIComponent(tab + "!A:ZZ")}`,
    { headers: auth },
  );
  const values = (await res.json()).values ?? [];
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values[0].map((h) => String(h).trim());
  const rows = values.slice(1).map((row, index) => {
    const record = { _row: index + 2 };
    headers.forEach((h, i) => {
      if (h) record[h] = row[i] ?? "";
    });
    return record;
  });
  return { headers, rows };
}

async function appendTab(tab, headers, items) {
  if (items.length === 0) return;
  const values = items.map((item) => headers.map((h) => item[h] ?? ""));

  const res = await fetch(
    `${api}/${fileId}/values/${encodeURIComponent(tab + "!A:ZZ")}:append` +
      "?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
    { method: "POST", headers: jsonAuth, body: JSON.stringify({ values }) },
  );
  if (!res.ok) throw new Error(`เพิ่มแถวใน ${tab} ไม่สำเร็จ: ${await res.text()}`);
}

async function gidOf(tab) {
  const res = await fetch(
    `${api}/${fileId}?fields=sheets.properties(sheetId,title)`,
    { headers: auth },
  );
  const found = (await res.json()).sheets.find(
    (s) => s.properties.title === tab,
  );
  if (!found) throw new Error(`ไม่พบแท็บ ${tab}`);
  return found.properties.sheetId;
}

async function deleteRows(tab, rowNumbers) {
  if (rowNumbers.length === 0) return;
  const gid = await gidOf(tab);

  // ลบจากล่างขึ้นบน ไม่งั้นเลขแถวที่เหลือจะเลื่อนหลังลบแถวแรก
  const requests = [...rowNumbers]
    .sort((a, b) => b - a)
    .map((rowNumber) => ({
      deleteDimension: {
        range: {
          sheetId: gid,
          dimension: "ROWS",
          startIndex: rowNumber - 1,
          endIndex: rowNumber,
        },
      },
    }));

  const res = await fetch(`${api}/${fileId}:batchUpdate`, {
    method: "POST",
    headers: jsonAuth,
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`ลบแถวใน ${tab} ไม่สำเร็จ: ${await res.text()}`);
}

const isDemo = (row) => String(row["note"] ?? "").includes(MARKER);

/* ---------- ลบข้อมูลตัวอย่าง ---------- */

if (undo) {
  const schedule = await readTab("fellow_schedule");
  const demoDays = schedule.rows.filter(isDemo).map((r) => r._row);
  await deleteRows("fellow_schedule", demoDays);
  console.log(`✓ ลบวันออกตรวจตัวอย่าง ${demoDays.length} แถว`);

  const fellows = await readTab("fellows");
  const demoFellows = fellows.rows.filter(isDemo);
  await deleteRows(
    "fellows",
    demoFellows.map((r) => r._row),
  );
  console.log(`✓ ลบรายชื่อ fellow ตัวอย่าง ${demoFellows.length} คน`);

  console.log("\nข้อมูลจริงที่กรอกเองไม่ถูกแตะต้อง");
  process.exit(0);
}

/* ---------- ใส่ข้อมูลตัวอย่าง ---------- */

const fellows = await readTab("fellows");
const existingNames = new Set(
  fellows.rows.map((r) => String(r["fellow_name"] ?? "").trim()),
);

const newFellows = DEMO.filter((d) => !existingNames.has(d.name)).map((d) => ({
  fellow_name: d.name,
  active: "yes",
  note: MARKER,
}));

await appendTab(
  "fellows",
  fellows.headers.length > 0 ? fellows.headers : ["fellow_name", "active", "note"],
  newFellows,
);
console.log(`✓ เพิ่ม fellow ตัวอย่าง ${newFellows.length} คน`);

/** วันจันทร์ของสัปดาห์ที่มีวันที่ 1 ของเดือนนี้ */
const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const monday = new Date(firstOfMonth);
monday.setDate(firstOfMonth.getDate() - ((firstOfMonth.getDay() + 6) % 7));

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
  `${String(d.getDate()).padStart(2, "0")}`;

const schedule = await readTab("fellow_schedule");
const taken = new Set(
  schedule.rows.map(
    (r) => `${String(r["clinic_date"] ?? "").trim()}|${String(r["fellow_name"] ?? "").trim()}`,
  ),
);

const days = [];
for (let week = 0; week < WEEKS; week++) {
  for (const fellow of DEMO) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + week * 7 + (fellow.weekday - 1));

    const key = `${iso(date)}|${fellow.name}`;
    if (taken.has(key)) continue;

    days.push({
      clinic_date: iso(date),
      fellow_name: fellow.name,
      max_slots: String(fellow.slots),
      note: MARKER,
      start_time: fellow.start,
      end_time: fellow.end,
    });
  }
}

await appendTab(
  "fellow_schedule",
  schedule.headers.length > 0
    ? schedule.headers
    : ["clinic_date", "fellow_name", "max_slots", "note", "start_time", "end_time"],
  days,
);

console.log(`✓ เพิ่มวันออกตรวจตัวอย่าง ${days.length} วัน (${WEEKS} สัปดาห์)`);
console.log("\nเปิด /dashboard/schedule ดูได้เลย");
console.log("\n⚠️ ลบทิ้งก่อนใช้งานจริง:  node scripts/seed-schedule-demo.mjs --undo");
