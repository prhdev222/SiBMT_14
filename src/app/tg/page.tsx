import type { Metadata } from "next";
import { TelegramWebAppEntry } from "./TelegramWebAppEntry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "เข้าระบบผ่าน Telegram — ส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  robots: { index: false, follow: false },
};

/** จุดเข้าระบบผ่าน Telegram Web App — เปิดจากปุ่มในแอป Telegram */
export default function TelegramWebAppPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <TelegramWebAppEntry />
    </div>
  );
}
