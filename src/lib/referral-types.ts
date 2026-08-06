/**
 * Domain model for the 4-group triage workflow.
 *
 * The referral **type** (what the referring doctor is asking for) is the primary
 * axis — it decides who handles the case and how it is answered. The **disease
 * group** is a secondary axis used for document checklists and reporting.
 *
 * See docs/SRS.md §9 and docs/PROPOSAL_REVIEW.md §1.
 */

/** กลุ่มที่ 1–4 — แยกตามลักษณะงาน ไม่ใช่ตามโรค */
export type ReferralType =
  | "TRANSPLANT_APPOINTMENT"
  | "REGIMEN_CONSULT"
  | "CHEMO_ADMISSION"
  | "GENERAL_OPD";

export type AutomationLevel = "SEMI_AUTOMATED" | "FULLY_AUTOMATED";

export interface ReferralTypeMeta {
  /** เลขกลุ่มตามเอกสารข้อเสนอโครงการ */
  groupNumber: 1 | 2 | 3 | 4;
  emoji: string;
  titleTh: string;
  /** คำอธิบายสั้น ๆ ให้แพทย์ต้นทางเลือกกลุ่มได้ถูก */
  purposeTh: string;
  handlerTh: string;
  automation: AutomationLevel;
  /** SLA เฉพาะกลุ่ม (ชั่วโมงทำการ) */
  slaBusinessHours: number;
  /** เส้นทางหน้ารายละเอียดของกลุ่ม */
  href: string;
}

export const REFERRAL_TYPE_META: Record<ReferralType, ReferralTypeMeta> = {
  TRANSPLANT_APPOINTMENT: {
    groupNumber: 1,
    emoji: "🧬",
    titleTh: "ขอนัดหมายพบแพทย์ปลูกถ่ายเซลล์ต้นกำเนิด",
    purposeTh:
      "ต้องการนัดผู้ป่วยมาพบ fellow transplant ที่ OPD 700 เพื่อประเมินการปลูกถ่ายไขกระดูก/สเต็มเซลล์",
    handlerTh: "แพทย์แอดมิน (จัดคิว fellow)",
    automation: "SEMI_AUTOMATED",
    slaBusinessHours: 48,
    href: "/refer/transplant",
  },
  REGIMEN_CONSULT: {
    groupNumber: 2,
    emoji: "💊",
    titleTh: "ขอความเห็นสูตรยาเคมีบำบัด",
    purposeTh:
      "ต้องการปรึกษาสูตรยาเคมีบำบัด โดยผู้ป่วยยังรักษาต่อที่โรงพยาบาลต้นทาง ไม่ต้องส่งตัวมา",
    handlerTh: "แพทย์ประจำบ้าน R2/R3 วอร์ดเคโม + อาจารย์ Attending อนุมัติ",
    automation: "SEMI_AUTOMATED",
    slaBusinessHours: 48,
    href: "/refer/regimen-consult",
  },
  CHEMO_ADMISSION: {
    groupNumber: 3,
    emoji: "🏥",
    titleTh: "ขอส่งตัวมาให้ยาเคมีบำบัด/ยากดภูมิ",
    purposeTh:
      "ต้องการส่งผู้ป่วยมานอนโรงพยาบาลศิริราชเพื่อรับยาเคมีบำบัดหรือยากดภูมิ",
    handlerTh: "แพทย์ประจำบ้าน R2/R3 วอร์ดเคโม + อาจารย์ Attending อนุมัติ",
    automation: "SEMI_AUTOMATED",
    slaBusinessHours: 48,
    href: "/refer/chemo-admission",
  },
  GENERAL_OPD: {
    groupNumber: 4,
    emoji: "🌐",
    titleTh: "Refer ผู้ป่วยนอกด้วยเหตุผลอื่น",
    purposeTh:
      "ส่งต่อผู้ป่วยนอกทั่วไปที่เกินศักยภาพโรงพยาบาลต้นทาง นอกเหนือจาก 3 กลุ่มแรก",
    handlerTh: "ระบบอัตโนมัติ (ไม่ผ่านแพทย์ประจำบ้าน)",
    automation: "FULLY_AUTOMATED",
    slaBusinessHours: 24,
    href: "/refer/general",
  },
};

export const REFERRAL_TYPES = Object.keys(
  REFERRAL_TYPE_META,
) as ReferralType[];

/** เรียงตามเลขกลุ่ม 1→4 สำหรับแสดงผลบนหน้าเว็บ */
export const REFERRAL_TYPES_ORDERED: ReferralType[] = [...REFERRAL_TYPES].sort(
  (a, b) =>
    REFERRAL_TYPE_META[a].groupNumber - REFERRAL_TYPE_META[b].groupNumber,
);

/** map จาก slug บน URL กลับเป็น ReferralType */
export const REFERRAL_TYPE_BY_SLUG: Record<string, ReferralType> =
  Object.fromEntries(
    REFERRAL_TYPES.map((t) => [
      REFERRAL_TYPE_META[t].href.replace("/refer/", ""),
      t,
    ]),
  );

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

/**
 * สถานะรวมของทุกกลุ่ม — แต่ละกลุ่มใช้เพียงบางสถานะ (ดู `STATUSES_BY_TYPE`)
 */
export type Status =
  | "Submitted"
  | "Pending Review"
  | "Incomplete"
  | "Slot Reserved"
  | "Awaiting Attending"
  | "Advice Sent"
  | "Readiness Visit Scheduled"
  | "Appointment Confirmed"
  | "Auto Replied"
  | "Rejected / Redirected"
  | "Closed";

export const STATUS_LABEL_TH: Record<Status, string> = {
  Submitted: "ส่งข้อมูลแล้ว",
  "Pending Review": "รอตรวจความครบถ้วน",
  Incomplete: "ข้อมูลไม่ครบ",
  "Slot Reserved": "จองคิว fellow แล้ว",
  "Awaiting Attending": "รออาจารย์อนุมัติ",
  "Advice Sent": "ส่งคำแนะนำกลับแล้ว",
  "Readiness Visit Scheduled": "นัดประเมินความพร้อมแล้ว",
  "Appointment Confirmed": "ยืนยันวันนัดแล้ว",
  "Auto Replied": "ระบบตอบกลับอัตโนมัติแล้ว",
  "Rejected / Redirected": "ไม่เข้าเกณฑ์ / ส่งต่อช่องทางอื่น",
  Closed: "ปิดเคสแล้ว",
};

export const STATUS_COLOR: Record<Status, string> = {
  Submitted: "bg-blue-100 text-blue-800",
  "Pending Review": "bg-amber-100 text-amber-800",
  Incomplete: "bg-red-100 text-red-800",
  "Slot Reserved": "bg-indigo-100 text-indigo-800",
  "Awaiting Attending": "bg-amber-100 text-amber-800",
  "Advice Sent": "bg-green-100 text-green-800",
  "Readiness Visit Scheduled": "bg-indigo-100 text-indigo-800",
  "Appointment Confirmed": "bg-green-100 text-green-800",
  "Auto Replied": "bg-green-100 text-green-800",
  "Rejected / Redirected": "bg-zinc-200 text-zinc-700",
  Closed: "bg-zinc-200 text-zinc-700",
};

/**
 * สถานะที่ใช้ได้จริงในแต่ละกลุ่ม
 *
 * กลุ่มที่ 3 มีทางออกเพียง 2 ทางตามที่อาจารย์ยืนยัน (29 ก.ค. 2569):
 * นัดมาดูความพร้อมที่ OPD หรือ ตอบกลับแนะนำการรักษาให้ รพ. ต้นทางดูแลเอง
 * — ไม่มีขั้นตอนยืนยันเตียง เพราะ resident เป็นผู้นัดและให้คิวเอง
 */
export const STATUSES_BY_TYPE: Record<ReferralType, Status[]> = {
  // กลุ่มที่ 1 จองคิวเองได้ทันที ไม่มีขั้นรอแอดมินตรวจแล้ว (มติอาจารย์ 2 ส.ค. 2569)
  // Pending Review / Incomplete / Slot Reserved จึงไม่มีความหมายกับกลุ่มนี้อีก
  // ความรับผิดชอบเรื่องความครบถ้วนของเอกสารเป็นของแพทย์ต้นทาง
  TRANSPLANT_APPOINTMENT: [
    "Appointment Confirmed",
    "Rejected / Redirected",
    "Closed",
  ],
  REGIMEN_CONSULT: [
    "Submitted",
    "Pending Review",
    "Incomplete",
    "Awaiting Attending",
    "Advice Sent",
    "Rejected / Redirected",
    "Closed",
  ],
  CHEMO_ADMISSION: [
    "Submitted",
    "Pending Review",
    "Incomplete",
    "Awaiting Attending",
    "Readiness Visit Scheduled",
    "Advice Sent",
    "Rejected / Redirected",
    "Closed",
  ],
  GENERAL_OPD: ["Submitted", "Auto Replied", "Closed"],
};

export const STATUSES = Object.keys(STATUS_LABEL_TH) as Status[];

/* ------------------------------------------------------------------ */
/* Urgency & escalation                                                */
/* ------------------------------------------------------------------ */

/**
 * ไม่มีระดับ "ฉุกเฉิน" โดยเจตนา — อาจารย์ยืนยัน 29 ก.ค. 2569 ว่าหากเป็นเคสฉุกเฉินจริง
 * จะไม่ใช่การ refer แบบ OPD ตั้งแต่ต้น การมีช่องฉุกเฉินจะทำให้ถูกใช้ผิดวัตถุประสงค์
 * เคสฉุกเฉินให้ใช้ช่องทางส่งต่อฉุกเฉินระหว่างโรงพยาบาลตามปกติ
 */
export type Urgency = "Routine" | "Urgent";

export const URGENCY_LABEL_TH: Record<Urgency, string> = {
  Routine: "ปกติ",
  Urgent: "เร่งด่วน",
};

export const URGENCY_COLOR: Record<Urgency, string> = {
  Routine: "bg-zinc-200 text-zinc-700",
  Urgent: "bg-orange-100 text-orange-800",
};

/**
 * ระดับการแจ้งเตือนตาม Fail-Safe & Escalation Matrix
 * - none   : ยังอยู่ในกรอบเวลา
 * - yellow : ค้างครบ 24 ชั่วโมงทำการ — ปักหมุดไว้บนสุดของ LINE รอบ 10:00 น.
 * - red    : ค้างครบ 48 ชั่วโมงทำการ — แจ้ง resident + คุณหมอแอดมินกลางทันที
 */
export type AlertLevel = "none" | "yellow" | "red";

export const ALERT_LABEL_TH: Record<AlertLevel, string> = {
  none: "ปกติ",
  yellow: "Yellow Alert (ค้าง 24 ชม.)",
  red: "Red Alert (ค้าง 48 ชม.)",
};

export const ALERT_COLOR: Record<AlertLevel, string> = {
  none: "bg-zinc-100 text-zinc-500",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

/** เกณฑ์เวลา (ชั่วโมงทำการ) ของแต่ละระดับการแจ้งเตือน */
export const ESCALATION_THRESHOLDS = {
  yellowBusinessHours: 24,
  redBusinessHours: 48,
} as const;

export function alertLevelFor(
  elapsedBusinessHours: number,
  status: Status,
): AlertLevel {
  if (isTerminal(status)) return "none";
  if (elapsedBusinessHours >= ESCALATION_THRESHOLDS.redBusinessHours)
    return "red";
  if (elapsedBusinessHours >= ESCALATION_THRESHOLDS.yellowBusinessHours)
    return "yellow";
  return "none";
}

/** เคสที่ถือว่าจบแล้ว ไม่ต้องนับ SLA ต่อ */
export function isTerminal(status: Status): boolean {
  return (
    status === "Closed" ||
    status === "Rejected / Redirected" ||
    status === "Advice Sent" ||
    status === "Readiness Visit Scheduled" ||
    status === "Appointment Confirmed" ||
    status === "Auto Replied"
  );
}

/* ------------------------------------------------------------------ */
/* Disease group (แกนรอง — ใช้กับ checklist เอกสารและรายงาน)            */
/* ------------------------------------------------------------------ */

/**
 * กลุ่มโรค — ครอบคลุมข้อบ่งชี้การส่งต่อที่พบจริงในเวชปฏิบัติ
 *
 * MDS, MPN และ CML แยกเป็นกลุ่มของตัวเอง ไม่รวมใน "Other Hematology"
 * เพราะเป็นข้อบ่งชี้หลักของการส่งต่อมาศูนย์ปลูกถ่าย
 * (high-risk MDS และ myelofibrosis เป็น transplant indication โดยตรง
 *  ส่วน CML ส่งต่อเมื่อดื้อยาหรือทนยา TKI ไม่ได้)
 */
export type DiseaseGroup =
  | "Acute Leukemia"
  | "Lymphoma"
  | "Multiple Myeloma"
  | "MDS"
  | "MPN"
  | "CML"
  | "Aplastic Anemia / BMF"
  | "Other Hematology";

export const DISEASE_GROUP_LABEL_TH: Record<DiseaseGroup, string> = {
  "Acute Leukemia": "มะเร็งเม็ดเลือดขาวเฉียบพลัน (AML/ALL/APL)",
  Lymphoma: "มะเร็งต่อมน้ำเหลือง",
  "Multiple Myeloma": "มัยอิโลมา / โรคพลาสมาเซลล์",
  MDS: "MDS — ไขกระดูกผิดปกติ",
  MPN: "MPN — PV / ET / Myelofibrosis",
  CML: "CML — มะเร็งเม็ดเลือดขาวเรื้อรังมัยอิลอยด์",
  "Aplastic Anemia / BMF": "ไขกระดูกฝ่อ / ไขกระดูกล้มเหลว",
  "Other Hematology": "โลหิตวิทยาอื่น ๆ",
};

export const DISEASE_GROUPS = Object.keys(
  DISEASE_GROUP_LABEL_TH,
) as DiseaseGroup[];

/* ------------------------------------------------------------------ */
/* Referral record                                                     */
/* ------------------------------------------------------------------ */

export interface Referral {
  referralId: string;
  referralType: ReferralType;
  /** แกนรอง — กลุ่ม 4 อาจยังไม่ระบุ เพราะไม่มีใครคัดกรอง */
  diseaseGroup: DiseaseGroup | null;
  submittedAt: string;
  referrerOrg: string;
  referrerPhone: string;
  urgency: Urgency;
  status: Status;
  assignedTo: string | null;
  /** ชั่วโมงทำการที่ผ่านไปนับจากส่งฟอร์ม (ไม่นับวันหยุด — ดู SRS FR-013) */
  elapsedBusinessHours: number;
  followUpDate: string | null;
  /** ระบบตรวจพบว่าอาจซ้ำกับเคสอื่นใน 30 วัน (FR-014) — ให้เจ้าหน้าที่ตรวจสอบเอง */
  possibleDuplicateOf: string | null;
  /**
   * วันนัด รูปแบบ yyyy-MM-dd — ใช้เฉพาะกลุ่มที่ 1 และ 3
   * แยกจาก `note` เพราะต้องนำไปนับคิว fellow ได้ (ดู fellow-schedule.ts)
   */
  appointmentDate: string | null;
  /** fellow ที่ผู้ป่วยถูกนัดให้พบ — เฉพาะกลุ่มที่ 1 */
  fellowAssigned: string | null;
  note: string;
}

/**
 * ไม่มีรายชื่อผู้รับผิดชอบตายตัวในไฟล์นี้โดยเจตนา
 *
 * resident และ fellow หมุนเวียนทุกปีการศึกษา รายชื่อที่ฝังในโค้ดจะล้าสมัย
 * และต้องให้โปรแกรมเมอร์แก้ทุกครั้ง (ขัดกับ NFR-005)
 *
 * - dropdown "ผู้รับผิดชอบ" ใน dashboard สร้างจากเคสจริงที่มีอยู่
 * - ชื่อผู้รับผิดชอบระบบ (แอดมินกลาง ผู้สำรอง ฯลฯ) อ่านจากชีต `config`
 */
