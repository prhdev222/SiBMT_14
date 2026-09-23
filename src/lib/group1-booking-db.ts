/** Group 1 only. Server-side libSQL/Turso HTTP adapter. */

export interface Group1BookingInput {
  clinicDate: string;
  fellowName: string;
  referrerOrg: string;
  referrerName: string;
  referrerPhone: string;
  referrerEmail: string;
  diseaseGroup: string;
  diagnosis: string;
  patientAge: string;
  patientSex: string;
  note: string;
  transplantIndication: string;
  capacity: number;
}

export interface Group1Booking {
  referralId: string;
  status: string;
  clinicDate: string;
  fellowName: string;
  referrerOrg: string;
  diagnosis: string;
  canChange: boolean;
  manageToken: string;
  referrerName: string;
  referrerPhone: string;
  referrerEmail: string;
  diseaseGroup: string;
  patientAge: string;
  patientSex: string;
  note: string;
  transplantIndication: string;
  submittedAt: string;
  slotNumber: number;
}

export interface Group1ScheduleInput {
  clinicDate: string;
  fellowName: string;
  maxSlots: number;
  note: string;
  startTime: string;
  endTime: string;
}

type Value = string | number | null;
type Row = { [key: string]: Value };

function credentials() {
  return {
    url: process.env.GROUP1_DATABASE_URL || process.env.TURSO_DATABASE_URL,
    token: process.env.GROUP1_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
  };
}

export function isGroup1BookingDbConfigured(): boolean {
  const { url, token } = credentials();
  return Boolean(url && token);
}

function databaseUrl(): string {
  const url = credentials().url;
  if (!url) throw new Error("ยังไม่ได้ตั้งค่า GROUP1_DATABASE_URL");
  const httpUrl = url.replace(/^libsql:\/\//, "https://");
  return `${httpUrl.replace(/\/$/, "")}/v2/pipeline`;
}

function arg(value: Value) {
  if (value === null) return { type: "null" };
  if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "float", value: String(value) };
  return { type: "text", value };
}

async function execute<T extends Row = Row>(sql: string, values: Value[] = []): Promise<T[]> {
  const response = await fetch(databaseUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials().token}`,
    },
    body: JSON.stringify({
      baton: null,
      requests: [{ type: "execute", stmt: { sql, args: values.map(arg) } }, { type: "close" }],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`ฐานข้อมูลตอบกลับ ${response.status}`);
  const body = (await response.json()) as { results?: Array<{ type: string; response?: { result?: { cols: Array<{ name: string }>; rows: Array<Array<{ value?: string }>> } }; error?: { message?: string } }> };
  const result = body.results?.[0];
  if (!result || result.type !== "ok") throw new Error(result?.error?.message || "ฐานข้อมูลทำรายการไม่สำเร็จ");
  const data = result.response?.result;
  if (!data) return [];
  return data.rows.map((values) => Object.fromEntries(data.cols.map((col, i) => [col.name, values[i]?.value ?? null]))) as T[];
}

function text(value: Value): string {
  return value == null ? "" : String(value);
}

function rowToBooking(row: Row): Group1Booking {
  return {
    referralId: text(row.referral_id),
    status: text(row.status),
    clinicDate: text(row.clinic_date),
    fellowName: text(row.fellow_name),
    referrerOrg: text(row.referrer_org),
    diagnosis: text(row.diagnosis),
    canChange: text(row.status) === "Appointment Confirmed" && text(row.clinic_date) > todayIso(),
    manageToken: text(row.manage_token),
    referrerName: text(row.referrer_name),
    referrerPhone: text(row.referrer_phone),
    referrerEmail: text(row.referrer_email),
    diseaseGroup: text(row.disease_group),
    patientAge: text(row.patient_age),
    patientSex: text(row.patient_sex),
    note: text(row.note),
    transplantIndication: text(row.transplant_indication),
    submittedAt: text(row.submitted_at),
    slotNumber: Number(row.slot_number) || 1,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function id(): string {
  const date = todayIso().replaceAll("-", "");
  return `HEM-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function listGroup1Bookings(): Promise<Record<string, string>[]> {
  return (await execute("SELECT * FROM group1_bookings ORDER BY submitted_at"))
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)])));
}

export async function listGroup1Schedule(): Promise<Record<string, string>[]> {
  return (await execute("SELECT * FROM group1_schedule ORDER BY clinic_date, fellow_name"))
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, text(value)])));
}

export async function listGroup1Fellows(): Promise<string[]> {
  const rows = await execute("SELECT fellow_name FROM group1_fellows WHERE active = 1 ORDER BY fellow_name");
  return rows.map((row) => text(row.fellow_name));
}

export async function addGroup1Fellow(name: string): Promise<void> {
  await execute(
    `INSERT INTO group1_fellows (fellow_name, active) VALUES (?, 1)
     ON CONFLICT(fellow_name) DO UPDATE SET active = 1`,
    [name],
  );
}

export async function renameGroup1Fellow(oldName: string, newName: string): Promise<void> {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to) throw new Error("กรุณากรอกชื่อ Fellow");
  if (from === to) return;
  if ((await execute("SELECT fellow_name FROM group1_fellows WHERE fellow_name = ?", [to]))[0]) {
    throw new Error(`มีชื่อ "${to}" อยู่แล้ว`);
  }
  if (!(await execute("SELECT fellow_name FROM group1_fellows WHERE fellow_name = ?", [from]))[0]) {
    throw new Error(`ไม่พบชื่อ "${from}"`);
  }
  await execute("UPDATE group1_fellows SET fellow_name = ? WHERE fellow_name = ?", [to, from]);
  await execute("UPDATE group1_schedule SET fellow_name = ? WHERE fellow_name = ?", [to, from]);
  await execute("UPDATE group1_bookings SET fellow_name = ? WHERE fellow_name = ?", [to, from]);
  await execute("UPDATE group1_fellow_line_accounts SET fellow_name = ? WHERE fellow_name = ?", [to, from]);
}

export async function deactivateGroup1Fellow(name: string): Promise<void> {
  const rows = await execute("UPDATE group1_fellows SET active = 0 WHERE fellow_name = ? RETURNING fellow_name", [name]);
  if (!rows[0]) throw new Error(`ไม่พบชื่อ "${name}"`);
}

export async function addGroup1Schedule(days: Group1ScheduleInput[]): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  for (const day of days) {
    const rows = await execute(
      `INSERT INTO group1_schedule (clinic_date, fellow_name, max_slots, note, start_time, end_time)
       SELECT ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM group1_schedule WHERE clinic_date = ? AND fellow_name = ?)
       RETURNING schedule_id`,
      [day.clinicDate, day.fellowName, day.maxSlots, day.note, day.startTime, day.endTime, day.clinicDate, day.fellowName],
    );
    if (rows[0]) added++;
    else skipped++;
  }
  return { added, skipped };
}

export async function removeGroup1Schedule(clinicDate: string, fellowName: string): Promise<void> {
  const rows = await execute("DELETE FROM group1_schedule WHERE clinic_date = ? AND fellow_name = ? RETURNING schedule_id", [clinicDate, fellowName]);
  if (!rows[0]) throw new Error("ไม่พบวันออกตรวจ หรือข้อมูลเปลี่ยนไปแล้ว — กรุณาโหลดหน้าใหม่");
}

export async function createGroup1Booking(input: Group1BookingInput): Promise<Group1Booking> {
  const referralId = id();
  const manageToken = crypto.randomUUID().replaceAll("-", "");
  const submittedAt = new Date().toISOString();
  const rows = await execute(
    `INSERT INTO group1_bookings (
      referral_id, referral_type, status, submitted_at, consent_acknowledged_at,
      clinic_date, fellow_name, slot_number, referrer_org, referrer_name,
      referrer_phone, referrer_email, disease_group, diagnosis, patient_age,
      patient_sex, note, manage_token, transplant_indication
    )
    SELECT ?, 'TRANSPLANT_APPOINTMENT', 'Appointment Confirmed', ?, ?, ?, ?,
      COALESCE(MAX(slot_number), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    FROM group1_bookings
    WHERE clinic_date = ? AND fellow_name = ? AND status = 'Appointment Confirmed'
    HAVING COUNT(*) < ?
    RETURNING *`,
    [
      referralId, submittedAt, submittedAt, input.clinicDate, input.fellowName,
      input.referrerOrg, input.referrerName, input.referrerPhone, input.referrerEmail,
      input.diseaseGroup, input.diagnosis, input.patientAge, input.patientSex,
      input.note, manageToken, input.transplantIndication, input.clinicDate,
      input.fellowName, input.capacity,
    ],
  );
  if (!rows[0]) throw new Error(`คิวของ ${input.fellowName} วันที่ ${input.clinicDate} เต็มแล้ว กรุณาเลือกวันอื่นหรือแพทย์ท่านอื่น`);
  return rowToBooking(rows[0]);
}

export async function findGroup1Booking(referralId: string, token?: string, phone?: string): Promise<Group1Booking> {
  const rows = await execute(
    `SELECT * FROM group1_bookings
     WHERE referral_id = ? AND (manage_token = ? OR (? = '' AND referrer_phone = ?))
     LIMIT 1`,
    [referralId, token || "", token ? "no-phone" : "", phone || ""],
  );
  if (!rows[0]) throw new Error("ไม่พบข้อมูลนัด หรือข้อมูลยืนยันสิทธิ์ไม่ถูกต้อง");
  return rowToBooking(rows[0]);
}

export async function cancelGroup1Booking(referralId: string, token?: string, phone?: string): Promise<Group1Booking> {
  const booking = await findGroup1Booking(referralId, token, phone);
  if (!booking.canChange) throw new Error("นัดนี้ถึงวันนัดแล้วหรือไม่สามารถแก้ไขได้");
  await execute("UPDATE group1_bookings SET status = 'Cancelled', cancelled_at = ? WHERE referral_id = ?", [new Date().toISOString(), referralId]);
  return { ...booking, status: "Cancelled", canChange: false };
}

export async function rescheduleGroup1Booking(
  referralId: string,
  token: string | undefined,
  phone: string | undefined,
  clinicDate: string,
  fellowName: string,
  capacity: number,
): Promise<Group1Booking> {
  const booking = await findGroup1Booking(referralId, token, phone);
  if (!booking.canChange) throw new Error("นัดนี้ถึงวันนัดแล้วหรือไม่สามารถแก้ไขได้");
  const rows = await execute(
    `UPDATE group1_bookings SET clinic_date = ?, fellow_name = ?, slot_number = (
      SELECT COALESCE(MAX(slot_number), 0) + 1 FROM group1_bookings
      WHERE clinic_date = ? AND fellow_name = ? AND status = 'Appointment Confirmed' AND referral_id <> ?
    ) WHERE referral_id = ? AND (
      SELECT COUNT(*) FROM group1_bookings
      WHERE clinic_date = ? AND fellow_name = ? AND status = 'Appointment Confirmed' AND referral_id <> ?
    ) < ? RETURNING *`,
    [clinicDate, fellowName, clinicDate, fellowName, referralId, referralId, clinicDate, fellowName, referralId, capacity],
  );
  if (!rows[0]) throw new Error(`คิวของ ${fellowName} วันที่ ${clinicDate} เต็มแล้ว กรุณาเลือกวันอื่นหรือแพทย์ท่านอื่น`);
  return rowToBooking(rows[0]);
}

function fellowLineCodes(): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of (process.env.GROUP1_LINE_FELLOW_CODES || "").split(";")) {
    const separator = item.indexOf("::");
    if (separator < 1) continue;
    map.set(item.slice(0, separator).trim(), item.slice(separator + 2).trim());
  }
  return map;
}

export async function linkGroup1FellowLineUser(
  fellowName: string,
  lineUserId: string,
  code: string,
): Promise<void> {
  const typedName = fellowName.trim();
  const fellows = await listGroup1Fellows();
  const name = fellows.find((candidate) => candidate.replace(/\s+/g, "") === typedName.replace(/\s+/g, ""));
  if (!name) throw new Error("ยังไม่มีชื่อ Fellow นี้ในตารางระบบ");
  const individualCode = fellowLineCodes().get(name);
  const sharedCode = process.env.GROUP1_LINE_SHARED_CODE?.trim();
  if ((individualCode !== code.trim()) && (sharedCode !== code.trim())) {
    throw new Error("ชื่อ Fellow หรือรหัสลงทะเบียนไม่ถูกต้อง");
  }
  await execute(
    `INSERT INTO group1_fellow_line_accounts (line_user_id, fellow_name, linked_at, active)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(line_user_id) DO UPDATE SET fellow_name = excluded.fellow_name, linked_at = excluded.linked_at, active = 1`,
    [lineUserId, name, new Date().toISOString()],
  );
}

export async function startGroup1LineRegistration(lineUserId: string): Promise<void> {
  await execute(
    `INSERT INTO group1_line_registration_sessions (line_user_id, fellow_name, started_at)
     VALUES (?, '', ?)
     ON CONFLICT(line_user_id) DO UPDATE SET fellow_name = '', started_at = excluded.started_at`,
    [lineUserId, new Date().toISOString()],
  );
}

export async function pendingGroup1LineRegistration(lineUserId: string): Promise<string | null> {
  const rows = await execute(
    "SELECT fellow_name FROM group1_line_registration_sessions WHERE line_user_id = ? LIMIT 1",
    [lineUserId],
  );
  return rows[0] ? text(rows[0].fellow_name) : null;
}

export async function setPendingGroup1LineFellow(lineUserId: string, fellowName: string): Promise<void> {
  await execute(
    "UPDATE group1_line_registration_sessions SET fellow_name = ? WHERE line_user_id = ?",
    [fellowName.trim(), lineUserId],
  );
}

export async function clearGroup1LineRegistration(lineUserId: string): Promise<void> {
  await execute("DELETE FROM group1_line_registration_sessions WHERE line_user_id = ?", [lineUserId]);
}

export async function findGroup1FellowByLineUser(lineUserId: string): Promise<string | null> {
  const rows = await execute(
    "SELECT fellow_name FROM group1_fellow_line_accounts WHERE line_user_id = ? AND active = 1 LIMIT 1",
    [lineUserId],
  );
  return rows[0] ? text(rows[0].fellow_name) : null;
}

export async function unlinkGroup1FellowLineUser(lineUserId: string): Promise<void> {
  await execute("UPDATE group1_fellow_line_accounts SET active = 0 WHERE line_user_id = ?", [lineUserId]);
}
