import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * ค่าเริ่มต้นของ Next คือ 1 MB ซึ่งไม่พอสำหรับไฟล์แนบในคำตอบ
       * (เช่น protocol chemotherapy ที่เป็น PDF สแกน)
       *
       * เพดานไฟล์จริงคือ 10 MB — ดู ALLOWED_ATTACHMENT_TYPES ใน
       * src/app/dashboard/review/actions.ts เผื่อไว้อีก 2 MB เพราะ
       * multipart/form-data เพิ่ม boundary กับ header ของแต่ละ part
       * และ base64 ที่ส่งต่อไป Apps Script ขยายอีกราวหนึ่งในสาม
       */
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
