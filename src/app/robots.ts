import type { MetadataRoute } from "next";

/**
 * กันไม่ให้ search engine เก็บหน้า dashboard เข้าดัชนี
 *
 * สำคัญขึ้นมากเมื่อไม่ได้ใช้ Cloudflare Access — เพราะด่านเดียวที่เหลือคือรหัสผ่าน
 * ถ้าหน้า login ไปโผล่ในผลค้นหา จะมีคนสุ่มเข้ามาลองรหัสโดยที่เราไม่ได้ตั้งใจ
 *
 * นี่ไม่ใช่ระบบความปลอดภัย — บอทที่ไม่สนใจ robots.txt ก็เข้ามาได้อยู่ดี
 * ตัวกั้นจริงคือรหัสผ่านกับ rate limit
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/dashboard", "/dashboard/", "/login"],
    },
  };
}
