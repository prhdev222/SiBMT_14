"use client";

/**
 * แถวลิงก์ของ PageHeader — desktop เป็นแถวลิงก์เหมือนเดิม
 * มือถือยุบเป็นปุ่มเมนู (hamburger) เปิดแผงรายการ
 *
 * เดิมมือถือใช้แถวเลื่อนแนวนอน ซึ่งใช้ได้แต่ลิงก์ท้าย ๆ ถูกบังจนไม่มีใครรู้ว่ามี
 * (feedback จากการตอบเคสผ่านมือถือใน LINE, 4 ก.ย. 2569) — เมนูแบบกดเปิด
 * เห็นครบทุกรายการ และแต่ละแถวสูงพอสำหรับนิ้ว (44px)
 */

import { useState } from "react";
import Link from "next/link";
import type { HeaderLink } from "@/components/PageHeader";

export function HeaderNav({ links }: { links: HeaderLink[] }) {
  const [open, setOpen] = useState(false);

  if (links.length === 0) return null;

  const linkTone = (muted?: boolean) =>
    muted ? "text-zinc-500 hover:text-zinc-700" : "text-blue-600";

  return (
    <>
      {/* desktop — แถวลิงก์เดิม ไม่แตะพฤติกรรม */}
      <nav className="hidden sm:flex items-center gap-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`py-1.5 -my-1.5 text-sm font-medium whitespace-nowrap hover:underline ${linkTone(link.muted)}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* mobile — ปุ่มเมนู + แผงรายการ */}
      <div className="sm:hidden relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
          className="flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 active:bg-zinc-100"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          เมนู
        </button>

        {open && (
          <>
            {/* ฉากหลังโปร่งใส — แตะที่ไหนก็ปิดเมนู */}
            <button
              type="button"
              aria-label="ปิดเมนู"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <nav className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
              {links.map((link, i) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`flex h-11 items-center px-4 text-sm font-medium active:bg-zinc-50 ${linkTone(link.muted)} ${
                    i > 0 ? "border-t border-zinc-100" : ""
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </>
        )}
      </div>
    </>
  );
}
