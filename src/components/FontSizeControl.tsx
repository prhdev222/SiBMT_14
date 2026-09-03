"use client";

import { useEffect, useState } from "react";

/**
 * ปุ่มปรับขนาดตัวหนังสือทั้งเว็บ
 *
 * ⚠️ ปรับที่ font-size ของ <html> ตัวเดียว ไม่แตะแต่ละหน้า
 *
 * Tailwind กำหนดขนาดตัวอักษรเป็นหน่วย rem เกือบทั้งหมด ซึ่งอิงกับ font-size
 * ของ <html> การขยับค่านั้นค่าเดียวจึงทำให้ทุกข้อความขยายตามสัดส่วนพร้อมกัน
 * โดยไม่ทำให้สัดส่วนหน้าเพี้ยน
 *
 * ⚠️ ต้องมีสคริปต์กันจอกระพริบใน layout ด้วย (ดู FONT_SCALE_INIT)
 * ถ้าตั้งค่าตอน component นี้ mount อย่างเดียว หน้าจะโหลดด้วยขนาดปกติก่อน
 * แล้วค่อยกระตุกไปขนาดที่ผู้ใช้เลือก — สคริปต์ในหัวเอกสารตั้งค่าก่อนวาดหน้า
 */

const STORAGE_KEY = "sibmt-font-scale";
const STEPS = [1, 1.15, 1.3] as const;

function applyScale(scale: number) {
  document.documentElement.style.fontSize = `${scale * 100}%`;
}

export function FontSizeControl() {
  const [scale, setScale] = useState(1);

  // อ่านค่าที่บันทึกไว้ตอน mount — สคริปต์ในหัวเอกสารตั้ง font-size ให้แล้ว
  // ตรงนี้แค่ทำให้ปุ่มที่กำลังใช้อยู่ไฮไลต์ถูกดวง
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      // อ่านจาก localStorage ได้เฉพาะฝั่ง client จึงต้องทำใน effect ไม่ใช่ตอน
      // สร้าง state (SSR ไม่มี localStorage) — เป็นการ sync จากภายนอกตอน mount
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (STEPS.includes(saved as (typeof STEPS)[number])) setScale(saved);
    } catch {
      // localStorage ปิดอยู่ (หน้าต่างส่วนตัว ฯลฯ) — ใช้ค่าปกติ ไม่ต้องแจ้ง
    }
  }, []);

  const choose = (next: number) => {
    setScale(next);
    applyScale(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // เก็บค่าไม่ได้ก็ยังปรับให้ในหน้านี้ ครั้งหน้าค่อยกดใหม่
    }
  };

  return (
    // ⚠️ ขนาดทุกอย่างเป็น px ไม่ใช่ rem โดยตั้งใจ — ปุ่มนี้เป็นส่วนควบคุมของเว็บ
    // ไม่ใช่เนื้อหา จึงต้องคงขนาดเดิมเสมอ ถ้าใช้ rem มันจะขยายตามที่ผู้ใช้เลือก
    // แล้วโตจนล้นขอบจอมือถือตอนตั้งขนาดใหญ่สุด
    <div
      className="fixed bottom-3 right-3 z-40 flex items-center gap-0.5 rounded-full border border-zinc-300 bg-white/95 shadow-md print:hidden"
      style={{ padding: "4px" }}
    >
      <span className="sr-only">ปรับขนาดตัวหนังสือ</span>
      {STEPS.map((step, i) => (
        <button
          key={step}
          type="button"
          onClick={() => choose(step)}
          aria-pressed={scale === step}
          aria-label={`ขนาดตัวหนังสือ ${["ปกติ", "ใหญ่", "ใหญ่พิเศษ"][i]}`}
          title={["ตัวหนังสือขนาดปกติ", "ตัวหนังสือใหญ่", "ตัวหนังสือใหญ่พิเศษ"][i]}
          className={`flex items-center justify-center rounded-full font-semibold text-zinc-700 transition-colors ${
            scale === step ? "bg-blue-600 text-white" : "hover:bg-zinc-100"
          }`}
          // px ทั้งหมด: กล่องคงที่ 34px, ตัว ก เล็ก–ใหญ่ให้เห็นว่าปุ่มไหนขยายแค่ไหน
          style={{ width: 34, height: 34, fontSize: 13 + i * 4 }}
        >
          ก
        </button>
      ))}
    </div>
  );
}

/**
 * สคริปต์กันจอกระพริบ — ฝังในหัวเอกสาร ทำงานก่อนวาดหน้า
 *
 * อ่าน localStorage แล้วตั้ง font-size ทันที เพื่อไม่ให้หน้าโหลดด้วยขนาดปกติ
 * ก่อนแล้วค่อยกระตุกไปขนาดที่เลือกไว้ ห่อ try/catch เพราะ localStorage
 * โยน error ได้ในบางบริบท (เช่นตั้งค่าบล็อกคุกกี้) ซึ่งต้องไม่ทำให้หน้าพัง
 */
export const FONT_SCALE_INIT = `(function(){try{var s=Number(localStorage.getItem("${STORAGE_KEY}"));if([${STEPS.join(",")}].indexOf(s)!==-1){document.documentElement.style.fontSize=(s*100)+"%";}}catch(e){}})();`;
