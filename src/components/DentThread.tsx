"use client";

import { useEffect, useState } from "react";
import type { CaseMessage } from "@/lib/referral-repository";
import { MessageThreadView } from "@/components/MessageThreadView";
import {
  loadMessagesAction,
  markReadDentAction,
  postDentMessageAction,
} from "@/app/dashboard/actions";

/**
 * บทสนทนาต่อเคสฝั่ง dent ในกล่องรายละเอียด dashboard
 * โหลดข้อความแบบ lazy ตอนเปิด (ไม่ดึงของทุกเคสพร้อมกัน) + ล้างธง unread
 */
export function DentThread({
  referralId,
  senderName,
}: {
  referralId: string;
  senderName: string;
}) {
  const [messages, setMessages] = useState<CaseMessage[] | null>(null);

  useEffect(() => {
    let alive = true;
    setMessages(null);
    loadMessagesAction(referralId).then((m) => {
      if (alive) setMessages(m);
    });
    markReadDentAction(referralId);
    return () => {
      alive = false;
    };
  }, [referralId]);

  if (messages === null) {
    return <p className="text-sm text-zinc-400">กำลังโหลดบทสนทนา…</p>;
  }

  return (
    <MessageThreadView
      initialMessages={messages}
      mySide="resident"
      myName={senderName || "ทีมโลหิตวิทยา"}
      onSend={(text) => postDentMessageAction(referralId, text, senderName)}
    />
  );
}
