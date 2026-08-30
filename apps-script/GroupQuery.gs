/**
 * ถามงานของตัวเองในกลุ่ม LINE
 *
 * fellow ถามว่าวันไหนมีนัดกี่ราย · resident ถามว่ามีเคสค้างเท่าไร
 *
 * ⚠️ ตอบเฉพาะในกลุ่มที่อยู่ใน LINE_TARGET_* เท่านั้น ห้ามตอบในแชทตัวต่อตัว
 *
 * แชทตัวต่อตัวของบอทเป็นช่องทางของ "แพทย์ต้นทาง" ไม่ใช่เจ้าหน้าที่ —
 * ถ้าตอบคำสั่งเหล่านี้ในแชทตัวต่อตัวด้วย แพทย์โรงพยาบาลอื่นที่แอดบอทเป็นเพื่อน
 * จะพิมพ์ "เคสค้าง" แล้วเห็นภาระงานภายในของหน่วยงานทันที
 *
 * การอยู่ในกลุ่มคือสิ่งที่ใช้เป็นสิทธิ์ — หลักการเดียวกับการเข้า dashboard ด้วย LINE
 *
 * ⚠️ ห้ามใส่ข้อมูลผู้ป่วยในคำตอบ (PDPA-003)
 *
 * บอทบอกได้แค่ "จำนวน" กับ "ชื่อ fellow" ส่วนการวินิจฉัย ชื่อโรงพยาบาลต้นทาง
 * และเบอร์ติดต่อ ให้เปิด dashboard ซึ่งตอนนี้กดจากในแชทแล้วเข้าได้เลยด้วย LINE Login
 */

/** คำที่ทำให้บอทตอบเรื่องนัดของ fellow */
const GROUP_QUERY_APPOINTMENT = /^(นัด|ตาราง)\s*(.*)$/;

/** คำที่ทำให้บอทตอบเรื่องเคสค้างของ resident */
const GROUP_QUERY_PENDING = /^(เคสค้าง|งานค้าง|ค้าง|คิว)\s*$/;

/** แสดง fellow มากสุดกี่คนในข้อความเดียว ก่อนยุบเป็น "และอีก N คน" */
const GROUP_QUERY_MAX_FELLOWS = 6;

/**
 * ลองตอบคำถามจากในกลุ่ม คืน true ถ้าตอบไปแล้ว
 *
 * เรียกจาก handleLineEvent_ ก่อนบรรทัดที่ตัดข้อความจากกลุ่มทิ้ง
 *
 * ⚠️ ตอบเฉพาะข้อความที่ตรงคำสั่งแบบเป๊ะ ๆ ไม่ใช่ทุกข้อความที่มีคำว่า "นัด"
 *
 * เหตุผลเดิมที่บอทเงียบในกลุ่มคือกันไม่ให้กลุ่มเต็มไปด้วยข้อความบอท
 * เหตุผลนั้นยังอยู่ — สิ่งที่เปลี่ยนคือ "ตอบเมื่อถูกถามตรง ๆ" ไม่ใช่ "ตอบทุกอย่าง"
 */
function handleGroupQuery_(event, text, sourceId) {
  if (!isStaffGroup_(sourceId)) return false;

  if (GROUP_QUERY_PENDING.test(text)) {
    replyLineMessage_(event.replyToken, buildPendingReply_());
    return true;
  }

  const match = text.match(GROUP_QUERY_APPOINTMENT);
  if (!match) return false;

  const target = parseQueryDate_(match[2]);
  if (!target) {
    // พิมพ์ว่า "นัด" แล้วตามด้วยอย่างอื่นที่อ่านไม่ออก — บอกวิธีใช้ ไม่ใช่เงียบ
    replyLineMessage_(
      event.replyToken,
      'พิมพ์แบบนี้ได้ครับ\n' +
      '  นัดวันนี้\n' +
      '  นัดพรุ่งนี้\n' +
      '  นัด 15/9   (วันที่/เดือน)\n' +
      '  นัด 15/9/69   (ใส่ปี พ.ศ. ได้)',
    );
    return true;
  }

  replyLineMessage_(event.replyToken, buildAppointmentReply_(target));
  return true;
}

/**
 * ปลายทางนี้เป็นกลุ่มของเจ้าหน้าที่หรือไม่
 *
 * ใช้ค่าเดียวกับที่ส่งแจ้งเตือนและใช้เป็นสิทธิ์เข้า dashboard — รายชื่อกลุ่ม
 * มีที่เดียวคือ Script Properties จะได้ไม่มีวันไม่ตรงกัน
 */
function isStaffGroup_(sourceId) {
  if (!sourceId || sourceId.charAt(0) !== 'C') return false;
  return dashboardLineGroups_().indexOf(sourceId) !== -1;
}

/**
 * แปลงคำที่พิมพ์เป็นวันที่
 *
 * รับ: (ว่าง) · วันนี้ · พรุ่งนี้ · มะรืน · 15/9 · 15/9/69 · 15-9-2569 · 2026-09-15
 * คืน Date ที่ตัดเวลาออกแล้ว หรือ null ถ้าอ่านไม่ออก
 *
 * ⚠️ ปีที่คนไทยพิมพ์เป็น พ.ศ. เกือบทุกครั้ง
 *
 * "15/9/69" หมายถึง พ.ศ. 2569 ไม่ใช่ ค.ศ. 1969 และ "2569" ก็ไม่ใช่ ค.ศ.
 * ถ้าแปลงตรง ๆ จะได้วันที่ผิดไปห้าร้อยกว่าปีโดยไม่มีอะไรฟ้อง แล้วบอทจะตอบว่า
 * "ไม่มีนัด" ซึ่งดูเหมือนคำตอบปกติ
 */
function parseQueryDate_(raw) {
  const s = String(raw || '').trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!s || s === 'วันนี้') return today;

  if (s === 'พรุ่งนี้') {
    today.setDate(today.getDate() + 1);
    return today;
  }
  if (s === 'มะรืน' || s === 'มะรืนนี้') {
    today.setDate(today.getDate() + 2);
    return today;
  }

  // yyyy-MM-dd — รูปแบบเดียวกับที่เก็บในชีต
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return buildDate_(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // d/M หรือ d/M/y — คั่นด้วย / หรือ - หรือ .
  const thai = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2}|\d{4}))?$/);
  if (thai) {
    const day = Number(thai[1]);
    const month = Number(thai[2]);
    const year = thai[3] === undefined
      ? new Date().getFullYear()
      : normalizeYear_(Number(thai[3]));
    return buildDate_(year, month, day);
  }

  return null;
}

/**
 * แปลงปีที่คนพิมพ์ให้เป็น ค.ศ.
 *
 * 69 → 2569 → 2026   (สองหลัก ถือเป็น พ.ศ. เสมอ เพราะไม่มีใครพิมพ์ ค.ศ. สองหลัก)
 * 2569 → 2026        (สี่หลักที่มากกว่า 2400 คือ พ.ศ.)
 * 2026 → 2026
 */
function normalizeYear_(year) {
  if (year < 100) return 2500 + year - 543;
  if (year > 2400) return year - 543;
  return year;
}

function buildDate_(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  // ตรวจว่าไม่ถูกปัดข้ามเดือน เช่น 31/2 กลายเป็น 3 มี.ค.
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/**
 * นัดของ fellow ในวันที่กำหนด
 *
 * นับเฉพาะกลุ่มที่ 1 ที่ยืนยันนัดแล้ว — นัด OPD ของกลุ่มที่ 3 ไม่ได้อยู่ในความ
 * รับผิดชอบของ fellow และการรวมสองอย่างเข้าด้วยกันจะทำให้ตัวเลขไม่ตรงกับ
 * หน้า /dashboard/appointments ที่คนกดจากข้อความนี้ไปดูต่อ
 */
function buildAppointmentReply_(date) {
  const rows = readRows_(getSheet_(SHEETS.referrals));
  const iso = Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd');

  const matched = rows.filter(function (r) {
    if (String(r['referral_type'] || '') !== TYPES.transplant) return false;
    if (String(r['status'] || '') !== 'Appointment Confirmed') return false;
    const at = toDate_(r['appointment_date']);
    return at && Utilities.formatDate(at, TIMEZONE, 'yyyy-MM-dd') === iso;
  });

  const header = '📅 นัด fellow ' + formatThaiDate_(date) + '\n────────────────\n';

  if (matched.length === 0) {
    return header + 'ไม่มีนัดในวันนี้';
  }

  // นับต่อ fellow แล้วเรียงจากคนที่มีเคสมากสุด — คนที่งานแน่นควรเห็นก่อน
  const byFellow = {};
  matched.forEach(function (r) {
    const name = String(r['fellow_assigned'] || '').trim() || '(ยังไม่ระบุ)';
    byFellow[name] = (byFellow[name] || 0) + 1;
  });

  const names = Object.keys(byFellow).sort(function (a, b) {
    return byFellow[b] - byFellow[a];
  });

  let text = header + 'รวม ' + matched.length + ' ราย\n';
  names.slice(0, GROUP_QUERY_MAX_FELLOWS).forEach(function (name) {
    text += '• ' + name + ' — ' + byFellow[name] + ' ราย\n';
  });
  if (names.length > GROUP_QUERY_MAX_FELLOWS) {
    text += '• และอีก ' + (names.length - GROUP_QUERY_MAX_FELLOWS) + ' คน\n';
  }

  return linkButtonMessage_(
    text + '\nรายละเอียดโรคและเบอร์แพทย์ต้นทาง',
    'เปิด dashboard',
    SITE_URL + '/dashboard/appointments',
  );
}

/**
 * เคสที่ยังไม่จบของกลุ่มที่ 2 และ 3
 *
 * แยกตามระดับการแจ้งเตือน เพราะจำนวนรวมอย่างเดียวไม่บอกว่าต้องรีบแค่ไหน
 * — ค้าง 12 เคสที่ยังอยู่ในกรอบเวลา ต่างจากค้าง 3 เคสที่เลยกำหนดแล้วโดยสิ้นเชิง
 */
function buildPendingReply_() {
  const rows = readRows_(getSheet_(SHEETS.referrals));

  const open = rows.filter(function (r) {
    const type = String(r['referral_type'] || '');
    if (type !== TYPES.regimen && type !== TYPES.admission) return false;
    return TERMINAL_STATUSES.indexOf(String(r['status'] || '')) === -1;
  });

  const header = '📋 เคสค้างของ resident\n────────────────\n';
  if (open.length === 0) {
    return header + 'ไม่มีเคสค้าง ✅';
  }

  let red = 0;
  let yellow = 0;
  let oldest = 0;

  open.forEach(function (r) {
    const hours = Number(r['elapsed_business_hours']) || 0;
    if (hours > oldest) oldest = hours;
    if (hours >= ESCALATION.redHours) red++;
    else if (hours >= ESCALATION.yellowHours) yellow++;
  });

  let text = header + 'รวม ' + open.length + ' เคส\n';
  if (red > 0) text += '🔴 เลยกรอบเวลาแล้ว ' + red + ' เคส\n';
  if (yellow > 0) text += '🟡 ใกล้ครบกำหนด ' + yellow + ' เคส\n';
  const normal = open.length - red - yellow;
  if (normal > 0) text += '⚪ ยังอยู่ในกรอบเวลา ' + normal + ' เคส\n';
  text += '\nรอนานสุด ' + oldest + ' ชม.ทำการ';

  return linkButtonMessage_(
    text,
    'เปิดหน้าตอบคำปรึกษา',
    SITE_URL + '/dashboard/review',
  );
}
