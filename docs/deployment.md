# Hướng Dẫn Deploy DHV TapAttend (Vercel & Supabase & Android APK)

## 1. Deploy Database & Backend (Supabase)

1. Truy cập [Supabase Dashboard](https://supabase.com) và tạo một Project mới (Ví dụ: `dhv-tap-attend`).
2. Mở mục **SQL Editor** trong Supabase:
   - Thao tác chạy file [supabase/schema.sql](file:///d:/DHV/supabase/schema.sql) để tạo toàn bộ bảng, enum và chỉ mục.
   - Thao tác chạy file [supabase/seed.sql](file:///d:/DHV/supabase/seed.sql) để tạo dữ liệu mẫu sẵn sàng dùng (Admin, Giảng viên, Sinh viên, Lớp, Thẻ NFC).
3. Lấy thông tin URL & Keys trong mục **Settings -> API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Deploy Web Portal & REST API (Vercel)

1. Kết nối Repository vào [Vercel Dashboard](https://vercel.com).
2. Cấu hình **Root Directory**: `apps/web`.
3. Thêm các **Environment Variables**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   CARD_HMAC_SECRET=dhv_tap_attend_hmac_secret_2026_key
   ```
4. Nhấn **Deploy**. Vercel sẽ tự động build Next.js App Router và xuất bản trang web thời gian thực.

---

## 3. Build & Cài Đặt Android App (.APK)

1. Mở thư mục `apps/android` bằng Android Studio hoặc VSCode.
2. Kiểm tra file `apps/android/app/src/main/java/vn/edu/dhv/tapattend/sync/OfflineScanSyncWorker.kt`, cập nhật URL Vercel vừa deploy.
3. Chạy lệnh build APK bằng Gradle:
   ```bash
   cd apps/android
   ./gradlew assembleRelease
   ```
4. File APK sẽ được tạo tại: `apps/android/app/build/outputs/apk/release/app-release.apk`.
5. Copy file `.apk` vào điện thoại Android của Giảng viên và tiến hành cài đặt. Cấp quyền NFC khi mở ứng dụng lần đầu.
