# Software Requirements Specification (SRS)

## 1. Project Information

**Project Name:** Siriraj Smart Outpatient Referral System for Hematology (OPD Only)

**Document Type:** Software Requirements Specification

**Version:** 0.1

**Date:** 2026-07-25

**Prepared For:** ภาควิชาอายุรศาสตร์ สาขาโลหิตวิทยา โรงพยาบาลศิริราช

## 2. Purpose

เอกสารนี้กำหนดความต้องการของระบบคัดกรองและส่งต่อผู้ป่วยนอกทางไกลสำหรับคลินิกโลหิตวิทยา โดยเริ่มจากเครื่องมือที่ใช้งานได้เร็วและดูแลง่าย ได้แก่ Google Form, Google Sheet, LINE และหน้า web กลาง เพื่อให้แพทย์ พยาบาล และเจ้าหน้าที่สามารถรับเรื่อง คัดกรอง ติดตามสถานะ และประสานงาน refer ได้เป็นระบบมากขึ้น ภายใต้ข้อกำหนดด้านความปลอดภัยและ PDPA

ระบบนี้เป็นระบบสนับสนุน workflow การส่งต่อผู้ป่วย OPD เท่านั้น ไม่ใช่ระบบวินิจฉัยโรค ไม่ใช่ระบบเวชระเบียนหลัก และไม่แทนการตัดสินใจทางคลินิกของแพทย์

## 3. Background

การส่งต่อผู้ป่วยมายัง OPD Hematology มีปริมาณมาก และมักมีปัญหาเอกสารไม่ครบ การคัดกรองไม่เป็นระบบ การกระจายภาระงานไม่สมดุล และการติดตามกลับใช้เวลามาก ระบบที่เสนอนี้ต้องช่วยลดงานซ้ำซ้อน ลดการตกหล่น เพิ่มความชัดเจนของสถานะ และทำให้ผู้เกี่ยวข้องทุกฝ่ายเข้าถึงข้อมูลที่จำเป็นได้ง่าย โดยยังคงมีเจ้าหน้าที่หรือแพทย์ตรวจสอบก่อนยืนยันนัดหมาย

## 4. Goals

1. รับ refer OPD Hematology ผ่านช่องทางที่เข้าถึงง่าย
2. จัดเก็บข้อมูลและเอกสารประกอบอย่างเป็นระบบ
3. คัดกรองและแยกประเภท case ตามกลุ่มงาน Hematology
4. กระจายงานให้แพทย์ พยาบาล และเจ้าหน้าที่อย่างตรวจสอบได้
5. แจ้งเตือนสถานะผ่าน LINE โดยไม่เปิดเผยข้อมูลสุขภาพเกินจำเป็น
6. มีหน้า web กลางที่ใช้งานง่ายสำหรับทุก role
7. รองรับหลัก PDPA ตั้งแต่การเก็บ ใช้ เปิดเผย เข้าถึง เก็บรักษา และลบข้อมูล

## 5. Scope

### 5.1 In Scope

- ผู้ป่วยนอก OPD Hematology ที่มีใบส่งตัวหรือมีการส่งต่อเพื่อประเมินนัดหมาย
- Google Form สำหรับรับข้อมูล refer
- Google Sheet สำหรับเก็บข้อมูลและติดตามสถานะในระยะ MVP
- Google Drive สำหรับจัดเก็บเอกสารแนบแบบจำกัดสิทธิ์
- LINE Official Account หรือ LINE group workflow สำหรับแจ้งเตือนและส่ง link
- หน้า web กลางสำหรับเข้าใช้งานระบบ ดูคู่มือ ส่ง refer และเข้าถึง dashboard
- Dashboard สำหรับเจ้าหน้าที่ แพทย์ พยาบาล และผู้ดูแลระบบ
- Audit log ขั้นพื้นฐาน เช่น วันที่รับเรื่อง ผู้เปลี่ยนสถานะ และเวลาตอบกลับ
- PDPA notice, consent/acknowledgement, access control, retention policy และ breach workflow

### 5.2 Out of Scope

- ผู้ป่วยใน IPD
- ระบบ EMR หลัก
- ระบบออกใบนัดหมายอย่างเป็นทางการแทนระบบโรงพยาบาล
- การเชื่อมต่อ HN หรือ appointment API ของโรงพยาบาลในระยะ MVP
- Clinical decision support ที่ให้คำวินิจฉัยหรือคำสั่งรักษาอัตโนมัติ
- การส่งข้อมูลสุขภาพเต็มรูปแบบผ่าน LINE message

## 6. Stakeholders and Users

| Role | Description | Main Needs |
| --- | --- | --- |
| Referring Hospital/User | ผู้ส่งต่อจากโรงพยาบาลต้นทาง | ส่งข้อมูลและเอกสารได้ง่าย ทราบสถานะตอบกลับ |
| เจ้าหน้าที่ธุรการ | รับเรื่อง ตรวจข้อมูลเบื้องต้น ประสานงาน | เห็น queue ชัด แก้สถานะง่าย ติดตาม case ค้าง |
| พยาบาล | ช่วยคัดกรองความครบถ้วนและประสานนัดหมาย | เห็น checklist เอกสาร ข้อมูลติดต่อ และสถานะ |
| Resident/Fellow | ประเมิน case และจัดกลุ่ม clinical | เห็นข้อมูลจำเป็นเร็ว ลดงานเอกสารซ้ำ |
| Attending | ตรวจสอบหรือกำกับ case สำคัญ | เห็น case summary และ workload |
| Admin | ดูแลฟอร์ม สิทธิ์ผู้ใช้ sheet/web/LINE | จัดการสิทธิ์ audit และ backup |
| DPO/Legal/Compliance | กำกับ PDPA และความปลอดภัยข้อมูล | ตรวจ privacy notice, RoPA, retention, breach process |

## 7. System Overview

ระบบในระยะ MVP จะใช้ Google Workspace เป็นฐานข้อมูลและ workflow หลัก โดยมีหน้า web กลางเป็นจุดเข้าใช้งานที่เป็นมิตรกับผู้ใช้

```text
User / Hospital
  -> Web Portal
  -> Google Form
  -> Google Sheet + Google Drive
  -> Apps Script Automation
  -> LINE Notification
  -> Staff / Nurse / Doctor Dashboard
```

### 7.1 Component Summary

| Component | Purpose |
| --- | --- |
| Web Portal | หน้าแรกสำหรับส่ง refer, เข้าระบบ, ดูคู่มือ, ติดต่อ |
| Google Form | รับข้อมูลผู้ป่วยและเอกสารแนบ |
| Google Sheet | เก็บข้อมูล refer, สถานะ, assignment, timestamp |
| Google Drive | เก็บไฟล์แนบโดยใช้ folder permission แบบจำกัดสิทธิ์ |
| Apps Script | สร้าง referral ID, ส่งแจ้งเตือน, validate field, sync dashboard |
| LINE | แจ้งเตือน case ใหม่ สถานะค้าง และแจ้งกลับผู้ส่ง refer แบบจำกัดข้อมูล |
| Dashboard | แสดง queue, status, workload, SLA และ missing documents |

## 8. Workflow

### 8.1 Referral Submission

1. ผู้ส่ง refer เข้า web portal
2. อ่าน privacy notice และคำแนะนำการส่งข้อมูล
3. กด link Google Form
4. กรอกข้อมูลผู้ป่วยและแนบเอกสารที่จำเป็น
5. ระบบสร้าง referral ID อัตโนมัติ
6. ระบบแจ้งผู้รับผิดชอบผ่าน LINE ด้วย referral ID และ link ภายใน
7. เจ้าหน้าที่ตรวจความครบถ้วน
8. แพทย์หรือพยาบาลคัดกรองและจัดกลุ่ม
9. ระบบแจ้งสถานะกลับตามช่องทางที่กำหนด

### 8.2 Status Flow

| Status | Meaning |
| --- | --- |
| Submitted | รับข้อมูลจาก Google Form แล้ว |
| Pending Review | รอเจ้าหน้าที่ตรวจความครบถ้วน |
| Incomplete | เอกสารหรือข้อมูลไม่ครบ |
| Ready for Triage | ข้อมูลพร้อมคัดกรอง |
| Triaged | จัดกลุ่มแล้ว |
| Assigned | มอบหมายผู้รับผิดชอบแล้ว |
| Appointment Pending | รอประสานวันนัด |
| Appointment Confirmed | ยืนยันวันนัดแล้ว |
| Rejected / Redirected | ไม่เข้าเกณฑ์หรือควรส่งช่องทางอื่น |
| Closed | ปิด case แล้ว |

## 9. Functional Requirements

### FR-001 Web Portal

ระบบต้องมีหน้า web กลางที่เข้าถึงได้ง่ายผ่าน URL เดียว รองรับ mobile และ desktop

หน้า web ต้องมีอย่างน้อย:

- ปุ่มส่ง refer
- ปุ่มตรวจสอบสถานะหรือช่องทางติดต่อ
- ปุ่มเข้าสู่ dashboard สำหรับบุคลากร
- คำแนะนำเอกสารที่ต้องเตรียม
- privacy notice แบบอ่านง่าย
- ช่องทางติดต่อกรณีเร่งด่วนหรือส่งข้อมูลไม่ได้

### FR-002 Google Form Submission

ระบบต้องมี Google Form สำหรับรับข้อมูล refer โดยกำหนด field ที่จำเป็นเป็น required

ข้อมูลขั้นต่ำ:

- Referral ID อัตโนมัติ
- วันที่และเวลาส่ง
- ชื่อหน่วยงานผู้ส่ง
- ชื่อผู้ติดต่อ
- เบอร์โทรศัพท์
- อีเมลหรือ LINE contact
- HN โรงพยาบาลศิริราช ถ้ามี
- ชื่อย่อหรือรหัสผู้ป่วยตามนโยบายหน่วยงาน
- อายุหรือปีเกิด
- เพศ
- diagnosis / suspected diagnosis
- reason for referral
- urgency
- current treatment
- key lab results
- imaging/pathology summary
- file upload สำหรับใบส่งตัวและเอกสารประกอบ
- checkbox รับทราบ privacy notice และอำนาจหน้าที่ในการส่งข้อมูล

### FR-003 Document Checklist

ระบบต้องมี checklist เอกสารตามกลุ่มโรค เช่น

| Group | Required Documents |
| --- | --- |
| Acute leukemia / SiAML | CBC, bone marrow report, flow cytometry, chromosome, molecular mutation, treatment summary |
| Lymphoma | pathology report, block/slide status, imaging, staging, prior treatment |
| Multiple Myeloma | SPEP, serum free light chain, immunofixation, beta-2 microglobulin, bone marrow, imaging |
| Stem Cell Transplantation | diagnosis, disease status, donor/HLA information, prior treatment, transplant indication |
| Other Hematology | referral letter, essential labs, summary of clinical question |

### FR-004 Google Sheet Data Store

ระบบต้องบันทึกข้อมูลจาก Google Form ลง Google Sheet แบบ structured table

Sheet หลักที่ต้องมี:

- `referrals`
- `status_log`
- `assignments`
- `users`
- `triage_rules`
- `document_checklist`
- `notification_log`
- `config`

Google Sheet ต้องไม่ถูกตั้งค่าเป็น public หรือ anyone with link สำหรับข้อมูลจริง

### FR-005 Triage Classification

ระบบต้องช่วยจัดกลุ่ม case เบื้องต้นจากคำตอบในฟอร์ม โดยใช้ rule ที่แก้ไขได้ใน Google Sheet

ตัวอย่าง rule:

- ถ้าเลือก stem cell transplant หรือมีคำว่า transplant/HLA/donor ให้เสนอ group: Stem Cell Transplantation
- ถ้ามี acute leukemia/AML/ALL/APL ให้เสนอ group: Acute Leukemia
- ถ้ามี lymphoma/DLBCL/HL/NHL ให้เสนอ group: Lymphoma
- ถ้ามี myeloma/MGUS/plasma cell ให้เสนอ group: Multiple Myeloma

ผลลัพธ์ต้องแสดงเป็น suggested group และต้องให้ผู้ใช้ที่มีสิทธิ์ยืนยันหรือแก้ไขได้

### FR-006 Assignment and Workload

ระบบต้องรองรับการมอบหมาย case ให้แพทย์ พยาบาล หรือเจ้าหน้าที่

ระบบต้องแสดง:

- จำนวน case ต่อผู้รับผิดชอบ
- จำนวน case ต่อกลุ่มโรค
- case ค้างเกิน SLA
- วันที่ต้องติดตาม
- หมายเหตุการส่งต่อ

### FR-007 LINE Notification

ระบบต้องแจ้งเตือนผ่าน LINE เมื่อมีเหตุการณ์สำคัญ

เหตุการณ์ที่ต้องแจ้ง:

- มี case ใหม่
- case ถูกระบุว่า incomplete
- case พร้อม triage
- case ค้างเกิน SLA
- มีการ assign case
- ยืนยันวันนัดหรือแจ้งให้ติดต่อกลับ

ข้อความ LINE ต้องใช้ข้อมูลเท่าที่จำเป็น เช่น referral ID, status, action needed และ link ภายใน หลีกเลี่ยงการส่ง diagnosis, HN, ชื่อผู้ป่วย หรือข้อมูลสุขภาพโดยตรงใน LINE message

### FR-008 Dashboard

ระบบต้องมี dashboard สำหรับบุคลากรภายใน โดยแสดงข้อมูลตามสิทธิ์

หน้าจอขั้นต่ำ:

- Queue ทั้งหมด
- Queue แยกตาม status
- Queue แยกตาม disease group
- รายการ incomplete
- รายการเกิน SLA
- workload ต่อคน
- case detail
- export รายงาน

### FR-009 Search and Filter

Dashboard ต้องค้นหาและกรองข้อมูลได้ตาม:

- referral ID
- วันที่ส่ง
- status
- disease group
- urgency
- assigned person
- referring hospital
- SLA status

### FR-010 Audit Log

ระบบต้องบันทึกการเปลี่ยนแปลงสำคัญ ได้แก่:

- การเปลี่ยน status
- การ assign
- การแก้ไข disease group
- การส่ง notification
- การปิด case

ข้อมูล audit log ต้องมี timestamp, user, action, old value และ new value เท่าที่ทำได้ใน Google Sheet/Apps Script

### FR-011 Reporting

ระบบต้องออกรายงานอย่างน้อย:

- จำนวน refer รายวัน/รายเดือน
- จำนวน case แยกตามกลุ่มโรค
- turnaround time ตั้งแต่รับเรื่องถึง triage
- turnaround time ตั้งแต่รับเรื่องถึงตอบกลับ
- incomplete rate
- workload ต่อผู้รับผิดชอบ
- SLA breach count

## 10. Web Usability Requirements

หน้า web ต้องออกแบบให้แพทย์ พยาบาล และเจ้าหน้าที่ใช้งานง่าย โดยไม่ต้องเรียนรู้ระบบนาน

ข้อกำหนด:

- ใช้ภาษาไทยเป็นหลัก และมีคำอังกฤษเฉพาะทางเท่าที่จำเป็น
- รองรับมือถือ เพราะผู้ใช้จำนวนมากเข้าผ่าน LINE
- ปุ่มหลักต้องชัดเจน เช่น ส่ง Refer, เข้า Dashboard, ติดต่อเจ้าหน้าที่
- ไม่ใช้ layout ซับซ้อนหรือเมนูหลายชั้น
- ตัวอักษรอ่านง่ายบนมือถือ
- มีสีสถานะที่เข้าใจง่าย เช่น new, incomplete, urgent, done
- มีหน้า error ที่บอกวิธีติดต่อเมื่อส่งฟอร์มไม่ได้
- ลดการพิมพ์ซ้ำด้วย dropdown, checkbox และ template
- ไม่แสดงข้อมูลผู้ป่วยบนหน้า public web

## 11. Roles and Permissions

| Role | View | Edit | Admin |
| --- | --- | --- | --- |
| Public Referrer | ส่ง form, อ่านคู่มือ | แก้ไขหลังส่งไม่ได้ ยกเว้นส่งข้อมูลเพิ่ม | No |
| Staff | ดู case ที่รับเข้า | แก้ status, incomplete note, contact log | No |
| Nurse | ดู clinical summary และ checklist | แก้ checklist/status บางส่วน | No |
| Resident/Fellow | ดู case detail | triage, comment, assign recommendation | No |
| Attending | ดู case detail และ report | override triage/assignment | No |
| Admin | ดูทั้งหมด | จัดการ config, users, rules | Yes |
| DPO/Compliance | ดู policy/audit/report ที่จำเป็น | review compliance note | Limited |

หลักการสำคัญคือให้สิทธิ์น้อยที่สุดเท่าที่จำเป็นต่อหน้าที่

## 12. PDPA and Privacy Requirements

ข้อมูลผู้ป่วยเป็นข้อมูลสุขภาพ จัดเป็นข้อมูลส่วนบุคคลที่มีความละเอียดอ่อนตาม PDPA มาตรา 26 ดังนั้นระบบต้องออกแบบโดยใช้ privacy by design และ security by design ตั้งแต่เริ่มต้น

ข้อกำหนดในเอกสารนี้เป็น requirement เชิงระบบ ไม่ใช่คำปรึกษากฎหมายขั้นสุดท้าย หน่วยงานควรให้ DPO หรือฝ่ายกฎหมายตรวจ privacy notice, lawful basis, data sharing และ retention policy ก่อนใช้งานจริง

### PDPA-001 Privacy Notice

ก่อนส่งข้อมูล ผู้ใช้ต้องเห็น privacy notice ที่อธิบายอย่างน้อย:

- ใครเป็นผู้ควบคุมข้อมูลส่วนบุคคล
- วัตถุประสงค์การเก็บ ใช้ และเปิดเผยข้อมูล
- ประเภทข้อมูลที่เก็บ
- ผู้ที่อาจเข้าถึงข้อมูล
- ระยะเวลาเก็บรักษา
- สิทธิของเจ้าของข้อมูล
- ช่องทางติดต่อ DPO หรือหน่วยงานรับผิดชอบ
- ข้อจำกัดของการใช้ Google/LINE ในระบบ MVP

### PDPA-002 Lawful Basis and Consent

ฟอร์มต้องมี checkbox ให้ผู้ส่งข้อมูลรับทราบว่า:

- มีหน้าที่หรือได้รับอนุญาตให้ส่งข้อมูลเพื่อการรักษา/ส่งต่อ
- ได้แจ้งผู้ป่วยหรือผู้แทนตามกระบวนการของหน่วยงานต้นทางแล้ว หากจำเป็น
- ข้อมูลที่ส่งถูกต้องและจำเป็นต่อการประเมิน refer

สำหรับข้อมูลสุขภาพ ต้องให้ DPO/Legal ยืนยันฐานกฎหมายที่เหมาะสม เช่น explicit consent, medical treatment, vital interest, public health หรือฐานอื่นที่เกี่ยวข้องตามบริบทจริง

### PDPA-003 Data Minimization

ระบบต้องเก็บเฉพาะข้อมูลที่จำเป็นต่อการรับ refer และคัดกรองนัดหมาย

ข้อห้าม:

- ห้ามเก็บเลขบัตรประชาชน เว้นแต่มีเหตุผลและฐานกฎหมายชัดเจน
- ห้ามเก็บข้อมูลที่ไม่จำเป็น เช่น ศาสนา การเมือง หรือข้อมูลครอบครัวที่ไม่เกี่ยวกับการรักษา
- ห้ามส่งข้อมูลสุขภาพเต็มรูปแบบใน LINE message
- ห้ามเปิด sheet หรือ drive เป็น public

### PDPA-004 Access Control

ระบบต้องจำกัดสิทธิ์การเข้าถึงด้วยบัญชีองค์กร

ข้อกำหนดขั้นต่ำ:

- ใช้ Google Workspace account ของหน่วยงาน
- เปิดใช้งาน 2-Step Verification ถ้าหน่วยงานรองรับ
- จำกัด Drive folder ตาม role
- จำกัด Google Sheet ให้เฉพาะบุคลากรที่เกี่ยวข้อง
- แยกสิทธิ์ view/edit/admin
- ทบทวนรายชื่อผู้มีสิทธิ์อย่างน้อยทุก 3 เดือน

### PDPA-005 Data Retention

ต้องกำหนดระยะเวลาเก็บรักษาข้อมูล refer อย่างชัดเจน

ข้อเสนอเริ่มต้น:

- case active: เก็บจนกว่าจะปิด case
- case closed: เก็บตามนโยบายโรงพยาบาลและข้อกำหนดเวชระเบียน
- log และ report: เก็บเท่าที่จำเป็นสำหรับ audit และ quality improvement
- ไฟล์ที่ไม่จำเป็นหรือ duplicate: ลบตามรอบที่กำหนด

ระยะเวลาจริงต้องได้รับการยืนยันจากนโยบายโรงพยาบาลและ DPO

### PDPA-006 Data Sharing

ระบบต้องระบุว่าใครเป็นผู้ควบคุมข้อมูล ผู้ประมวลผลข้อมูล และผู้รับข้อมูล

ต้องพิจารณา:

- Google Workspace terms และ data processing arrangement
- LINE Official Account และข้อจำกัดของการส่งข้อมูลผ่าน LINE
- โรงพยาบาลต้นทางที่ส่งข้อมูล
- บุคลากรภายในที่มีสิทธิ์ดูข้อมูล

### PDPA-007 Breach Response

ต้องมีขั้นตอนรับมือข้อมูลรั่วไหลหรือเข้าถึงผิดสิทธิ์

ขั้นต่ำ:

1. หยุดการเข้าถึงหรือปิด share link ทันที
2. บันทึกเหตุการณ์ วันที่ เวลา ผู้เกี่ยวข้อง และข้อมูลที่ได้รับผลกระทบ
3. แจ้ง admin, DPO และหัวหน้าหน่วยงาน
4. ประเมินความเสี่ยงต่อเจ้าของข้อมูล
5. ดำเนินการแจ้งตามข้อกำหนดกฎหมายและนโยบายหน่วยงาน
6. สรุป root cause และมาตรการป้องกันซ้ำ

## 13. Non-Functional Requirements

### NFR-001 Availability

ระบบ MVP ควรใช้งานได้ในเวลาราชการและรองรับการส่ง form นอกเวลาราชการ โดยต้องมีข้อความชัดเจนว่าไม่ใช่ช่องทาง emergency

### NFR-002 Performance

หน้า web และ Google Form ควรโหลดได้ภายใน 3 วินาทีบนเครือข่ายมือถือทั่วไป

Dashboard ควรแสดงข้อมูล case ล่าสุดได้ภายใน 10 วินาทีหลัง submit form ในกรณีปกติ

### NFR-003 Security

- ต้องใช้ HTTPS
- ห้ามใช้ public link สำหรับ sheet ที่มีข้อมูลผู้ป่วย
- ห้ามฝังข้อมูลลับใน frontend code
- ต้องจำกัด Apps Script owner และ editor
- ต้องแยก production form/sheet ออกจาก test form/sheet

### NFR-004 Backup

ต้องมี backup Google Sheet และไฟล์แนบอย่างน้อยวันละครั้ง หรือใช้ version history / scheduled export ตามความสามารถของ Google Workspace

### NFR-005 Maintainability

workflow, disease group, checklist, SLA และข้อความ notification ต้องแก้ไขได้โดย admin ผ่าน sheet config หรือไฟล์ config โดยไม่ต้องแก้ code ทุกครั้ง

### NFR-006 Accessibility

หน้า web ต้องอ่านง่าย ใช้บนมือถือได้ ปุ่มใหญ่พอ และรองรับผู้ใช้ที่ไม่เชี่ยวชาญคอมพิวเตอร์

## 14. Data Dictionary

| Field | Type | Required | Note |
| --- | --- | --- | --- |
| referral_id | Text | Yes | สร้างอัตโนมัติ เช่น HEM-20260725-0001 |
| submitted_at | DateTime | Yes | timestamp จาก form |
| referrer_org | Text | Yes | หน่วยงานผู้ส่ง |
| referrer_name | Text | Yes | ผู้ติดต่อ |
| referrer_phone | Text | Yes | เบอร์ติดต่อ |
| referrer_email | Email | Optional | ใช้สำหรับตอบกลับ |
| line_contact | Text | Optional | ใช้เฉพาะกรณีจำเป็น |
| siriraj_hn | Text | Optional | ถ้ามี |
| patient_identifier | Text | Yes | ใช้ตาม policy หน่วยงาน หลีกเลี่ยงข้อมูลเกินจำเป็น |
| age_or_birth_year | Text | Yes | ลดการเก็บวันเกิดเต็มถ้าไม่จำเป็น |
| sex | Dropdown | Yes | ตามความจำเป็นทางคลินิก |
| suspected_diagnosis | Text | Yes | diagnosis หรือ provisional diagnosis |
| referral_reason | Text | Yes | เหตุผลส่งต่อ |
| urgency | Dropdown | Yes | Routine, Urgent, Very Urgent |
| disease_group_suggested | Text | Auto | จาก rule |
| disease_group_final | Text | Yes after triage | แก้ไขโดยผู้มีสิทธิ์ |
| status | Dropdown | Yes | status flow |
| assigned_to | Text | Optional | ผู้รับผิดชอบ |
| document_links | URL | Optional | link Drive แบบจำกัดสิทธิ์ |
| incomplete_reason | Text | Optional | ระบุข้อมูลที่ต้องขอเพิ่ม |
| appointment_note | Text | Optional | ไม่ใช่ใบนัดทางการ |
| closed_at | DateTime | Optional | วันที่ปิด case |

## 15. Google Sheet Structure

### 15.1 referrals

เก็บข้อมูลหลักหนึ่งแถวต่อหนึ่ง referral ID

### 15.2 status_log

เก็บประวัติการเปลี่ยนสถานะ

| Column | Description |
| --- | --- |
| timestamp | วันที่เวลา |
| referral_id | case อ้างอิง |
| old_status | สถานะเดิม |
| new_status | สถานะใหม่ |
| changed_by | ผู้แก้ไข |
| note | หมายเหตุ |

### 15.3 triage_rules

เก็บ keyword และ mapping สำหรับ suggested group

### 15.4 users

เก็บรายชื่อผู้ใช้ role และ active status

### 15.5 notification_log

เก็บประวัติการส่ง LINE/email notification

## 16. LINE Message Templates

### New Case Notification

```text
New Hematology Referral
Referral ID: {{referral_id}}
Status: Submitted
Action: Please review in dashboard
Link: {{internal_dashboard_link}}
```

### Incomplete Case

```text
Referral ID: {{referral_id}}
Status: Incomplete
Action: Please request missing documents
Link: {{internal_dashboard_link}}
```

### Public Reply

```text
ได้รับข้อมูล refer แล้ว
Referral ID: {{referral_id}}
เจ้าหน้าที่จะตรวจสอบและติดต่อกลับตามขั้นตอน
หมายเหตุ: ช่องทางนี้ไม่ใช่ช่องทางฉุกเฉิน
```

ห้ามใส่ชื่อผู้ป่วย HN diagnosis lab result หรือเอกสารแนบใน LINE message เว้นแต่ได้รับอนุมัติจากนโยบายหน่วยงานอย่างชัดเจน

## 17. Acceptance Criteria

ระบบ MVP ถือว่าพร้อมทดลองใช้งานเมื่อ:

1. ผู้ส่ง refer สามารถเข้า web portal และส่ง Google Form ได้
2. ข้อมูลเข้า Google Sheet พร้อม referral ID อัตโนมัติ
3. ไฟล์แนบถูกจัดเก็บใน Drive folder ที่จำกัดสิทธิ์
4. เจ้าหน้าที่เห็น case ใหม่ใน dashboard
5. ระบบส่ง LINE notification โดยไม่เปิดเผยข้อมูลสุขภาพเกินจำเป็น
6. ผู้มีสิทธิ์สามารถเปลี่ยน status และบันทึกเหตุผลได้
7. มี privacy notice และ checkbox รับทราบใน form
8. มี access control สำหรับ sheet, drive และ dashboard
9. มี report เบื้องต้นเรื่องจำนวน case และ SLA
10. DPO/Legal ตรวจ requirement ด้าน PDPA ก่อน pilot จริง

## 18. Testing Requirements

### Functional Test

- Submit form สำเร็จ
- Required field ทำงานถูกต้อง
- Upload file สำเร็จ
- Referral ID ไม่ซ้ำ
- LINE notification ส่งสำเร็จ
- Dashboard filter ถูกต้อง
- Status update ถูกบันทึกใน log

### Permission Test

- Public user เปิด sheet ไม่ได้
- Staff ดูเฉพาะข้อมูลที่จำเป็น
- ผู้ไม่มีสิทธิ์เปิด Drive file ไม่ได้
- Admin เท่านั้นที่แก้ config ได้

### PDPA Test

- Privacy notice แสดงก่อน submit
- Form ไม่มี field ที่เก็บข้อมูลเกินจำเป็น
- LINE message ไม่มีข้อมูลสุขภาพละเอียด
- Sheet/Drive ไม่เป็น public
- มี retention และ deletion procedure

## 19. Implementation Plan

### Phase 1: MVP Setup

- สร้าง web portal หน้าเดียว
- สร้าง Google Form
- สร้าง Google Sheet structure
- ตั้งค่า Drive folder permission
- สร้าง Apps Script สำหรับ referral ID และ LINE notification
- สร้าง dashboard เบื้องต้นจาก Google Sheet

### Phase 2: Workflow Hardening

- เพิ่ม triage rules
- เพิ่ม checklist ตาม disease group
- เพิ่ม status log
- เพิ่ม SLA alert
- เพิ่ม role-based dashboard view

### Phase 3: PDPA and Governance

- ตรวจ privacy notice กับ DPO/Legal
- จัดทำ RoPA
- ทบทวน DPA/data sharing
- ตั้งรอบ retention/deletion
- ทดสอบ breach response tabletop

### Phase 4: Pilot

- ทดลองกับผู้ใช้จำนวนน้อย
- เก็บ feedback จากแพทย์ พยาบาล และเจ้าหน้าที่
- วัด turnaround time และ incomplete rate
- ปรับ form และ dashboard

### Phase 5: Scale or Migrate

- ขยายไปทุก OPD Hematology
- พิจารณาย้ายจาก Google Sheet ไป database ถ้าข้อมูลมากหรือ requirement ความปลอดภัยสูงขึ้น
- พิจารณาเชื่อมระบบ HN/appointment ของโรงพยาบาล

## 20. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Google Sheet ถูก share ผิด | ข้อมูลรั่วไหล | จำกัดสิทธิ์, review ทุก 3 เดือน, audit sharing |
| ส่งข้อมูลสุขภาพผ่าน LINE | เสี่ยง PDPA | ส่งเฉพาะ referral ID/status/link |
| Form เก็บข้อมูลมากเกินจำเป็น | เสี่ยง compliance | ทบทวน field กับ DPO/แพทย์ |
| ข้อมูลค้างไม่ได้ตอบกลับ | กระทบ service | SLA alert และ dashboard queue |
| ผู้ใช้ไม่เข้าใจ workflow | ใช้งานผิด | web portal เรียบง่ายและมีคู่มือสั้น |
| Sheet โตเกินดูแลยาก | performance/maintenance | วางแผน migrate เป็น web app + database |
| ไม่มี owner ชัดเจน | ระบบไม่ยั่งยืน | ตั้ง admin, clinical owner, DPO contact |

## 21. Open Questions

1. หน่วยงานจะใช้ Google Workspace domain ใด และมี policy อนุญาตเก็บข้อมูลสุขภาพใน Google Workspace หรือไม่
2. จะใช้ LINE Official Account เดิมหรือสร้าง account ใหม่สำหรับระบบนี้
3. ใครเป็น data controller และใครเป็น DPO contact ใน privacy notice
4. ต้องเก็บข้อมูล referral นานเท่าใดตามนโยบายโรงพยาบาล
5. ผู้ส่ง refer ภายนอกต้องได้รับ acknowledgement จากผู้ป่วยในรูปแบบใด
6. ต้องแยก dashboard ตาม role มากน้อยแค่ไหนใน MVP
7. มี requirement เชื่อม HN หรือ appointment system ภายหลังหรือไม่

## 22. References

- สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล, Government Platform for PDPA Compliance: https://gppc.pdpc.or.th/
- PDPC Portal and DPO registration information: https://dpo.pdpc.or.th/registration
- พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562, เอกสารเผยแพร่รัฐสภา: https://www.parliament.go.th/view/297/รายละเอียดข่าว/พระราชบัญญัติและประมวลกฎหมาย/13/TH-TH
- แนวปฏิบัติการคุ้มครองข้อมูลส่วนบุคคล กระทรวงสาธารณสุข: https://pdpa.tph.go.th/

