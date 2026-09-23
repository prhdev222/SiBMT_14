import {
  findGroup1FellowByLineUser,
  linkGroup1FellowLineUser,
  listGroup1Bookings,
  unlinkGroup1FellowLineUser,
} from "@/lib/group1-booking-db";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
};

export async function POST(request: Request) {
  const body = await request.text();
  if (!(await validSignature(body, request.headers.get("x-line-signature")))) {
    return new Response("invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body) as { events?: LineEvent[] };
  for (const event of payload.events ?? []) {
    if (event.replyToken && event.source?.userId) {
      await reply(event.replyToken, await answer(event));
    }
  }
  return Response.json({ ok: true });
}

async function answer(event: LineEvent): Promise<string> {
  const userId = event.source?.userId || "";
  const text = event.message?.type === "text" ? (event.message.text || "").trim() : "";
  if (event.type === "follow" || !text) return publicHelp();

  if (text.startsWith("ลงทะเบียน")) {
    const match = text.match(/^ลงทะเบียน\s+(.+?)\s+([^\s]+)$/);
    if (!match) return "รูปแบบ: ลงทะเบียน ชื่อ Fellow รหัสลงทะเบียน";
    try {
      await linkGroup1FellowLineUser(match[1], userId, match[2]);
      return `ลงทะเบียนสำเร็จค่ะ ต่อไปนี้ถามคิวนัดของ ${match[1].trim()} ได้เลย\nพิมพ์ “เมนู” เพื่อดูคำสั่ง`;
    } catch (error) {
      return error instanceof Error ? error.message : "ลงทะเบียนไม่สำเร็จ";
    }
  }

  const fellowName = await findGroup1FellowByLineUser(userId);
  if (!fellowName) {
    if (/(ทั่วไป|refer|ผู้ป่วยนอก)/i.test(text)) return generalReferralHelp();
    if (/(ปลูกถ่าย|transplant|stem cell|เซลล์ต้นกำเนิด)/i.test(text)) return transplantHelp();
    return publicHelp();
  }
  if (["ยกเลิกการเชื่อมต่อ", "เลิกผูก"].includes(text)) {
    await unlinkGroup1FellowLineUser(userId);
    return "ยกเลิกการเชื่อมต่อแล้วค่ะ หากต้องการใช้ใหม่ให้ลงทะเบียนอีกครั้ง";
  }
  if (["เมนู", "menu", "ช่วยเหลือ", "เริ่ม"].includes(text.toLowerCase())) return menu(fellowName);

  const requestedDate = text.match(/(?:คิว|นัด)?\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
  if (requestedDate) return formatBookings(fellowName, requestedDate, requestedDate, `คิววันที่ ${requestedDate}`);
  if (text.includes("วันนี้")) {
    const today = bangkokToday();
    return formatBookings(fellowName, today, today, "คิววันนี้");
  }
  if (text.includes("สัปดาห์") || text.includes("ใกล้") || text.includes("14 วัน")) {
    const today = bangkokToday();
    return formatBookings(fellowName, today, addDays(today, 14), "คิวใน 14 วันข้างหน้า");
  }
  return `ไม่เข้าใจคำถามค่ะ\n\n${menu(fellowName)}`;
}

function publicHelp(): string {
  return [
    "สวัสดีค่ะ เลือกบริการที่ต้องการได้เลย",
    "",
    "• นัดพบแพทย์ปลูกถ่ายฯ",
    "https://sibmt-14.uradev222.workers.dev/refer/transplant",
    "",
    "• Refer ผู้ป่วยนอกทั่วไป",
    "https://sibmt-14.uradev222.workers.dev/refer/general",
    "",
    "• Fellow ดูคิวนัด: พิมพ์ ลงทะเบียน ชื่อ Fellow รหัสลงทะเบียน",
  ].join("\n");
}

function generalReferralHelp(): string {
  return `Refer ผู้ป่วยนอกทั่วไป ให้ผู้ป่วยทำนัดผ่านระบบนัดหมายของโรงพยาบาลโดยตรงค่ะ\nดูรายละเอียด:\nhttps://sibmt-14.uradev222.workers.dev/refer/general`;
}

function transplantHelp(): string {
  return `นัดพบแพทย์ปลูกถ่ายฯ และดูเกณฑ์ transplant candidate ได้ที่:\nhttps://sibmt-14.uradev222.workers.dev/refer/transplant\n\nหากต้องการดูคิว Fellow ให้ลงทะเบียนก่อนค่ะ`;
}

function menu(fellowName: string): string {
  return `เชื่อมต่อในชื่อ ${fellowName} แล้วค่ะ\nถามได้ด้วยคำสั่ง:\n• วันนี้มีกี่เคส\n• สัปดาห์นี้มีนัดกี่ราย\n• นัดใกล้สุด\n• คิววันที่ YYYY-MM-DD\n• ยกเลิกการเชื่อมต่อ`;
}

async function formatBookings(fellowName: string, from: string, to: string, title: string): Promise<string> {
  const rows = (await listGroup1Bookings())
    .filter((row) => row.fellow_name === fellowName && row.status === "Appointment Confirmed" && row.clinic_date >= from && row.clinic_date <= to)
    .sort((a, b) => a.clinic_date.localeCompare(b.clinic_date) || a.slot_number.localeCompare(b.slot_number));
  if (rows.length === 0) return `${title}ของ ${fellowName}: ไม่มีนัดค่ะ`;
  const lines = rows.map((row, index) => `${index + 1}. ${row.clinic_date} คิว ${row.slot_number} · ${row.referral_id}${row.referrer_org ? ` · ${row.referrer_org}` : ""}`);
  return `${title}ของ ${fellowName} ${rows.length} เคส\n${lines.join("\n")}`;
}

function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function validSignature(body: string, signature: string | null): Promise<boolean> {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = btoa(String.fromCharCode(...digest));
  return expected.length === signature.length && [...expected].every((char, index) => char === signature[index]);
}

async function reply(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN");
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
  });
  if (!response.ok) throw new Error(`LINE reply failed: ${response.status}`);
}
