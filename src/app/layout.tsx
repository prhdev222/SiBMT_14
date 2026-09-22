import type { Metadata } from "next";
import "./globals.css";
import { FontSizeControl, FONT_SCALE_INIT } from "@/components/FontSizeControl";
import { HematoBotWidget } from "@/components/hemato-bot/HematoBotWidget";

export const metadata: Metadata = {
  title: "ระบบส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช",
  description:
    "ระบบคัดกรองและส่งต่อผู้ป่วยนอกทางไกลสำหรับคลินิกโลหิตวิทยา โรงพยาบาลศิริราช",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        {/* ตั้งขนาดตัวหนังสือก่อนวาดหน้า กันจอกระพริบ — ดู FontSizeControl.tsx */}
        <script dangerouslySetInnerHTML={{ __html: FONT_SCALE_INIT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <FontSizeControl />
        <HematoBotWidget />
      </body>
    </html>
  );
}
