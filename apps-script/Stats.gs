/**
 * สรุปสถิติรายเดือน (ชุดข้อมูลที่ 3 ตาม PDPA-005)
 *
 * ตั้ง trigger สิ้นเดือน
 * ข้อมูลชุดนี้เป็นตัวเลขรวมล้วน ไม่มีข้อมูลรายบุคคล จึงเก็บถาวรได้
 * ใช้ทำรายงานและ KPI ตาม SRS §23
 */

const STATS_COLUMNS = [
  'year_month',
  'referral_type',
  'disease_group',
  'count',
  'avg_turnaround_business_hours',
  'incomplete_count',
  'yellow_alert_count',
  'red_alert_count',
];

function buildMonthlyStats() {
  const target = previousMonth_();
  const yearMonth = Utilities.formatDate(target, TIMEZONE, 'yyyy-MM');

  const sheet = getSheet_(SHEETS.referrals);
  const stats = getSheet_(SHEETS.statsMonthly);
  const rows = readRows_(sheet);

  ensureStatsHeader_(stats);

  const inMonth = rows.filter(function (r) {
    const submittedAt = toDate_(r['submitted_at'] || r['Timestamp']);
    if (!submittedAt) return false;
    return Utilities.formatDate(submittedAt, TIMEZONE, 'yyyy-MM') === yearMonth;
  });

  if (inMonth.length === 0) {
    console.log('ไม่มีเคสในเดือน ' + yearMonth);
    return;
  }

  // จัดกลุ่มตาม referral_type + disease_group
  const buckets = {};
  inMonth.forEach(function (r) {
    const type = String(r['referral_type'] || '-');
    const group = String(r['disease_group'] || '-');
    const key = type + '||' + group;

    if (!buckets[key]) {
      buckets[key] = {
        type: type,
        group: group,
        count: 0,
        hoursSum: 0,
        hoursN: 0,
        incomplete: 0,
        yellow: 0,
        red: 0,
      };
    }

    const b = buckets[key];
    b.count++;

    // นับ turnaround เฉพาะเคสที่จบแล้ว มิฉะนั้นค่าเฉลี่ยจะเพี้ยน
    if (isTerminal_(r['status'])) {
      const h = Number(r['elapsed_business_hours']);
      if (isFinite(h)) {
        b.hoursSum += h;
        b.hoursN++;
      }
    }

    if (String(r['status']) === 'Incomplete') b.incomplete++;
    if (r['yellow_alert_sent_at']) b.yellow++;
    if (r['red_alert_sent_at']) b.red++;
  });

  const output = Object.keys(buckets).map(function (key) {
    const b = buckets[key];
    const avg = b.hoursN > 0 ? Math.round((b.hoursSum / b.hoursN) * 10) / 10 : '';
    return [yearMonth, b.type, b.group, b.count, avg, b.incomplete, b.yellow, b.red];
  });

  // ลบสถิติเดือนเดียวกันที่เคยสร้างไว้ กันข้อมูลซ้ำเมื่อรันซ้ำ
  removeExistingMonth_(stats, yearMonth);

  stats
    .getRange(stats.getLastRow() + 1, 1, output.length, STATS_COLUMNS.length)
    .setValues(output);

  console.log('สร้างสถิติเดือน ' + yearMonth + ' แล้ว ' + output.length + ' แถว');
}

function ensureStatsHeader_(stats) {
  if (stats.getLastRow() >= 1 && stats.getLastColumn() >= STATS_COLUMNS.length) return;
  stats.getRange(1, 1, 1, STATS_COLUMNS.length).setValues([STATS_COLUMNS]);
}

function removeExistingMonth_(stats, yearMonth) {
  const rows = readRows_(stats);
  rows
    .filter(function (r) { return String(r['year_month']) === yearMonth; })
    .map(function (r) { return r._row; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (rowNumber) { stats.deleteRow(rowNumber); });
}

function previousMonth_() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d;
}
