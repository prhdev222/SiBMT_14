import { isAuthConfigured } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

/**
 * แสดงว่าใครล็อกอินอยู่ และปุ่มออกจากระบบ
 *
 * เมื่อยังไม่ได้ตั้งรหัสผ่าน จะขึ้นเตือนสีแดงแทน — ตั้งใจให้เกะกะสายตา
 * เพราะความเสี่ยงที่แท้จริงคือ deploy ขึ้นไปแล้วลืมว่ายังไม่ได้ปิดประตู
 */
export function SessionBar({ username }: { username: string }) {
  if (!isAuthConfigured()) {
    return (
      <div className="bg-red-600 text-white text-sm">
        <div className="max-w-6xl mx-auto px-4 py-2">
          <span className="font-semibold">⚠️ ยังไม่ได้ตั้งรหัสผ่าน</span> —
          ใครก็ตามที่รู้ลิงก์นี้เข้าดูข้อมูลได้ ห้ามเปิดใช้จริงจนกว่าจะตั้งค่า
          <code className="mx-1 rounded bg-red-700 px-1 break-all">DASHBOARD_USERS</code>
          และ
          <code className="mx-1 rounded bg-red-700 px-1 break-all">AUTH_SECRET</code>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 text-zinc-300 text-xs">
      <div className="max-w-6xl mx-auto px-4 py-1.5 flex items-center justify-between gap-4">
        <span>
          เข้าใช้งานในชื่อ <span className="font-medium text-white">{username}</span>
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="font-medium text-zinc-300 hover:text-white hover:underline"
          >
            ออกจากระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
