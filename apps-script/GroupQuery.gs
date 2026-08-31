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
 * ปุ่มทั้งหมดที่มี — ⚠️ template แบบปุ่มรับได้มากสุด 4 ปุ่ม ป้ายยาวได้ 20 ตัวอักษร
 */
const GROUP_QUERY_APPOINTMENT_ACTIONS = [
  { label: 'นัดวันนี้', text: 'นัดวันนี้' },
  { label: 'นัดพรุ่งนี้', text: 'นัดพรุ่งนี้' },
];
const GROUP_QUERY_PENDING_ACTIONS = [
  { label: 'เคสค้าง', text: 'เคสค้าง' },
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

  if (fellow && !resident) return GROUP_QUERY_APPOINTMENT_ACTIONS;
  if (resident && !fellow) return GROUP_QUERY_PENDING_ACTIONS;

  return GROUP_QUERY_APPOINTMENT_ACTIONS.concat(GROUP_QUERY_PENDING_ACTIONS);
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

  const actions = groupActionsFor_(sourceId);

  if (GROUP_QUERY_MENU.test(text)) {
    replyLineMessage_(event.replyToken, buildMenuMessage_(actions));
    return true;
  }

  if (GROUP_QUERY_PENDING.test(text)) {
    replyLineMessage_(event.replyToken, withQuickReply_(
      toMessageObject_(buildPendingReply_()), actions));
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
      '  นัด 15/9/69   (ใส่ปี พ.ศ. ได้)\n\n' +
      'หรือพิมพ์ "เมนู" เพื่อขอปุ่มกด',
    );
    return true;
  }

  replyLineMessage_(event.replyToken, withQuickReply_(
    toMessageObject_(buildAppointmentReply_(target)), actions));
  return true;
}

/**
 * การ์ดปุ่มกดที่เอาไว้ปักหมุด
 *
 * ⚠️ นี่คือคำตอบของข้อจำกัดที่ว่า "quick reply ต้องมีคำถามนำก่อน"
 *
 * quick reply โผล่หลังบอทตอบเท่านั้น และหายไปทันทีที่มีคนพิมพ์อย่างอื่น
 * ส่วนการ์ดนี้เป็นข้อความธรรมดาที่อยู่ในห้องแชทถาวร ปุ่มยังกดได้แม้ผ่านไปเป็นเดือน
 *
 * วิธีใช้: พิมพ์ "เมนู" หนึ่งครั้ง แล้ว **ปักหมุดข้อความที่บอทตอบ**
 * จากนั้นทุกคนกดหมุด → กดปุ่ม → ไม่ต้องพิมพ์และไม่ต้องจำคำสั่งอีกเลย
 *
 * rich menu ทำแบบนี้ไม่ได้เพราะมีเฉพาะแชทตัวต่อตัว การ์ดนี้จึงทำหน้าที่แทนในกลุ่ม
 */
function buildMenuMessage_(actions) {
  return {
    type: 'template',
    altText: 'เมนูคำสั่งของบอท — ปักหมุดข้อความนี้ไว้ได้',
    template: {
      type: 'buttons',
      text: 'กดปุ่มด้านล่างได้เลย ไม่ต้องพิมพ์\n(ปักหมุดข้อความนี้ไว้ จะได้กดได้ตลอด)',
      actions: actions.map(function (item) {
        return { type: 'message', label: item.label.substring(0, 20), text: item.text };
      }),
    },
  };
}

/**
 * แปลงคำตอบให้เป็น message object เสมอ เพื่อให้แนบ quick reply ได้
 *
 * buildAppointmentReply_() คืนได้ทั้งสตริง (เมื่อไม่มีนัด) และ template object
 * (เมื่อมีนัด) ส่วน withQuickReply_() ต้องการ object เท่านั้น — ถ้าส่งสตริงเข้าไป
 * จะไปเซ็ต property บนสตริงซึ่ง JavaScript ยอมให้ทำแบบเงียบ ๆ แล้ว quickReply
 * จะหายไปโดยไม่มี error
 */
function toMessageObject_(payload) {
  if (typeof payload !== 'string') return payload;
  return { type: 'text', text: payload.substring(0, 4900) };
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
