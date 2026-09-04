"use client";

export function PrintButton({ label = "พิมพ์แบบฟอร์ม" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
    >
      {label}
    </button>
  );
}
