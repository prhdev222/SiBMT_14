/**
 * เกณฑ์การส่งต่อผู้ป่วยเพื่อเข้ารับการเตรียมตัวปลูกถ่ายเซลล์ต้นกำเนิด
 *
 * ที่มา: docs/I:CBMT.pdf ซึ่งอาจารย์ขอให้ใส่เพิ่มในกลุ่มที่ 1
 * "เพื่อให้แพทย์ต้นทางทราบเบื้องต้นว่าเกณฑ์ตอบสนองในแต่ละโรคก่อนทำการส่งผู้ป่วยมา"
 *
 * ⚠️ นี่คือข้อมูลประกอบการตัดสินใจ ไม่ใช่ด่านกั้น
 *
 * ระบบต้องไม่ปฏิเสธการจองเพราะเกณฑ์ไม่ครบ ตามมติอาจารย์ 2 ส.ค. 2569 ที่ว่า
 * ความครบถ้วนเป็นหน้าที่ของแพทย์ต้นทาง และการกั้นตั้งแต่ตอนจองมีแต่ทำให้
 * ผู้ป่วยต้องเดินทางกลับไปกลับมา — วันนัดอยู่ห่างออกไปหลายสัปดาห์
 * สิ่งที่ยังขาดจึงทำให้ครบทันก่อนถึงวันนัดอยู่แล้ว
 *
 * หน้าที่ของไฟล์นี้คือทำให้แพทย์ต้นทาง **เห็นเกณฑ์ตอนที่กำลังเลือก**
 * ไม่ใช่ให้ระบบตัดสินแทน
 */

export type TransplantType = "AUTOLOGOUS" | "ALLOGENEIC";

export const TRANSPLANT_TYPE_LABEL_TH: Record<TransplantType, string> = {
  AUTOLOGOUS: "Autologous stem cell transplantation",
  ALLOGENEIC: "Allogeneic stem cell transplantation",
};

export interface TransplantIndication {
  /** ค่าที่บันทึกลงชีต — ห้ามแก้หลังใช้จริง ไม่งั้นเคสเก่าจะอ่านไม่ออก */
  id: string;
  type: TransplantType;
  /** ชื่อโรคตามตารางในเอกสาร */
  diseaseTh: string;
  /** เกณฑ์สถานะโรค — ว่างได้ ตารางบางแถวไม่ได้ระบุ */
  statusTh: string;
  /** เกณฑ์อายุ — ว่างได้ */
  ageTh: string;
}

/**
 * เรียงตามลำดับในเอกสารต้นฉบับ ไม่เรียงใหม่ตามตัวอักษร
 * เพื่อให้เทียบกับกระดาษที่อาจารย์ถืออยู่ได้ทีละบรรทัด
 */
export const TRANSPLANT_INDICATIONS: TransplantIndication[] = [
  {
    id: "AUTO_MM",
    type: "AUTOLOGOUS",
    diseaseTh: "Multiple myeloma",
    statusTh:
      "ประเมินโรคมีการตอบสนองตั้งแต่ PR ขึ้นไป ให้ CMT อย่างน้อย 2 รอบ (after 2 cycle of induction)",
    ageTh: "ต่ำกว่า 70 ปี (อายุ 65–70 ปี ประเมินแล้ว fit และไม่มีโรคประจำตัว)",
  },
  {
    id: "AUTO_LYMPHOMA_RR",
    type: "AUTOLOGOUS",
    diseaseTh: "Relapse/refractory lymphoma (chemosensitive)",
    statusTh:
      "ประเมินโรคมีการตอบสนองตั้งแต่ PR ขึ้นไป ให้ CMT อย่างน้อย 2 รอบ (after 2 cycle of salvage)",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "AUTO_PCNSL",
    type: "AUTOLOGOUS",
    diseaseTh: "PCNSL (chemosensitive)",
    statusTh: "ประเมินโรคมีการตอบสนองตั้งแต่ PR ขึ้นไป (after interim)",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "AUTO_PTCL",
    type: "AUTOLOGOUS",
    diseaseTh: "PTCL (chemosensitive)",
    statusTh: "ประเมินโรคมีการตอบสนองตั้งแต่ PR ขึ้นไป (after interim)",
    ageTh: "",
  },

  {
    id: "ALLO_AML",
    type: "ALLOGENEIC",
    diseaseTh: "AML (intermediate and adverse risk)",
    statusTh: "CR",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "ALLO_ALL_PH_NEG",
    type: "ALLOGENEIC",
    diseaseTh: "ALL Ph negative (high risk)",
    statusTh: "CR",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "ALLO_ALL_PH_POS",
    type: "ALLOGENEIC",
    diseaseTh: "ALL Ph positive",
    statusTh: "CR",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "ALLO_RR_AML_ALL",
    type: "ALLOGENEIC",
    diseaseTh: "Relapse/refractory AML and ALL",
    statusTh: "CR",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "ALLO_MDS",
    type: "ALLOGENEIC",
    diseaseTh: "MDS (high and very high risk)",
    statusTh: "",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "ALLO_PMF",
    type: "ALLOGENEIC",
    diseaseTh: "PMF (int-2, high risk)",
    statusTh: "",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "ALLO_CML",
    type: "ALLOGENEIC",
    diseaseTh: "CML triple refractory หรือ T315I mutation",
    statusTh: "",
    ageTh: "ต่ำกว่า 65 ปี",
  },
  {
    id: "ALLO_SAA",
    type: "ALLOGENEIC",
    diseaseTh: "Severe aplastic anemia",
    statusTh: "",
    ageTh: "MUD อายุน้อยกว่า 18 ปี, MSD อายุน้อยกว่า 50 ปี",
  },
];

/**
 * ตัวเลือกสำหรับกรณีที่ไม่ตรงข้อใดเลย
 *
 * ต้องมี ไม่งั้นแพทย์ที่มีเคสนอกตารางจะเลือกข้อที่ใกล้เคียงที่สุดแทน
 * แล้วข้อมูลจะผิดโดยที่ไม่มีใครรู้ — ยอมให้ตอบว่า "ไม่ตรง" ตรง ๆ ดีกว่า
 * และเป็นสัญญาณให้ทีมเห็นว่ามีเคสนอกเกณฑ์เข้ามาบ่อยแค่ไหน
 */
export const INDICATION_OTHER = "OTHER";
export const INDICATION_OTHER_LABEL_TH = "ไม่ตรงข้อใดข้างต้น / ขอปรึกษาก่อน";

export function findIndication(id: string): TransplantIndication | null {
  return TRANSPLANT_INDICATIONS.find((i) => i.id === id) ?? null;
}

/** ข้อความสั้น ๆ ที่เก็บลงชีตและแสดงบน dashboard */
export function indicationLabel(id: string): string {
  if (!id) return "";
  if (id === INDICATION_OTHER) return INDICATION_OTHER_LABEL_TH;
  const found = findIndication(id);
  return found ? found.diseaseTh : id;
}

export const INDICATIONS_BY_TYPE: Record<
  TransplantType,
  TransplantIndication[]
> = {
  AUTOLOGOUS: TRANSPLANT_INDICATIONS.filter((i) => i.type === "AUTOLOGOUS"),
  ALLOGENEIC: TRANSPLANT_INDICATIONS.filter((i) => i.type === "ALLOGENEIC"),
};
