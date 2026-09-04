import { HeaderNav } from "@/components/HeaderNav";

export interface HeaderLink {
  href: string;
  label: string;
  /** ลิงก์รอง เช่น "กลับหน้าแรก" — สีจางกว่าเพื่อไม่ให้แข่งกับลิงก์หลัก */
  muted?: boolean;
}

/**
 * หัวหน้าจอของหน้าหลังบ้าน — ชื่อหน้าและลิงก์ไปหน้าอื่น
 *
 * บนมือถือลิงก์ยุบเป็นปุ่ม "เมนู" (hamburger) — เคยลองแถวเลื่อนแนวนอนแล้ว
 * ลิงก์ท้าย ๆ ถูกบังจนไม่มีใครรู้ว่ามี (ดูเหตุผลเต็มใน HeaderNav.tsx)
 * ส่วน desktop ยังเป็นแถวลิงก์ตามเดิม
 */
export function PageHeader({
  eyebrow,
  title,
  links = [],
  width = "max-w-6xl",
}: {
  eyebrow: string;
  title: string;
  links?: HeaderLink[];
  /** ความกว้างสูงสุด ต้องตรงกับ main ของหน้านั้น ไม่งั้นหัวกับเนื้อจะไม่ตรงแนว */
  width?: string;
}) {
  return (
    <header className="bg-white border-b border-zinc-200">
      <div
        className={`${width} mx-auto px-4 py-3 sm:py-4 flex flex-row items-center justify-between gap-3 sm:gap-4`}
      >
        {/* min-w-0 จำเป็น ไม่งั้นชื่อยาว ๆ จะดันแถวลิงก์จนล้นแทนที่จะตัดบรรทัดเอง */}
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">{eyebrow}</p>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900">{title}</h1>
        </div>

        {/* desktop = แถวลิงก์ / มือถือ = ปุ่มเมนูเปิดแผง (ดูเหตุผลใน HeaderNav) */}
        <HeaderNav links={links} />
      </div>
    </header>
  );
}
