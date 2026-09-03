/**
 * ทำเบอร์โทรให้เทียบกันได้: "081-234-5678" กับ "812345678" (ชีตตัด 0) ต้องตรงกัน
 * ตรรกะเดียวกับ phoneKey_ ใน apps-script/LineWebhook.gs — แก้ฝั่งหนึ่งต้องแก้อีกฝั่ง
 */
export function phoneKey(value: string): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 9) return "";
  return /^[1-9]\d{7,8}$/.test(digits) ? `0${digits}` : digits;
}
