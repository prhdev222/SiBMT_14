"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  createSessionToken,
  isAuthConfigured,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { allowLoginAttempt } from "@/lib/rate-limit";

export interface LoginState {
  error: string | null;
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isAuthConfigured()) {
    return {
      error:
        "ระบบยังไม่ได้ตั้งรหัสผ่าน — ตั้งค่า DASHBOARD_USERS และ AUTH_SECRET ก่อน",
    };
  }

  // นับก่อนตรวจรหัส — ให้การยิงรัวถูกหยุดตั้งแต่ยังไม่ได้แตะ verifyPassword
  // ซึ่งเป็นงานที่กินซีพียู (PBKDF2 ราว 150 มิลลิวินาทีต่อครั้ง)
  if (!(await allowLoginAttempt())) {
    return {
      error:
        "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง " +
        "หากลืมรหัสผ่านกรุณาติดต่อแพทย์แอดมินกลาง",
    };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const verified = await verifyPassword(username, password);
  if (!verified) {
    // หน่วงเวลาเมื่อรหัสผิด แบบสุ่มช่วง 600–1200 มิลลิวินาที
    //
    // ที่ต้องสุ่มไม่ใช่คงที่ เพราะรหัสผ่านที่เก็บแบบพิมพ์ตรง ๆ เทียบเสร็จทันที
    // ส่วนแบบ hash ใช้เวลาราว 150 มิลลิวินาที ถ้าหน่วงเท่ากันทุกครั้ง
    // เวลาที่ตอบกลับจะบอกใบ้ได้ว่าผู้ใช้คนนั้นเก็บรหัสไว้แบบไหน หรือมีตัวตนหรือไม่
    //
    // นี่เป็นแค่ลูกระนาด ไม่ใช่ประตู — ผู้โจมตียิงพร้อมกันหลายเส้นได้
    // ประตูจริงคือ allowLoginAttempt() ข้างบน (ดู src/lib/rate-limit.ts)
    await new Promise((resolve) =>
      setTimeout(resolve, 600 + Math.floor(Math.random() * 600)),
    );

    // ไม่แยกว่าผิดที่ชื่อหรือรหัส เพราะจะกลายเป็นเครื่องมือไล่เดาว่ามีชื่อใดบ้าง
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  (await cookies()).set(
    SESSION_COOKIE,
    await createSessionToken(verified),
    sessionCookieOptions(),
  );

  // รับเฉพาะ path ภายในเว็บ — ถ้าปล่อยให้เป็น URL เต็มจะถูกใช้พาผู้ใช้
  // ไปเว็บปลอมที่หน้าตาเหมือนกันได้ (open redirect)
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logoutAction() {
  // เขียนทับด้วยค่าว่างและ maxAge 0 แทน delete(name)
  // เพราะต้องส่ง path/secure ชุดเดียวกับตอนตั้ง ไม่งั้นเบราว์เซอร์ลบไม่ตรงตัว
  (await cookies()).set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  redirect("/login");
}
