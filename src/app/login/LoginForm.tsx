"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="block text-sm font-medium text-zinc-700 mb-1">
          ชื่อผู้ใช้
        </span>
        <input
          name="username"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-zinc-700 mb-1">
          รหัสผ่าน
        </span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-900"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-300"
      >
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
