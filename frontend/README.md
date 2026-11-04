# TikTok Live Monitor

Frontend React/Vite để kết nối tới backend và hiển thị sự kiện TikTok LIVE theo
thời gian thực qua Socket.IO.

## Chạy local

```bash
npm install
npm run dev
```

Frontend mặc định gọi backend tại `http://localhost:3000`. Có thể ghi đè bằng
biến môi trường `VITE_API_URL`.

Backend cần được chạy riêng:

```bash
cd ../backend
npm install
npm start
```

Nhập username TikTok (có hoặc không có `@`) vào ô kết nối. Giao diện sẽ nhận
event mới qua Socket.IO, đồng thời hỗ trợ lọc, tìm kiếm và xem JSON gốc của
từng event.
