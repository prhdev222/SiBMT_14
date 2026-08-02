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
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
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

/** ขอ access token ด้วย JWT bearer flow */
async function requestAccessToken(
  credentials: ServiceAccountCredentials,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const claims = {
    iss: credentials.clientEmail,
    scope: SCOPE,
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
): Promise<Record<string, string>[]> {
  const credentials = readCredentials();
  if (!credentials) return [];

  const token = await requestAccessToken(credentials);
  const range = encodeURIComponent(`${sheetName}!A:ZZ`);

  const response = await fetch(
    `${SHEETS_API}/${credentials.spreadsheetId}/values/${range}?majorDimension=ROWS`,
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
