export type Status =
  | "Submitted"
  | "Pending Review"
  | "Incomplete"
  | "Ready for Triage"
  | "Triaged"
  | "Assigned"
  | "Appointment Pending"
  | "Appointment Confirmed"
  | "Rejected / Redirected"
  | "Closed";

export type Urgency = "Routine" | "Urgent" | "Very Urgent";

export type DiseaseGroup =
  | "Acute Leukemia"
  | "Lymphoma"
  | "Multiple Myeloma"
  | "Stem Cell Transplantation"
  | "Other Hematology";

export interface Referral {
  referralId: string;
  submittedAt: string;
  referrerOrg: string;
  urgency: Urgency;
  diseaseGroup: DiseaseGroup;
  status: Status;
  assignedTo: string | null;
  slaOverdue: boolean;
  followUpDate: string | null;
  note: string;
}

export const STATUS_LABEL_TH: Record<Status, string> = {
  Submitted: "ส่งข้อมูลแล้ว",
  "Pending Review": "รอตรวจความครบถ้วน",
  Incomplete: "ข้อมูลไม่ครบ",
  "Ready for Triage": "พร้อมคัดกรอง",
  Triaged: "คัดกรองแล้ว",
  Assigned: "มอบหมายแล้ว",
  "Appointment Pending": "รอประสานวันนัด",
  "Appointment Confirmed": "ยืนยันวันนัดแล้ว",
  "Rejected / Redirected": "ไม่เข้าเกณฑ์ / ส่งต่อช่องทางอื่น",
  Closed: "ปิดเคสแล้ว",
};

export const STATUS_COLOR: Record<Status, string> = {
  Submitted: "bg-blue-100 text-blue-800",
  "Pending Review": "bg-amber-100 text-amber-800",
  Incomplete: "bg-red-100 text-red-800",
  "Ready for Triage": "bg-amber-100 text-amber-800",
  Triaged: "bg-indigo-100 text-indigo-800",
  Assigned: "bg-indigo-100 text-indigo-800",
  "Appointment Pending": "bg-amber-100 text-amber-800",
  "Appointment Confirmed": "bg-green-100 text-green-800",
  "Rejected / Redirected": "bg-zinc-200 text-zinc-700",
  Closed: "bg-zinc-200 text-zinc-700",
};

export const URGENCY_LABEL_TH: Record<Urgency, string> = {
  Routine: "ปกติ",
  Urgent: "เร่งด่วน",
  "Very Urgent": "เร่งด่วนมาก",
};

export const URGENCY_COLOR: Record<Urgency, string> = {
  Routine: "bg-zinc-200 text-zinc-700",
  Urgent: "bg-orange-100 text-orange-800",
  "Very Urgent": "bg-red-100 text-red-800",
};

export const DISEASE_GROUP_LABEL_TH: Record<DiseaseGroup, string> = {
  "Acute Leukemia": "มะเร็งเม็ดเลือดขาวเฉียบพลัน",
  Lymphoma: "มะเร็งต่อมน้ำเหลือง",
  "Multiple Myeloma": "มัยอิโลมา",
  "Stem Cell Transplantation": "ปลูกถ่ายไขกระดูก/สเต็มเซลล์",
  "Other Hematology": "โลหิตวิทยาอื่น ๆ",
};

export const MOCK_REFERRALS: Referral[] = [
  {
    referralId: "HEM-20260721-0001",
    submittedAt: "2026-07-21 09:12",
    referrerOrg: "โรงพยาบาลสมุทรสาคร",
    urgency: "Very Urgent",
    diseaseGroup: "Acute Leukemia",
    status: "Incomplete",
    assignedTo: null,
    slaOverdue: true,
    followUpDate: "2026-07-23",
    note: "ขาดผล flow cytometry",
  },
  {
    referralId: "HEM-20260722-0002",
    submittedAt: "2026-07-22 11:40",
    referrerOrg: "โรงพยาบาลราชบุรี",
    urgency: "Urgent",
    diseaseGroup: "Lymphoma",
    status: "Ready for Triage",
    assignedTo: null,
    slaOverdue: false,
    followUpDate: "2026-07-24",
    note: "",
  },
  {
    referralId: "HEM-20260722-0003",
    submittedAt: "2026-07-22 14:05",
    referrerOrg: "โรงพยาบาลนครปฐม",
    urgency: "Routine",
    diseaseGroup: "Multiple Myeloma",
    status: "Triaged",
    assignedTo: "พญ. สุดา",
    slaOverdue: false,
    followUpDate: "2026-07-28",
    note: "",
  },
  {
    referralId: "HEM-20260723-0004",
    submittedAt: "2026-07-23 08:55",
    referrerOrg: "โรงพยาบาลสมเด็จพระพุทธเลิศหล้า",
    urgency: "Very Urgent",
    diseaseGroup: "Stem Cell Transplantation",
    status: "Assigned",
    assignedTo: "นพ. ธนกร",
    slaOverdue: true,
    followUpDate: "2026-07-24",
    note: "รอ HLA typing ผู้บริจาค",
  },
  {
    referralId: "HEM-20260723-0005",
    submittedAt: "2026-07-23 13:20",
    referrerOrg: "โรงพยาบาลเพชรบุรี",
    urgency: "Routine",
    diseaseGroup: "Other Hematology",
    status: "Pending Review",
    assignedTo: null,
    slaOverdue: false,
    followUpDate: "2026-07-25",
    note: "",
  },
  {
    referralId: "HEM-20260724-0006",
    submittedAt: "2026-07-24 10:02",
    referrerOrg: "โรงพยาบาลสระบุรี",
    urgency: "Urgent",
    diseaseGroup: "Lymphoma",
    status: "Appointment Pending",
    assignedTo: "พยาบาลกาญจนา",
    slaOverdue: false,
    followUpDate: "2026-07-27",
    note: "รอผู้ป่วยยืนยันวันนัด",
  },
  {
    referralId: "HEM-20260724-0007",
    submittedAt: "2026-07-24 15:48",
    referrerOrg: "โรงพยาบาลอ่างทอง",
    urgency: "Routine",
    diseaseGroup: "Acute Leukemia",
    status: "Appointment Confirmed",
    assignedTo: "นพ. ธนกร",
    slaOverdue: false,
    followUpDate: "2026-08-01",
    note: "",
  },
  {
    referralId: "HEM-20260725-0008",
    submittedAt: "2026-07-25 09:30",
    referrerOrg: "โรงพยาบาลสิงห์บุรี",
    urgency: "Urgent",
    diseaseGroup: "Multiple Myeloma",
    status: "Submitted",
    assignedTo: null,
    slaOverdue: false,
    followUpDate: null,
    note: "",
  },
  {
    referralId: "HEM-20260725-0009",
    submittedAt: "2026-07-25 16:10",
    referrerOrg: "โรงพยาบาลชัยนาท",
    urgency: "Routine",
    diseaseGroup: "Other Hematology",
    status: "Rejected / Redirected",
    assignedTo: "พญ. สุดา",
    slaOverdue: false,
    followUpDate: null,
    note: "แนะนำส่งต่อคลินิกอายุรกรรมทั่วไป",
  },
  {
    referralId: "HEM-20260726-0010",
    submittedAt: "2026-07-26 07:45",
    referrerOrg: "โรงพยาบาลกาญจนบุรี",
    urgency: "Very Urgent",
    diseaseGroup: "Lymphoma",
    status: "Closed",
    assignedTo: "นพ. ธนกร",
    slaOverdue: false,
    followUpDate: null,
    note: "นัดหมายเรียบร้อย ปิดเคส",
  },
];

export const STAFF_MEMBERS = [
  "นพ. ธนกร",
  "พญ. สุดา",
  "พยาบาลกาญจนา",
] as const;
