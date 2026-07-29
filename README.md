# DHV TapAttend - Hệ Thống Điểm Danh Sinh Viên Thẻ NFC Real-time

> **Trường Đại học Hùng Vương (Hung Vuong University)**  
> System Architecture: **Android Native (Kotlin/Compose)** + **Supabase (Postgres & Realtime)** + **Next.js 16 (Vercel)**

![DHV TapAttend Banner](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200)

---

## 📌 Giới Thiệu Sản Phẩm

**DHV TapAttend** là giải pháp điểm danh sinh viên hiện đại bằng thẻ sinh viên NFC **MIFARE Classic 1K**.

- **Ứng dụng máy quét cố định**: Đọc UID thẻ, ký request bằng Android Keystore, kiểm tra liveness bằng CameraX/ML Kit và gửi ảnh xác minh tới engine nội bộ.
- **Website Quản lý & Live Attendance**: Xây dựng trên **Next.js 16 App Router** + **Tailwind CSS** + **Supabase Realtime**, cập nhật lượt quẹt thẻ tức thì.
- **Bảo mật UID Thẻ**: Không bao giờ lưu hay log UID dạng plain-text. Sử dụng chuẩn mã hóa **HMAC-SHA256** và che UID (`80:74:**:**`).
- **Chống gian lận**: Thẻ trường + khuôn mặt + liveness + thời gian máy chủ + máy quét theo phòng + chặn trùng lịch + tái xác minh ngẫu nhiên.

---

## 🛠️ Công Nghệ Sử Dụng

| Thành Phần | Công Nghệ |
| :--- | :--- |
| **Web Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS, Recharts, Lucide Icons |
| **Backend & DB** | Supabase (PostgreSQL, Supabase Auth, Supabase Realtime CDC) |
| **Hosting Web** | Vercel Serverless Functions |
| **Android App** | Kotlin, Jetpack Compose, NFC API, CameraX, ML Kit, Room, WorkManager, Android Keystore |

---

## 🚀 Hướng Dẫn Chạy Dự Án

### 1. Khởi Tạo Cơ Sở Dữ Liệu Supabase

1. Chạy `supabase/schema.sql` cho dự án mới, sau đó áp dụng `supabase/migrations/202607290001_security_hardening.sql`.
2. Tạo tài khoản và dữ liệu nghiệp vụ thật qua Supabase hoặc giao diện quản trị. Dự án không tự nạp dữ liệu mẫu.

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

## 🔐 Tài Khoản

Dự án không chứa tài khoản hoặc mật khẩu demo. Tài khoản đăng nhập được xác thực trực tiếp bằng Supabase Auth.

---

## 📄 Tài Liệu Liên Quan

- 📘 [Tài liệu API Swagger](file:///d:/DHV/docs/api.md)
- 🚀 [Hướng dẫn Deploy Vercel & Supabase](file:///d:/DHV/docs/deployment.md)
- 🔐 [Mô hình bảo mật và nhận diện khuôn mặt](docs/security.md)
- ⚡ [Mục tiêu và tối ưu hiệu năng](docs/performance.md)
- 📋 [Implementation Plan](file:///C:/Users/Asus/.gemini/antigravity-ide/brain/3991cf73-eb4d-45da-9b51-daa8368872dc/implementation_plan.md)
