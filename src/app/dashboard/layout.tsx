import type { Metadata } from "next";

/**
 * บอกเครื่องมือค้นหาไม่ให้เก็บหน้าหลังบ้านเข้าดัชนี
 *
 * ซ้ำกับ robots.txt โดยตั้งใจ — robots.txt บอกว่า "อย่าคลาน"
 * ส่วน noindex บอกว่า "ถ้าคลานมาแล้วก็อย่าเก็บ" ซึ่งกันคนละจังหวะกัน
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
