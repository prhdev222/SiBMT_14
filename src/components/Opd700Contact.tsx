import { CONTACT } from "@/lib/config";

/**
 * ที่อยู่ + เบอร์ OPD 700 แบบเต็ม — ใช้ทุกที่ที่บอกแพทย์ต้นทาง/ผู้ป่วยว่า "มาที่ OPD 700"
 *
 * คำขอผู้ใช้ 11 ก.ย. 2569: คำว่า OPD 700 เฉย ๆ ไม่พอ ผู้ป่วยต่างจังหวัดหาตึกไม่เจอ
 * และไม่รู้จะโทรถามใคร — ต้องมีชั้น/ตึก/เบอร์/เวลาทำการติดไปด้วยเสมอ
 * ข้อความจริงอยู่ที่ CONTACT ใน lib/config.ts ที่เดียว แก้ที่นั่นเปลี่ยนทุกหน้า
 */
export function Opd700Contact({
  compact = false,
  className = "",
}: {
  /** บรรทัดเดียว (ใช้ในตารางนัด) แทนบล็อกสองบรรทัด */
  compact?: boolean;
  className?: string;
}) {
  const phone = (
    <a href={`tel:${CONTACT.phone}`} className="text-blue-600 hover:underline">
      {CONTACT.phoneDisplay}
    </a>
  );
  if (compact) {
    return (
      <span className={className}>
        {CONTACT.officeTh} · โทร. {phone} ({CONTACT.hoursTh})
      </span>
    );
  }
  return (
    <div className={`text-sm text-zinc-700 ${className}`}>
      <p className="font-medium text-zinc-900">{CONTACT.officeTh}</p>
      <p className="mt-0.5">
        โทร. {phone}{" "}
        <span className="text-zinc-500">({CONTACT.hoursTh})</span>
      </p>
    </div>
  );
}
