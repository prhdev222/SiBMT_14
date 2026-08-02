#!/usr/bin/env node
/**
 * สร้างบรรทัดผู้ใช้สำหรับ DASHBOARD_USERS
 *
 * ใช้:  node scripts/make-user.mjs somchai
 *
 * สคริปต์จะถามรหัสผ่าน (พิมพ์แล้วไม่ขึ้นบนจอ) แล้วพิมพ์บรรทัดที่คัดลอกไปวาง
 * ใน .env.local หรือ Cloudflare Pages ได้เลย
 *
 * รหัสผ่านตัวจริงไม่ถูกเก็บที่ไหนทั้งสิ้น — สิ่งที่เก็บคือ PBKDF2 hash
 * ซึ่งย้อนกลับเป็นรหัสผ่านไม่ได้ ถ้า environment หลุดก็ยังเข้าระบบไม่ได้
 */

import { webcrypto as crypto } from "node:crypto";
import { stdin, stdout, argv, exit } from "node:process";

const ITERATIONS = 210_000;

/**
 * base64url ไม่มี padding — ทั้งค่าจึงมีแต่ [A-Za-z0-9-_]
 * สำคัญเพราะค่านี้ต้องไปอยู่ในไฟล์ .env ซึ่งตีความ `$` เป็นตัวแปร
 * และ `+` `/` `=` ก็สร้างปัญหาเวลาวางผ่าน shell หรือ Cloudflare dashboard
 */
const b64 = (bytes) =>
  Buffer.from(bytes).toString("base64url");

// โหมดสร้าง AUTH_SECRET อย่างเดียว ไม่ต้องมีชื่อผู้ใช้
if (argv[2] === "--secret") {
  console.log(`AUTH_SECRET=${b64(crypto.getRandomValues(new Uint8Array(32)))}`);
  exit(0);
}

const username = (argv[2] ?? "").trim().toLowerCase();
if (!username || /[:;\s]/.test(username)) {
  console.error("ใช้: node scripts/make-user.mjs <ชื่อผู้ใช้>");
  console.error("     node scripts/make-user.mjs --secret   (สร้าง AUTH_SECRET)");
  console.error("\nชื่อผู้ใช้ห้ามมีช่องว่าง เครื่องหมาย : หรือ ;");
  exit(1);
}

/** ตัวอักษรที่เหลือจาก chunk ก่อนหน้า — เกิดเมื่อ input ถูก pipe เข้ามาทีเดียว */
let buffered = "";

/** อ่านรหัสผ่านโดยไม่ echo ตัวอักษรออกจอ */
function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);

    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);

    let value = "";

    const finish = (rest) => {
      buffered = rest;
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      stdin.removeListener("data", onData);
      stdin.pause();
      stdout.write("\n");
      resolve(value);
    };

    // ไล่ทีละตัวอักษร ไม่ใช่ตรวจทั้ง chunk รวดเดียว
    // เพราะเมื่อ input ถูก pipe เข้ามา ทั้งสองบรรทัดจะมาในก้อนเดียว
    // ส่วนที่เหลือหลังบรรทัดแรกต้องเก็บไว้ให้การอ่านครั้งถัดไป ไม่งั้นจะค้าง
    const consume = (text) => {
      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Enter หรือ Ctrl-D = จบการพิมพ์
        if (char === "\r" || char === "\n" || char === "\u0004") {
          finish(text.slice(i + 1).replace(/^\n/, ""));
          return true;
        }
        // Ctrl-C = ยกเลิก
        if (char === "\u0003") {
          if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
          stdout.write("\n");
          exit(130);
        }
        // Backspace / Delete
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
      return false;
    };

    const onData = (chunk) => consume(chunk.toString("utf8"));

    const leftover = buffered;
    buffered = "";
    if (leftover && consume(leftover)) return;

    stdin.resume();
    stdin.on("data", onData);
  });
}

const password = await askHidden(`รหัสผ่านของ ${username}: `);
const again = await askHidden("พิมพ์อีกครั้งเพื่อยืนยัน: ");

if (password !== again) {
  console.error("\nรหัสผ่านสองครั้งไม่ตรงกัน — ยังไม่ได้สร้างอะไร");
  exit(1);
}
if (password.length < 12) {
  console.error("\nรหัสผ่านสั้นเกินไป — ขอ 12 ตัวอักษรขึ้นไป");
  console.error(
    "แนะนำเป็นวลีที่จำได้ เช่น 3-4 คำต่อกัน จำง่ายกว่าและเดายากกว่ารหัสสั้นที่มีอักขระพิเศษ",
  );
  console.error(
    "\nระบบนี้ใช้รหัสผ่านเป็นด่านเดียว ความยาวจึงสำคัญกว่าความซับซ้อน",
  );
  exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  key,
  256,
);

const entry = `${username}:pbkdf2.${ITERATIONS}.${b64(salt)}.${b64(new Uint8Array(bits))}`;

console.log("\nคัดลอกบรรทัดนี้ไปต่อท้าย DASHBOARD_USERS (คั่นแต่ละคนด้วย ;)\n");
console.log(entry);
console.log("\nตัวอย่างเมื่อมีสองคน:");
console.log(`DASHBOARD_USERS="${entry};somsri:pbkdf2.210000..."`);
console.log(
  "\nยังไม่มี AUTH_SECRET ให้สร้างด้วย:  node scripts/make-user.mjs --secret",
);
