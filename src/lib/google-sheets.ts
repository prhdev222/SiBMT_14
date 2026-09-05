/**
 * อ่านข้อมูลจาก Google Sheets ผ่าน REST API
 *
 * ใช้ Web Crypto เซ็น JWT เองแทนการใช้ `googleapis` SDK
 * เพราะ SDK หนักเกินสำหรับ edge runtime ของ Cloudflare (ดู docs/DEPLOYMENT.md)
 *
 * ⚠️ ไฟล์นี้ต้องรันฝั่ง server เท่านั้น ห้าม import จาก client component
 *    เพราะอ่าน private key จาก environment
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * ขอบเขตสิทธิ์ของ token — แยกสองชุดโดยตั้งใจ
 *
 * ไฟล์ข้อมูลผู้ป่วยอ่านด้วย token ที่ขอสิทธิ์อ่านอย่างเดียวเสมอ
 * ต่อให้วันหนึ่งมีคนเผลอตั้งสิทธิ์ไฟล์นั้นเป็น Editor ให้ service account
 * token ที่ใช้อ่านก็ยังเขียนไม่ได้อยู่ดี เป็นการกันซ้ำอีกชั้นนอกเหนือจาก
 * สิทธิ์ระดับไฟล์ของ Google เอง
 */
const SCOPE_READ = "https://www.googleapis.com/auth/spreadsheets.readonly";
const SCOPE_WRITE = "https://www.googleapis.com/auth/spreadsheets";

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

/**
 * ไฟล์ชีตตารางเวร fellow — แยกคนละไฟล์กับข้อมูลผู้ป่วย
 *
 * เหตุผลที่ต้องแยก: สิทธิ์ของ Google Sheets ให้เป็นรายไฟล์ จำกัดเป็นรายแท็บไม่ได้
 * ถ้าตารางเวรอยู่ไฟล์เดียวกับข้อมูลผู้ป่วย การให้เว็บเขียนตารางเวรได้
 * แปลว่าเว็บแก้หรือลบข้อมูลผู้ป่วยได้ด้วย พอแยกไฟล์แล้วให้ Editor
 * เฉพาะไฟล์นี้ ข้อมูลผู้ป่วยจึงยังอ่านได้อย่างเดียวเหมือนเดิม
 *
 * ยังไม่ได้ตั้งค่า = ใช้ไฟล์เดียวกับข้อมูลผู้ป่วย และเขียนไม่ได้
 */
export function scheduleSpreadsheetId(): string | null {
  return process.env.GOOGLE_SCHEDULE_SHEET_ID || null;
}

/** ลิงก์เปิด Google Sheet หลัก (ข้อมูลผู้ป่วย) — null ถ้ายังไม่ตั้ง env */
export function mainSheetUrl(): string | null {
  const id = process.env.GOOGLE_SHEET_ID;
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

/** ลิงก์เปิดไฟล์ตารางเวร fellow (คนละไฟล์) — null ถ้ายังไม่ตั้ง env */
export function scheduleSheetUrl(): string | null {
  const id = process.env.GOOGLE_SCHEDULE_SHEET_ID;
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

/** เขียนตารางเวรจากเว็บได้หรือยัง */
export function canWriteSchedule(): boolean {
  return Boolean(readCredentials() && scheduleSpreadsheetId());
}

/**
 * อ่าน credential จาก environment
 * คืน null ถ้ายังไม่ได้ตั้งค่า เพื่อให้ระบบ fallback ไปใช้ข้อมูลตัวอย่างได้
 */
export function readCredentials(): ServiceAccountCredentials | null {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) return null;

  return {
    clientEmail,
    // ค่าใน env มักเก็บ \n เป็นตัวอักษรสองตัว ต้องแปลงกลับเป็นบรรทัดใหม่จริง
    privateKey: privateKey.replace(/\\n/g, "\n"),
    spreadsheetId,
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

/** แปลง PEM (PKCS#8) เป็น CryptoKey สำหรับเซ็น RS256 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * access token ที่ขอไว้แล้ว ใช้ซ้ำจนกว่าจะใกล้หมดอายุ
 *
 * หน้า dashboard หนึ่งหน้าอ่านชีต 3 แท็บ (referrals, fellow_schedule, fellows)
 * ถ้าไม่เก็บไว้ แต่ละแท็บจะเซ็น JWT แล้ววิ่งไปขอ token ที่ Google ใหม่ทุกครั้ง
 * กลายเป็น 3 รอบเครือข่ายที่เสียเปล่า ทั้งตอนเปิดหน้าและทุกครั้งที่บันทึกแล้ว
 * revalidate ใหม่ — เป็นสาเหตุหลักที่หน้ารู้สึกหน่วง
 *
 * เก็บเป็น Promise ไม่ใช่ค่าที่ได้แล้ว เพราะทั้งสามคำขอเกิดขึ้นพร้อมกัน
 * ถ้าเก็บเฉพาะค่าที่ได้แล้ว ทั้งสามจะเห็น cache ว่าง แล้วยิงขอพร้อมกันอยู่ดี
 */
const tokenCache = new Map<
  string,
  { token: Promise<string>; expiresAt: number }
>();

async function getAccessToken(
  credentials: ServiceAccountCredentials,
  scope: string,
): Promise<string> {
  // แยก cache ตาม scope ด้วย ไม่ใช่แค่ตามบัญชี
  // ไม่งั้น token สิทธิ์เขียนจะถูกหยิบไปใช้อ่านไฟล์ข้อมูลผู้ป่วย
  const key = `${credentials.clientEmail}|${scope}`;
  const now = Date.now();

  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > now) return cached.token;

  const token = requestAccessToken(credentials, scope);
  // Google ให้อายุ 1 ชั่วโมง กันชน 5 นาทีเผื่อคำขอที่กำลังวิ่งอยู่
  tokenCache.set(key, { token, expiresAt: now + 55 * 60 * 1000 });

  // ขอไม่สำเร็จแล้วปล่อยค้างไว้ จะพังยาวทั้งชั่วโมงแม้ปัญหาหายไปแล้ว
  token.catch(() => {
    if (tokenCache.get(key)?.token === token) tokenCache.delete(key);
  });

  return token;
}

/** ขอ access token ด้วย JWT bearer flow */
async function requestAccessToken(
  credentials: ServiceAccountCredentials,
  scope: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const claims = {
    iss: credentials.clientEmail,
    scope,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  };

  const unsigned =
    encodeJson({ alg: "RS256", typ: "JWT" }) + "." + encodeJson(claims);

  const key = await importPrivateKey(credentials.privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

  const assertion = unsigned + "." + base64UrlEncode(new Uint8Array(signature));

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `ขอ access token ไม่สำเร็จ (${response.status}): ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("ไม่พบ access_token ในคำตอบจาก Google");
  return data.access_token;
}

/**
 * อ่านชีตหนึ่งชีตทั้งหมด คืนเป็น array ของ object โดยใช้แถวแรกเป็นชื่อคีย์
 *
 * เข้าถึงคอลัมน์ด้วยชื่อหัวตารางเสมอ ไม่อิงลำดับคอลัมน์
 * เพราะ Google Form จะแทรกคอลัมน์ใหม่เมื่อเพิ่มคำถาม
 */
export async function readSheetRows(
  sheetName: string,
  spreadsheetId?: string,
): Promise<Record<string, string>[]> {
  const credentials = readCredentials();
  if (!credentials) return [];

  // อ่านด้วยสิทธิ์อ่านอย่างเดียวเสมอ แม้เป็นไฟล์ที่เขียนได้
  const token = await getAccessToken(credentials, SCOPE_READ);
  const range = encodeURIComponent(`${sheetName}!A:ZZ`);
  const fileId = spreadsheetId ?? credentials.spreadsheetId;

  const response = await fetch(
    `${SHEETS_API}/${fileId}/values/${range}?majorDimension=ROWS`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `อ่านชีต "${sheetName}" ไม่สำเร็จ (${response.status}): ${await response.text()}`,
    );
  }

  const data = (await response.json()) as { values?: string[][] };
  const values = data.values ?? [];
  if (values.length < 2) return [];

  const headers = values[0].map((h) => String(h).trim());

  return values.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (header) record[header] = row[i] !== undefined ? String(row[i]) : "";
    });
    return record;
  });
}

/* ------------------------------------------------------------------ */
/* เขียนลงไฟล์ตารางเวร                                                  */
/*                                                                     */
/* ทุกฟังก์ชันด้านล่างบังคับให้ระบุ spreadsheetId เอง และเรียกใช้ได้จาก    */
/* schedule-store.ts ซึ่งส่ง scheduleSpreadsheetId() เข้ามาเท่านั้น       */
/* ไม่มีเส้นทางไหนที่เขียนลงไฟล์ข้อมูลผู้ป่วยได้                          */
/* ------------------------------------------------------------------ */

async function writeToken(): Promise<{
  token: string;
  credentials: ServiceAccountCredentials;
}> {
  const credentials = readCredentials();
  if (!credentials) throw new Error("ยังไม่ได้ตั้งค่า credential ของ Google");

  return { token: await getAccessToken(credentials, SCOPE_WRITE), credentials };
}

async function expectOk(response: Response, action: string): Promise<void> {
  if (response.ok) return;

  const detail = await response.text();
  if (response.status === 403) {
    throw new Error(
      `${action}ไม่สำเร็จ — service account ยังไม่มีสิทธิ์ Editor บนไฟล์ตารางเวร ` +
        "(แชร์ไฟล์ให้อีเมลของ service account แบบ Editor ก่อน)",
    );
  }
  throw new Error(`${action}ไม่สำเร็จ (${response.status}): ${detail}`);
}

/** ต่อแถวใหม่ท้ายชีต — ค่าทุกตัวเขียนเป็นข้อความดิบ ไม่ให้ Sheets ตีความเอง */
export async function appendRows(
  spreadsheetId: string,
  sheetName: string,
  rows: string[][],
): Promise<void> {
  if (rows.length === 0) return;
  const { token } = await writeToken();

  const range = encodeURIComponent(`${sheetName}!A:ZZ`);
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${range}:append` +
      "?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
      cache: "no-store",
    },
  );

  await expectOk(response, "เพิ่มแถว");
}

/** เขียนทับช่วงเซลล์ที่ระบุ เช่น "fellows!B5" */
export async function updateValues(
  spreadsheetId: string,
  a1Range: string,
  values: string[][],
): Promise<void> {
  const { token } = await writeToken();

  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(a1Range)}` +
      "?valueInputOption=RAW",
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
      cache: "no-store",
    },
  );

  await expectOk(response, "แก้ไขข้อมูล");
}

/**
 * หา sheetId (gid) ของแท็บ — จำเป็นสำหรับการลบแถว
 * เพราะ batchUpdate อ้างแท็บด้วยตัวเลข ไม่ใช่ชื่อ
 */
const gidCache = new Map<string, number>();

async function getSheetGid(
  spreadsheetId: string,
  sheetName: string,
): Promise<number> {
  const key = `${spreadsheetId}|${sheetName}`;
  const cached = gidCache.get(key);
  if (cached !== undefined) return cached;

  const { token } = await writeToken();
  const response = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  await expectOk(response, "อ่านโครงสร้างไฟล์");

  const data = (await response.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  };
  const found = data.sheets?.find((s) => s.properties?.title === sheetName);

  if (found?.properties?.sheetId === undefined) {
    throw new Error(`ไม่พบแท็บชื่อ "${sheetName}" ในไฟล์ตารางเวร`);
  }

  gidCache.set(key, found.properties.sheetId);
  return found.properties.sheetId;
}

/** ลบหนึ่งแถว (rowNumber นับแบบเดียวกับที่เห็นในชีต แถวแรกคือหัวตาราง = 1) */
export async function deleteRow(
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
): Promise<void> {
  const { token } = await writeToken();
  const gid = await getSheetGid(spreadsheetId, sheetName);

  const response = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: gid,
              dimension: "ROWS",
              // API นับแถวเริ่มที่ 0 และไม่รวมปลายทาง
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    }),
    cache: "no-store",
  });

  await expectOk(response, "ลบแถว");
}
