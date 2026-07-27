# DHV TapAttend - Hệ Thống Điểm Danh Sinh Viên Thẻ NFC Real-time

> **Trường Đại học Hùng Vương (Hung Vuong University)**  
> System Architecture: **Android Native (Kotlin/Compose)** + **Supabase (Postgres & Realtime)** + **Next.js 14 (Vercel)**

![DHV TapAttend Banner](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200)

---

## 📌 Giới Thiệu Sản Phẩm

**DHV TapAttend** là giải pháp điểm danh sinh viên hiện đại bằng thẻ sinh viên NFC **MIFARE Classic 1K**.

- **Ứng dụng Android Scanner**: Đọc **UID hex (`Tag.getId()`)** trực tiếp từ thẻ sinh viên bằng NFC ReaderMode, hỗ trợ lưu trữ cục bộ **Room Database** và tự động đồng bộ khi có mạng lại bằng **WorkManager**.
- **Website Quản lý & Live Attendance**: Xây dựng trên **Next.js 14 App Router** + **Tailwind CSS** + **Supabase Realtime**, cập nhật lượt quẹt thẻ tức thì không cần reload trang.
- **Bảo mật UID Thẻ**: Không bao giờ lưu hay log UID dạng plain-text. Sử dụng chuẩn mã hóa **HMAC-SHA256** và che UID (`80:74:**:**`).
- **Trình Giả Lập Thẻ NFC Web**: Tích hợp công cụ giả lập quẹt thẻ trực tiếp trên trình duyệt Web dành cho giảng viên & nhà phát triển thử nghiệm không cần phần cứng điện thoại.

---

## 🛠️ Công Nghệ Sử Dụng

| Thành Phần | Công Nghệ |
| :--- | :--- |
| **Web Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Lucide Icons |
| **Backend & DB** | Supabase (PostgreSQL, Supabase Auth, Supabase Realtime CDC) |
| **Hosting Web** | Vercel Serverless Functions |
| **Android App** | Kotlin, Jetpack Compose, NFC API (`Tag.getId()`), Room DB, WorkManager, Hilt, Keystore |

---

## 🚀 Hướng Dẫn Chạy Dự Án

### 1. Khởi Tạo Cơ Sở Dữ Liệu Supabase

1. Chạy Script [supabase/schema.sql](file:///d:/DHV/supabase/schema.sql) trên SQL Editor Supabase.
2. Chạy Script [supabase/seed.sql](file:///d:/DHV/supabase/seed.sql) để tạo dữ liệu mẫu sẵn có (Admin, Giảng viên, Sinh viên, Phiên điểm danh demo).

### 2. Chạy Web Local

```bash
cd apps/web
npm install
npm run dev
```

Truy cập: `http://localhost:3000`

### 3. Build Android App APK

```bash
cd apps/android
./gradlew assembleRelease
```

---

## 🔐 Tài Khoản Demo Sẵn Có

| Vai trò | Email | Mật khẩu | Chức năng |
| :--- | :--- | :--- | :--- |
| **Giảng viên** | `gv.an@dhv.edu.vn` | `Password123#` | Mở/Đóng phiên, Quét NFC, Xem Live Attendance |
| **Quản trị viên** | `admin@dhv.edu.vn` | `Password123#` | Quản lý tài khoản, thẻ NFC, phê duyệt thiết bị |
| **Phòng Đào tạo**| `daotao@dhv.edu.vn` | `Password123#` | Lịch học toàn trường, Xuất báo cáo chuyên cần |
| **Sinh viên** | `st2001@student.dhv.edu.vn` | `Password123#` | Cổng sinh viên, Xem tỷ lệ chuyên cần & xin điều chỉnh |

---

## 📄 Tài Liệu Liên Quan

- 📘 [Tài liệu API Swagger](file:///d:/DHV/docs/api.md)
- 🚀 [Hướng dẫn Deploy Vercel & Supabase](file:///d:/DHV/docs/deployment.md)
- 📋 [Implementation Plan](file:///C:/Users/Asus/.gemini/antigravity-ide/brain/3991cf73-eb4d-45da-9b51-daa8368872dc/implementation_plan.md)
