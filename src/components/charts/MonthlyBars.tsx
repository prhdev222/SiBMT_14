import { GRID, SINGLE } from "./palette";

/**
 * จำนวนเคสรายเดือน — แท่งตั้งเรียงตามเวลา
 *
 * ใช้แท่ง ไม่ใช่เส้น เพราะแต่ละเดือนเป็นยอดนับที่จบในตัว ไม่ใช่ค่าที่ไหลต่อเนื่อง
 * เส้นจะชวนให้อ่านว่ามีค่าระหว่างเดือน ซึ่งไม่มีอยู่จริง
 *
 * ชุดข้อมูลเดียวจึงไม่มีคำอธิบายสี — หัวข้อของกล่องบอกอยู่แล้วว่าคืออะไร
 *
 * ทำด้วย HTML ไม่ใช่ SVG เพื่อให้ยืดตามความกว้างจอเองโดยไม่ต้องคำนวณ viewBox
 * และตัวเลขบนแท่งไม่หดตามการสเกลของ SVG
 */
export function MonthlyBars({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-2">
        ยังไม่มีเคสมากพอจะแสดงแนวโน้ม
      </p>
    );
  }

  // แสดงย้อนหลังอย่างมาก 12 เดือน — เท่ากับช่วงที่ข้อมูลยังอยู่ในชีตพอดี
  const shown = data.slice(-12);
  const max = Math.max(...shown.map((d) => d.count), 1);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 min-w-max h-40 pt-5">
        {shown.map((d) => {
          // เดือนที่ไม่มีเคสยังต้องเห็นเป็นแท่งจาง ๆ ไม่ใช่ช่องว่าง
          // ไม่งั้นจะอ่านเป็น "ไม่มีข้อมูล" แทน "มีข้อมูลและเท่ากับศูนย์"
          const pct = (d.count / max) * 100;

          return (
            <div
              key={d.label}
              className="flex flex-col items-center gap-1 w-12 shrink-0 h-full justify-end"
            >
              <span className="text-xs font-medium text-zinc-900 tabular-nums">
                {d.count}
              </span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(pct, 2)}%`,
                  backgroundColor: d.count > 0 ? SINGLE : GRID,
                }}
                role="img"
                aria-label={`${d.label} ${d.count} เคส`}
              />
              <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
