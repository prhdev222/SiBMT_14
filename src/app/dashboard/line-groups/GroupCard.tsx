"use client";

/**
 * การ์ดกลุ่ม LINE หนึ่งกลุ่ม — QR วาดสดจากลิงก์เชิญฝั่งเบราว์เซอร์
 * (ไม่ส่งลิงก์ไปให้บริการวาด QR ภายนอก — ลิงก์เชิญคือกุญแจเข้ากลุ่ม)
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function GroupCard({
  emoji,
  title,
  audience,
  inviteLink,
  configKey,
  scanWith = "LINE",
}: {
  emoji: string;
  title: string;
  audience: string;
  /** ลิงก์เชิญจากชีต config — ว่าง = ยังไม่ได้วาง แสดงวิธีตั้งค่าแทน */
  inviteLink: string;
  configKey: string;
  /** แอปที่ใช้สแกน/เข้ากลุ่ม (LINE หรือ Telegram) — ปรับข้อความให้ตรงช่องทาง */
  scanWith?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteLink) return;
    QRCode.toDataURL(inviteLink, { width: 480, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [inviteLink]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col items-center gap-3 text-center print:break-inside-avoid">
      <div>
        <p className="text-2xl" aria-hidden>
          {emoji}
        </p>
        <h2 className="font-semibold text-zinc-900">{title}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{audience}</p>
      </div>

      {inviteLink ? (
        <>
          {qr ? (
            /* ใช้ img จาก data URL ตรง ๆ — QR ต้องคมและพิมพ์ได้ ไม่ผ่าน next/image */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qr}
              alt={`QR เข้ากลุ่ม ${title}`}
              className="w-56 h-56 rounded-lg border border-zinc-100"
            />
          ) : (
            <div className="w-56 h-56 rounded-lg bg-zinc-50 flex items-center justify-center text-sm text-zinc-400">
              กำลังสร้าง QR...
            </div>
          )}
          <a
            href={inviteLink}
            className="print:hidden flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white active:bg-emerald-700"
          >
            เข้ากลุ่มนี้ (กดจากมือถือ)
          </a>
          <p className="print:hidden text-xs text-zinc-400">
            สแกน QR ด้วยกล้องหรือ {scanWith} ก็เข้ากลุ่มได้เช่นกัน
          </p>
        </>
      ) : (
        <div className="w-full rounded-lg bg-amber-50 border border-amber-200 p-4 text-left text-sm text-amber-900">
          <p className="font-semibold">ยังไม่ได้วางลิงก์เชิญ</p>
          <ol className="mt-2 ml-4 list-decimal space-y-1">
            <li>เปิดกลุ่มใน LINE → ≡ → เชิญ → คัดลอกลิงก์</li>
            <li>
              วางลงชีต <code className="rounded bg-amber-100 px-1">config</code>{" "}
              แถวใหม่ key ={" "}
              <code className="rounded bg-amber-100 px-1">{configKey}</code>
            </li>
            <li>รีเฟรชหน้านี้</li>
          </ol>
        </div>
      )}
    </div>
  );
}
