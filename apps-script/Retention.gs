/**
 * การถอดชื่อและลบข้อมูลตามกำหนด (PDPA-005)
 *
 * ตั้ง trigger เดือนละครั้ง
 *
 * หลักการ: ไม่ลบทั้งแถวทิ้ง แต่ถอดคอลัมน์ที่โยงกลับหาผู้ป่วยได้ออก
 * แล้วย้ายส่วนที่เหลือไปเก็บถาวรใน advice_library
 * ทำให้ยังใช้ย้อนดูว่าเคยตอบเคสลักษณะนี้อย่างไร โดยไม่เหลือข้อมูลส่วนบุคคล
 */

function anonymizeExpired() {
  const sheet = getSheet_(SHEETS.referrals);
  const library = getSheet_(SHEETS.adviceLibrary);
  const rows = readRows_(sheet);
  if (rows.length === 0) return;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const expired = rows.filter(function (r) {
    const closedAt = toDate_(r['closed_at']);
    return closedAt && closedAt < cutoff;
  });

  if (expired.length === 0) {
    console.log('ไม่มีเคสที่ครบกำหนดถอดชื่อ');
    return;
  }

  ensureLibraryHeader_(library);

  const toAppend = expired.map(function (r) {
    return buildAnonymizedRow_(r);
  });

  library
    .getRange(library.getLastRow() + 1, 1, toAppend.length, ADVICE_LIBRARY_COLUMNS.length)
    .setValues(toAppend);

  // ไฟล์แนบต้องหายไปพร้อมเคส ไม่ใช่ค้างใน Drive ตลอดไป
  // ต้องทำก่อนลบแถว เพราะ url อยู่ในแถวที่กำลังจะหายไป
  trashAttachments_(expired);

  // ลบจากล่างขึ้นบน มิฉะนั้นเลขแถวจะเลื่อนระหว่างลบ
  expired
    .map(function (r) { return r._row; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (rowNumber) {
      sheet.deleteRow(rowNumber);
    });

  console.log('ถอดชื่อและย้ายเข้าคลังแล้ว ' + expired.length + ' เคส');
}

/**
 * ทิ้งไฟล์แนบของเคสที่ครบกำหนดลงถังขยะ Drive
 *
 * ใช้ setTrashed แทนการลบถาวร เพื่อให้กู้คืนได้ 30 วันหากลบผิด
 * ไฟล์ที่หาไม่เจอ (ถูกลบไปแล้ว) ข้ามไปเงียบ ๆ — ไม่ควรทำให้การถอดชื่อทั้งรอบล้ม
 * เพราะไฟล์ค้างเป็นเรื่องเล็กกว่าข้อมูลผู้ป่วยที่เลยกำหนดแล้วยังไม่ถูกถอดชื่อ
 */
function trashAttachments_(rows) {
  let trashed = 0;

  rows.forEach(function (r) {
    const url = String(r['advice_file_url'] || '').trim();
    if (!url) return;

    const id = (url.match(/\/d\/([A-Za-z0-9_-]+)/) || [])[1];
    if (!id) return;

    try {
      DriveApp.getFileById(id).setTrashed(true);
      trashed++;
    } catch (err) {
      console.warn('ทิ้งไฟล์แนบไม่สำเร็จ (' + id + '): ' + err);
    }
  });

  if (trashed > 0) console.log('ทิ้งไฟล์แนบลงถังขยะแล้ว ' + trashed + ' ไฟล์');
}

function ensureLibraryHeader_(library) {
  if (library.getLastRow() >= 1 && library.getLastColumn() >= ADVICE_LIBRARY_COLUMNS.length) return;
  library
    .getRange(1, 1, 1, ADVICE_LIBRARY_COLUMNS.length)
    .setValues([ADVICE_LIBRARY_COLUMNS]);
}

/**
 * สร้างแถวสำหรับ advice_library โดยถอดข้อมูลที่โยงกลับได้ออกทั้งหมด
 *
 * ที่ต้องถอด: referral_id, ชื่อ/เบอร์/โรงพยาบาลผู้ส่ง, วันที่แบบเต็ม, เอกสารแนบ
 * ที่แปลง:    อายุจริง → ช่วงอายุ, วันที่ → เหลือเฉพาะปี
 */
function buildAnonymizedRow_(r) {
  const submittedAt = toDate_(r['submitted_at'] || r['Timestamp']);
  const year = submittedAt ? submittedAt.getFullYear() : '';

  const values = {
    year: year,
    referral_type: r['referral_type'] || '',
    disease_group: r['disease_group'] || '',
    age_band: ageBand_(r['patient_age']),
    patient_sex: r['patient_sex'] || '',
    diagnosis: r['diagnosis'] || '',
    stage: r['stage'] || '',
    treatment_summary: r['treatment_summary'] || '',
    clinical_question: r['clinical_question'] || '',
    advice_record: r['advice_record'] || '',
  };

  return ADVICE_LIBRARY_COLUMNS.map(function (c) { return values[c]; });
}

/**
 * ตรวจว่าคลังไม่มีคอลัมน์ที่ระบุตัวตนหลุดเข้าไป
 * ควรรันหลังติดตั้ง และหลังแก้โครงสร้างชีตทุกครั้ง
 */
function verifyLibraryHasNoIdentifiers() {
  const library = getSheet_(SHEETS.adviceLibrary);
  const map = headerMap_(library);
  const found = IDENTIFYING_COLUMNS.filter(function (c) { return c in map; });

  if (found.length > 0) {
    throw new Error(
      'พบคอลัมน์ที่ระบุตัวตนใน ' + SHEETS.adviceLibrary + ': ' + found.join(', ') +
      ' — ต้องลบออกก่อนใช้งาน มิฉะนั้นข้อมูลจะยังนับเป็นข้อมูลส่วนบุคคล'
    );
  }
  console.log('ตรวจแล้ว: คลังคำตอบไม่มีคอลัมน์ที่ระบุตัวตน');
}
