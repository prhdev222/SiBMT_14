"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryBars, type BarDatum } from "./CategoryBars";
import { MonthlyBars } from "./MonthlyBars";
import { PieChart } from "./PieChart";
import {
  saveCategoryChart,
  saveMonthlyChart,
  savePieChart,
} from "@/lib/chart-image";
import { downloadCsv, fileStamp, toCsv } from "@/lib/csv";
import { safeFileName } from "@/lib/download";

/**
 * กรอบของกราฟหนึ่งอัน พร้อมปุ่มขยายและบันทึกเป็นรูป
 *
 * ถือข้อมูลเองแทนที่จะรับกราฟที่ประกอบเสร็จแล้วมาเป็น children
 * เพราะทั้งการขยาย (แสดงครบทุกแถว ไม่ใช่แค่ 8 แถวแรก) และการบันทึกรูป
 * (วาดใหม่ลงบน canvas) ต้องใช้ตัวเลขดิบ ไม่ใช่ DOM ที่วาดไว้แล้ว
 */
export function ChartCard({
  title,
  note,
  kind = "category",
  data,
  max,
  emptyText,
  limit = 8,
  dense = false,
  pie = true,
  unit = "เคส",
}: {
  title: string;
  /** คำอธิบายใต้กราฟ — ใช้เมื่อตัวเลขอาจถูกอ่านผิดถ้าไม่มีบริบท */
  note?: string;
  kind?: "category" | "monthly";
  data: BarDatum[];
  max?: number;
  emptyText?: string;
  /** จำนวนแถวที่แสดงบนหน้าจอ — ตอนขยายและตอนบันทึกรูปจะแสดงครบเสมอ */
  limit?: number;
  /** แบบกะทัดรัดสำหรับกล่องที่ซ้อนอยู่ในแผงอื่น */
  dense?: boolean;
  /**
   * เลือกดูเป็นวงกลมได้ไหม
   *
   * ⚠️ ปิดเมื่อข้อมูลไม่ใช่ "ส่วนหนึ่งของทั้งหมด" — วงกลมสื่อว่าทุกชิ้น
   * รวมกันได้ 100% ของบางอย่าง ถ้าไม่จริงกราฟจะโกหกโดยที่ไม่มีตัวเลขไหนผิด
   */
  pie?: boolean;
  /** หน่วยที่เขียนไว้กลางวงกลม */
  unit?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [shape, setShape] = useState<"bar" | "pie">("bar");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasData = data.length > 0;
  const canPie = pie && kind === "category";

  const saveImage = async () => {
    setSaving(true);
    setError("");
    try {
      if (kind === "monthly") {
        await saveMonthlyChart(data, { title, footnote: note });
      } else if (shape === "pie") {
        // รูปที่บันทึกต้องเป็นแบบเดียวกับที่กำลังดูอยู่ ไม่ใช่แบบตั้งต้นเสมอ
        await savePieChart(data, { title, footnote: note }, unit);
      } else {
        await saveCategoryChart(data, { title, footnote: note }, max);
      }
    } catch (e) {
      // ล้มเหลวเงียบ ๆ แปลว่าผู้ใช้กดแล้วไม่มีอะไรเกิดขึ้น แล้วกดซ้ำไปเรื่อย ๆ
      setError(e instanceof Error ? e.message : "บันทึกรูปไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const saveCsv = () =>
    downloadCsv(
      `${safeFileName(title)}-${fileStamp()}`,
      toCsv(["รายการ", "จำนวน"], data.map((d) => [d.label, d.count])),
    );

  const chart = (full: boolean) => {
    if (kind === "monthly") return <MonthlyBars data={data} />;
    if (shape === "pie")
      return (
        <PieChart
          data={data}
          emptyText={emptyText}
          unit={unit}
          // ตอนขยายมีที่กว้างแล้ว ไม่ต้องบีบเป็นแบบกะทัดรัดอีก
          compact={dense && !full}
        />
      );
    return (
      <CategoryBars
        data={data}
        max={max}
        emptyText={emptyText}
        limit={full ? data.length : limit}
      />
    );
  };

  return (
    <section
      className={`rounded-xl bg-white border border-zinc-200 ${dense ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3
          className={`min-w-0 font-semibold text-zinc-900 ${dense ? "text-xs text-zinc-500 font-medium" : "text-sm"}`}
        >
          {title}
        </h3>

        {hasData && (
          <div className="flex items-center gap-1 shrink-0 print:hidden">
            {canPie && (
              <ShapeToggle shape={shape} onChange={setShape} />
            )}
            <IconButton
              label="ขยาย"
              title="ขยายเต็มจอ"
              onClick={() => setExpanded(true)}
            >
              ⤢
            </IconButton>
            <IconButton
              label="บันทึกรูป"
              title="บันทึกเป็นไฟล์รูป PNG"
              onClick={saveImage}
              disabled={saving}
            >
              🖼
            </IconButton>
          </div>
        )}
      </div>

      {chart(false)}

      {note && <p className="text-xs text-zinc-500 mt-3">ⓘ {note}</p>}
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}

      {expanded && (
        <Expanded title={title} onClose={() => setExpanded(false)}>
          {chart(true)}
          {note && <p className="text-xs text-zinc-500 mt-4">ⓘ {note}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveImage}
              disabled={saving}
              className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              🖼 {saving ? "กำลังบันทึก…" : "บันทึกเป็นรูป PNG"}
            </button>
            {/*
              ตัวเลขของกราฟนี้อย่างเดียว — คนละอย่างกับปุ่ม "สถิติทั้งหมด"
              ที่รวมทุกหมวดไว้ในไฟล์เดียว ซึ่งต้องมากรองต่อใน Excel ก่อนใช้
            */}
            <button
              type="button"
              onClick={saveCsv}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              ⬇ ดาวน์โหลด CSV
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              ปิด
            </button>
          </div>
          {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
        </Expanded>
      )}
    </section>
  );
}

/**
 * หน้าต่างขยาย
 *
 * ใช้ <dialog> ของเบราว์เซอร์ ไม่ใช่ div ที่ทำเอง — ได้ปุ่ม Esc ปิด
 * การกักโฟกัสไว้ในหน้าต่าง และการซ้อนทับที่ถูกต้องมาให้ฟรีทั้งหมด
 * ซึ่งถ้าทำเองต้องเขียนใหม่ทุกข้อและมักตกหล่นข้อใดข้อหนึ่งเสมอ
 */
function Expanded({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // showModal() เรียกซ้ำกับหน้าต่างที่เปิดอยู่แล้วจะโยน error
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      // onClose จับได้ทั้งการกด Esc และการปิดด้วยปุ่ม — สถานะฝั่ง React
      // จึงไม่ค้างเป็น true หลังหน้าต่างปิดไปแล้ว
      onClose={onClose}
      onClick={(e) => {
        // คลิกพื้นที่มืดรอบนอกเพื่อปิด — เป้าของ event เป็นตัว dialog เอง
        // ต่อเมื่อคลิกโดนฉากหลัง เพราะเนื้อหาอยู่ใน div ชั้นใน
        if (e.target === ref.current) ref.current?.close();
      }}
      /*
        m-auto จำเป็น ไม่ใช่ของแถม

        เบราว์เซอร์จัดกึ่งกลางให้ <dialog> ด้วย margin:auto ของมันเอง
        แต่ Tailwind รีเซ็ต margin ของทุกอย่างเป็น 0 ทับไปตั้งแต่ต้น
        หน้าต่างจึงไปเกาะมุมซ้ายบนของจอ — เห็นชัดที่สุดบนมือถือ
      */
      className="m-auto w-[92vw] max-w-4xl max-h-[85vh] rounded-xl border border-zinc-200 p-0 backdrop:bg-zinc-900/50"
      aria-label={title}
    >
      <div className="p-5 sm:p-6 overflow-y-auto max-h-[85vh]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-base sm:text-lg font-bold text-zinc-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="ปิด"
            className="shrink-0 rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100 text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/**
 * สลับระหว่างแท่งกับวงกลม
 *
 * ทั้งสองปุ่มแสดงพร้อมกันเสมอ ไม่ใช่ปุ่มเดียวที่สลับความหมายเมื่อกด —
 * ปุ่มสลับทำให้ต้องเดาว่าไอคอนที่เห็นคือ "กำลังดูอยู่" หรือ "กดแล้วจะได้"
 */
function ShapeToggle({
  shape,
  onChange,
}: {
  shape: "bar" | "pie";
  onChange: (s: "bar" | "pie") => void;
}) {
  const style = (active: boolean) =>
    `px-3 py-2 sm:px-2 sm:py-1 text-sm leading-none transition-colors ${
      active
        ? "bg-zinc-100 text-zinc-900"
        : "text-zinc-400 hover:text-zinc-700"
    }`;

  return (
    <div
      className="flex rounded-md border border-zinc-200 overflow-hidden mr-1"
      role="group"
      aria-label="รูปแบบกราฟ"
    >
      <button
        type="button"
        onClick={() => onChange("bar")}
        aria-pressed={shape === "bar"}
        aria-label="กราฟแท่ง"
        title="กราฟแท่ง"
        className={style(shape === "bar")}
      >
        ▤
      </button>
      <button
        type="button"
        onClick={() => onChange("pie")}
        aria-pressed={shape === "pie"}
        aria-label="กราฟวงกลม"
        title="กราฟวงกลม"
        className={style(shape === "pie")}
      >
        ◕
      </button>
    </div>
  );
}

function IconButton({
  label,
  title,
  onClick,
  disabled,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className="rounded-md border border-zinc-200 px-3 py-2 sm:px-2 sm:py-1 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  );
}
