export function extractUsername(input) {
  if (!input || typeof input !== "string") {
    throw new Error("Vui lòng nhập username hoặc link TikTok");
  }

  const value = input.trim();

  // Nhận link TikTok
  if (/^https?:\/\//i.test(value)) {
    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error("Link không hợp lệ");
    }

    const hostname = url.hostname.toLowerCase();

    if (hostname !== "tiktok.com" && !hostname.endsWith(".tiktok.com")) {
      throw new Error("Chỉ chấp nhận link TikTok");
    }

    const match = url.pathname.match(/^\/@([a-zA-Z0-9._]+)/);

    if (!match) {
      throw new Error("Không tìm thấy username trong link");
    }

    return match[1];
  }

  // Nhận username trực tiếp
  const username = value.replace(/^@/, "");

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    throw new Error("Username không hợp lệ");
  }

  return username;
}
