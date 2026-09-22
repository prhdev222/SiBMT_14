"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { INDICATIONS_BY_TYPE, TRANSPLANT_TYPE_LABEL_TH, type TransplantType } from "@/lib/transplant-indications";

type Message = { from: "bot" | "user"; text: string; links?: { label: string; href: string }[] };

const menu: Message = { from: "bot", text: "สวัสดีค่ะ เลือกเรื่องที่ต้องการสอบถามได้เลย", links: [] };

export function HematoBotWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/login")) return null;

  function show(next: Message, label?: string) {
    setMessages((current) => [...current, ...(label ? [{ from: "user", text: label } as Message] : []), next]);
  }

  function openBot() {
    setOpen(true);
    if (messages.length === 0) show(menu);
  }

  return (
    <>
      {!open && <button type="button" onClick={openBot} aria-label="เปิดแชท Hemato Bot" className="fixed bottom-14 right-3 z-40 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hemato-bot.png" alt="Hemato Bot" width="86" height="89" className="h-[86px] w-[83px] object-contain drop-shadow-md" />
      </button>}
      {open && <section aria-label="แชท Hemato Bot" className="fixed bottom-3 right-3 z-50 flex h-[min(620px,calc(100vh-24px))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-blue-700 px-4 py-3 text-white"><p className="font-semibold">Hemato Bot</p><button type="button" onClick={() => setOpen(false)} aria-label="ปิดแชท">✕</button></header>
        <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-3">
          {messages.map((message, index) => <div key={`${message.from}-${index}`} className={message.from === "user" ? "ml-8 rounded-xl bg-blue-100 p-3 text-sm text-zinc-800" : "mr-4 rounded-xl bg-white p-3 text-sm text-zinc-800 shadow-sm whitespace-pre-line"}>{message.text}{message.links && message.links.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.links.map((link) => <Link key={link.href} href={link.href} className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{link.label}</Link>)}</div>}</div>)}
          {messages.length > 0 && <BotChoices onChoice={show} />}
        </div>
        <button type="button" onClick={() => setMessages([menu])} className="border-t border-zinc-200 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50">กลับเมนูหลัก</button>
      </section>}
    </>
  );
}

function BotChoices({ onChoice }: { onChoice: (message: Message, label?: string) => void }) {
  const candidateText = [
    "เกณฑ์เบื้องต้น (ข้อมูลประกอบการตัดสินใจ ไม่ใช่ด่านกั้น):",
    ...(["AUTOLOGOUS", "ALLOGENEIC"] as TransplantType[]).flatMap((type) => [
      `\n${TRANSPLANT_TYPE_LABEL_TH[type]}`,
      ...INDICATIONS_BY_TYPE[type].map((item) => `${item.diseaseTh}: ${item.statusTh || "—"}; ${item.ageTh || "—"}`),
    ]),
  ].join("\n");
  return <div className="mt-2 flex flex-wrap gap-2"><Choice label="📅 คำถามเรื่องนัด" onClick={() => onChoice({ from: "bot", text: "เลือกวันนัดจากคิวว่างได้ทันทีค่ะ\nถ้าต้องการเลื่อน ยกเลิก หรือเปิดใบนัด ให้ใช้หน้าจัดการนัด", links: [{ label: "รายละเอียดการนัด", href: "/refer/transplant" }, { label: "จองคิว", href: "/book/transplant" }, { label: "จัดการนัด", href: "/booking" }] }, "📅 คำถามเรื่องนัด")} /><Choice label="🧬 Transplant candidate" onClick={() => onChoice({ from: "bot", text: candidateText, links: [{ label: "ดูรายละเอียด", href: "/refer/transplant" }] }, "🧬 Transplant candidate")} /><Choice label="🌐 Refer ผู้ป่วยนอก" onClick={() => onChoice({ from: "bot", text: "ให้ผู้ป่วยทำนัดผ่าน LINE Siriraj นัดหมายของโรงพยาบาลโดยตรงค่ะ", links: [{ label: "ดูขั้นตอน", href: "/refer/general" }] }, "🌐 Refer ผู้ป่วยนอก")} /></div>;
}

function Choice({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100">{label}</button>; }
