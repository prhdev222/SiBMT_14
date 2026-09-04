import { DocButtons } from "@/components/DocButtons";
import {
  documentsForGroup,
  type SystemDocument,
} from "@/lib/referral-repository";

/**
 * กล่อง "เอกสารสำคัญและอัปเดต" บนหน้ากลุ่ม — เนื้อหามาจากชีต documents
 * (แอดมินอัปโหลดไฟล์เข้า Drive แล้วเพิ่มแถว โผล่ที่นี่ทันที ไม่ต้อง deploy)
 *
 * ไม่มีเอกสารของกลุ่มนั้น = ไม่แสดงกล่องเลย — หน้ากลุ่มไม่ควรมีหัวข้อว่าง
 */
export function DocumentLibrary({
  documents,
  groupNumber,
}: {
  documents: SystemDocument[];
  groupNumber: number;
}) {
  const docs = documentsForGroup(documents, groupNumber);
  if (docs.length === 0) return null;

  // ไฟล์น้อยกางให้เห็นเลย ไฟล์เยอะพับไว้ไม่ให้ท่วมหน้า — <details> ของ
  // เบราว์เซอร์เอง ไม่ต้องมี JS และจำสถานะกดได้ทุกอุปกรณ์
  const openByDefault = docs.length <= 2;

  return (
    <details
      open={openByDefault}
      className="group rounded-xl bg-white border border-zinc-200 p-5"
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-zinc-900">
              📚 เอกสารสำคัญและอัปเดต{" "}
              <span className="font-normal text-zinc-500">
                ({docs.length} ไฟล์)
              </span>
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              แบบฟอร์มและประกาศล่าสุดสำหรับแพทย์ต้นทาง — กดเพื่อดูรายการ
            </p>
          </div>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </summary>
      {/* DocButtons เป็นการ์ดมีกรอบในตัวแล้ว — เว้นช่องพอ ไม่ใส่เส้นคั่นซ้อน */}
      <div className="mt-4 space-y-3">
        {docs.map((doc) => (
          <DocButtons
            key={doc.url + doc.title}
            url={doc.url}
            label={doc.title}
            hint={doc.description || undefined}
          />
        ))}
      </div>
    </details>
  );
}
