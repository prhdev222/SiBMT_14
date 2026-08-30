/**
 * ท้ายหน้าที่ใช้ร่วมกันทุกหน้า
 *
 * อยู่ใน root layout จึงขึ้นทุกหน้าโดยไม่ต้องไปเติมทีละหน้า
 *
 * ⚠️ print:hidden — หน้าที่ออกแบบมาให้พิมพ์ (หนังสือรับทราบ, คลังคำตอบ)
 * ไม่ควรมีบรรทัดเครดิตติดไปบนกระดาษที่เข้าแฟ้มผู้ป่วยหรือใช้ present
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 py-4 px-4 text-center text-[11px] leading-relaxed text-zinc-400 print:hidden">
      {/*
        สองประโยคนี้เป็นคนละใจความ — "ระบบนี้คืออะไร" กับ "ไม่ใช่อะไร"
        ประโยคหลังคือส่วนที่สำคัญกว่า จึงต้องไม่ถูกตัดกลางคำเวลาจอแคบ

        จอกว้างวางเรียงกันโดยมีจุดคั่น ไม่ให้ดูโหรงเหรง
        จอมือถือแยกคนละบรรทัดเสมอ ไม่ปล่อยให้ตัดตรงไหนก็ได้ตามความกว้าง
      */}
      <p className="flex flex-col sm:flex-row sm:justify-center sm:gap-x-2">
        <span>ระบบสนับสนุน workflow การส่งต่อผู้ป่วย</span>
        <span aria-hidden="true" className="hidden sm:inline">
          ·
        </span>
        <span>ไม่ใช่ระบบวินิจฉัยโรคหรือเวชระเบียนหลัก</span>
      </p>
      <p className="mt-1.5">
        Built with <span aria-label="ความตั้งใจ">❤️</span> for Siriraj
        Hematology · © 2026 Directed by Uradev
      </p>
    </footer>
  );
}
