const url = process.env.GROUP1_DATABASE_URL || process.env.TURSO_DATABASE_URL;
const token = process.env.GROUP1_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
if (!url || !token) throw new Error("Set GROUP1_DATABASE_URL and GROUP1_DATABASE_AUTH_TOKEN first");

const fellows = ["พญ.สมหญิง", "นพ.สมชาย", "พญ.มานี", "นพ.มานะ"];
const start = new Date("2026-10-01T00:00:00Z");
const end = new Date("2026-12-31T00:00:00Z");
const dates = [];
for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
  if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) dates.push(date.toISOString().slice(0, 10));
}

const statements = [
  { sql: "DELETE FROM group1_bookings WHERE referral_id LIKE 'DEMO-%'", args: [] },
  { sql: "DELETE FROM group1_schedule WHERE note = ?", args: ["ข้อมูลจำลองสำหรับทดสอบระบบ"] },
  { sql: "UPDATE group1_fellows SET active = 0 WHERE fellow_name LIKE 'DEMO Fellow %'", args: [] },
];

for (const fellow of fellows) {
  statements.push({
    sql: "INSERT INTO group1_fellows (fellow_name, active) VALUES (?, 1) ON CONFLICT(fellow_name) DO UPDATE SET active = 1",
    args: [fellow],
  });
}

for (const [dayIndex, clinicDate] of dates.entries()) {
  const pair = dayIndex % 2 === 0 ? fellows.slice(0, 2) : fellows.slice(2, 4);
  for (const [fellowIndex, fellowName] of pair.entries()) {
    statements.push({
      sql: "INSERT OR IGNORE INTO group1_schedule (clinic_date, fellow_name, max_slots, note, start_time, end_time) VALUES (?, ?, 2, ?, '09:00', '12:00')",
      args: [clinicDate, fellowName, "ข้อมูลจำลองสำหรับทดสอบระบบ"],
    });
    statements.push({
      sql: `INSERT OR IGNORE INTO group1_bookings (
        referral_id, referral_type, status, submitted_at, consent_acknowledged_at,
        clinic_date, fellow_name, slot_number, referrer_org, referrer_name,
        referrer_phone, referrer_email, disease_group, diagnosis, patient_age,
        patient_sex, note, manage_token, transplant_indication
      ) VALUES (?, 'TRANSPLANT_APPOINTMENT', 'Appointment Confirmed', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `DEMO-${clinicDate.replaceAll("-", "")}-${fellowIndex + 1}`,
        new Date(`${clinicDate}T08:00:00+07:00`).toISOString(),
        new Date(`${clinicDate}T08:00:00+07:00`).toISOString(),
        clinicDate, fellowName, "โรงพยาบาลทดสอบ", `ผู้ส่งต่อทดสอบ ${fellowName}`,
        "0800000000", "demo@example.invalid", "DEMO", "ข้อมูลผู้ป่วยจำลอง",
        "60", "ไม่ระบุ", "ห้ามใช้ข้อมูลนี้เป็นข้อมูลจริง",
        `demo-token-${clinicDate}-${fellowIndex + 1}`, "AUTO_MM",
      ],
    });
  }
}

const httpUrl = url.replace(/^libsql:\/\//, "https://").replace(/\/$/, "");
const response = await fetch(`${httpUrl}/v2/pipeline`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    baton: null,
    requests: [
      ...statements.map((statement) => ({
        type: "execute",
        stmt: { sql: statement.sql, args: statement.args.map((value) => ({ type: "text", value: String(value) })) },
      })),
      { type: "close" },
    ],
  }),
});
if (!response.ok) throw new Error(`Database returned ${response.status}: ${await response.text()}`);
const body = await response.json();
const failed = body.results?.find((result) => result.type !== "ok");
if (failed) throw new Error(failed.error?.message || "Demo seed failed");
console.log(`Demo data ready: ${fellows.length} fellows, ${dates.length} workdays, ${dates.length * 2} bookings; 2 slots per fellow (${dates[0]} to ${dates.at(-1)})`);
