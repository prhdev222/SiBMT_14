"use client";

import { useActionState } from "react";
import { contactAdminAction, type ContactState } from "./actions";

const INITIAL: ContactState = { ok: false, message: "" };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    contactAdminAction,
    INITIAL,
  );

  // ส่งสำเร็จแล้วซ่อนฟอร์มทิ้ง — ปล่อยไว้คนจะกดซ้ำเพราะไม่แน่ใจว่าส่งไปหรือยัง
  // แล้วแอดมินจะได้ข้อความเดียวกันหลายรอบ
  if (state.ok) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-5">
        <p className="font-semibold text-green-900">ส่งข้อความแล้ว ✓</p>
        <p className="text-sm text-green-900/90 mt-1">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <fieldset
        disabled={pending}
        className={`space-y-3 transition-opacity ${pending ? "opacity-50" : ""}`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="name" label="ชื่อผู้ติดต่อ" required />
          <Field name="org" label="โรงพยาบาลต้นทาง" required />
        </div>

        <Field
          name="contact"
          label="เบอร์หรืออีเมลให้ติดต่อกลับ"
          required
          hint="แอดมินจะติดต่อกลับตามช่องทางนี้"
        />

        <Field
          name="referralId"
          label="เลขที่อ้างอิงของเคส (ถ้ามี)"
          hint="เช่น HEM-20260903-0012 — ใส่เมื่อสอบถามสถานะเคสที่ส่งไปแล้ว"
        />

        <label className="block text-sm">
          <span className="block font-medium text-zinc-700 mb-1">
            ข้อความ <span className="text-red-600">*</span>
          </span>
          <textarea
            name="message"
            required
            rows={5}
            maxLength={1500}
            placeholder="เช่น ส่งฟอร์มกลุ่มที่ 2 ไม่สำเร็จ ขึ้น error หรือ สอบถามสถานะเคส HEM-… ที่ส่งไปเกินกำหนดแล้วยังไม่ได้รับคำตอบ"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 leading-relaxed"
          />
        </label>

        {/*
          ปลายทางคือ LINE ของทีม ซึ่งตาม PDPA-003 ห้ามมีข้อมูลผู้ป่วยเด็ดขาด
          ระบบบังคับไม่ได้ จึงต้องเตือนตรงจุดที่กำลังจะพิมพ์
        */}
        <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">
            🔒 ห้ามพิมพ์ชื่อ-สกุล เลข HN หรือเลขบัตรประชาชนของผู้ป่วย
          </span>{" "}
          — ช่องทางนี้ส่งเข้า LINE ของทีม
          หากต้องการปรึกษาเคสจริงให้ใช้กลุ่มที่ 2 ซึ่งมีเลขที่อ้างอิงและกรอบเวลาตอบกลับ
        </p>
      </fieldset>

      {state.message && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait transition-colors"
      >
        {pending ? "กำลังส่ง…" : "ส่งถึงแพทย์แอดมินกลาง"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  required = false,
  hint,
}: {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block font-medium text-zinc-700 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <input
        name={name}
        required={required}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
      />
      {hint && <span className="block text-xs text-zinc-500 mt-1">{hint}</span>}
    </label>
  );
}
