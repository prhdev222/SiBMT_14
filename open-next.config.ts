/**
 * ตั้งค่า adapter ที่แปลง build ของ Next.js ให้รันบน Cloudflare Workers
 *
 * ไม่ได้ตั้ง incrementalCache ไว้โดยตั้งใจ — template ของ adapter ใส่
 * r2IncrementalCache มาให้ ซึ่งบังคับให้ต้องสร้าง R2 bucket ก่อน deploy
 * แอปนี้ไม่ได้ใช้ ISR และไม่มี 'use cache' เลย (หน้าหลังบ้านเป็น force-dynamic
 * ทุกหน้าเพราะข้อมูลเคสต้องสด) แคชที่ไม่มีใครเขียนลงไปจึงไม่ต้องมีที่เก็บ
 *
 * ถ้าวันหลังเพิ่มหน้าที่ใช้ ISR ให้กลับมาเปิด r2IncrementalCache พร้อมสร้าง
 * bucket และเพิ่ม binding NEXT_INC_CACHE_R2_BUCKET กับ WORKER_SELF_REFERENCE
 * ใน wrangler.jsonc — ดู https://opennext.js.org/cloudflare/caching
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
