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
    // แพทย์ต้นทางจองคิวเองจากปฏิทิน ไม่มีขั้นรอแอดมินแล้ว (มติอาจารย์ 2 ส.ค. 2569)
    // slaBusinessHours ไม่มีความหมายกับกลุ่มนี้ หน้าเว็บจึงไม่แสดงกรอบเวลาตอบกลับ
    handlerTh: "จองคิวเองผ่านระบบ ไม่ต้องรอเจ้าหน้าที่",
    automation: "FULLY_AUTOMATED",
    slaBusinessHours: 0,
    href: "/refer/transplant",
  },
  REGIMEN_CONSULT: {
    groupNumber: 2,
    emoji: "💊",
    /**
     * ⚠️ ข้อความนี้เป็นของหน้าเว็บเท่านั้น ไม่ใช่ตัวเลือกใน Google Form
     *
     * ตัวเลือกในฟอร์มต้องคงข้อความเดิม "กลุ่มที่ 2 — ขอความเห็นสูตรยาเคมีบำบัด"
     * เพราะ TYPE_FROM_FORM_LABEL ใน apps-script/Config.gs จับคู่ด้วยข้อความนั้นตรง ๆ
     * แก้ในฟอร์มเมื่อไร เคสใหม่จะแปลงกลุ่มไม่ได้และหายจาก dashboard ทันที
     */
    titleTh: "ขอความเห็นสูตรยาเคมีบำบัด หรือสอบถามอื่น ๆ",
    purposeTh:
      "ปรึกษาสูตรยาเคมีบำบัด หรือสอบถามเรื่องอื่นก่อนตัดสินใจส่งตัว " +
      "เช่น ควร refer หรือไม่ หรือมีการศึกษาวิจัย (clinical trial) ที่เหมาะกับผู้ป่วยหรือไม่ " +
      "— ผู้ป่วยยังรักษาต่อที่โรงพยาบาลต้นทาง ไม่ต้องส่งตัวมา",
    handlerTh: "แพทย์ประจำบ้าน R2/R3 วอร์ดเคโม + อาจารย์ Attending อนุมัติ",
    automation: "SEMI_AUTOMATED",
    slaBusinessHours: 24,
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
    slaBusinessHours: 24,
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
  | "Cancelled by Referrer"
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
  "Cancelled by Referrer": "แพทย์ต้นทางยกเลิกนัดแล้ว",
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
  "Cancelled by Referrer": "bg-zinc-200 text-zinc-700",
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
    "Cancelled by Referrer",
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
 * - yellow : ค้างครบ 2 วันทำการ — ปักหมุดไว้บนสุดของ LINE รอบ 10:00 น.
 * - red    : ค้างครบ 3 วันทำการ — แจ้ง resident + คุณหมอแอดมินกลางทันที
 */
export type AlertLevel = "none" | "yellow" | "red";

export const ALERT_LABEL_TH: Record<AlertLevel, string> = {
  none: "ปกติ",
  yellow: "Yellow Alert (ค้าง 2 วันทำการ)",
  red: "Red Alert (ค้าง 3 วันทำการ)",
};

export const ALERT_COLOR: Record<AlertLevel, string> = {
  none: "bg-zinc-100 text-zinc-500",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

/** เวลาทำการต่อวัน — 08:00-16:00 ตรงกับ BUSINESS ใน apps-script/Config.gs */
const BUSINESS_HOURS_PER_DAY = 8;

/**
 * แปลงชั่วโมงทำการเป็นวันทำการ สำหรับข้อความที่คนอ่าน
 *
 * ไม่มีใครแปลง "48 ชั่วโมงทำการ" ในหัวได้ว่าเท่ากับ 6 วันทำงาน
 * แพทย์ต้นทางอ่านแล้วเข้าใจว่าราวสองวัน ซึ่งห่างจากของจริงสี่เท่า
 * ตัวเลขที่สื่อสารออกไปจึงต้องเป็นวัน ส่วนการคำนวณภายในยังใช้ชั่วโมงเหมือนเดิม
 * เพราะต้องตัดเศษของวันที่ยื่นตอนบ่ายให้ถูก
 */
export function businessDaysText(businessHours: number): string {
  const days = businessHours / BUSINESS_HOURS_PER_DAY;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} วันทำการ`;
}

/**
 * เกณฑ์เวลา (ชั่วโมงทำการ) ของแต่ละระดับการแจ้งเตือน
 *
 * ⚠️ ต้องตรงกับ ESCALATION ใน apps-script/Config.gs
 *
 * เดิม 24/48 ชั่วโมงทำการ = 3/6 วันทำงาน ซึ่งยาวกว่าที่ตั้งใจไว้มาก
 * มติ 29 ส.ค. 2569 ให้กรอบตอบกลับเป็น 3 วันทำการนับจากวันที่ส่ง
 * — ครอบคลุมความล่าช้าจากรอบแจ้งเตือน 10:00 น. อยู่ในตัวแล้ว
 * เคสที่ส่งหลัง 10:00 จะได้รับแจ้งเช้าวันรุ่งขึ้น ยังเหลือเวลาราวสองวันทำการ
 * จึงไม่ต้องแยกกรอบเวลาตามช่วงเวลาที่ส่ง
 */
export const ESCALATION_THRESHOLDS = {
  yellowBusinessHours: 16, // 2 วันทำการ — เตือนล่วงหน้าหนึ่งวันเต็มก่อนครบกำหนด
  redBusinessHours: 24, // 3 วันทำการ
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

/**
 * สถานะที่ทำให้คิวของ fellow ว่างกลับคืนมา
 *
 * ⚠️ แยกจาก isTerminal() โดยเจตนา อย่ารวมกัน — "Appointment Confirmed"
 * เป็นสถานะจบเหมือนกัน แต่ยัง **กินคิวอยู่** เพราะผู้ป่วยจะมาตามนัดจริง
 * ถ้าเอา isTerminal() มาใช้นับคิว คิวที่จองแล้วจะกลายเป็นว่างทั้งหมด
 * แล้วระบบจะรับจองเกินโควตาโดยไม่มีอะไรเตือน
 *
 * ⚠️ ต้องตรงกับ SLOT_RELEASING_STATUSES ใน apps-script/Config.gs
 *    คนละ runtime แชร์ไฟล์กันไม่ได้ ถ้าแก้ที่นี่ต้องไปแก้ที่นั่นด้วย
 *    ถ้าไม่ตรงกัน ปฏิทินกับตัวจองจะเห็นคิวคงเหลือไม่เท่ากัน
 */
export const SLOT_RELEASING_STATUSES: Status[] = [
  "Rejected / Redirected",
  "Cancelled by Referrer",
];

export function releasesSlot(status: Status): boolean {
  return SLOT_RELEASING_STATUSES.includes(status);
}

/** เคสที่ถือว่าจบแล้ว ไม่ต้องนับ SLA ต่อ */
export function isTerminal(status: Status): boolean {
  return (
    status === "Closed" ||
    status === "Rejected / Redirected" ||
    status === "Advice Sent" ||
    status === "Readiness Visit Scheduled" ||
    status === "Appointment Confirmed" ||
    status === "Auto Replied" ||
    status === "Cancelled by Referrer"
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
  /** ชื่อแพทย์ผู้ส่ง — ใช้ตอนโทรกลับ จะได้ขอสายถูกคน */
  referrerName: string;
  referrerPhone: string;
  /**
   * สิทธิการรักษา — บัตรทอง / ประกันสังคม / ข้าราชการ / ชำระเงินเอง
   *
   * สูตรที่ถูกต้องทางวิชาการกับสูตรที่ผู้ป่วยเบิกได้จริงไม่ใช่อันเดียวกัน
   * ยานอกบัญชียาหลักแนะนำไปก็ให้ไม่ได้ ผู้ตอบจึงต้องเห็นก่อนเลือกสูตร
   *
   * ว่างได้ — เคสที่ส่งเข้ามาก่อนฟอร์มมีคำถามนี้จะไม่มีค่า
   */
  insuranceScheme: string;
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
  /**
   * รายละเอียดนัดแบบข้อความ เช่น "08:00 น. พบ พญ. … (OPD 700)"
   *
   * แยกจาก note เพราะ pickNote() รวมหลายคอลัมน์ไว้ด้วยกัน
   * ถ้าเคสมี note ของตัวเองอยู่แล้ว รายละเอียดนัดจะถูกกลบหายไป
   */
  appointmentNote: string;
  /**
   * ข้อบ่งชี้การปลูกถ่ายที่แพทย์ต้นทางเลือกตอนจอง — เฉพาะกลุ่มที่ 1
   * เก็บเป็น id จาก transplant-indications.ts ว่างได้ (เคสที่จองก่อนมีช่องนี้)
   */
  transplantIndication: string;
  note: string;

  /**
   * เนื้อหาทางคลินิกที่แพทย์ผู้ตอบต้องอ่านก่อนให้คำแนะนำ
   *
   * มาจากคอลัมน์กลางที่ Apps Script รวมค่าจาก _g2/_g3 ให้แล้ว
   * หนึ่งเคสตอบได้กลุ่มเดียว จึงมีชุดเดียวเสมอ
   */
  diagnosis: string;
  stage: string;
  treatmentSummary: string;
  comorbidity: string;
  clinicalQuestion: string;
  /** คำตอบที่บันทึกไว้แล้ว — ว่าง = ยังไม่มีใครตอบ */
  adviceRecord: string;
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
