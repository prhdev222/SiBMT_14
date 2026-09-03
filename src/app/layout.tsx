import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { FontSizeControl, FONT_SCALE_INIT } from "@/components/FontSizeControl";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* ตั้งขนาดตัวหนังสือก่อนวาดหน้า กันจอกระพริบ — ดู FontSizeControl.tsx */}
        <script dangerouslySetInnerHTML={{ __html: FONT_SCALE_INIT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
        <FontSizeControl />
      </body>
    </html>
  );
}
