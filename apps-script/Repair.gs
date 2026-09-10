/**
 * เครื่องมือซ่อมชีต — รันมือจาก Apps Script editor (เลือกฟังก์ชัน → Run → ดู Log)
 *
 * เหตุการณ์ 10 ก.ย. 2569: แท็บ referrals มีหัวคอลัมน์ซ้ำ (referral_type,
 * referrer_org/name/phone/email, patient_age/sex) — ชุดแรกคอลัมน์ 3-10 ที่ฟอร์ม
 * เขียน และชุดหลังท้ายชีตที่ ensureColumns_ สร้างตอนหัวถูกรีเซ็ตเป็นไทยชั่วคราว
 * headerMap_ เดิมยึดคอลัมน์หลัง (ว่าง) → เคสใหม่ referral_type ว่าง, อีเมลไม่ถูกส่ง,
 * dashboard ขึ้น 0 เคส
 *
 * ลำดับซ่อม:
 *   1. previewRepairDuplicateHeaders()  → ดูว่าจะย้ายอะไร/ลบคอลัมน์ไหน (ไม่เขียน)
 *   2. applyRepairDuplicateHeaders()    → ย้ายค่าจากคอลัมน์ซ้ำเข้าคอลัมน์แรก แล้วลบคอลัมน์ซ้ำ
 *   3. previewReprocessBrokenRows()     → ดูเคสที่ referral_type ว่าง/ไม่ได้อีเมล
 *   4. applyReprocessBrokenRows()       → เติม referral_type + ส่งอีเมลรหัส + แจ้งทีม
 */

/** คู่ (ชื่อหัว → [index คอลัมน์ทั้งหมดที่ใช้ชื่อนี้]) เฉพาะที่ซ้ำ */
function duplicateHeaderGroups_(sheet) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const byName = {};
  headers.forEach(function (h, i) {
    const key = String(h).trim();
    if (!key) return;
    (byName[key] = byName[key] || []).push(i);
  });
  return Object.keys(byName)
    .filter(function (k) { return byName[k].length > 1; })
    .map(function (k) { return { name: k, cols: byName[k] }; });
}

function repairDuplicateHeaders_(dryRun) {
  const sheet = getSheet_(SHEETS.referrals);
  const groups = duplicateHeaderGroups_(sheet);
  if (groups.length === 0) {
    Logger.log('✅ ไม่มีหัวคอลัมน์ซ้ำในแท็บ ' + SHEETS.referrals);
    return;
  }
  const lastRow = sheet.getLastRow();
  const toDelete = [];
  let moved = 0, conflicts = 0;

  groups.forEach(function (g) {
    const keep = g.cols[0];
    Logger.log('หัว "' + g.name + '" ซ้ำที่คอลัมน์ ' +
      g.cols.map(function (c) { return c + 1; }).join(', ') +
      ' → เก็บคอลัมน์ ' + (keep + 1) + ' ลบที่เหลือ');
    g.cols.slice(1).forEach(function (extra) {
      if (lastRow >= 2) {
        const keepVals = sheet.getRange(2, keep + 1, lastRow - 1, 1).getValues();
        const extraVals = sheet.getRange(2, extra + 1, lastRow - 1, 1).getValues();
        for (let r = 0; r < extraVals.length; r++) {
          const v = extraVals[r][0];
          if (v === '' || v === null) continue;
          const k = keepVals[r][0];
          if (k === '' || k === null) {
            moved++;
            Logger.log('  แถว ' + (r + 2) + ': ย้าย "' + String(v).slice(0, 30) +
              '" → คอลัมน์ ' + (keep + 1));
            if (!dryRun) keepVals[r][0] = v;
          } else if (String(k) !== String(v)) {
            conflicts++;
            Logger.log('  ⚠️ แถว ' + (r + 2) + ': ทั้งสองคอลัมน์มีค่าต่างกัน เก็บ "' +
              String(k).slice(0, 30) + '" ทิ้ง "' + String(v).slice(0, 30) + '"');
          }
        }
        if (!dryRun) sheet.getRange(2, keep + 1, lastRow - 1, 1).setValues(keepVals);
      }
      toDelete.push(extra);
    });
  });

  // ลบจากขวาไปซ้าย ไม่ให้ index เลื่อน
  toDelete.sort(function (a, b) { return b - a; });
  if (!dryRun) {
    toDelete.forEach(function (c) { sheet.deleteColumn(c + 1); });
  }
  Logger.log('สรุป: ย้ายค่า ' + moved + ' เซลล์ · ค่าขัดกัน ' + conflicts +
    ' · ' + (dryRun ? 'จะลบ ' : 'ลบแล้ว ') + toDelete.length + ' คอลัมน์' +
    (dryRun ? '   ← preview ยังไม่เขียน — รัน applyRepairDuplicateHeaders() เพื่อทำจริง' : ''));
}
function previewRepairDuplicateHeaders() { repairDuplicateHeaders_(true); }
function applyRepairDuplicateHeaders() { repairDuplicateHeaders_(false); }

/**
 * เคสที่ประมวลผลตอนหัวซ้ำ: referral_type ว่าง หรือมีธง "แปลง referral_type ไม่สำเร็จ"
 * → เติม referral_type จากป้ายในฟอร์ม · ส่งอีเมลรหัสอ้างอิง (ยังไม่เคยส่ง) ·
 *   แจ้งกลุ่ม resident ถ้าเป็นกลุ่ม 2/3 · ล้างธง
 * ⚠️ รันหลัง applyRepairDuplicateHeaders() เท่านั้น
 */
function reprocessBrokenRows_(dryRun) {
  const sheet = getSheet_(SHEETS.referrals);
  if (duplicateHeaderGroups_(sheet).length > 0) {
    throw new Error('ยังมีหัวคอลัมน์ซ้ำ — รัน applyRepairDuplicateHeaders() ก่อน');
  }
  const map = headerMap_(sheet);
  const rows = readRows_(sheet);
  let fixed = 0, skipped = 0;

  rows.forEach(function (r) {
    const id = String(r['referral_id'] || '').trim();
    const flag = String(r['incomplete_reason'] || '');
    const type = String(r['referral_type'] || '').trim();
    const broken = /แปลง referral_type/.test(flag) || (!type && id);
    if (!broken) return;

    const label = formLabelFor_(sheet, map, r._row);
    const code = typeFromFormLabel_(label);
    if (!code) {
      skipped++;
      Logger.log('⏭️ ' + (id || 'แถว ' + r._row) + ' — ป้าย "' + label + '" ตีความไม่ได้ ข้าม');
      return;
    }
    const email = String(r['referrer_email'] || '').trim();
    Logger.log((dryRun ? '👀 ' : '✅ ') + id + ' → ' + code +
      (email ? ' · ส่งอีเมลรหัสถึง ' + email.replace(/^(.{2}).*(@.*)$/, '$1…$2') : ' · ไม่มีอีเมล'));
    fixed++;
    if (dryRun) return;

    setCell_(sheet, map, r._row, 'referral_type', code);
    if (/แปลง referral_type/.test(flag)) setCell_(sheet, map, r._row, 'incomplete_reason', '');
    if (code === TYPES.general && String(r['status'] || '') === 'Submitted') {
      setCell_(sheet, map, r._row, 'status', 'Auto Replied');
    }
    if (email) {
      sendReferralIdEmail_(email, id, code,
        String(r['email_verify_token'] || ''), String(r['case_token'] || ''));
    }
    if (code === TYPES.regimen || code === TYPES.admission) {
      // มอบหมายอัตโนมัติตามเวร ณ วันที่ส่ง — ตอนรับฟอร์มข้ามไปเพราะยังอ่านกลุ่มไม่ออก
      let assigned = String(r['assigned_to'] || '').trim();
      if (!assigned) {
        assigned = autoAssignResident_(sheet, map, r._row,
          toDate_(r['submitted_at']) || new Date());
      }
      notifyResidentNewCase_(id, GROUP_NUMBER[code] || '-', assigned,
        (r['patient_sex'] || '-') + ' อายุ ' + (r['patient_age'] || '-') + ' ปี',
        String(r['diagnosis'] || '-'), String(r['referrer_org'] || '-'));
    }
  });

  Logger.log('สรุป: ' + (dryRun ? 'จะแก้ ' : 'แก้แล้ว ') + fixed + ' เคส · ข้าม ' + skipped +
    (dryRun ? '   ← preview ยังไม่เขียน/ไม่ส่ง — รัน applyReprocessBrokenRows() เพื่อทำจริง' : ''));
}
function previewReprocessBrokenRows() { reprocessBrokenRows_(true); }
function applyReprocessBrokenRows() { reprocessBrokenRows_(false); }

/**
 * เคสกลุ่ม 2/3 ที่ยังเปิดอยู่และ "ยังไม่มอบหมาย" → มอบให้เวร ณ วันที่ส่ง (วนตามลำดับ)
 *   previewAssignUnassignedCases()  → ดูว่าจะมอบใครให้ใคร (ไม่เขียน)
 *   applyAssignUnassignedCases()    → เขียนจริง + แจ้งกลุ่มแอดมิน
 * ใช้เมื่อเคสค้าง "ยังไม่มอบหมาย" ทั้งที่มีเวรในตาราง (เช่นหลังซ่อมหัวซ้ำ 10 ก.ย. 2569)
 */
function assignUnassignedCases_(dryRun) {
  const sheet = getSheet_(SHEETS.referrals);
  const map = ensureColumns_(sheet, ['assigned_to']);
  const rows = readRows_(sheet);
  let done = 0, noDuty = 0;
  const lines = [];

  rows.forEach(function (r) {
    const type = String(r['referral_type'] || '').trim();
    if (type !== TYPES.regimen && type !== TYPES.admission) return;
    if (isTerminal_(r['status'])) return;
    if (String(r['assigned_to'] || '').trim()) return;

    const id = String(r['referral_id'] || '').trim();
    const when = toDate_(r['submitted_at']) || new Date();
    const dutyNames = onDutyResidents_(when).map(function (d) { return d.name; });
    if (dutyNames.length === 0) {
      noDuty++;
      Logger.log('⏭️ ' + id + ' — วันที่ส่ง ' + formatThaiDate_(when) + ' ไม่มีเวรในตาราง');
      return;
    }
    if (dryRun) {
      Logger.log('👀 ' + id + ' → หนึ่งในเวร ' + formatThaiDate_(when) + ': ' + dutyNames.join(' / '));
      done++;
      return;
    }
    const name = autoAssignResident_(sheet, map, r._row, when);
    Logger.log('✅ ' + id + ' → ' + name);
    lines.push(id + ' → ' + name);
    done++;
  });

  if (!dryRun && lines.length > 0) {
    sendTelegram_('👤 มอบหมายเคสค้างอัตโนมัติตามเวร\n' + lines.join('\n'), 'red');
  }
  Logger.log('สรุป: ' + (dryRun ? 'จะมอบ ' : 'มอบแล้ว ') + done + ' เคส · ไม่มีเวร ' + noDuty +
    (dryRun ? '   ← preview — รัน applyAssignUnassignedCases() เพื่อทำจริง' : ''));
}
function previewAssignUnassignedCases() { assignUnassignedCases_(true); }
function applyAssignUnassignedCases() { assignUnassignedCases_(false); }
