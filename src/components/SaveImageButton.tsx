"use client";

import { useState } from "react";

/**
 * บันทึกใบนัดเป็นรูป PNG — แพทย์ต้นทาง save ลงเครื่อง/ส่งให้คนไข้ได้
 *
 * ใช้ modern-screenshot (SVG foreignObject) เพราะ html2canvas แปลงสี oklch
 * ของ Tailwind v4 ไม่ได้ · บนมือถือเปิด share sheet (บันทึกลงรูปภาพ/ส่ง LINE)
 * บนคอมพ์ดาวน์โหลดไฟล์ตรง ๆ
 */
export function SaveImageButton({
  targetId,
  fileName,
  label = "💾 บันทึกรูปใบนัด",
}: {
  targetId: string;
  fileName: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const el = document.getElementById(targetId);
      if (!el) throw new Error("ไม่พบใบนัด");

      const { domToBlob } = await import("modern-screenshot");
      const blob = await domToBlob(el, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      if (!blob) throw new Error("สร้างรูปไม่สำเร็จ");

      const file = new File([blob], fileName, { type: "image/png" });

      // มือถือ: share sheet → บันทึกลงรูปภาพ หรือส่งให้คนไข้ทาง LINE ได้เลย
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: "ใบนัดหมาย" });
          return;
        } catch (shareErr) {
          // ผู้ใช้กดยกเลิก share — ไม่ใช่ error ที่ต้องแจ้ง
          if ((shareErr as { name?: string })?.name === "AbortError") return;
          // share ไม่ได้ด้วยเหตุอื่น → ตกไปดาวน์โหลดแทน
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError("บันทึกรูปไม่สำเร็จ — ลองใช้ปุ่มพิมพ์แทนได้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={save}
        disabled={busy}
        className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        {busy ? "กำลังสร้างรูป…" : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
