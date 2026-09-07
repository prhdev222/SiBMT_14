import { after, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ตัวคั่น webhook Telegram → Apps Script
 *
 * ทำไมต้องมี: Apps Script (/exec) ตอบ Telegram ผ่าน redirect (302→200) ซึ่ง
 * Telegram มองว่าส่งไม่สำเร็จ แล้วส่ง update เดิมซ้ำไม่หยุด (loop) — ต่อให้
 * ฝั่ง Apps Script กัน "ตอบซ้ำ" ด้วย update_id ได้ ก็ยังกัน "Telegram ส่งซ้ำ"
 * ไม่ได้ เพราะปัญหาอยู่ที่รูปแบบการตอบ ไม่ใช่ตัวเนื้อหา
 *
 * ตัวคั่นนี้ (รันบน Cloudflare Worker) ตอบ Telegram ด้วย HTTP 200 ตรง ๆ
 * ทันที → Telegram พอใจ เลิก retry → แล้วค่อย forward update ต่อให้ Apps
 * Script ทำงานจริงหลังตอบเสร็จ (after) โดยไม่ปล่อยให้ Telegram รอ
 *
 * ตั้ง webhook ให้ชี้มาที่ URL นี้ (ไม่ใช่ /exec ของ Apps Script):
 *   https://<โดเมนเว็บ>/api/telegram
 */
export async function POST(request: Request) {
  // ถ้าตั้ง TELEGRAM_WEBHOOK_SECRET ไว้ → ยืนยันว่าเป็น Telegram จริง (กันคนยิงปลอม)
  // ไม่ตั้งก็ได้ — ฝั่ง Apps Script ยังกรองด้วย chat_id ที่อนุญาตอยู่แล้ว
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (secret) {
    const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (got !== secret) {
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  const target = process.env.BOOKING_API_URL;
  const body = await request.text();

  // ส่งต่อให้ Apps Script หลังตอบ Telegram ไปแล้ว — Telegram ไม่ต้องรอ
  // (fetch ตามด้วย redirect ของ Apps Script ได้เองอยู่แล้ว ต่างจาก Telegram)
  if (target) {
    after(async () => {
      try {
        await fetch(target, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
      } catch {
        // ปล่อยผ่าน — Telegram ได้ 200 ไปแล้ว ไม่มีการ retry ให้เสียเวลา
      }
    });
  }

  // ตอบ 200 ทันที (ตรง ไม่ redirect) — หัวใจของการหยุด loop
  return NextResponse.json({ ok: true });
}

/** ให้เปิดใน browser เช็กได้ว่า route มีอยู่ (Telegram ใช้ POST เท่านั้น) */
export function GET() {
  return NextResponse.json({ ok: true, endpoint: "telegram-webhook" });
}
