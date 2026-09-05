"use client";

import { useEffect } from "react";
import type { CaseMessage } from "@/lib/referral-repository";
import { MessageThreadView } from "@/components/MessageThreadView";
import { markReadReferrerAction, sendReferrerMessageAction } from "./actions";

/**
 * กล่องสนทนาฝั่งแพทย์ต้นทางในหน้า /case/[token]
 * เปิดหน้าปุ๊บล้างธง unread (ฟรี) เพื่อให้ข้อความใหม่ครั้งถัดไป push เตือนได้อีก
 */
export function ReferrerThread({
  caseToken,
  referrerOrg,
  initialMessages,
}: {
  caseToken: string;
  referrerOrg: string;
  initialMessages: CaseMessage[];
}) {
  useEffect(() => {
    markReadReferrerAction(caseToken);
  }, [caseToken]);

  return (
    <MessageThreadView
      initialMessages={initialMessages}
      mySide="referrer"
      myName={referrerOrg || "แพทย์ต้นทาง"}
      onSend={(text) => sendReferrerMessageAction(caseToken, text)}
    />
  );
}
