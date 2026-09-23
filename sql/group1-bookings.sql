CREATE TABLE IF NOT EXISTS group1_bookings (
  referral_id TEXT PRIMARY KEY,
  referral_type TEXT NOT NULL DEFAULT 'TRANSPLANT_APPOINTMENT',
  status TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  consent_acknowledged_at TEXT NOT NULL,
  clinic_date TEXT NOT NULL,
  fellow_name TEXT NOT NULL,
  slot_number INTEGER NOT NULL,
  referrer_org TEXT NOT NULL,
  referrer_name TEXT NOT NULL,
  referrer_phone TEXT NOT NULL,
  referrer_email TEXT NOT NULL,
  disease_group TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  patient_age TEXT NOT NULL,
  patient_sex TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  manage_token TEXT NOT NULL UNIQUE,
  transplant_indication TEXT NOT NULL,
  cancelled_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS group1_active_slot
  ON group1_bookings (clinic_date, fellow_name, slot_number)
  WHERE status = 'Appointment Confirmed';

CREATE INDEX IF NOT EXISTS group1_lookup
  ON group1_bookings (referral_id, referrer_phone);

CREATE TABLE IF NOT EXISTS group1_fellows (
  fellow_name TEXT PRIMARY KEY,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS group1_schedule (
  schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_date TEXT NOT NULL,
  fellow_name TEXT NOT NULL,
  max_slots INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  UNIQUE (clinic_date, fellow_name)
);

CREATE TABLE IF NOT EXISTS group1_fellow_line_accounts (
  line_user_id TEXT PRIMARY KEY,
  fellow_name TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS group1_fellow_line_lookup
  ON group1_fellow_line_accounts (fellow_name, active);

CREATE TABLE IF NOT EXISTS group1_line_registration_sessions (
  line_user_id TEXT PRIMARY KEY,
  fellow_name TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL
);
