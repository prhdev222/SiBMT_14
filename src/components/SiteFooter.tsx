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
      <p>
        ระบบสนับสนุน workflow การส่งต่อผู้ป่วย
        ไม่ใช่ระบบวินิจฉัยโรคหรือเวชระเบียนหลัก
      </p>
      <p className="mt-1">
        Built with <span aria-label="ความตั้งใจ">❤️</span> for Siriraj
        Hematology · © 2026 Directed by Uradev
      </p>
    </footer>
  );
}
