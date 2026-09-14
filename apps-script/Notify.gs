/**
 * การแจ้งเตือนผ่าน LINE
 *
 * ⚠️ ใช้ LINE Messaging API ไม่ใช่ LINE Notify
 *    LINE Notify ปิดให้บริการไปแล้วเมื่อ 31 มีนาคม 2568
 *    เอกสารข้อเสนอโครงการฉบับเดิมอ้างถึง LINE Notify จึงต้องปรับตามนี้
 *
 * ข้อความทุกฉบับมีเฉพาะ referral ID กลุ่ม สถานะ และลิงก์เท่านั้น
 * ห้ามใส่ข้อมูลผู้ป่วยลงใน LINE (PDPA-003)
 * ข้อยกเว้นเดียวคือการแจ้ง fellow กลุ่มที่ 1 ซึ่งอาจารย์อนุมัติให้ส่ง
 * เพศ อายุ และโรค ได้ เพราะไม่มีชื่อและ HN แล้ว
 */

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';
const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';

/**
 * ตอบกลับข้อความที่เพิ่งเข้ามา
 *
 * ต่างจาก push ตรงที่ใช้ replyToken แทน ID ปลายทาง จึงตอบได้โดยยังไม่รู้ว่า
 * ปลายทางคือใคร — เป็นเหตุผลที่ใช้ตัวนี้หา group ID ตอนตั้งค่าได้
 * และ reply ไม่นับโควตาข้อความของ LINE ด้วย
 *
 * replyToken ใช้ได้ครั้งเดียวและหมดอายุใน 1 นาที
 */
function replyLineMessage_(replyToken, payload) {
  const token = PropertiesService.getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  // รับได้ทั้งสตริงเดียว (ใช้อยู่เกือบทุกที่) และอาร์เรย์ของ message object
  // เพื่อให้แนบปุ่มกดไปด้วยได้โดยไม่ต้องแก้ผู้เรียกทั้ง 22 จุด
  const messages = typeof payload === 'string'
    ? [{ type: 'text', text: payload.substring(0, 4900) }]
    : payload;

  if (!token || !replyToken) {
    console.log('[ตอบ LINE ไม่ได้ ยังไม่มี token] ' + JSON.stringify(messages));
    return;
  }

  const response = UrlFetchApp.fetch(LINE_REPLY_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      replyToken: replyToken,
      // LINE รับได้สูงสุด 5 ข้อความต่อการตอบหนึ่งครั้ง
      messages: messages.slice(0, 5),
    }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    console.error('ตอบ LINE ไม่สำเร็จ (' + response.getResponseCode() + '): ' +
      response.getContentText());
  }
}

/**
 * ข้อความแบบมีปุ่มกดเปิดลิงก์ — ใช้แทนการวาง URL ดิบในข้อความ
 *
 * URL ดิบใน LINE จะถูกดึงมาทำการ์ดพรีวิวต่อท้ายอัตโนมัติ ซึ่งกินพื้นที่จอ
 * และทำให้ข้อความที่เป็นคำถาม ("พิมพ์เลข 1-3") ถูกดันขึ้นไปจนคนเลื่อนไม่เห็น
 *
 * ⚠️ ข้อจำกัดของ buttons template
 *   text  ยาวได้ 160 ตัวอักษร — ข้อความยาวกว่านั้นให้ส่งเป็นข้อความแยกก่อนหน้า
 *   label ยาวได้ 20 ตัวอักษร
 * เกินแล้ว LINE ตอบ 400 และ "ไม่ส่งอะไรเลย" ไม่ใช่ตัดให้ จึงต้องตัดเองที่นี่
 */
function linkButtonMessage_(text, label, url) {
  return {
    type: 'template',
    // altText คือสิ่งที่โผล่ในรายการแชทและใน notification ของมือถือ
    altText: text.substring(0, 300),
    template: {
      type: 'buttons',
      text: text.substring(0, 160),
      actions: [{ type: 'uri', label: label.substring(0, 20), uri: url }],
    },
  };
}

/**
 * แปะปุ่มลัดไว้เหนือแป้นพิมพ์ของข้อความหนึ่ง
 *
 * ต่างจาก buttons template ตรงที่ปุ่มพวกนี้ "หายไปเองเมื่อกดหรือพิมพ์อย่างอื่น"
 * จึงเหมาะกับตัวเลือกชั่วคราวของโฟลว์ที่กำลังคุยกันอยู่ ไม่ค้างรกแชทย้อนหลัง
 *
 * action แบบ message ทำให้ข้อความถูกส่งเสมือนผู้ใช้พิมพ์เอง
 * ตัวจัดการเดิมจึงรับได้โดยไม่ต้องแก้ — คนที่อยากพิมพ์ "1" เองก็ยังได้ผลเหมือนกัน
 *
 * ⚠️ LINE แสดงปุ่มลัดของ "ข้อความสุดท้าย" ในการตอบหนึ่งครั้งเท่านั้น
 *    แปะไว้กับข้อความอื่นแล้วจะไม่ขึ้นเลย
 * ⚠️ label ยาวได้ 20 ตัวอักษร เกินแล้ว LINE ตอบ 400 และไม่ส่งอะไรเลย
 */
function withQuickReply_(message, items) {
  message.quickReply = {
    items: items.slice(0, 13).map(function (item) {
      return {
        type: 'action',
        action: {
          type: 'message',
          label: item.label.substring(0, 20),
          text: item.text,
        },
      };
    }),
  };
  return message;
}

/** ปุ่มลัด "ยกเลิก" — ใช้ทุกขั้นของโฟลว์ที่ออกกลางคันได้ */
function cancelQuickReply_() {
  return [{ label: '✕ ยกเลิก', text: 'ยกเลิก' }];
}

const LINE_TARGET_BY_AUDIENCE = {
  batch: 'LINE_TARGET_RESIDENT',
  red: 'LINE_TARGET_ADMIN',
  fellow: 'LINE_TARGET_FELLOW',
};

/**
 * ปลายทางสำรอง — ใช้เมื่อยังไม่ได้ตั้งปลายทางเฉพาะของกลุ่มนั้น
 *
 * มีไว้เพื่อให้เริ่มใช้งานได้ด้วยการตั้งค่าเพียงตัวเดียว
 * แอดมินแอด LINE OA เป็นเพื่อน พิมพ์ #id ในแชทตัวต่อตัว แล้วเอา userId
 * มาใส่ตัวนี้ ก็ได้รับครบทุกการแจ้งเตือนโดยไม่ต้องสร้างกลุ่มสักกลุ่ม
 *
 * ที่ต้องมีเพราะการเงียบสนิทเป็นค่าเริ่มต้นที่อันตราย — ระบบจะดูเหมือนทำงานปกติ
 * ทุกอย่าง ยกเว้นไม่มีใครรู้ว่ามีเคสค้าง ซึ่งเป็นสิ่งเดียวที่การแจ้งเตือนมีไว้ทำ
 */
const LINE_TARGET_FALLBACK = 'LINE_TARGET_ADMIN';

/**
 * ส่งข้อความเข้า LINE
 *
 * ปลายทางเป็น groupId หรือ userId ก็ได้ — LINE ไม่แยก ใช้ช่อง `to` เดียวกัน
 * จึงไม่จำเป็นต้องสร้างกลุ่มถ้ายังไม่พร้อม
 *
 * @param {string} text ข้อความ
 * @param {string} audience 'batch' = resident, 'red' = แอดมินกลาง, 'fellow' = fellow
 */
function pushLineMessage_(text, audience) {
  // สวิตช์หลัก: ปิด push อัตโนมัติทั้งหมด (ค่าเริ่มต้น) — ทีมดึงข้อมูลเองผ่านปุ่ม/เมนู
  // (reply ฟรี) · ตั้ง config line_push = on เพื่อเปิดกลับ
  if (!linePushEnabled_()) {
    console.log('[LINE push ปิด (line_push=off)] ' + audience + ': ' + text);
    return;
  }
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  const targetKey = LINE_TARGET_BY_AUDIENCE[audience] || LINE_TARGET_FALLBACK;
  let target = props.getProperty(targetKey);
  let message = text;

  if (!target && targetKey !== LINE_TARGET_FALLBACK) {
    target = props.getProperty(LINE_TARGET_FALLBACK);
    if (target) {
      // บอกให้รู้ว่าทำไมข้อความนี้ถึงมาถึงตัวเอง ไม่งั้นแอดมินจะงงว่าเกี่ยวอะไรด้วย
      // และจะไม่มีทางรู้เลยว่ายังตั้งค่าไม่ครบ
      message =
        '(ส่งถึงคุณเพราะยังไม่ได้ตั้ง ' + targetKey + ')\n' +
        '──────────\n' + text;
    }
  }

  const targets = parseLineTargets_(target);

  if (!token || targets.length === 0) {
    // ยังไม่ได้ตั้งค่า — บันทึก log ไว้แทนการส่ง เพื่อให้ทดสอบระบบได้ก่อนมี LINE OA
    console.log('[LINE ยังไม่ได้ตั้งค่า: ' + targetKey + '] ' + text);
    return;
  }

  // ส่งทีละปลายทาง ไม่ใช้ multicast เพราะ multicast รับได้เฉพาะ userId
  // ส่วนที่นี่ต้องรองรับ groupId ด้วย และจำนวนปลายทางอยู่ระดับหลักหน่วย
  targets.forEach(function (to) {
    sendOneLinePush_(token, to, message);
  });
}

/**
 * แยกค่า Script Property เป็นรายการปลายทาง
 *
 * รองรับหลายปลายทางด้วยการคั่นจุลภาค เพื่อให้มีแอดมินหลายคนได้โดยไม่ต้อง
 * สร้างกลุ่ม LINE (ซึ่งต้องเปิดสิทธิ์ให้บอทเข้ากลุ่มเพิ่มอีกขั้น)
 *
 * ตัดค่าซ้ำออก เพราะคนเดียวกันอาจถูกใส่ไว้ทั้งใน _ADMIN และ _RESIDENT
 * แล้วจะได้ข้อความเดียวกันสองรอบ
 */
function parseLineTargets_(raw) {
  const seen = {};
  return String(raw || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) {
      if (!s || seen[s]) return false;
      seen[s] = true;
      return true;
    });
}

/**
 * ส่งหนึ่งข้อความไปหนึ่งปลายทาง
 *
 * ปลายทางหนึ่งพังต้องไม่ทำให้ปลายทางที่เหลือไม่ได้รับ — แอดมินคนหนึ่งบล็อก
 * บัญชีหรือออกจากกลุ่ม ไม่ควรทำให้ทั้งทีมพลาด Red Alert
 */
function sendOneLinePush_(token, to, message) {
  try {
    const response = UrlFetchApp.fetch(LINE_PUSH_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        to: to,
        messages: [{ type: 'text', text: message.substring(0, 4900) }],
      }),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    if (code !== 200) {
      console.error('ส่ง LINE ไม่สำเร็จ (' + code + ') ปลายทาง ' + to + ': ' +
        response.getContentText());
      return null;
    }
    // คืน id ของข้อความที่เพิ่งส่ง (ใช้ผูกกับเคสสำหรับ quote-reply)
    // ผู้เรียกเดิมไม่สนใจค่านี้ จึงไม่กระทบพฤติกรรมเดิม
    try {
      const body = JSON.parse(response.getContentText() || '{}');
      if (body.sentMessages && body.sentMessages.length) {
        return String(body.sentMessages[0].id || '') || null;
      }
    } catch (e) { /* response ว่าง/ไม่ใช่ JSON — ไม่มี id ให้คืน */ }
    return null;
  } catch (err) {
    console.error('ส่ง LINE ไม่สำเร็จ ปลายทาง ' + to + ': ' + err);
    return null;
  }
}

/**
 * ยิงข้อความทดสอบไปทุกปลายทางที่ตั้งไว้ แล้วรายงานผลรายปลายทาง
 *
 * ⚠️ ต่างจาก runSelfTest() ตรงที่ตัวนั้นตรวจแค่ว่า "ตั้งค่าไว้แล้ว"
 *
 * การตั้งค่าครบไม่ได้แปลว่าส่งถึง — บอทถูกเตะออกจากกลุ่ม แอดมินบล็อกบัญชี
 * กลุ่มถูกยุบ หรือ token หมดอายุ ล้วนทำให้แจ้งเตือนเงียบสนิทโดยที่
 * Script Properties ยังมีค่าอยู่ครบทุกตัว และไม่มีอะไรฟ้องจนกว่าจะมีเคสค้าง
 * แล้วไม่มีใครรู้ ซึ่งคือสิ่งเดียวที่การแจ้งเตือนมีไว้ทำ
 *
 * ควรรันหลังตั้งค่า LINE ครั้งแรก และทุกครั้งที่เปลี่ยนกลุ่มหรือเปลี่ยนตัวแอดมิน
 */
function testLineTargets() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  if (!token) {
    console.log('❌ ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN — ยังส่งอะไรไม่ได้');
    return;
  }

  const stamp = Utilities.formatDate(new Date(), TIMEZONE, 'd MMM yyyy HH:mm');
  const problems = [];
  let sent = 0;

  Object.keys(LINE_TARGET_BY_AUDIENCE).forEach(function (audience) {
    const key = LINE_TARGET_BY_AUDIENCE[audience];
    const targets = parseLineTargets_(props.getProperty(key));

    if (targets.length === 0) {
      // ไม่ใช่ error เสมอไป — ถ้าไม่ตั้ง ระบบจะไปใช้ LINE_TARGET_ADMIN แทน
      // แต่ต้องรู้ตัว เพราะแปลว่ากลุ่มแอดมินจะได้ข้อความของกลุ่มอื่นไปด้วยทุกวัน
      problems.push('⚠️  ' + key + ' ยังไม่ได้ตั้ง — ข้อความของ "' + audience +
        '" จะไหลไปเข้า ' + LINE_TARGET_FALLBACK + ' แทน');
      return;
    }

    targets.forEach(function (to) {
      const result = probeLineTarget_(token, to, stamp, key);
      if (result.ok) {
        sent++;
        console.log('✅ ' + key + ' → ' + maskLineId_(to));
      } else {
        problems.push('❌ ' + key + ' → ' + maskLineId_(to) + '\n      ' + result.detail);
      }
    });
  });

  // ⚠️ ค่าเดียวกันนี้เป็นประตูของ dashboard ด้วย ไม่ใช่แค่ปลายทางแจ้งเตือน
  // พิมพ์ออกมาทุกครั้งที่ตรวจ เพื่อให้คนที่เพิ่งเพิ่มกลุ่มเห็นผลข้างเคียงทันที
  // ไม่ใช่รู้ตัวตอนที่มีคนเข้าดูข้อมูลผู้ป่วยได้โดยไม่มีใครตั้งใจให้เข้า
  const dashboardGroups = dashboardLineGroups_();
  console.log('');
  console.log('กลุ่มที่เข้า dashboard ด้วย LINE ได้ตอนนี้: ' +
    dashboardGroups.length + ' กลุ่ม');
  dashboardGroups.forEach(function (id) {
    console.log('   • ' + maskLineId_(id));
  });
  if (dashboardGroups.length === 0) {
    console.log('   (ไม่มี — ยังไม่มีใครเข้าระบบด้วย LINE ได้)');
  }

  console.log('');
  if (problems.length === 0) {
    console.log('ส่งข้อความทดสอบสำเร็จครบ ' + sent + ' ปลายทาง');
    console.log('ไปเปิด LINE ดูว่าได้รับจริงทุกที่ — ตอบ 200 ไม่ได้แปลว่ามีคนเห็น');
  } else {
    console.log('ส่งสำเร็จ ' + sent + ' ปลายทาง / มีปัญหา ' + problems.length + ' รายการ:');
    problems.forEach(function (p) { console.log('   ' + p); });
  }
}

/** ส่งข้อความทดสอบหนึ่งครั้ง คืนผลแทนการเขียน log อย่างเดียว */
function probeLineTarget_(token, to, stamp, key) {
  try {
    const response = UrlFetchApp.fetch(LINE_PUSH_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        to: to,
        messages: [{
          type: 'text',
          text: '🔧 ทดสอบการแจ้งเตือน (' + key + ')\n' + stamp +
            '\n\nได้รับข้อความนี้แปลว่าปลายทางใช้งานได้ ไม่ต้องดำเนินการอะไร',
        }],
      }),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    if (code === 200) return { ok: true, detail: '' };

    // 403 = บอทถูกเตะออกจากกลุ่ม หรือผู้ใช้บล็อกบัญชี
    // 400 = id ผิดรูปแบบ (คัดลอกมาไม่ครบ หรือใส่ชื่อกลุ่มแทน id)
    // 401 = token ผิดหรือหมดอายุ
    const hint =
      code === 403 ? 'บอทไม่ได้อยู่ในกลุ่มนี้แล้ว หรือผู้ใช้บล็อกบัญชีไว้' :
      code === 400 ? 'id ผิดรูปแบบ — ตรวจว่าคัดลอกมาครบและไม่มีอักขระแปลกปน' :
      code === 401 ? 'LINE_CHANNEL_ACCESS_TOKEN ผิดหรือหมดอายุ' :
      'ดูรายละเอียดใน Executions';
    return { ok: false, detail: 'HTTP ' + code + ' — ' + hint };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}

/**
 * ปิดกลาง id ก่อนเขียนลง log
 *
 * Execution log ถูกคัดลอกไปวางในแชทเพื่อขอความช่วยเหลือบ่อย ๆ
 * และ LINE id เป็นสิ่งที่ใครถือไปก็ยิงข้อความเข้ากลุ่มได้ทันทีหากมี token
 * แสดงหัวกับท้ายพอให้แยกออกว่าเป็นปลายทางไหน โดยไม่ให้ค่าที่ใช้งานได้จริง
 */
function maskLineId_(id) {
  const s = String(id);
  if (s.length <= 10) return s.charAt(0) + '…';
  return s.slice(0, 5) + '…' + s.slice(-4);
}

/**
 * รอบแจ้งเตือนรวมวันละครั้ง เวลา 10:00 น. ของวันทำการ
 *
 * รวมเคสค้างทั้งหมดส่งเป็นข้อความเดียว โดยปักหมุด Yellow Alert ไว้บนสุด
 * ไม่มีการแจ้งเตือนนอกรอบนี้ เพื่อปกป้องเวลาเรียนของแพทย์ประจำบ้าน
 * (ยกเว้น Red Alert ซึ่งเป็นตาข่ายนิรภัยชั้นสุดท้าย)
 */
/**
 * รายชื่อ resident ที่อยู่เวรตอบคำปรึกษา ณ วันที่กำหนด ตามชีต resident_schedule
 *
 * หนึ่งแถว = หนึ่งคนหนึ่งช่วง (รวมวันแรกและวันสุดท้าย) ช่วงเหลื่อมกันได้
 * แลกเวรกัน = แก้แถวในชีตตรง ๆ ระบบอ่านสดทุกครั้ง ไม่มี cache
 *
 * คืน [] เมื่อชีตยังไม่ถูกสร้างหรืออ่านไม่ได้ — การแจ้งเตือนรายวันต้องไม่ตาย
 * เพียงเพราะตารางเวรยังไม่พร้อม (ข้อความจะเตือนให้เติมตารางแทน)
 */
function onDutyResidents_(date) {
  try {
    const rows = readRows_(getSheet_(SHEETS.residentSchedule));
    const found = [];
    rows.forEach(function (r) {
      const from = toDate_(r['from_date']);
      const to = toDate_(r['to_date']);
      const name = String(r['resident_name'] || '').trim();
      if (!from || !to || !name) return;
      const start = new Date(from); start.setHours(0, 0, 0, 0);
      const end = new Date(to); end.setHours(23, 59, 59, 999);
      if (date >= start && date <= end) found.push({ name: name, until: to });
    });
    return found;
  } catch (error) {
    console.error('อ่านตารางเวร resident ไม่ได้: ' + error);
    return [];
  }
}

function sendDailyBatch() {
  const holidays = loadHolidays_();
  const now = new Date();
  if (!isWorkingDay_(now, holidays)) return;

  const sheet = getSheet_(SHEETS.referrals);
  const map = headerMap_(sheet);

  // เนื้อหาแยกตามกลุ่ม (คำขอผู้ใช้ 7 ก.ย. 2569):
  //   fellow   → นัด fellow วันนี้ + พรุ่งนี้
  //   resident → เคสค้าง + รายละเอียด + ผู้ต้องดู + ปุ่มอ่านแต่ละเคส
  //   admin    → ได้ทั้ง fellow และ resident
  const resident = buildResidentDigest_(now);   // { text, buttons }
  const fellow = buildFellowDigest_(now);         // text

  sendTelegram_(resident.text, 'batch', resident.buttons);
  sendTelegram_(fellow, 'fellow');
  // admin: เตือนเฉพาะเคสค้างตาม SLA — เหลือง (ใกล้ครบ) / แดง (เกินกำหนดยังไม่ปิด)
  // ไม่รับ real-time (คำขอผู้ใช้ 7 ก.ย. 2569) ดูรอบ 10:00 รอบเดียวพอ
  // รอบนี้คือผู้ส่งสรุปแอดมิน "คนเดียว" ของวัน — markSent=true ประทับ red_alert_sent_at
  // และจดวันที่ไว้ให้ sendRedAlert (trigger อีกตัวที่ 10:00 เหมือนกัน) ข้ามไป
  // (14 ก.ย. 2569: สองตัวยิงคนละนาทีในชั่วโมงเดียวกัน กลุ่มแอดมินได้สรุปซ้ำ 2 รอบ)
  const adminMsg = buildAdminAlertMessage_(now, true);
  sendTelegram_(
    adminMsg || ('✅ ไม่มีเคสเกินกำหนด/ใกล้ครบ — ' + formatThaiDate_(now)),
    'red');
  markAdminAlertSentToday_(now);

  // ยังเปิดทาง LINE ถ้าเปิดสวิตช์ line_push (สรุป resident แบบข้อความ ไม่มีปุ่ม)
  if (linePushEnabled_()) {
    pushLineMessage_(resident.text, 'batch');
  }

  // ประทับว่าแจ้ง Yellow ไปแล้ว เพื่อดูย้อนหลังว่าเคสถูกเตือนกี่รอบ
  const nowTs = new Date();
  readRows_(sheet).forEach(function (r) {
    if (!isTerminal_(r['status']) && r['referral_id'] &&
        String(r['alert_level']) === 'yellow' && !r['yellow_alert_sent_at']) {
      setCell_(sheet, map, r._row, 'yellow_alert_sent_at', nowTs);
    }
  });
}

/**
 * แจ้งกลุ่ม resident ทันทีเมื่อมีเคสกลุ่ม 2/3 ใหม่ (real-time)
 * เรียกจาก onFormSubmit หลังมอบหมายเคสเสร็จ · มีปุ่มกดอ่านเคส
 * (คำขอผู้ใช้ 7 ก.ย. 2569 — เคสใหม่ให้เด้งเลย ไม่รอรอบ 10:00)
 */
function notifyResidentNewCase_(referralId, groupNo, assignedTo, patient, diagnosis, org) {
  const buttons = [{
    text: '📖 อ่าน ' + referralId,
    url: SITE_URL + '/dashboard/review#' + referralId,
  }];
  sendTelegram_(
    '🆕 เคสใหม่กลุ่ม ' + groupNo + ' รอตอบ\n' +
    '────────────────\n' +
    'เลขที่: ' + referralId + '\n' +
    '👤 ' + patient + ' · ' + diagnosis + '\n' +
    '🩺 ผู้รับผิดชอบเคส: ' + (assignedTo || 'ยังไม่มอบหมาย') + '\n' +
    '🏥 จาก: ' + (org || '-'),
    'batch', buttons);
}

/**
 * แจ้ง fellow เมื่อมีผู้ป่วยจองคิวมาพบในวันที่ตนออกตรวจ (กลุ่มที่ 1)
 *
 * อาจารย์กำหนดให้ส่ง เพศ อายุ และโรค ได้ — ไม่มีชื่อและ HN จึงไม่ระบุตัวผู้ป่วย
 * นี่เป็นข้อยกเว้นเดียวของ PDPA-003 ข้อความ LINE อื่นห้ามมีข้อมูลผู้ป่วย
 *
 * ⚠️ ข้อจำกัดที่ยังแก้ไม่ได้: pushLineMessage_ ส่งไปที่ LINE_TARGET_FELLOW
 * ซึ่งเป็น group ID — fellow ทุกคนในกลุ่มเห็นข้อความนี้ ไม่ใช่เฉพาะคนที่ถูกจอง
 * ข้อความจึงต้องขึ้นชื่อ fellow ให้ชัดว่าเป็นคิวของใคร
 * การส่งถึงตัวบุคคลต้องรู้ userId ซึ่งต้องมี LINE Login + LIFF ก่อน
 *
 * @param {{referralId: string, clinicDate: string, fellowName: string,
 *          referrerOrg: string, patientSex: string, patientAge: string,
 *          diagnosis: string}} booking ผลจาก bookTransplantSlot_
 */
/**
 * วันนัดใกล้พอที่จะรอรอบ 10:00 น. ไม่ได้หรือยัง
 *
 * นับเป็นวันปฏิทิน ไม่ใช่วันทำการ โดยเจตนา — จองบ่ายวันศุกร์ให้มาวันจันทร์
 * ถ้านับวันทำการจะเหลือ "1 วัน" แล้วผ่านเกณฑ์ ทั้งที่ fellow มีเวลาเตรียมตัว
 * จริงแค่เช้าวันจันทร์ก่อนคลินิกเริ่ม
 */
function isUrgentClinicDate_(clinicDate) {
  const date = toDate_(clinicDate);
  if (!date) return true; // อ่านวันไม่ออก แจ้งทันทีไว้ก่อน ปลอดภัยกว่าเงียบ

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  return days <= FELLOW_URGENT_DAYS;
}

/**
 * สรุปนัดใหม่ของ fellow รอบเดียวตอน 10:00 น. พร้อมรอบของ resident
 *
 * ⚠️ ทำไมต้องรวมรอบ
 *
 * การยิงทีละนัดทำให้จำนวนข้อความ LINE โตตามจำนวนเคส ซึ่งเป็นจุดเดียวในระบบ
 * ที่โตแบบนั้น — 300 เคสต่อเดือนคือ 300 ข้อความ ส่วนรอบรวมคือ 22 ไม่ว่าจะกี่เคส
 *
 * นัดที่ใกล้ถึงภายใน FELLOW_URGENT_DAYS วันไม่ผ่านทางนี้ ถูกแจ้งทันทีไปแล้ว
 * ตอนจอง (ดู notifyFellowOfBooking_) เพราะรอรอบถัดไปอาจสายเกินไป
 *
 * ใช้คอลัมน์ fellow_notified_at กันแจ้งซ้ำ แทนการเดาจากช่วงเวลา —
 * รอบที่ล้มไปหนึ่งวันจะเก็บตกให้เองในรอบถัดไป ไม่มีนัดไหนหายไปเงียบ ๆ
 */
function sendFellowDailyBatch() {
  const holidays = loadHolidays_();
  const now = new Date();
  if (!isWorkingDay_(now, holidays)) return;

  const sheet = getSheet_(SHEETS.referrals);
  const map = ensureColumns_(sheet, ['fellow_notified_at']);
  const rows = readRows_(sheet);

  const fresh = rows.filter(function (r) {
    if (String(r['referral_type']) !== TYPES.transplant) return false;
    if (String(r['status']) !== 'Appointment Confirmed') return false;
    if (!r['appointment_date']) return false;
    if (String(r['fellow_notified_at'] || '').trim()) return false;
    return true;
  });

  if (fresh.length === 0) return;

  fresh.sort(function (a, b) {
    return String(a['appointment_date']).localeCompare(String(b['appointment_date']));
  });

  let message = '🧬 นัดใหม่ของ fellow ' + formatThaiDate_(now) + '\n';
  message += '────────────────\n';
  message += 'มีผู้ป่วยจองคิวเข้ามา ' + fresh.length + ' ราย\n\n';

  fresh.forEach(function (r) {
    message +=
      '• ' + formatThaiDate_(toDate_(r['appointment_date'])) +
        ' — ' + (r['fellow_assigned'] || '-') + '\n' +
      '  ' + (r['referral_id'] || '-') + ' · ' +
        (r['patient_sex'] || '-') + ' อายุ ' + (r['patient_age'] || '-') + ' ปี\n' +
      '  ' + (r['diagnosis'] || '-') + '\n' +
      '  จาก ' + (r['referrer_org'] || '-') + '\n\n';
  });

  message += 'เบอร์แพทย์ต้นทางและรายละเอียดโรค ดูที่\n' + SITE_URL + '/dashboard/appointments';

  sendTeamNotify_(message, 'fellow');

  // ประทับเวลาหลังส่งสำเร็จเท่านั้น — ถ้า push ล้ม ให้รอบถัดไปลองใหม่
  fresh.forEach(function (r) {
    setCell_(sheet, map, r._row, 'fellow_notified_at', now);
  });

  console.log('แจ้ง fellow รอบรวมแล้ว ' + fresh.length + ' นัด');
}

function notifyFellowOfBooking_(booking) {
  // การแจ้งเตือนล้มเหลวต้องไม่ทำให้การจองที่เขียนลงชีตแล้วกลายเป็นล้มเหลวตามไปด้วย
  // แพทย์ต้นทางได้เลขนัดไปแล้ว ถ้าโยน error ต่อ หน้าเว็บจะบอกว่าจองไม่สำเร็จทั้งที่สำเร็จ
  try {
    // นัดที่ยังอีกหลายวัน รอรอบ 10:00 น. ได้ — sendFellowDailyBatch() จะเก็บไปเอง
    // ยิงทีละนัดทำให้จำนวนข้อความโตตามจำนวนเคส ซึ่งเป็นตัวเดียวในระบบที่โตแบบนั้น
    if (!isUrgentClinicDate_(booking.clinicDate)) return;

    const message =
      '🧬 มีผู้ป่วยจองคิวมาพบ (นัดใกล้ถึงแล้ว)\n' +
      '────────────────\n' +
      'แพทย์ผู้ตรวจ: ' + (booking.fellowName || '-') + '\n' +
      'วันนัด: ' + formatThaiDate_(booking.clinicDate) + ' เวลา 08:00 น.\n' +
      'เลขที่อ้างอิง: ' + (booking.referralId || '-') + '\n' +
      'ส่งมาจาก: ' + (booking.referrerOrg || '-') + '\n' +
      'ผู้ป่วย: ' + (booking.patientSex || '-') +
        ' อายุ ' + (booking.patientAge || '-') + ' ปี\n' +
      'การวินิจฉัย: ' + (booking.diagnosis || '-') + '\n' +
      (booking.indication ? 'ข้อบ่งชี้ (I/C): ' + booking.indication + '\n' : '') +
      '\nรายละเอียดเพิ่มเติม: ' + DASHBOARD_URL;

    sendTeamNotify_(message, 'fellow');

    // ประทับว่าแจ้งแล้ว ไม่งั้นรอบ 10:00 น. จะหยิบนัดนี้ไปแจ้งซ้ำอีกครั้ง
    markFellowNotified_(booking.referralId);
  } catch (err) {
    console.error(
      'แจ้ง fellow ไม่สำเร็จ (' + (booking && booking.referralId) + '): ' + err
    );
  }
}

/**
 * ประทับ fellow_notified_at ให้เคสหนึ่ง จากเลขที่อ้างอิง
 *
 * แยกเป็นฟังก์ชันเพราะ notifyFellowOfBooking_() ได้มาแต่ก้อนข้อมูลการจอง
 * ไม่ได้ถือเลขแถวไว้ — และมันทำงานนอกล็อกโดยตั้งใจ (ดู bookTransplantSlot_)
 * จึงต้องหาแถวเองอีกครั้ง
 *
 * ล้มเหลวได้โดยไม่ทำให้อะไรพัง — ผลที่แย่ที่สุดคือ fellow ได้ข้อความซ้ำหนึ่งครั้ง
 * ซึ่งดีกว่าการทำให้การแจ้งเตือนทั้งก้อนล้ม
 */
function markFellowNotified_(referralId) {
  if (!referralId) return;
  try {
    const sheet = getSheet_(SHEETS.referrals);
    const map = ensureColumns_(sheet, ['fellow_notified_at']);
    const rows = readRows_(sheet);

    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i]['referral_id'] || '').trim() === referralId) {
        setCell_(sheet, map, rows[i]._row, 'fellow_notified_at', new Date());
        return;
      }
    }
  } catch (err) {
    console.warn('ประทับ fellow_notified_at ไม่สำเร็จ (' + referralId + '): ' + err);
  }
}

/**
 * แจ้งผู้ดูแลระบบเมื่อพบว่าการตั้งค่าฟอร์มกับโค้ดไม่ตรงกัน
 *
 * ปัญหาแบบนี้ทำให้เคสหายจาก dashboard โดยไม่มีใครรู้ จึงต้องแจ้งทันที
 * ไม่รอรอบ 10:00 น. เพราะเป็นความผิดพลาดของระบบ ไม่ใช่ภาระงานปกติ
 */
function notifyConfigProblem_(detail) {
  sendTeamNotify_(
    '🛠️ ระบบตั้งค่าไม่ตรงกัน\n' +
      detail.split('\n').slice(0, 2).join('\n') +
      '\nดูรายละเอียดใน Apps Script → Executions',
    'red'
  );
}

// formatThaiDate_ ย้ายไปอยู่ที่ Util.gs แล้ว ดูคำเตือนเรื่องชื่อซ้ำที่นั่น

/**
 * แจ้ง fellow ว่านัดถูกยกเลิก
 *
 * fellow ถูกแจ้งตอนมีคนจอง ถ้าไม่แจ้งตอนยกเลิกด้วย เขาจะเตรียมตัวรอผู้ป่วย
 * ที่ไม่มาแล้ว และจะเข้าใจว่าผู้ป่วยผิดนัดทั้งที่แพทย์ต้นทางแจ้งล่วงหน้าแล้ว
 *
 * ไม่มีข้อมูลผู้ป่วยในข้อความนี้เลย — การยกเลิกไม่จำเป็นต้องรู้ว่าเป็นใคร
 * รู้แค่ว่าคิวไหนว่างคืนมาก็พอ (แคบกว่าข้อความตอนจองโดยตั้งใจ)
 */
function notifyFellowOfCancellation_(booking) {
  try {
    sendTeamNotify_(
      '❌ นัดถูกยกเลิก\n' +
      '────────────────\n' +
      'แพทย์ผู้ตรวจ: ' + (booking.fellowName || '-') + '\n' +
      'วันที่เคยนัด: ' + formatThaiDate_(booking.clinicDate) + '\n' +
      'เลขที่อ้างอิง: ' + (booking.referralId || '-') + '\n' +
      'ยกเลิกโดย: แพทย์ต้นทาง (' + (booking.referrerOrg || '-') + ')\n\n' +
      'คิวนี้ว่างกลับเข้าปฏิทินแล้ว',
      'fellow'
    );
  } catch (err) {
    console.error('แจ้งยกเลิกให้ fellow ไม่สำเร็จ: ' + err);
  }
}

/**
 * แจ้ง fellow ว่านัดถูกเลื่อน
 *
 * ส่งข้อความเดียวที่บอกทั้งวันเก่าและวันใหม่ ไม่แยกเป็น "ยกเลิก" กับ "จองใหม่"
 * สองฉบับ เพราะในกลุ่มจะอ่านแล้วเข้าใจว่าเป็นผู้ป่วยคนละคน
 */
function notifyFellowOfReschedule_(booking) {
  try {
    sendTeamNotify_(
      '🔄 เลื่อนนัด\n' +
      '────────────────\n' +
      'เลขที่อ้างอิง: ' + (booking.referralId || '-') + '\n' +
      'จาก: ' + formatThaiDate_(booking.previousDate) +
        ' (' + (booking.previousFellow || '-') + ')\n' +
      'เป็น: ' + formatThaiDate_(booking.clinicDate) +
        ' (' + (booking.fellowName || '-') + ') เวลา 08:00 น.\n' +
      'ผู้ป่วย: ' + (booking.patientSex || '-') +
        ' อายุ ' + (booking.patientAge || '-') + ' ปี\n' +
      'การวินิจฉัย: ' + (booking.diagnosis || '-') + '\n\n' +
      'รายละเอียดเพิ่มเติม: ' + DASHBOARD_URL,
      'fellow'
    );
  } catch (err) {
    console.error('แจ้งเลื่อนนัดให้ fellow ไม่สำเร็จ: ' + err);
  }
}

/**
 * ส่งรหัสยืนยันการผูกบัญชี LINE ไปที่อีเมลที่ลงทะเบียนไว้
 *
 * ⚠️ ปลายทางมาจากชีตเสมอ ไม่ใช่จากสิ่งที่ผู้ใช้พิมพ์เข้ามา
 * นี่คือสิ่งเดียวที่ทำให้การผูกด้วยเบอร์โทรปลอดภัย
 */
function sendLinkCodeEmail_(email, code) {
  try {
    MailApp.sendEmail({
      to: email,
      subject: 'รหัสยืนยันการผูก LINE — ระบบส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช',
      body:
        'มีการขอผูกบัญชี LINE กับอีเมลนี้\n\n' +
        'รหัสยืนยัน: ' + code + '\n' +
        '(ใช้ได้ 10 นาที)\n\n' +
        'นำรหัสนี้ไปพิมพ์ในแชท LINE ของระบบเพื่อยืนยัน\n\n' +
        'ผูกแล้วจะได้อะไร: เมื่อทีมตอบคำปรึกษา ระบบจะส่งลิงก์เปิดคำตอบ\n' +
        'มาที่ LINE ให้ทันที ไม่ต้องค้นอีเมลอีก (อีเมลยังส่งตามปกติ)\n\n' +
        '⚠️ หากท่านไม่ได้เป็นผู้ขอ กรุณาเพิกเฉยต่ออีเมลนี้\n' +
        'ไม่มีการผูกบัญชีใดเกิดขึ้นจนกว่าจะมีผู้กรอกรหัสนี้\n\n' +
        '--\n' +
        'ระบบส่งต่อผู้ป่วยนอก สาขาวิชาโลหิตวิทยา โรงพยาบาลศิริราช\n' +
        'อีเมลนี้ส่งจากระบบอัตโนมัติ กรุณาอย่าตอบกลับ',
    });
  } catch (err) {
    console.error('ส่งรหัสผูกบัญชีไม่สำเร็จ: ' + err);
  }
}

/**
 * เด้งลิงก์คำตอบเข้า LINE ของแพทย์ต้นทางที่ผูกบัญชีไว้
 *
 * ⚠️ ส่งแค่ "ลิงก์" ไม่ส่งเนื้อคำตอบ — PDPA-003 ห้ามข้อมูลผู้ป่วยใน LINE
 * เนื้อหาอยู่บนเว็บหลัง token ที่เดาไม่ได้
 *
 * ไม่ผูกไว้ก็ไม่เกิดอะไรขึ้น เงียบไป แล้วเขาได้อีเมลตามปกติ
 * ล้มเหลวได้โดยไม่ทำให้การบันทึกคำตอบล้มตาม
 */
function notifyReferrerOnLine_(row, answerToken) {
  if (!linePushEnabled_()) return false; // ปิด push — แพทย์ต้นทางรับทางอีเมล/ถามบอทเอง
  try {
    const userId = findLineUserByPhone_(row['referrer_phone']);
    // ไม่ได้ผูกบัญชี — ไม่ใช่ความผิดพลาด แค่ยังไม่มีปลายทาง LINE
    if (!userId) return false;

    const token = PropertiesService.getScriptProperties()
      .getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    if (!token) return false;

    const referralId = String(row['referral_id'] || '').trim();
    // ข้อความต่างตามสถานะ — เคส "ขอข้อมูลเพิ่ม" ไม่ใช่คำตอบสุดท้าย
    // (ให้ตรงกับอีเมล — feedback 5 ก.ย. 2569)
    const isIncomplete = String(row['status'] || '') === 'Incomplete';
    const notice = isIncomplete
      ? 'ทีมโลหิตวิทยาขอข้อมูลเพิ่มเติมสำหรับเคส ' + referralId
      : 'ทีมโลหิตวิทยาตอบคำปรึกษา ' + referralId + ' แล้ว';
    const msg = linkButtonMessage_(
      notice,
      isIncomplete ? 'ดูรายละเอียด' : 'เปิดคำตอบ',
      SITE_URL + '/answer/' + answerToken
    );
    // เมื่อเป็นคำตอบสุดท้าย ให้ปุ่มลัด "จบเคส / ถามเพิ่ม" ใน LINE เลย
    // (ตอบด้วยการแตะปุ่ม = ส่งข้อความกลับ บอทจัดการต่อ — ดู handleReferrerCommand_)
    const messages = isIncomplete ? [msg] : [withQuickReply_(msg, [
      { label: '✓ พอใจ จบเคส', text: 'จบเคส ' + referralId },
      { label: '💬 ถามเพิ่ม', text: 'ถามเพิ่ม ' + referralId },
    ])];
    return sendOneLineMessage_(token, userId, messages);
  } catch (err) {
    console.error('เด้งลิงก์คำตอบเข้า LINE ไม่สำเร็จ: ' + err);
    return false;
  }
}

/** ส่ง message object ชุดหนึ่งไปหาปลายทางเดียว — ใช้ตอนต้องแนบปุ่ม */
function sendOneLineMessage_(token, to, messages) {
  try {
    const response = UrlFetchApp.fetch(LINE_PUSH_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ to: to, messages: messages.slice(0, 5) }),
      muteHttpExceptions: true,
    });
    if (response.getResponseCode() !== 200) {
      console.error('ส่ง LINE ไม่สำเร็จ (' + response.getResponseCode() + '): ' +
        response.getContentText());
      return false;
    }
    return true;
  } catch (err) {
    console.error('ส่ง LINE ไม่สำเร็จ ปลายทาง ' + to + ': ' + err);
    return false;
  }
}

/** คำชวนผูก LINE ท้ายอีเมล — จุดที่คนกำลังรู้สึกถึงความยุ่งยากพอดี */
function buildLineLinkInvite_() {
  return (
    '--- ครั้งหน้าไม่ต้องเปิดอีเมล ---\n\n' +
    'ผูก LINE ครั้งเดียว แล้วคำตอบจะเด้งเข้า LINE พร้อมปุ่มเปิดอ่านทันที\n' +
    '  1. แอด LINE ' + LINE_OA_ID + '\n' +
    '  2. กดปุ่ม "ผูกบัญชี" (หรือพิมพ์ว่า ผูกบัญชี)\n' +
    '  3. พิมพ์เบอร์โทรที่ใช้ส่งเคส แล้วกรอกรหัสที่ส่งมาทางอีเมล\n\n'
  );
}
