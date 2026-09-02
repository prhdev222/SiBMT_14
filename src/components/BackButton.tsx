"use client";

import { useRouter } from "next/navigation";

/**
 * ปุ่มย้อนกลับไปหน้าก่อนหน้า
 *
 * ⚠️ ต้องมี fallback เสมอ เพราะบางหน้าเปิดจากลิงก์ตรง ๆ ไม่มีประวัติให้ย้อน
 *
 * หน้าจัดการนัดกับหน้าคำตอบเปิดจากลิงก์ในอีเมลหรือ LINE ซึ่งเป็นแท็บใหม่
 * ที่ไม่มีหน้าก่อนหน้าในเว็บนี้ — router.back() ตอนนั้นจะเด้งออกนอกเว็บ
 * หรือย้อนไปหน้าว่างของแท็บใหม่ จึงต้องรู้ก่อนว่า "มาจากเว็บนี้จริงไหม"
 *
 * ⚠️ ทำไมใช้ history.length ไม่ใช่ตัวอื่น
 *
 * Next.js 16 ไม่มี history.state.idx ให้เช็ค (App Router เก็บ tree ภายในแทน)
 * และ document.referrer ก็เชื่อไม่ได้ เพราะการนำทางด้วย Link แบบ client-side
 * ไม่อัปเดต referrer จึงค้างเป็นค่าของหน้าที่โหลดครั้งแรก
 *
 * เหลือ history.length ที่ใช้ได้จริง: แท็บที่ผู้ใช้เปิดจากลิงก์ในอีเมล/LINE
 * เป็นแท็บใหม่ที่มีแค่หน้านี้หน้าเดียว (length 1) — ถอยไป fallback ที่กำหนดไว้
 * ส่วนการกดลิงก์ในเว็บทำให้ length เพิ่มขึ้น ย้อนได้ตามปกติ
 *
 * ⚠️ เป็นการเดาแบบหยาบ ยอมพลาดในกรณีขอบที่พบยาก (เปิดลิงก์ทับแท็บที่มีประวัติ
 * อยู่ก่อน) ซึ่งอย่างมากคือย้อนไปอีกหน้าในเว็บเดียวกัน ไม่ถึงกับหลุดออกนอกเว็บ
 */
export function BackButton({
  fallback = "/",
  label = "ย้อนกลับ",
}: {
  fallback?: string;
  label?: string;
}) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
    >
      <span aria-hidden>←</span> {label}
    </button>
  );
}
