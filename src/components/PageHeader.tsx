import Link from "next/link";

export interface HeaderLink {
  href: string;
  label: string;
  /** ลิงก์รอง เช่น "กลับหน้าแรก" — สีจางกว่าเพื่อไม่ให้แข่งกับลิงก์หลัก */
  muted?: boolean;
}

/**
 * หัวหน้าจอของหน้าหลังบ้าน — ชื่อหน้าและลิงก์ไปหน้าอื่น
 *
 * ⚠️ บนมือถือลิงก์ต้องเลื่อนตามแนวนอนได้ ไม่ใช่ตัดบรรทัด
 *
 * ก่อนหน้านี้ทุกหน้าวางชื่อกับลิงก์ไว้ในแถวเดียวกันแบบ justify-between
 * บนจอ 375px ลิงก์หกอันที่ห้ามตัดคำกินที่ไป 607px ดันหน้าทั้งหน้ากว้าง 719px
 * — เลื่อนซ้ายขวาได้ทั้งหน้า และชื่อหน้าถูกบีบจนเหลือสามบรรทัด
 *
 * วิธีที่ใช้คือแยกเป็นสองชั้นบนมือถือ แล้วให้แถวลิงก์เลื่อนอยู่ในตัวมันเอง
 * โดยล้นออกไปชิดขอบจอด้วย -mx-4 เพื่อให้เห็นว่ายังมีลิงก์ต่อไปทางขวา
 * ไม่ใช่ถูกตัดหายไปเฉย ๆ
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
        className={`${width} mx-auto px-4 py-3 sm:py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}
      >
        {/* min-w-0 จำเป็น ไม่งั้นชื่อยาว ๆ จะดันแถวลิงก์จนล้นแทนที่จะตัดบรรทัดเอง */}
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">{eyebrow}</p>
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900">{title}</h1>
        </div>

        {links.length > 0 && (
          <nav className="flex items-center gap-4 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 sm:overflow-visible">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                // py-1.5 -my-1.5 ขยายพื้นที่นิ้วโดยไม่ทำให้แถวสูงขึ้น
                className={`py-1.5 -my-1.5 text-sm font-medium whitespace-nowrap hover:underline ${
                  link.muted
                    ? "text-zinc-500 hover:text-zinc-700"
                    : "text-blue-600"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
