/**
 * Checklist เอกสาร/ข้อมูลที่ต้องเตรียม แยกตามกลุ่มงาน (ไม่ใช่ตามโรค)
 * เนื้อหาอ้างอิงจากเอกสารข้อเสนอโครงการฉบับ 23.7.2026 §3
 */

import type { ReferralType } from "./referral-types";

export interface ChecklistItem {
  label: string;
  /** เงื่อนไข — แสดงเฉพาะบางโรค เช่น "กรณีผู้ป่วย Lymphoma" */
  conditionTh?: string;
  detail?: string;
}

export interface ChecklistSection {
  /** สิ่งที่ **แพทย์ต้นทาง** ต้องทำก่อนส่ง */
  forReferrer: ChecklistItem[];
  /** สิ่งที่ **ผู้ป่วย** ต้องถือมาในวันนัด */
  forPatient: ChecklistItem[];
}

const TRANSPLANT_CHECKLIST: ChecklistSection = {
  forReferrer: [
    {
      label:
        'เขียนบนหัวกระดาษใบ refer ให้ชัดเจนว่า "ส่งพบ fellow transplant ชื่อ .......... วันที่ .......... ที่ OPD 700"',
      detail:
        "เพื่อให้พยาบาลคัดกรองด่านหน้าของ รพ.ศิริราช ส่งผู้ป่วยขึ้นมาที่คลินิกโรคเลือดได้ถูกต้อง",
    },
    {
      label: "แจ้งผู้ป่วยให้ทำบัตรโรงพยาบาลออนไลน์ให้เรียบร้อยก่อนวันนัด",
      detail: "https://si-eservice2.mahidol.ac.th/medrecord/index.php",
    },
    {
      label:
        "ให้ผู้ป่วยลงนามหนังสือรับทราบการส่งข้อมูลผ่านระบบอิเล็กทรอนิกส์ และเก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง",
      detail: "ดาวน์โหลดแบบฟอร์มได้จากหน้านี้",
    },
  ],
  forPatient: [
    { label: "เอกสารสิทธิการรักษาของผู้ป่วย" },
    {
      label: "ข้อมูลการรักษาทั้งหมด",
      detail:
        "ระบุวันที่เริ่มต้นและวันสุดท้ายที่ได้ยาเคมีบำบัด ระบุสูตรยาให้ชัดเจน พร้อมข้อมูลการประเมินโรคหลังรักษาจนถึงปัจจุบัน",
    },
    {
      label:
        "ผลตรวจ BM study แรกวินิจฉัยและล่าสุด / ผล Chromosome / ผล Molecular mutation",
    },
    {
      label: "ผล Imaging แรกวินิจฉัยและล่าสุด",
      detail: "กรุณานำแผ่น CD บันทึกภาพถ่ายรังสี พร้อมแนบผล Official report มาด้วย",
    },
    {
      label: "Block slide + ผล Official report เดิม มา Review Patho ที่ศิริราช",
      conditionTh: "กรณีผู้ป่วย Lymphoma",
    },
    {
      label: "ผล SPEP, SFLC, immunofixation, Beta2-microglobulin ให้ครบถ้วน",
      conditionTh: "กรณีผู้ป่วย Multiple Myeloma",
    },
    {
      label: "พาพี่น้องมาพร้อมผู้ป่วยเพื่อทำนัดตรวจ HLA และรับทราบค่าใช้จ่าย",
      conditionTh: "กรณี Allogeneic stem cell transplantation",
    },
  ],
};

const CONSULT_FIELDS: ChecklistItem[] = [
  { label: "ชื่อ-สกุล, อายุ, เพศ ของผู้ป่วย" },
  { label: "Diagnosis และ stage" },
  { label: "Treatment ที่ได้รับมาแล้ว" },
  { label: "สิ่งที่ต้องการปรึกษา (ระบุคำถามให้ชัดเจน)" },
  {
    label: "เบอร์ติดต่อกลับของแพทย์เจ้าของไข้",
    detail: "บังคับกรอก เพื่อให้ทีมติดต่อกลับได้โดยไม่ต้องแชททวงถามไปมา",
  },
];

const CONSENT_ITEM: ChecklistItem = {
  label:
    "ให้ผู้ป่วยลงนามหนังสือรับทราบการส่งข้อมูลผ่านระบบอิเล็กทรอนิกส์ และเก็บต้นฉบับไว้ที่โรงพยาบาลต้นทาง",
  detail: "ดาวน์โหลดแบบฟอร์มได้จากหน้านี้",
};

export const CHECKLIST_BY_TYPE: Record<ReferralType, ChecklistSection> = {
  TRANSPLANT_APPOINTMENT: TRANSPLANT_CHECKLIST,

  REGIMEN_CONSULT: {
    forReferrer: [...CONSULT_FIELDS, CONSENT_ITEM],
    forPatient: [],
  },

  CHEMO_ADMISSION: {
    forReferrer: [
      { label: "ชื่อ-สกุล, อายุ, เพศ ของผู้ป่วย" },
      { label: "Underlying disease" },
      { label: "Diagnosis และ stage" },
      { label: "Treatment ที่ได้รับมาแล้ว" },
      { label: "สิ่งที่ต้องการปรึกษา และเหตุผลที่ต้องการเตียง Admit" },
      {
        label: "เบอร์ติดต่อกลับของแพทย์เจ้าของไข้",
        detail: "บังคับกรอก เพื่อให้ทีมติดต่อกลับได้ทันทีเมื่อมีเตียงว่าง",
      },
      CONSENT_ITEM,
    ],
    forPatient: [
      {
        label: "เอกสารสิทธิการรักษา และผลตรวจทางห้องปฏิบัติการล่าสุด",
        detail: "นำมาในวันที่มาประเมินความพร้อมที่ OPD 700",
      },
    ],
  },

  GENERAL_OPD: {
    forReferrer: [
      {
        label: "เขียนใบ refer (ใบส่งตัว) ให้ผู้ป่วยให้เรียบร้อยก่อน",
        detail: "สำหรับการส่งต่อมารักษาที่ศิริราชเนื่องจากเกินศักยภาพ",
      },
    ],
    forPatient: [
      {
        label: 'แอด LINE "Siriraj นัดหมาย" จาก QR code เพื่อทำนัดกับ OPD โดยตรง',
        detail: "ผู้ป่วยจะได้รับใบนัดภายใน 3 วันทำการ",
      },
      {
        label: "หากผู้ป่วยไม่มีสมาร์ทโฟนหรือใช้ LINE ไม่ได้ ให้โทรติดต่อเจ้าหน้าที่แทน",
        detail: "โทร. 02-419-9903 ในเวลาราชการ",
      },
    ],
  },
};
