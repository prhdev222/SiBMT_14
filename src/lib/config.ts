/**
 * ค่าคงที่ที่ผู้ดูแลระบบแก้ไขได้โดยไม่ต้องแตะ logic (ตาม SRS NFR-005)
 *
 * ค่าที่เป็น TODO ต้องเติมของจริงก่อนเปิดใช้งาน — ระบุไว้ใน
 * docs/PROPOSAL_REVIEW.md §6.4 (ตาราง Governance)
 */

import type { ReferralType } from "./referral-types";

export const CONTACT = {
  officeTh: "ธุรการ OPD 700 โลหิตวิทยา โรงพยาบาลศิริราช",
  phone: "024199903",
  phoneDisplay: "02-419-9903",
  hoursTh: "ในเวลาราชการ จันทร์–ศุกร์ 08:00–16:00 น.",
} as const;

export const LINE_OA = {
  displayName: "Siriraj Hemato Refer",
  /** TODO: เปลี่ยนเป็น LINE OA ของระบบนี้เมื่อสร้างเสร็จ */
  addFriendUrl: "https://lin.ee/TVFfRUd",
  /** ลิงก์เครือข่าย SiAML สำหรับส่งต่อปลูกถ่ายฯ (ทุกโรค) */
  siamlUrl: "https://lin.ee/TVFfRUd",
} as const;

export const HOSPITAL_LINKS = {
  /** ทำบัตรโรงพยาบาลออนไลน์ก่อนมาตรวจ */
  onlineRegistration: "https://si-eservice2.mahidol.ac.th/medrecord/index.php",
} as const;

/**
 * Google Form ของแต่ละกลุ่ม — ลิงก์แบบ prefilled ที่เลือกกลุ่มไว้ล่วงหน้า
 *
 * ทั้ง 4 ลิงก์ชี้ไปฟอร์มเดียวกัน ต่างกันที่ค่าของ `entry.1365456446`
 * ซึ่งเป็น ID ของคำถาม "ต้องการติดต่อเรื่องอะไร" ใน Section 3
 *
 * ⚠️ ถ้าแก้ข้อความตัวเลือกในฟอร์ม ต้องสร้างลิงก์ใหม่ทั้ง 4 อัน
 *    (⋮ → Pre-fill form) มิฉะนั้นการเลือกกลุ่มล่วงหน้าจะไม่ทำงาน
 *
 * ปล่อยเป็น null ระบบจะแสดงข้อความ "อยู่ระหว่างเปิดใช้งาน" แทนปุ่ม
 */
const FORM_BASE =
  "https://docs.google.com/forms/d/e/1FAIpQLSfmbgVvyzwKK7QAVBINgiILhnXwCZAewCCfW4UU5I-lnzF9DA/viewform?usp=pp_url&entry.1365456446=";

export const FORM_URL: Record<ReferralType, string | null> = {
  TRANSPLANT_APPOINTMENT:
    FORM_BASE +
    "%E0%B8%81%E0%B8%A5%E0%B8%B8%E0%B9%88%E0%B8%A1%E0%B8%97%E0%B8%B5%E0%B9%88+1+%E2%80%94+%E0%B8%82%E0%B8%AD%E0%B8%99%E0%B8%B1%E0%B8%94%E0%B8%9E%E0%B8%9A%E0%B9%81%E0%B8%9E%E0%B8%97%E0%B8%A2%E0%B9%8C%E0%B8%9B%E0%B8%A5%E0%B8%B9%E0%B8%81%E0%B8%96%E0%B9%88%E0%B8%B2%E0%B8%A2%E0%B9%80%E0%B8%8B%E0%B8%A5%E0%B8%A5%E0%B9%8C%E0%B8%95%E0%B9%89%E0%B8%99%E0%B8%81%E0%B8%B3%E0%B9%80%E0%B8%99%E0%B8%B4%E0%B8%94",
  REGIMEN_CONSULT:
    FORM_BASE +
    "%E0%B8%81%E0%B8%A5%E0%B8%B8%E0%B9%88%E0%B8%A1%E0%B8%97%E0%B8%B5%E0%B9%88+2+%E2%80%94+%E0%B8%82%E0%B8%AD%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1%E0%B9%80%E0%B8%AB%E0%B9%87%E0%B8%99%E0%B8%AA%E0%B8%B9%E0%B8%95%E0%B8%A3%E0%B8%A2%E0%B8%B2%E0%B9%80%E0%B8%84%E0%B8%A1%E0%B8%B5%E0%B8%9A%E0%B8%B3%E0%B8%9A%E0%B8%B1%E0%B8%94",
  CHEMO_ADMISSION:
    FORM_BASE +
    "%E0%B8%81%E0%B8%A5%E0%B8%B8%E0%B9%88%E0%B8%A1%E0%B8%97%E0%B8%B5%E0%B9%88+3+%E2%80%94+%E0%B8%82%E0%B8%AD%E0%B8%AA%E0%B9%88%E0%B8%87%E0%B8%95%E0%B8%B1%E0%B8%A7%E0%B8%A1%E0%B8%B2%E0%B9%83%E0%B8%AB%E0%B9%89%E0%B8%A2%E0%B8%B2%E0%B9%80%E0%B8%84%E0%B8%A1%E0%B8%B5%E0%B8%9A%E0%B8%B3%E0%B8%9A%E0%B8%B1%E0%B8%94%2F%E0%B8%A2%E0%B8%B2%E0%B8%81%E0%B8%94%E0%B8%A0%E0%B8%B9%E0%B8%A1%E0%B8%B4",
  // กลุ่มที่ 4 ไม่ใช้ฟอร์มของเราแล้ว ตามมติอาจารย์ 2 ส.ค. 2569
  // ให้ผู้ป่วยนัด OPD เองผ่านระบบนัดหมายของโรงพยาบาลที่มีอยู่แล้ว (ดู HOSPITAL_APPOINTMENT)
  GENERAL_OPD: null,
};

/**
 * เวลาทำการที่ใช้นับ SLA — นอกช่วงนี้ตัวนับหยุดเดิน
 * (แก้ปัญหาเคสยื่นเย็นวันศุกร์แล้วโดน Red Alert ทั้งที่ยังไม่มีใครเห็น)
 */
export const BUSINESS_HOURS = {
  startHour: 8,
  endHour: 16,
  /** 1 = จันทร์ … 5 = ศุกร์ */
  workingDays: [1, 2, 3, 4, 5],
} as const;

/**
 * รอบแจ้งเตือน LINE รวมวันละครั้ง — Time-Protected UI/UX
 *
 * ไม่มีช่องทางข้ามรอบสำหรับเคสฉุกเฉินโดยเจตนา (อาจารย์ยืนยัน 29 ก.ค. 2569)
 * เพราะเคสฉุกเฉินจริงไม่ใช่การ refer แบบ OPD ตั้งแต่ต้น
 */
export const BATCH_NOTIFICATION = {
  hour: 10,
  minute: 0,
  labelTh: "10:00 น.",
} as const;

/**
 * Governance — ผู้รับผิดชอบตามมติที่อาจารย์ให้ไว้ 29 ก.ค. 2569
 * TODO: เติมชื่อบุคคลและช่องทางติดต่อจริงก่อน pilot
 */
export const ESCALATION_CONTACTS = {
  /** เจ้าของระบบในนามหน่วยงาน */
  systemOwner: { nameTh: "สาขาวิชาโลหิตวิทยา", contact: "" },
  /** รับ Red Alert เมื่อเคสค้างครบ 48 ชั่วโมงทำการ — อาจารย์แจ้งว่ามีผู้รับแล้ว 1 ท่าน */
  centralAdminDoctor: { nameTh: "— รอระบุชื่อ —", contact: "" },
  /** ผู้สำรองเมื่อแอดมินกลางไม่สะดวก — อาจารย์กำลังหาเพิ่มอีก 1 ท่าน */
  centralAdminBackup: { nameTh: "— รอระบุชื่อ —", contact: "" },
  /** ดูแลคลังสูตรยาเคมีบำบัด (ใช้ทั้งกลุ่มที่ 2 และ 3) */
  templateLibraryOwner: { nameTh: "แพทย์แอดมินกลาง", contact: "" },
  /** กรอกตารางออกตรวจของ fellow ล่วงหน้าทั้งปีการศึกษา */
  fellowScheduleOwner: { nameTh: "แพทย์แอดมินกลาง", contact: "" },
} as const;

/**
 * ระบบนัดหมายผู้ป่วยนอกของโรงพยาบาล — ของเดิมที่มีอยู่แล้ว ไม่ใช่ของระบบนี้
 *
 * มติอาจารย์ 2 ส.ค. 2569: กลุ่มที่ 4 ไม่ต้องกรอกฟอร์มของเรา
 * ให้แพทย์ต้นทางบอกผู้ป่วยไปสแกน QR ทำนัดเองผ่าน LINE "Siriraj นัดหมาย"
 * เพื่อลดภาระงานแอดมิน และไม่ทำงานซ้ำกับระบบที่โรงพยาบาลมีอยู่
 *
 * ระบบนั้นเก็บชื่อ-สกุลและ HN ของผู้ป่วยเอง ซึ่งเป็นเรื่องของโรงพยาบาล
 * ระบบของเราจึงไม่รับข้อมูลส่วนนั้นเลย เพียงชี้ทางไปเท่านั้น
 *
 * ⚠️ ยังไม่มีลิงก์จริง — เติมเมื่อได้จากธุรการ ปล่อย null ไว้จะแสดงเฉพาะขั้นตอน
 */
export const HOSPITAL_APPOINTMENT = {
  lineOaNameTh: "Siriraj นัดหมาย",
  /** ลิงก์เพิ่มเพื่อน LINE OA — ถ้ายังไม่มี ผู้ใช้ค้นชื่อใน LINE เอาเองได้ */
  lineOaUrl: null as string | null,
  /** ขั้นตอนตามใบประชาสัมพันธ์ของโรงพยาบาล */
  stepsTh: [
    'สแกน QR code เพิ่มเพื่อน LINE "Siriraj นัดหมาย"',
    'กดเมนู "เวชระเบียน" เพื่อทำบัตรโรงพยาบาลศิริราชออนไลน์ (เฉพาะผู้ที่ยังไม่มี HN)',
    'กดเมนู "นัดหมาย" แล้วกรอกข้อมูลผู้ป่วย',
    'แนบรูปถ่าย "ใบส่งตัว" (ถ้าแนบไม่ได้ ส่งทางแชท LINE ได้)',
    "รอเจ้าหน้าที่ติดต่อกลับเพื่อรับใบนัดหมาย ภายใน 3 วันทำการ",
    'ดูนัดหมายและชำระค่าบริการครั้งถัดไปได้ที่เมนู "Siriraj Connect"',
    "มาตรวจตามวันเวลาที่ได้รับจาก LINE",
  ],
  waitingDaysTh: "3 วันทำการ",
};
