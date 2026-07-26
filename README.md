# SiBMT Refer — Siriraj Smart Outpatient Referral System for Hematology

Web portal + staff dashboard for the OPD hematology referral workflow at ภาควิชาอายุรศาสตร์ สาขาโลหิตวิทยา โรงพยาบาลศิริราช.

Full requirements: [docs/SRS.md](docs/SRS.md).

## Status

MVP scaffold. Currently built:

- **Web Portal** (`/`) — public landing page: send-referral CTA, status check, staff dashboard entry, document checklist guidance, privacy notice, contact info (FR-001).
- **Dashboard** (`/dashboard`) — staff queue view with filters and case detail (FR-008/FR-009), backed by mock data for now.

Not yet built (per SRS scope): Google Form intake, Google Sheet data store, Apps Script automation, LINE notifications, PDPA consent flow, auth/roles.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS.
