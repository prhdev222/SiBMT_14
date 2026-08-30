import { buildPieData, percentText } from "./slices";
import type { BarDatum } from "./CategoryBars";

/**
 * กราฟวงกลมแบบโดนัท
 *
 * ⚠️ ใช้ได้เฉพาะข้อมูลที่เป็น "ส่วนหนึ่งของทั้งหมด" เท่านั้น
 *
 * วงกลมสื่อว่าทุกชิ้นรวมกันแล้วได้ 100% ของบางอย่าง — สูตรยาที่แนะนำ
 * ใช้ไม่ได้เพราะเคสเดียวเลือกได้หลายสูตร ผลรวมจึงมากกว่าจำนวนเคส
 * และจำนวนรายเดือนก็ใช้ไม่ได้เพราะเป็นลำดับเวลา ไม่ใช่การแบ่งส่วน
 *
 * เจาะรูตรงกลางเพื่อวางยอดรวมไว้ในนั้น — คนอ่านจึงเห็นทั้งสัดส่วน
 * และฐานที่ใช้คิดสัดส่วนพร้อมกัน โดยไม่ต้องมองหาที่อื่น
 */
export function PieChart({
  data,
  emptyText = "ยังไม่มีข้อมูล",
  unit = "เคส",
  compact = false,
}: {
  data: BarDatum[];
  emptyText?: string;
  unit?: string;
  /**
   * วางคำอธิบายไว้ใต้วงกลมแทนที่จะอยู่ข้าง ๆ
   *
   * สำหรับกล่องแคบ ๆ ในแผงสองคอลัมน์ — วางข้างกันแล้วชื่อกลุ่มโรค
   * จะเหลือที่แค่ไม่กี่ตัวอักษรจนถูกตัดเป็น "A…" ซึ่งไม่ได้บอกอะไรเลย
   */
  compact?: boolean;
}) {
  const { slices, total } = buildPieData(data);

  if (slices.length === 0) {
    return <p className="text-sm text-zinc-500 py-2">{emptyText}</p>;
  }

  return (
    <div
      className={
        compact
          ? "flex flex-col items-center gap-3"
          : "flex flex-wrap items-center gap-x-6 gap-y-4"
      }
    >
      <Donut
        slices={slices}
        total={total}
        unit={unit}
        size={compact ? 132 : SIZE}
      />

      {/*
        คำอธิบายเรียงลำดับตรงกับชิ้นในวงกลม และมีทั้งชื่อ จำนวน และร้อยละ
        — ตัวตนของชิ้นจึงไม่เคยขึ้นกับสีเพียงอย่างเดียว
      */}
      <ul className={`min-w-0 space-y-1.5 ${compact ? "w-full" : "flex-1"}`}>
        {slices.map((s) => (
          <li key={s.label} className="flex items-baseline gap-2 text-sm">
            <span
              aria-hidden
              className="w-3 h-3 rounded-sm shrink-0 translate-y-0.5"
              style={{ backgroundColor: s.color }}
            />
            <span
              className={`min-w-0 truncate ${s.residual ? "text-zinc-500" : "text-zinc-700"}`}
              title={s.label}
            >
              {s.label}
            </span>
            <span className="ml-auto shrink-0 tabular-nums text-zinc-900 font-medium">
              {s.count}
            </span>
            <span className="shrink-0 tabular-nums text-zinc-500 w-12 text-right">
              {percentText(s.fraction)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SIZE = 180;
const RING_R = 66;
const RING_W = 34;

function Donut({
  slices,
  total,
  unit,
  size,
}: {
  slices: ReturnType<typeof buildPieData>["slices"];
  total: number;
  unit: string;
  size: number;
}) {
  // ย่อทั้งวงตามสัดส่วนเดียวกัน ความหนาของวงแหวนจึงได้สัดส่วนเดิม
  const k = size / SIZE;
  const c = size / 2;
  const ringR = RING_R * k;
  const ringW = RING_W * k;

  // คิดมุมเริ่มต้นของทุกชิ้นให้เสร็จก่อนวาด — เริ่มที่สิบสองนาฬิกา
  // ซึ่งเป็นจุดที่สายตาเริ่มอ่านเสมอ
  const placed = slices.map((s, i) => ({
    slice: s,
    from:
      -90 +
      slices.slice(0, i).reduce((sum, prev) => sum + prev.fraction, 0) * 360,
    sweep: s.fraction * 360,
  }));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={slices
        .map((s) => `${s.label} ${s.count} ${percentText(s.fraction)}`)
        .join(", ")}
    >
      {placed.map(({ slice: s, from, sweep }) => {
        // ชิ้นเดียวเต็มวง วาดเป็นวงแหวนตรง ๆ — เส้นโค้งที่จุดต้นกับจุดปลาย
        // อยู่ตำแหน่งเดียวกันจะไม่ถูกวาดออกมาเลย
        if (sweep >= 359.9) {
          return (
            <circle
              key={s.label}
              cx={c}
              cy={c}
              r={ringR}
              fill="none"
              stroke={s.color}
              strokeWidth={ringW}
            />
          );
        }

        return (
          <path
            key={s.label}
            d={arc(c, ringR, from, from + sweep, slices.length > 1 ? 1.2 : 0)}
            fill="none"
            stroke={s.color}
            strokeWidth={ringW}
          />
        );
      })}

      <text
        x={c}
        y={c - 4 * k}
        textAnchor="middle"
        className="fill-zinc-900 text-lg font-bold"
        style={{ fontSize: 20 * k }}
      >
        {total}
      </text>
      <text
        x={c}
        y={c + 14 * k}
        textAnchor="middle"
        className="fill-zinc-500"
        style={{ fontSize: 11 * k }}
      >
        {unit}
      </text>
    </svg>
  );
}

/**
 * เส้นโค้งของหนึ่งชิ้น
 *
 * @param gap องศาที่หดเข้าข้างละครึ่ง เพื่อให้เห็นรอยต่อระหว่างชิ้น
 *            โดยไม่ต้องวาดเส้นขอบทับ ซึ่งจะกินเนื้อที่ของชิ้นเล็ก ๆ ไปหมด
 */
function arc(
  c: number,
  r: number,
  fromDeg: number,
  toDeg: number,
  gap: number,
): string {
  const half = Math.min(gap / 2, (toDeg - fromDeg) / 4);
  const a0 = ((fromDeg + half) * Math.PI) / 180;
  const a1 = ((toDeg - half) * Math.PI) / 180;

  const x0 = c + r * Math.cos(a0);
  const y0 = c + r * Math.sin(a0);
  const x1 = c + r * Math.cos(a1);
  const y1 = c + r * Math.sin(a1);
  const large = toDeg - fromDeg > 180 ? 1 : 0;

  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}
