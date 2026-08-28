/**
 * ปุ่มเปิด / ดาวน์โหลดเอกสาร PDF ที่เก็บไว้ใน Google Drive
 *
 * URL มาจากชีต config (regimen_library_url, bmt_indication_url)
 * เพื่อให้เปลี่ยนไปยังไฟล์ฉบับใหม่ได้เองโดยไม่ต้อง deploy
 *
 * ⚠️ ไฟล์ใน Drive ต้องตั้งการแชร์เป็น "ผู้ที่มีลิงก์ → ผู้อ่าน"
 * ไม่งั้นแพทย์ต้นทางที่ไม่มีบัญชีของหน่วยงานจะเปิดไม่ได้
 * ทำได้เพราะทั้งสองไฟล์เป็นเอกสารวิชาการ ไม่มีข้อมูลผู้ป่วย
 */

/**
 * ดึง file id ออกจากลิงก์ Drive เพื่อสร้างลิงก์ดาวน์โหลดตรง
 *
 * รับได้ทั้ง /file/d/<id>/view และ ?id=<id>
 * คืน null เมื่อเป็นลิงก์รูปแบบอื่น — เช่นวันหนึ่งย้ายไฟล์ไปไว้ที่อื่น
 * กรณีนั้นจะเหลือแค่ปุ่มเปิด ซึ่งยังใช้งานได้ ดีกว่าปุ่มดาวน์โหลดที่กดแล้วพัง
 */
function driveFileId(url: string): string | null {
  return (
    url.match(/\/file\/d\/([A-Za-z0-9_-]+)/)?.[1] ??
    url.match(/[?&]id=([A-Za-z0-9_-]+)/)?.[1] ??
    null
  );
}

export function DocButtons({
  url,
  label,
  hint,
}: {
  /** ลิงก์ Drive จากชีต config — ว่างได้ แล้วจะไม่แสดงอะไรเลย */
  url: string;
  label: string;
  hint?: string;
}) {
  if (!url) return null;
  const id = driveFileId(url);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
      <p className="text-sm font-medium text-zinc-800">{label}</p>
      {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
      <div className="flex flex-wrap gap-2 mt-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
        >
          <span aria-hidden="true">📄</span> เปิด / พิมพ์
        </a>
        {id && (
          <a
            href={`https://drive.google.com/uc?export=download&id=${id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <span aria-hidden="true">⬇</span> ดาวน์โหลด PDF
          </a>
        )}
      </div>
    </div>
  );
}
