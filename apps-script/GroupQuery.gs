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

/** คำที่ขอการ์ดปุ่มกด — ตัวที่ทำให้ไม่ต้องจำคำสั่งอีกเลย */
const GROUP_QUERY_MENU = /^(เมนู|menu|คำสั่ง)\s*$/i;

/**
 * นัดของ fellow ช่วงข้างหน้า — "นัด fellow" (7 วัน) หรือ "นัด fellow 14"
 * ⚠️ ต้องตรวจก่อน GROUP_QUERY_APPOINTMENT เพราะ "นัด fellow" เข้าแพตเทิร์น
 * "นัด <อะไรก็ได้>" ด้วย แล้วจะถูกตีความเป็นวันที่ที่อ่านไม่ออก
 */
const GROUP_QUERY_FELLOW_UPCOMING = /^นัด\s*fellow\s*(\d{1,2})?\s*$/i;

/** เวรตอบคำปรึกษากลุ่ม 2/3 — "เวร" "เวร resident" "เวรตอนนี้" */
const GROUP_QUERY_DUTY = /^เวร(\s*resident|ตอนนี้)?\s*$/i;

/** เคสที่มีข้อความใหม่จากแพทย์ต้นทาง — "ข้อความใหม่" "ข้อความ" "แชท" */
const GROUP_QUERY_UNREAD = /^(ข้อความใหม่|ข้อความ|แชท)\s*$/;


/**
 * ปุ่มทั้งหมดที่มี — ⚠️ template แบบปุ่มรับได้มากสุด 4 ปุ่ม ป้ายยาวได้ 20 ตัวอักษร
 */
const GROUP_QUERY_APPOINTMENT_ACTIONS = [
  { label: 'นัดวันนี้', text: 'นัดวันนี้' },
  { label: 'นัดพรุ่งนี้', text: 'นัดพรุ่งนี้' },
];
const GROUP_QUERY_PENDING_ACTIONS = [
  { label: 'เคสค้าง', text: 'เคสค้าง' },
  { label: 'ข้อความใหม่', text: 'ข้อความใหม่' },
  { label: 'เวร resident', text: 'เวร resident' },
];
const GROUP_QUERY_FELLOW_ACTIONS = [
  { label: 'นัด fellow', text: 'นัด fellow' },
];

/**
 * ปุ่มที่กลุ่มนี้ควรเห็น
 *
 * ⚠️ ปุ่มต่างกันตามกลุ่ม แต่ "คำสั่ง" ไม่ต่าง
 *
 * ทุกคำสั่งยังพิมพ์ได้จากทุกกลุ่มเจ้าหน้าที่เหมือนเดิม สิ่งที่เลือกให้ตรงกลุ่ม
 * คือปุ่มที่ยื่นให้เท่านั้น — resident ที่อยากรู้ตารางนัดยังพิมพ์ "นัดวันนี้" ได้
 * เราแค่ไม่เอาปุ่มที่เขาไม่ได้ใช้ทุกวันมาวางเกะกะในการ์ดที่จะถูกปักหมุดไว้ถาวร
 *
 * ⚠️ แยกกลุ่มไม่ออกเมื่อไร ให้แสดงทุกปุ่ม
 *
 * เช่นกลุ่มแอดมินที่ดูภาพรวมทั้งสองด้าน หรือกรณีที่ LINE_TARGET_* ตั้งไม่ครบ
 * แล้วค่าไหลไปใช้ตัวสำรอง — เดาผิดแล้วซ่อนปุ่มที่เขาต้องใช้ แย่กว่าโชว์ปุ่มเกิน
 */
function groupActionsFor_(sourceId) {
  const props = PropertiesService.getScriptProperties();
  const inTarget = function (key) {
    return parseLineTargets_(props.getProperty(key)).indexOf(sourceId) !== -1;
  };

  const fellow = inTarget('LINE_TARGET_FELLOW');
  const resident = inTarget('LINE_TARGET_RESIDENT');

  if (fellow && !resident) {
    return GROUP_QUERY_APPOINTMENT_ACTIONS.concat(GROUP_QUERY_FELLOW_ACTIONS);
  }
  if (resident && !fellow) return GROUP_QUERY_PENDING_ACTIONS;

  // กลุ่มแอดมิน (หรือแยกไม่ออก) เห็นครบทุกคำสั่ง
  return GROUP_QUERY_APPOINTMENT_ACTIONS
    .concat(GROUP_QUERY_FELLOW_ACTIONS)
    .concat(GROUP_QUERY_PENDING_ACTIONS);
}

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
  if (!isStaffGroup_(sourceId)) {
    // เขียน log ไว้เสมอ เพราะการเงียบคืออาการที่ตั้งใจให้เกิดกับห้องที่ไม่รู้จัก
    // ถ้าไม่บอกว่า "เงียบเพราะอะไร" คนตั้งค่าจะแยกไม่ออกจากกรณีโค้ดพัง
    console.log(
      'ไม่ตอบคำสั่งกลุ่ม: ' + sourceId + ' ไม่อยู่ในรายชื่อกลุ่มเจ้าหน้าที่ ' +
      JSON.stringify(dashboardLineGroups_()),
    );
    return false;
  }

  /*
   * ⚠️ ทุกคำตอบเป็นข้อความธรรมดา ไม่ใช้ template และไม่แนบ quick reply
   *
   * บทเรียนจากคืนแรกที่เปิดใช้: template ที่ LINE ไม่ยอมรับจะถูกตอบ 400
   * แล้ว "ไม่ส่งทั้งข้อความ" — จากในแชทแยกไม่ออกเลยว่าบอทพังหรือกลุ่มผิด
   * ข้อความธรรมดาคือรูปแบบเดียวที่พิสูจน์แล้วว่าส่งถึงเสมอ (#id ใช้มาตลอด)
   * ลิงก์วางเป็นบรรทัดท้าย LINE ทำให้กดได้เองอยู่แล้ว
   *
   * ⚠️ error ระหว่างสร้างคำตอบต้องไปโผล่ "ในแชท" ไม่ใช่แค่ใน log
   * เพราะคนที่เจอปัญหาคือคนที่อยู่ในแชท และ log ของ Apps Script
   * ไม่ใช่ที่ที่ทุกคนเปิดเป็น — ความเงียบคือคำตอบที่แย่ที่สุด
   */
  if (GROUP_QUERY_MENU.test(text)) {
    replyOrReport_(event.replyToken, buildMenuText_(groupActionsFor_(sourceId)));
    return true;
  }

  if (GROUP_QUERY_PENDING.test(text)) {
    replyOrReport_(event.replyToken, buildPendingReply_);
    return true;
  }

  if (GROUP_QUERY_UNREAD.test(text)) {
    replyOrReport_(event.replyToken, buildUnreadReply_);
    return true;
  }

  const upcoming = text.match(GROUP_QUERY_FELLOW_UPCOMING);
  if (upcoming) {
    const days = parseInt(upcoming[1], 10) || 7;
    replyOrReport_(event.replyToken, function () {
      return buildFellowUpcomingReply_(days);
    });
    return true;
  }

  if (GROUP_QUERY_DUTY.test(text)) {
    replyOrReport_(event.replyToken, buildDutyReply_);
    return true;
  }

  const match = text.match(GROUP_QUERY_APPOINTMENT);
  if (!match) {
    // ไม่ตรงคำสั่งไหนเลย — ลองตีความว่าเป็น "ชื่อ fellow" ที่พิมพ์มาดูนัดตัวเอง
    // จับเฉพาะข้อความสั้น ๆ ที่ตรงชื่อ fellow จริงเท่านั้น จึงไม่แทรกบทสนทนาทั่วไป
    const matchedFellow = matchFellowByName_(text);
    if (matchedFellow === null) return false; // ไม่ตรงชื่อใคร — เงียบตามเดิม
    if (Array.isArray(matchedFellow)) {
      replyLineMessage_(event.replyToken,
        'มี fellow ชื่อคล้ายกันหลายท่าน พิมพ์ให้ชัดขึ้นครับ:\n' +
        matchedFellow.map(function (n) { return '• ' + n; }).join('\n'));
      return true;
    }
    // แสดงรายละเอียดผู้ป่วย (เพศ/อายุ/โรค/ข้อบ่งชี้) เฉพาะในกลุ่ม fellow —
    // เป็นข้อยกเว้น PDPA-003 เดียวที่อาจารย์อนุมัติ (แจ้ง fellow กลุ่ม 1)
    // กลุ่มอื่นได้แค่ วันนัด·เลขเคส·กลุ่มโรค
    const inFellowGroup = parseLineTargets_(
      PropertiesService.getScriptProperties().getProperty('LINE_TARGET_FELLOW')
    ).indexOf(sourceId) !== -1;
    replyOrReport_(event.replyToken, function () {
      return buildFellowOwnReply_(matchedFellow, inFellowGroup);
    });
    return true;
  }

  const target = parseQueryDate_(match[2]);
  if (!target) {
    // พิมพ์ว่า "นัด" แล้วตามด้วยอย่างอื่นที่อ่านไม่ออก — บอกวิธีใช้ ไม่ใช่เงียบ
    replyLineMessage_(
      event.replyToken,
      'พิมพ์แบบนี้ได้ครับ\n' +
      '  นัดวันนี้\n' +
      '  นัดพรุ่งนี้\n' +
      '  นัด 15/9   (วันที่/เดือน)\n' +
      '  นัด 15/9/69   (ใส่ปี พ.ศ. ได้)\n\n' +
      'หรือพิมพ์ "เมนู" เพื่อขอปุ่มกด',
    );
    return true;
  }

  replyOrReport_(event.replyToken, function () {
    return buildAppointmentReply_(target);
  });
  return true;
}

/**
 * ตอบด้วยผลของ builder หรือรายงานข้อผิดพลาดเข้าแชทตรง ๆ
 *
 * รับได้ทั้งข้อความสำเร็จรูปและฟังก์ชัน — ที่ให้ส่งฟังก์ชันเข้ามาเพราะ
 * การอ่านชีตอาจพังได้ และต้องพังหลังจากที่เรามี replyToken พร้อมจะรายงานแล้ว
 */
function replyOrReport_(replyToken, builderOrText) {
  let text;
  try {
    text = typeof builderOrText === 'function' ? builderOrText() : builderOrText;
  } catch (err) {
    replyLineMessage_(replyToken,
      '⚠️ บอทขัดข้อง ตอบไม่ได้: ' + err + '\n' +
      'แจ้งผู้ดูแลระบบพร้อมข้อความนี้ได้เลย');
    return;
  }
  replyLineMessage_(replyToken, text);
}

/**
 * ข้อความเมนูสำหรับปักหมุด
 *
 * เคยเป็นการ์ดปุ่มกด (buttons template) แต่ template คือผู้ต้องสงสัยหลัก
 * ของอาการ "บอทเงียบทั้งที่ทุกอย่างถูกต้อง" ในคืนเปิดใช้ — ข้อความธรรมดา
 * แลกความสวยกับความแน่นอนว่าส่งถึง ซึ่งเป็นการแลกที่คุ้มสำหรับระบบงาน
 */
function buildMenuText_(actions) {
  let text = '🤖 คำสั่งที่ใช้ได้ในกลุ่มนี้ — พิมพ์ได้เลย\n────────────────\n';
  actions.forEach(function (a) {
    text += '  ' + a.text + '\n';
  });
  text += '  นัด 15/9  (ดูวันอื่น ใส่ปี พ.ศ. ได้)\n';
  text += '  (fellow) พิมพ์ชื่อตัวเอง เพื่อดูนัดของตัวเอง\n';
  text += '\n📌 ปักหมุดข้อความนี้ไว้ให้ทุกคนเห็น';
  return text;
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

  return text + '\nรายละเอียดโรคและเบอร์แพทย์ต้นทาง\n' +
    SITE_URL + '/dashboard/appointments';
}

/**
 * เคสที่ยังไม่จบของกลุ่มที่ 2 และ 3
 *
 * แยกตามระดับการแจ้งเตือน เพราะจำนวนรวมอย่างเดียวไม่บอกว่าต้องรีบแค่ไหน
 * — ค้าง 12 เคสที่ยังอยู่ในกรอบเวลา ต่างจากค้าง 3 เคสที่เลยกำหนดแล้วโดยสิ้นเชิง
 */
/** เคสที่มีข้อความใหม่จากแพทย์ต้นทางที่ยังไม่อ่าน — ทีมพิมพ์ "ข้อความใหม่" ดึงเอง (ฟรี) */
function buildUnreadReply_() {
  const rows = readRows_(getSheet_(SHEETS.referrals));
  const unread = rows.filter(function (r) {
    return String(r['dent_unread'] || '').toLowerCase() === 'yes' &&
      TERMINAL_STATUSES.indexOf(String(r['status'] || '')) === -1;
  });

  const header = '💬 เคสมีข้อความใหม่จากแพทย์ต้นทาง\n────────────────\n';
  if (unread.length === 0) {
    return header + 'ไม่มีข้อความใหม่ ✅';
  }

  let msg = header;
  unread.slice(0, 15).forEach(function (r) {
    const groupNo = GROUP_NUMBER[String(r['referral_type'])] || '-';
    msg += '• ' + r['referral_id'] + ' · กลุ่ม ' + groupNo + '\n';
  });
  if (unread.length > 15) {
    msg += '  ...และอีก ' + (unread.length - 15) + ' เคส\n';
  }
  msg += '\nเปิดอ่าน/ตอบใน dashboard:\n' + DASHBOARD_URL;
  return msg;
}

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

  return text + '\n' + SITE_URL + '/dashboard/review';
}

/**
 * ตรวจว่าทำไมบอทถึงไม่ตอบคำสั่งในกลุ่ม
 *
 * ⚠️ รันในหน้าจอได้เลย ไม่ต้อง deploy — อ่าน Script Properties ชุดเดียวกับที่
 * deployment ใช้ ผลที่ได้จึงตรงกับที่เกิดขึ้นจริงตอนมีคนพิมพ์ในกลุ่ม
 *
 * พิมพ์ค่าดิบออกมาด้วย JSON.stringify โดยตั้งใจ เพราะช่องว่างหรือบรรทัดใหม่
 * ที่ติดมาตอนคัดลอกจะมองไม่เห็นเลยในหน้าตั้งค่า แต่จะโผล่เป็น \n ตรงนี้
 *
 * และพิมพ์ "ชื่อคีย์ทั้งหมด" ด้วย เพราะคีย์ที่มีช่องว่างต่อท้าย เช่น
 * "LINE_TARGET_FELLOW " จะทำให้ getProperty คืน null ทั้งที่หน้าจอดูเหมือนตั้งไว้แล้ว
 */
function diagnoseGroupQuery() {
  const props = PropertiesService.getScriptProperties();

  console.log('ชื่อคีย์ทั้งหมดใน Script Properties:');
  console.log('  ' + JSON.stringify(props.getKeys()));
  console.log('');

  ['LINE_TARGET_RESIDENT', 'LINE_TARGET_FELLOW', 'LINE_TARGET_ADMIN']
    .forEach(function (key) {
      const raw = props.getProperty(key);
      console.log(key + ' = ' + (raw === null ? '(ไม่ได้ตั้ง)' : JSON.stringify(raw)));
    });

  console.log('');
  const groups = dashboardLineGroups_();
  console.log('กลุ่มที่ระบบยอมรับ: ' + groups.length + ' กลุ่ม');
  groups.forEach(function (g) { console.log('  ' + g); });

  console.log('');
  if (groups.length === 0) {
    console.log('❌ ไม่มีกลุ่มไหนถูกยอมรับเลย — บอทจะเงียบทุกกลุ่ม');
    console.log('   สาเหตุที่พบบ่อย:');
    console.log('   • ค่าที่ใส่ขึ้นต้นด้วย U (บัญชีบุคคล) หรือ R (ห้องแชท)');
    console.log('     ระบบรับเฉพาะ C ซึ่งคือ "กลุ่ม" เท่านั้น');
    console.log('   • ชื่อคีย์สะกดผิดหรือมีช่องว่าง — เทียบกับรายการคีย์ด้านบน');
  } else {
    console.log('✅ เอา ID ที่บอทตอบตอนพิมพ์ #id มาเทียบกับรายการด้านบน');
    console.log('   ตรงกันเป๊ะ = บอทต้องตอบ / ไม่ตรง = ใส่ผิดกลุ่ม');
  }
}

/**
 * นัดพบ fellow ช่วง N วันข้างหน้า จัดกลุ่มตามชื่อ fellow — ให้แอดมินกวาดตา
 * แล้วรู้ว่าต้องไปเตือนใคร (คำขอผู้ใช้ 5 ก.ย. 2569)
 *
 * ข้อมูลต่อแถว: วันนัด · เลขเคส · กลุ่มโรค เท่านั้น — กติกาเดียวกับข้อความ
 * แจ้ง fellow (PDPA-003) ไม่มีชื่อ/อายุผู้ป่วยในข้อความกลุ่ม
 */
function buildFellowUpcomingReply_(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  end.setHours(23, 59, 59, 999);

  const byFellow = {};
  let total = 0;

  readRows_(getSheet_(SHEETS.referrals)).forEach(function (r) {
    if (String(r['referral_type']).trim() !== TYPES.transplant) return;
    if (String(r['status']).trim() !== 'Appointment Confirmed') return;
    const when = toDate_(r['appointment_date']);
    if (!when || when < start || when > end) return;

    const fellow = String(r['fellow_assigned'] || '').trim() || '(ไม่ระบุ fellow)';
    (byFellow[fellow] = byFellow[fellow] || []).push({
      when: when,
      id: String(r['referral_id'] || '').trim(),
      disease: String(r['disease_group'] || '').trim(),
    });
    total++;
  });

  let text = '📅 นัดพบ fellow ' + days + ' วันข้างหน้า\n' +
    '(' + formatThaiDate_(start) + ' – ' + formatThaiDate_(end) + ')\n' +
    '────────────────\n';

  const names = Object.keys(byFellow).sort();
  if (names.length === 0) {
    return text + 'ไม่มีนัดในช่วงนี้\n\nดูช่วงอื่น: พิมพ์ "นัด fellow 14"';
  }

  names.forEach(function (name) {
    const list = byFellow[name].sort(function (a, b) { return a.when - b.when; });
    text += '\n' + name + ' — ' + list.length + ' นัด\n';
    list.forEach(function (item) {
      text += '• ' + formatThaiDate_(item.when) + ' · ' + item.id +
        (item.disease ? ' · ' + item.disease : '') + '\n';
    });
  });

  text += '\nรวม ' + total + ' นัด · ดูตาราง:\n' + SITE_URL + '/dashboard/schedule';
  return text;
}

/**
 * เวรตอบคำปรึกษากลุ่ม 2/3 — ตอนนี้ใครประจำการ และรอบถัดไปคือใคร
 * อ่านจากชีต resident_schedule ตัวเดียวกับการมอบหมายเคสอัตโนมัติ
 */
function buildDutyReply_() {
  const now = new Date();
  const current = onDutyResidents_(now);

  let text = '🩺 เวรตอบคำปรึกษากลุ่ม 2/3\n────────────────\n';

  if (current.length === 0) {
    text += '⚠️ ตอนนี้ไม่มีชื่อเวรในตาราง — เคสใหม่จะไม่ถูกมอบหมายอัตโนมัติ\n';
  } else {
    text += 'ตอนนี้ (' + current.length + ' คน):\n';
    current.forEach(function (d) {
      text += '• ' + d.name + ' (ถึง ' + formatThaiDate_(toDate_(d.until)) + ')\n';
    });
  }

  // รอบถัดไป — ช่วงเวรอนาคตที่เริ่มเร็วที่สุด (อาจมีหลายคนช่วงเดียวกัน)
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const future = [];
  readRows_(getSheet_(SHEETS.residentSchedule)).forEach(function (r) {
    const from = toDate_(r['from_date']);
    const to = toDate_(r['to_date']);
    const name = String(r['resident_name'] || '').trim();
    if (!from || !to || !name || from <= today) return;
    future.push({ from: from, to: to, name: name });
  });

  if (future.length > 0) {
    future.sort(function (a, b) { return a.from - b.from; });
    const nextFrom = future[0].from.getTime();
    const nextTeam = future.filter(function (f) {
      return f.from.getTime() === nextFrom;
    });
    text += '\nรอบถัดไป (' + formatThaiDate_(nextTeam[0].from) + ' – ' +
      formatThaiDate_(nextTeam[0].to) + '):\n';
    nextTeam.forEach(function (f) { text += '• ' + f.name + '\n'; });
  }

  text += '\nเคสใหม่ถูกมอบหมายให้เวรตอนนี้อัตโนมัติ (วนตามลำดับ)\n' +
    'แก้/แลกเวร: ' + SITE_URL + '/dashboard/duty';
  return text;
}

/**
 * ชื่อ fellow ที่มีนัด (ยืนยันแล้ว) ข้างหน้าตั้งแต่วันนี้ — ใช้เป็นบัญชีคำที่
 * ยอมให้พิมพ์เพื่อดูนัดตัวเอง จึงไม่ตอบข้อความทั่วไปที่ไม่ใช่ชื่อ fellow
 */
function upcomingFellowNames_() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const seen = {};
  readRows_(getSheet_(SHEETS.referrals)).forEach(function (r) {
    if (String(r['referral_type']).trim() !== TYPES.transplant) return;
    if (String(r['status']).trim() !== 'Appointment Confirmed') return;
    const when = toDate_(r['appointment_date']);
    if (!when || when < start) return;
    const name = String(r['fellow_assigned'] || '').trim();
    if (name) seen[name] = true;
  });
  return Object.keys(seen);
}

/**
 * จับคู่ข้อความที่พิมพ์กับชื่อ fellow — พิมพ์บางส่วนก็เจอ
 * คืน: ชื่อเต็ม (ตรงหนึ่งคน) / อาร์เรย์ (ตรงหลายคน ให้เลือก) / null (ไม่ตรงใคร)
 */
function matchFellowByName_(text) {
  const q = String(text || '').trim().toLowerCase();
  // ยาวเกินไปไม่ใช่การพิมพ์ชื่อ — กันประโยคยาวมาแมตช์ชื่อโดยบังเอิญ
  if (!q || q.length > 40) return null;

  const names = upcomingFellowNames_();
  const hits = names.filter(function (n) {
    return n.toLowerCase().indexOf(q) !== -1;
  });
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  // ตรงเป๊ะทั้งชื่อ ให้ชนะการตรงบางส่วน
  const exact = hits.filter(function (n) { return n.toLowerCase() === q; });
  return exact.length === 1 ? exact[0] : hits;
}

/**
 * นัดข้างหน้าทั้งหมดของ fellow คนเดียว — เรียงตามวัน
 * ในแชทมีแค่ วันนัด·เลขเคส·กลุ่มโรค (PDPA-003) รายละเอียดเต็มดูใน dashboard
 */
function buildFellowOwnReply_(fellowName, detailed) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const list = [];
  readRows_(getSheet_(SHEETS.referrals)).forEach(function (r) {
    if (String(r['referral_type']).trim() !== TYPES.transplant) return;
    if (String(r['status']).trim() !== 'Appointment Confirmed') return;
    if (String(r['fellow_assigned'] || '').trim() !== fellowName) return;
    const when = toDate_(r['appointment_date']);
    if (!when || when < start) return;
    list.push({ when: when, row: r });
  });

  if (list.length === 0) {
    return '📅 ' + fellowName + ' — ยังไม่มีนัดข้างหน้าครับ';
  }

  list.sort(function (a, b) { return a.when - b.when; });
  let text = '📅 นัดของ ' + fellowName + ' — ' + list.length + ' เคส\n' +
    '────────────────\n';

  list.forEach(function (item) {
    const r = item.row;
    const id = String(r['referral_id'] || '').trim();
    if (detailed) {
      // รูปแบบเต็ม (เฉพาะกลุ่ม fellow) — เพศ/อายุ/โรค/ข้อบ่งชี้ ตาม PDPA-003 ข้อยกเว้น
      // เวลาจาก appointment_note ที่บันทึกไว้ (เช่น "08:00 น. พบ ...")
      const timeNote = String(r['appointment_note'] || '').trim();
      text +=
        '🗓️ ' + formatThaiDate_(item.when) +
          (timeNote ? ' · ' + timeNote.split(' พบ')[0] : '') + '\n' +
        '   เลขที่อ้างอิง: ' + id + '\n' +
        '   ส่งมาจาก: ' + (r['referrer_org'] || '-') + '\n' +
        '   ผู้ป่วย: ' + (r['patient_sex'] || '-') +
          ' อายุ ' + (r['patient_age'] || '-') + ' ปี\n' +
        '   การวินิจฉัย: ' + (r['diagnosis'] || '-') + '\n' +
        '   ข้อบ่งชี้ (I/C): ' + (r['transplant_indication'] || '-') + '\n\n';
    } else {
      const disease = String(r['disease_group'] || '').trim();
      text += '• ' + formatThaiDate_(item.when) + ' · ' + id +
        (disease ? ' · ' + disease : '') + '\n';
    }
  });

  text += '\nเปิดดูรายละเอียดเต็ม (ต้องล็อกอิน):\n' +
    SITE_URL + '/dashboard/schedule';
  return text;
}
