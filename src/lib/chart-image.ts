/**
 * บันทึกกราฟเป็นไฟล์รูป PNG สำหรับเอาไปวางในสไลด์
 *
 * ⚠️ client-only — วาดลงบน <canvas>
 *
 * ⚠️ วาดใหม่จากตัวเลข ไม่ได้ถ่ายภาพจากหน้าจอ
 *
 * การถ่ายภาพ DOM ต้องพึ่งไลบรารีภายนอกที่ต้องคอยอัปเดตตาม CSS ที่รองรับ
 * และได้ภาพเท่าขนาดที่เห็นบนจอ ซึ่งเบลอทันทีที่ฉายขึ้นโปรเจกเตอร์
 * วาดใหม่เองได้ภาพความละเอียดสองเท่า พื้นหลังขาวทึบ และมีหัวข้อกับวันที่
 * ติดอยู่ในรูป — สไลด์ที่หลุดออกจากบริบทจึงยังบอกได้ว่าเป็นข้อมูลของเมื่อไร
 *
 * ⚠️ ต้องรอ document.fonts.ready ก่อนวัดความกว้างตัวอักษร
 * ถ้าวาดตอนฟอนต์ยังโหลดไม่เสร็จ ความกว้างที่วัดได้จะเป็นของฟอนต์สำรอง
 * แล้วข้อความไทยจะถูกตัดผิดตำแหน่งหรือล้นออกนอกกรอบ
 */

import { GRID, SERIES, SINGLE } from "@/components/charts/palette";
import { safeFileName, saveBlob } from "./download";

export interface ChartDatum {
  label: string;
  count: number;
  seriesIndex?: number;
}

/** ความละเอียดเป็นสองเท่าของขนาดที่จัดวาง — ภาพในสไลด์จึงไม่แตก */
const SCALE = 2;
const PAD = 32;

const INK = "#18181b";
const MUTED = "#71717a";
const BG = "#ffffff";

const TITLE_H = 28;
const SUBTITLE_H = 22;
const FOOT_H = 20;

/** สูงต่อหนึ่งแถวของกราฟแท่งแนวนอน — ชื่อ 20 + แท่ง 10 + ช่องไฟ 16 */
const ROW_H = 46;
const BAR_H = 10;

const CATEGORY_W = 900;
const MONTH_COL_W = 64;
const MONTH_PLOT_H = 220;

export interface ChartMeta {
  title: string;
  /** บรรทัดเล็กใต้หัวข้อ — ถ้าไม่ส่งมาจะใช้ชื่อระบบกับวันที่ที่บันทึก */
  subtitle?: string;
  footnote?: string;
}

/**
 * บันทึกกราฟแท่งแนวนอนเป็น PNG
 *
 * วาดครบทุกแถวที่ส่งเข้ามา ไม่ตัดที่ 8 แถวเหมือนบนหน้าจอ — คนที่กดบันทึกรูป
 * กำลังจะเอาไปเป็นหลักฐานในรายงาน ภาพที่ตัดข้อมูลทิ้งเงียบ ๆ ใช้ไม่ได้
 */
export async function saveCategoryChart(
  data: ChartDatum[],
  meta: ChartMeta,
  max?: number,
): Promise<void> {
  if (data.length === 0) return;

  const headerH = headerHeight();
  const height =
    headerH + data.length * ROW_H + (meta.footnote ? FOOT_H : 0) + PAD;

  const canvas = await createCanvas(CATEGORY_W, height);
  const ctx = canvas.getContext("2d")!;
  const font = await drawHeader(ctx, CATEGORY_W, meta);

  const scale = max ?? Math.max(...data.map((d) => d.count), 1);
  const trackW = CATEGORY_W - PAD * 2;
  let y = headerH;

  for (const d of data) {
    const color =
      d.seriesIndex === undefined
        ? SINGLE
        : SERIES[d.seriesIndex % SERIES.length];

    // ตัวเลขวางชิดขวาก่อน แล้วค่อยรู้ว่าเหลือที่ให้ชื่อเท่าไร
    ctx.font = `600 15px ${font}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "right";
    ctx.fillText(String(d.count), CATEGORY_W - PAD, y);
    const countW = ctx.measureText(String(d.count)).width;

    ctx.font = `15px ${font}`;
    ctx.fillStyle = "#3f3f46";
    ctx.textAlign = "left";
    ctx.fillText(ellipsize(ctx, d.label, trackW - countW - 16), PAD, y);

    y += 20;
    pill(ctx, PAD, y, trackW, BAR_H, GRID);
    if (d.count > 0) {
      const w = scale > 0 ? (d.count / scale) * trackW : 0;
      pill(ctx, PAD, y, Math.max(w, 3), BAR_H, color);
    }
    y += ROW_H - 20;
  }

  drawFootnote(ctx, y, meta);
  await save(canvas, meta.title);
}

/** บันทึกกราฟแท่งตั้งรายเดือนเป็น PNG */
export async function saveMonthlyChart(
  data: { label: string; count: number }[],
  meta: ChartMeta,
): Promise<void> {
  if (data.length === 0) return;

  const headerH = headerHeight();
  const width = Math.max(720, data.length * MONTH_COL_W + PAD * 2);
  // ตัวเลขบนแท่ง 18 + พื้นที่แท่ง + ช่องไฟ 8 + ชื่อเดือน 16
  const height =
    headerH + 18 + MONTH_PLOT_H + 8 + 16 + (meta.footnote ? FOOT_H : 0) + PAD;

  const canvas = await createCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  const font = await drawHeader(ctx, width, meta);

  const max = Math.max(...data.map((d) => d.count), 1);
  const baseY = headerH + 18 + MONTH_PLOT_H;
  const barW = MONTH_COL_W - 14;

  ctx.textAlign = "center";
  data.forEach((d, i) => {
    const cx = PAD + i * MONTH_COL_W + MONTH_COL_W / 2;
    // เดือนที่ไม่มีเคสต้องเห็นเป็นแท่งจาง ๆ ไม่ใช่ช่องว่าง
    // ไม่งั้นจะอ่านเป็น "ไม่มีข้อมูล" แทน "มีข้อมูลและเท่ากับศูนย์"
    const h = d.count > 0 ? Math.max((d.count / max) * MONTH_PLOT_H, 4) : 4;

    ctx.fillStyle = d.count > 0 ? SINGLE : GRID;
    roundedTop(ctx, cx - barW / 2, baseY - h, barW, h, 4);

    ctx.font = `600 13px ${font}`;
    ctx.fillStyle = INK;
    ctx.fillText(String(d.count), cx, baseY - h - 18);

    ctx.font = `12px ${font}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(d.label, cx, baseY + 8);
  });

  ctx.textAlign = "left";
  drawFootnote(ctx, baseY + 8 + 16, meta);
  await save(canvas, meta.title);
}

/* ------------------------------------------------------------------ */

/** ขอบบน + หัวข้อ + บรรทัดที่มา + ช่องไฟก่อนเริ่มกราฟ */
function headerHeight(): number {
  return PAD + TITLE_H + SUBTITLE_H + 8;
}

async function createCanvas(
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้สร้างรูปภาพไม่ได้");

  ctx.scale(SCALE, SCALE);
  // พื้นหลังขาวทึบ ไม่ใช่โปร่งใส — PNG โปร่งใสที่วางบนสไลด์พื้นเข้ม
  // จะกลายเป็นตัวหนังสือดำบนพื้นดำ อ่านไม่ออกทั้งภาพ
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";

  return canvas;
}

/** วาดหัวข้อกับบรรทัดที่มา แล้วคืนชื่อชุดฟอนต์ให้ผู้เรียกใช้ต่อ */
async function drawHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  meta: ChartMeta,
): Promise<string> {
  // ใช้ฟอนต์เดียวกับหน้าเว็บ เพื่อให้รูปที่บันทึกไปหน้าตาตรงกับที่เห็นบนจอ
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";

  ctx.textAlign = "left";
  ctx.font = `700 19px ${font}`;
  ctx.fillStyle = INK;
  ctx.fillText(ellipsize(ctx, meta.title, width - PAD * 2), PAD, PAD);

  ctx.font = `13px ${font}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(meta.subtitle ?? defaultSubtitle(), PAD, PAD + TITLE_H);

  return font;
}

function drawFootnote(
  ctx: CanvasRenderingContext2D,
  y: number,
  meta: ChartMeta,
): void {
  if (!meta.footnote) return;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  ctx.font = `12px ${font}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.fillText(meta.footnote, PAD, y + 6);
}

/**
 * บรรทัดที่มาของรูป
 *
 * รูปที่ถูกก็อปไปวางในสไลด์จะหลุดจากบริบทเสมอ — ถ้าไม่มีวันที่ติดอยู่
 * คนดูจะไม่มีทางรู้ว่าตัวเลขนี้เป็นของรอบไหน และรูปเก่าจะถูกใช้ซ้ำได้เรื่อย ๆ
 */
function defaultSubtitle(): string {
  const d = new Date();
  const TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
              "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const date = `${d.getDate()} ${TH[d.getMonth()]} ${d.getFullYear() + 543}`;
  return `ระบบส่งต่อผู้ป่วยโลหิตวิทยา ศิริราช — ข้อมูล ณ วันที่ ${date}`;
}

/** ตัดข้อความที่ยาวเกินกรอบแล้วเติมจุดไข่ปลา */
function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + "…").width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut + "…";
}

function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  if (w <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  // roundRect ไม่มีในเบราว์เซอร์รุ่นเก่า — มุมเหลี่ยมยังอ่านค่าได้ถูกต้อง
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, Math.min(h / 2, w / 2));
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

function roundedTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (w <= 0 || h <= 0) return;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, [r, r, 0, 0]);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

async function save(canvas: HTMLCanvasElement, title: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("สร้างไฟล์รูปไม่สำเร็จ");

  const d = new Date();
  const stamp =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`;

  saveBlob(`${safeFileName(title)}-${stamp}.png`, blob);
}
