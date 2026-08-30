import { GRID, SERIES, SINGLE } from "./palette";

export interface BarDatum {
  label: string;
  count: number;
  /**
   * ตำแหน่งสีที่ตายตัวของรายการนี้ (0–3)
   *
   * ผูกกับตัวรายการ ไม่ใช่ลำดับที่แสดง — กลุ่มที่ 2 ต้องเป็นสีส้มเสมอ
   * ไม่ว่าจะอยู่อันดับไหนหรือถูกกรองออกไปกี่กลุ่ม
   *
   * เว้นว่าง = ใช้สีเดียวทั้งกราฟ สำหรับข้อมูลที่ไม่มีตัวตนประจำ เช่น กลุ่มโรค
   */
  seriesIndex?: number;
}

/**
 * แท่งแนวนอน — ใช้เมื่อเทียบขนาดระหว่างหมวดหมู่ที่ชื่อยาว
 *
 * เลือกแนวนอนเพราะชื่อกลุ่มโรคและชื่อกลุ่มงานเป็นภาษาไทยยาว ๆ
 * ถ้าวางเป็นแท่งตั้ง ชื่อจะต้องเอียงหรือตัดทิ้ง ซึ่งอ่านยากกว่าเสมอ
 *
 * ทำด้วย HTML ไม่ใช่ SVG — ข้อความไทยยาวไม่เท่ากันในแต่ละแถว
 * การให้เบราว์เซอร์จัดบรรทัดเองปลอดภัยกว่าการคำนวณตำแหน่งใน SVG
 * ซึ่งจะซ้อนทับกันทันทีที่ชื่อยาวกว่าที่คาด
 */
export function CategoryBars({
  data,
  max,
  emptyText = "ยังไม่มีข้อมูล",
  limit = 8,
}: {
  data: BarDatum[];
  /** ค่าสูงสุดที่ใช้เทียบสัดส่วน — ส่งมาเองเพื่อให้หลายกราฟใช้สเกลเดียวกันได้ */
  max?: number;
  emptyText?: string;
  limit?: number;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-500 py-2">{emptyText}</p>;
  }

  const shown = data.slice(0, limit);
  const scale = max ?? Math.max(...shown.map((d) => d.count), 1);

  return (
    <div>
      <ul className="space-y-2">
        {shown.map((d) => {
          const color =
            d.seriesIndex === undefined
              ? SINGLE
              : SERIES[d.seriesIndex % SERIES.length];
          const pct = scale > 0 ? (d.count / scale) * 100 : 0;

          return (
            <li key={d.label} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-zinc-700 min-w-0 truncate" title={d.label}>
                  {d.label}
                </span>
                {/*
                  ตัวเลขกำกับทุกแท่งเสมอ ไม่ใช่ของประดับ — สีบางสีมีความต่าง
                  จากพื้นขาวต่ำกว่าเกณฑ์ ตัวเลขคือสิ่งที่ทำให้อ่านค่าได้โดยไม่พึ่งสี
                */}
                <span className="text-zinc-900 font-medium tabular-nums shrink-0">
                  {d.count}
                </span>
              </div>
              <div
                className="h-2 rounded-full mt-1 overflow-hidden"
                style={{ backgroundColor: GRID }}
                role="img"
                aria-label={`${d.label} ${d.count}`}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {data.length > shown.length && (
        <p className="text-xs text-zinc-500 mt-2">
          และอีก {data.length - shown.length} รายการ — ดูครบในไฟล์ CSV
        </p>
      )}
    </div>
  );
}
