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

  return (
    <section className="rounded-xl bg-white border border-zinc-200 p-5">
      <h2 className="font-semibold text-zinc-900">📚 เอกสารสำคัญและอัปเดต</h2>
      <p className="text-sm text-zinc-500 mt-0.5">
        แบบฟอร์มและประกาศล่าสุดสำหรับแพทย์ต้นทาง — เปิดดูหรือดาวน์โหลดได้เลย
      </p>
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
    </section>
  );
}
