/**
 * การถอดชื่อและลบข้อมูลตามกำหนด (PDPA-005)
 *
 * ตั้ง trigger เดือนละครั้ง
 *
 * หลักการ: ไม่ลบทั้งแถวทิ้ง แต่ถอดคอลัมน์ที่โยงกลับหาผู้ป่วยได้ออก
 * แล้วย้ายส่วนที่เหลือไปเก็บถาวรใน advice_library
 * ทำให้ยังใช้ย้อนดูว่าเคยตอบเคสลักษณะนี้อย่างไร โดยไม่เหลือข้อมูลส่วนบุคคล
 *
 * ⚠️ ทุกกลุ่มเก็บ 12 เดือนเท่ากัน แต่นับจากคนละวัน ดูเหตุผลที่ isExpired_()
 */

function anonymizeExpired() {
  const sheet = getSheet_(SHEETS.referrals);
  const library = getSheet_(SHEETS.adviceLibrary);
  const rows = readRows_(sheet);
  if (rows.length === 0) return;

  const expired = rows.filter(isExpired_);

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
 * เคสนี้ครบกำหนดถอดชื่อหรือยัง
 *
 * 12 เดือนเท่ากันทุกกลุ่ม แต่ต้องดูสองคอลัมน์ เพราะสองกลุ่มนี้ "จบ" คนละแบบ
 *
 * กลุ่มที่ 2 และ 3 จบเมื่อมีคนตอบ ระบบจึงรู้เวลาจบจาก closed_at
 * กลุ่มที่ 1 ไม่มีใครมากดปิด สถานะค้างที่ 'Appointment Confirmed' ตั้งแต่วันจอง
 * closed_at จึงว่างตลอดกาล — วันที่ผู้ป่วยมาตามนัดคือวันที่เคสจบในความเป็นจริง
 * จึงนับจากวันนัดแทน (ไม่มีอะไรในระบบบันทึกว่ามาจริงหรือไม่ ถือว่ามาตามนัด)
 *
 * ⚠️ ครบเงื่อนไขใดเงื่อนไขหนึ่งก็ถือว่าครบกำหนด ไม่ต้องครบทั้งสอง
 * นัดที่ถูกยกเลิกจะมี closed_at ด้วย ถ้าต้องครบทั้งสอง เคสที่ยกเลิกไปแล้ว
 * จะถูกยืดอายุตามวันนัดที่ไม่มีใครไป ซึ่งเก็บข้อมูลไว้นานกว่าที่จำเป็น
 */
function isExpired_(r) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const closedAt = toDate_(r['closed_at']);
  if (closedAt && closedAt < cutoff) return true;

  if (String(r['referral_type'] || '') !== TYPES.transplant) return false;

  const appointment = toDate_(r['appointment_date']);
  return Boolean(appointment && appointment < cutoff);
}

/**
 * ดูว่ารอบถัดไปจะถอดชื่อเคสไหนบ้าง โดยยังไม่แตะข้อมูล
 *
 * ⚠️ รันอันนี้ก่อนเสมอ หลังแก้กฎการเก็บข้อมูล
 *
 * anonymizeExpired() ลบแถวจริงและกู้คืนไม่ได้ กฎที่เขียนผิดไปวันเดียว
 * อาจกวาดเคสที่ยังต้องใช้ไปทั้งชุดโดยไม่มีใครรู้จนกว่าจะมีคนมาตามหา
 */
function previewRetention() {
  const rows = readRows_(getSheet_(SHEETS.referrals));
  const expired = rows.filter(isExpired_);

  console.log('เคสทั้งหมดในชีต: ' + rows.length);
  console.log('รอบถัดไปจะถอดชื่อและย้ายเข้าคลัง: ' + expired.length + ' เคส');

  expired.slice(0, 30).forEach(function (r) {
    console.log(
      '  แถว ' + r._row + ' · ' + (r['referral_id'] || '(ไม่มีรหัส)') +
      ' · ' + (r['referral_type'] || '?') +
      ' · สถานะ ' + (r['status'] || '?') +
      ' · วันนัด ' + (r['appointment_date'] || '-') +
      ' · ปิดเมื่อ ' + (r['closed_at'] || '-')
    );
  });

  if (expired.length > 30) {
    console.log('  ... และอีก ' + (expired.length - 30) + ' เคส');
  }
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

/**
 * กวาดไฟล์แนบที่เก่าเกินกำหนด ไม่ว่าเคสจะปิดหรือไม่
 *
 * ⚠️ ทำไมต้องมีทั้งที่ trashAttachments_() ลบให้อยู่แล้ว
 *
 * anonymizeExpired() มองหาเคสจาก closed_at ซึ่งจะถูกเขียนเมื่อสถานะเป็น
 * TERMINAL_STATUSES เท่านั้น เคสที่ตอบว่า "Incomplete" (ขอข้อมูลเพิ่ม)
 * แล้วแพทย์ต้นทางเงียบหายไป จะไม่มี closed_at ตลอดกาล
 * แถวนั้นจึงไม่มีวันครบกำหนด และไฟล์แนบจะค้างใน Drive ตลอดไป
 *
 * ตัวนี้จึงตัดจากวันที่อัปโหลดตรง ๆ เป็นเพดานที่ไม่มีทางรั่ว
 * ลิงก์ที่ส่งไปมีค่าตอนแพทย์ต้นทางอ่านคำตอบ ไม่ใช่หนึ่งปีให้หลัง
 */
function sweepOldAttachments() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);

  const files = attachmentFolder_().getFiles();
  let trashed = 0;

  while (files.hasNext()) {
    const file = files.next();
    if (file.getDateCreated() < cutoff) {
      try {
        file.setTrashed(true);
        trashed++;
      } catch (err) {
        console.warn('ทิ้งไฟล์ ' + file.getName() + ' ไม่สำเร็จ: ' + err);
      }
    }
  }

  console.log('กวาดไฟล์แนบที่เก่ากว่า ' + RETENTION_MONTHS + ' เดือน: ' +
    trashed + ' ไฟล์');
}

/**
 * เขียนหัวตารางคลังให้ตรงกับ ADVICE_LIBRARY_COLUMNS
 *
 * ⚠️ ห้ามเขียนทับเมื่อคลังมีข้อมูลอยู่แล้วและหัวตารางไม่ตรง
 *
 * เดิมโค้ดนี้เขียนทับทันทีที่จำนวนคอลัมน์น้อยกว่าที่คาด ซึ่งจะทำให้แถวเก่า
 * ที่เก็บ treatment_summary ไว้คอลัมน์ 8 ถูกอ่านเป็น comorbidity หลังเพิ่ม
 * คอลัมน์ใหม่ตรงกลาง — ข้อมูลไม่หาย แต่ผิดความหมายทั้งคลังโดยไม่มีอะไรฟ้อง
 *
 * คลังว่างจึงเขียนได้ตามสบาย มีข้อมูลแล้วต้องให้คนตัดสินใจย้ายเอง
 */
function ensureLibraryHeader_(library) {
  const width = library.getLastColumn();
  const hasRows = library.getLastRow() > 1;

  if (width >= ADVICE_LIBRARY_COLUMNS.length) return;

  if (hasRows) {
    throw new Error(
      'ชีต ' + SHEETS.adviceLibrary + ' มีข้อมูล ' + (library.getLastRow() - 1) +
      ' แถว แต่หัวตารางมี ' + width + ' คอลัมน์ ซึ่งน้อยกว่าที่โค้ดคาด (' +
      ADVICE_LIBRARY_COLUMNS.length + ')\n\n' +
      'เขียนหัวตารางทับตอนนี้จะทำให้ค่าของแถวเดิมเลื่อนคอลัมน์และผิดความหมาย\n' +
      'ให้เพิ่มคอลัมน์ที่ขาดต่อท้ายด้วยมือ แล้วย้ายค่าให้ตรงก่อน จึงรันใหม่'
    );
  }

  library
    .getRange(1, 1, 1, ADVICE_LIBRARY_COLUMNS.length)
    .setValues([ADVICE_LIBRARY_COLUMNS]);
}

/**
 * สร้างแถวสำหรับ advice_library โดยถอดข้อมูลที่โยงกลับได้ออกทั้งหมด
 *
 * ที่ต้องถอด: referral_id, ชื่อ/เบอร์/โรงพยาบาลผู้ส่ง, วันที่แบบเต็ม, เอกสารแนบ
 * ที่แปลง:    อายุจริง → ช่วงอายุ, วันที่ → เหลือเฉพาะปี
 * ที่เก็บต่อ:  โรคร่วม สิทธิการรักษา และสูตรยาที่เลือก — ไม่ระบุตัวผู้ป่วย
 *             แต่เป็นสิ่งเดียวที่อธิบายได้ว่าทำไมเคสนั้นถึงถูกตอบแบบนั้น
 *
 * ⚠️ กลุ่มที่ 1 เหลือแค่ว่า "เดือนนั้นนัดผ่านระบบนี้กี่เคส" แยกตามโรคและช่วงอายุ
 *
 * ไม่เก็บ fellow_assigned ตามมติอาจารย์ 30 ส.ค. 2569 และไม่เก็บ appointment_date
 * เพราะวันนัดแบบเต็มคือวันที่ผู้ป่วยคนหนึ่งมาโรงพยาบาลจริง ซึ่งพอรวมกับโรค
 * และช่วงอายุแล้วแคบพอจะชี้ตัวได้ในโรคที่พบไม่บ่อย ระดับเดือนหยาบกว่าสามสิบเท่า
 * และตอบคำถามที่ต้องการได้ครบอยู่แล้ว
 *
 * ⚠️ year_month มาจากวันที่เคสเข้าระบบ ไม่ใช่วันนัด — เหมือนกันทุกกลุ่ม
 *
 * ถ้ากลุ่มที่ 1 ใช้เดือนของวันนัดแต่กลุ่มอื่นใช้เดือนที่ส่งเข้ามา คอลัมน์เดียวกัน
 * จะมีความหมายสองอย่าง แล้วกราฟรายเดือนที่รวมทุกกลุ่มจะบวกของคนละชนิดเข้าด้วยกัน
 * นิยามเดียวกันทั้งตารางยังทำให้ต่อคลังถาวรเข้ากับกราฟรายเดือนบนหน้าสถิติได้ตรง ๆ
 */
function buildAnonymizedRow_(r) {
  const submittedAt = toDate_(r['submitted_at'] || r['Timestamp']);
  const year = submittedAt ? submittedAt.getFullYear() : '';

  const values = {
    year: year,
    year_month: submittedAt
      ? Utilities.formatDate(submittedAt, TIMEZONE, 'yyyy-MM')
      : '',
    referral_type: r['referral_type'] || '',
    disease_group: r['disease_group'] || '',
    age_band: ageBand_(r['patient_age']),
    patient_sex: r['patient_sex'] || '',
    diagnosis: r['diagnosis'] || '',
    stage: r['stage'] || '',
    comorbidity: r['comorbidity'] || '',
    insurance_scheme: r['insurance_scheme'] || '',
    treatment_summary: r['treatment_summary'] || '',
    clinical_question: r['clinical_question'] || '',
    advice_record: r['advice_record'] || '',
    advice_regimens: r['advice_regimens'] || '',
    advice_question_type: r['advice_question_type'] || '',
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
