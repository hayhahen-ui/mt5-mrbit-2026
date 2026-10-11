/**
 * apiHealth.ts — Phát hiện "sai URL" ngay khi mở app.
 * Bệnh thật (11/10/2026): trình duyệt mở app từ một URL không phải production
 * (bookmark cũ / deployment lạ) → mọi /api/* trả trang 404 HTML của Vercel
 * ("The page could not be found") → r.json() nổ "Unexpected token 'T'..."
 * rải khắp các panel, user tưởng hệ thống hỏng trong khi production vẫn khỏe.
 * Lớp này: (1) đọc response an toàn, dịch 404-HTML thành lỗi tiếng Việt rõ ràng;
 * (2) kiểm tra 1 lần khi app khởi động, hiện banner nếu API không tồn tại.
 */

export const PROD_URL = 'https://mt5-mrbit-2026-web.vercel.app';

/** Vercel 404 page bắt đầu bằng "The page could not be found" */
function isVercel404Page(text: string): boolean {
  return text.includes('The page could not be found') || /NOT_FOUND/.test(text.slice(0, 300));
}

/**
 * Đọc JSON từ response của proxy nội bộ — dịch mọi dạng hỏng thành lỗi rõ nghĩa.
 * Ném Error với message tiếng Việt, không bao giờ để lọt "Unexpected token".
 */
export async function readApiJson(r: Response, apiName: string): Promise<any> {
  const text = await r.text();
  if (isVercel404Page(text)) {
    throw new Error(
      `${apiName}: không thấy API trên URL hiện tại (máy chủ trả 404). ` +
      `Anh đang mở app từ URL lạ — mở đúng ${PROD_URL}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${apiName} trả dữ liệu lạ (không phải JSON) — thử lại sau.`);
  }
}

export interface ApiOriginCheck { ok: boolean; reason?: string }

/** Kiểm tra 1 lần khi app khởi động: /api/* có tồn tại trên origin hiện tại không. */
export async function checkApiOrigin(): Promise<ApiOriginCheck> {
  try {
    const r = await fetch('/api/twelvedata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await readApiJson(r, 'API');
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Không kết nối được API.' };
  }
}
