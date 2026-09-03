/**
 * จำกัดจำนวนครั้งที่ยิงเข้ามาได้ต่อ IP — ใช้กันการเดารหัสผ่านที่หน้า /login
 *
 * ⚠️ ทำไมไม่ใช้ WAF ของ Cloudflare
 * กฎ Rate limiting ของ WAF ผูกกับ zone คือโดเมนที่อยู่ในบัญชีเรา
 * แต่เว็บนี้อยู่บน *.workers.dev ซึ่งเป็นโดเมนของ Cloudflare เอง
 * ในหน้า dashboard จึงไม่มีเมนู WAF ให้ตั้งเลย
 * ตัวนี้เป็น binding ระดับ Worker จึงทำงานได้โดยไม่ต้องมีโดเมนของตัวเอง
 *
 * ⚠️ นี่คือประตู ไม่ใช่ลูกระนาด
 * การหน่วงเวลาเมื่อรหัสผิดใน login/actions.ts กันได้แค่การยิงทีละครั้ง
 * ผู้โจมตีเปิดหลายเส้นพร้อมกันได้ ตัวนับนี้ต่างหากที่หยุดได้จริง
 *
 * ⚠️ server-only
 */

import { headers } from "next/headers";

/** สภาพแวดล้อมของ Cloudflare เท่าที่ไฟล์นี้ต้องใช้ */
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * true = ยังยิงได้ / false = เกินโควตาแล้ว
 *
 * ถ้าไม่มี binding (ตอน `next dev` บนเครื่องตัวเอง) จะปล่อยผ่านเสมอ
 * — ไม่ปิดกั้นการพัฒนา แต่แปลว่าการทดสอบว่ากันได้จริงต้องทำบน production
 */
export async function allowLoginAttempt(): Promise<boolean> {
  return allowAttempt("LOGIN_RATE_LIMIT", "login");
}

/**
 * กันการไล่เดารหัสอ้างอิง + เบอร์โทรเพื่อเปิดนัดของคนอื่น
 *
 * หน้าจัดการนัดยกเลิกนัดได้จริง ซึ่งย้อนกลับไม่ได้ — ต่างจากการเช็คสถานะ
 * ทาง LINE ที่เดาถูกแล้วได้แค่ข้อมูลไร้ประโยชน์
 */
export async function allowBookingLookup(): Promise<boolean> {
  return allowAttempt("MANAGE_RATE_LIMIT", "manage");
}

/**
 * กันสแปมที่หน้าติดต่อแอดมิน — เป็น endpoint สาธารณะที่ push เข้า LINE ของแอดมิน
 *
 * ใช้ตัวนับเดียวกับหน้าจัดการนัด แต่คนละ prefix จึงนับแยกกัน
 * ถ้าไม่กัน ใครก็ยิงข้อความรัวเข้ากลุ่ม LINE ของทีมได้ทั้งวัน
 */
export async function allowAdminContact(): Promise<boolean> {
  return allowAttempt("MANAGE_RATE_LIMIT", "contact");
}

/** เช็กสถานะ/รายการเคสจากแชทเว็บ — เพดานเดียวกับหน้าจัดการนัด */
export async function allowBotLookup(): Promise<boolean> {
  return allowAttempt("MANAGE_RATE_LIMIT", "bot");
}

/** ขอรหัสอีเมล — แยกถังเพราะยิงอีเมลออกจริง สแปมได้ */
export async function allowBotCode(): Promise<boolean> {
  return allowAttempt("MANAGE_RATE_LIMIT", "botcode");
}

async function allowAttempt(binding: string, prefix: string): Promise<boolean> {
  const limiter = await getLimiter(binding);
  if (!limiter) return true;

  const key = await clientIp(prefix);

  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (error) {
    // ตัวนับพังต้องไม่ทำให้ทุกคนล็อกอินไม่ได้ — ระบบนี้ใช้ตอนดูแลผู้ป่วยจริง
    // การกันคนที่ควรเข้าได้ออกไปเสียหายกว่าการปล่อยให้เดารหัสได้ชั่วคราว
    console.error("rate limiter ใช้งานไม่ได้ ปล่อยผ่านไปก่อน: " + String(error));
    return true;
  }
}

async function getLimiter(binding: string): Promise<RateLimitBinding | null> {
  try {
    // import แบบ dynamic เพราะโมดูลนี้มีเฉพาะตอนรันบน Cloudflare
    // ถ้า import ไว้บนสุด `next dev` จะพังตั้งแต่โหลดไฟล์
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as unknown as Record<
      string,
      RateLimitBinding | undefined
    >;
    return env[binding] ?? null;
  } catch {
    return null;
  }
}

/**
 * IP ของผู้ใช้จริง
 *
 * ใช้ CF-Connecting-IP ซึ่ง Cloudflare เขียนทับให้เองทุก request
 * ห้ามใช้ X-Forwarded-For เพราะผู้เรียกปลอมค่าเองได้ แล้วจะเลี่ยงตัวนับได้ทันที
 * ด้วยการสุ่มค่าใหม่ทุกครั้ง
 *
 * ถ้าไม่มีหัวข้อนี้ให้รวมทุกคนไว้ในถังเดียวกันแทนการปล่อยผ่าน
 */
async function clientIp(prefix: string): Promise<string> {
  const ip = (await headers()).get("cf-connecting-ip");
  return `${prefix}:${ip ?? "unknown"}`;
}
