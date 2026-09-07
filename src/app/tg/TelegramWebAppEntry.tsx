"use client";

import { useEffect, useState } from "react";

/**
 * หน้าเข้าระบบผ่าน Telegram Web App (แบบ B)
 *
 * เปิดจากปุ่ม "เปิด dashboard" ในแอป Telegram → สคริปต์ของ Telegram แนบ
 * initData (เซ็นด้วย bot token) มาให้ → ส่งไปยืนยันที่เซิร์ฟเวอร์ → ออก session
 * → เด้งเข้า /dashboard · เปิดในเบราว์เซอร์ปกติ (ไม่มี initData) จะบอกให้เปิดจากในแอป
 */
export function TelegramWebAppEntry() {
  const [status, setStatus] = useState("กำลังเข้าสู่ระบบ…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;

    script.onload = async () => {
      const tg = (
        window as unknown as {
          Telegram?: { WebApp?: { initData?: string; ready?: () => void } };
        }
      ).Telegram?.WebApp;

      tg?.ready?.();
      const initData = tg?.initData ?? "";

      if (!initData) {
        setFailed(true);
        setStatus(
          "กรุณาเปิดหน้านี้จากปุ่ม “เปิด dashboard” ในแอป Telegram — เปิดตรงในเบราว์เซอร์เข้าระบบไม่ได้",
        );
        return;
      }

      try {
        const res = await fetch("/api/telegram-webapp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (res.ok) {
          setStatus("เข้าระบบสำเร็จ กำลังเปิด dashboard…");
          window.location.href = "/dashboard";
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFailed(true);
        setStatus(
          data.error === "not_member"
            ? "ไม่มีสิทธิ์เข้าระบบ — บัญชี Telegram นี้ไม่ได้อยู่ในกลุ่มทีม"
            : "เข้าระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        );
      } catch {
        setFailed(true);
        setStatus("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    };

    script.onerror = () => {
      setFailed(true);
      setStatus("โหลดสคริปต์ Telegram ไม่สำเร็จ กรุณาลองใหม่");
    };

    document.body.appendChild(script);
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className={
          "h-10 w-10 rounded-full border-2 border-zinc-200 " +
          (failed ? "" : "border-t-emerald-600 animate-spin")
        }
        aria-hidden
      />
      <p className={failed ? "text-sm text-red-700" : "text-sm text-zinc-600"}>
        {status}
      </p>
    </div>
  );
}
