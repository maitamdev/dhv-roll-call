# Triển khai DHV TapAttend

Trước khi triển khai production, đọc `docs/security.md` và `docs/performance.md`.
Không đưa tài khoản, sinh viên, UID thẻ hoặc dữ liệu mẫu vào production.

## 1. Supabase

Với dự án mới, chạy `supabase/schema.sql`, sau đó chạy lần lượt:

1. `supabase/migrations/202607290001_security_hardening.sql`
2. `supabase/migrations/202607290002_performance_indexes.sql`

Migration thứ hai tạo các index cho màn hình realtime và hàm tổng hợp báo cáo.
Nên chạy trên staging trước, kiểm tra log và sao lưu database trước mỗi lần phát hành.

Các biến bắt buộc lấy từ Supabase Dashboard:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 2. Web portal và API

Trên Vercel, chọn Root Directory là `apps/web`, sau đó cấu hình:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CARD_HMAC_SECRET=generate-a-long-random-secret
DEVICE_PAIRING_SECRET=generate-a-different-long-random-secret
COMPREFACE_URL=https://face.internal.example.edu.vn
COMPREFACE_API_KEY=your-recognition-service-api-key
FACE_MATCH_THRESHOLD=0.88
```

Kiểm tra trước khi phát hành:

```powershell
cd apps/web
npm ci
npm run lint
npm run build
```

Sau deploy, gọi `/api/health` và xác nhận `database` trả về `ok`.

## 3. Máy quét Android cố định

Cấu hình URL API bằng `BuildConfig.API_BASE_URL`, build bản release đã
ký và cài lên thiết bị Android NFC được cố định tại phòng học. Không dùng APK debug
cho production.

```powershell
cd apps/android
.\gradle-bin\gradle-8.4\bin\gradle.bat assembleRelease -PAPI_BASE_URL=https://your-web-domain.example
```

Sau khi cài:

1. Admin tạo phòng học trên trang **Thiết bị**.
2. Admin tạo mã ghép nối và chọn đúng phòng cố định.
3. Nhập mã vào app Android một lần. Không nhập mã phiên hoặc URL trên thiết bị.
4. Giảng viên tạo/mở buổi học và chọn đúng phòng; app tự nhận phiên đang mở.
5. Chặn cài ứng dụng lạ và bật kiosk/device-owner mode.
6. Kiểm tra NFC, camera, liveness, đồng bộ offline và thời gian hệ thống.
7. Thu hồi thiết bị ngay trên web nếu bị mất hoặc tháo khỏi phòng.

## 4. Kiểm tra sau phát hành

- Đăng nhập thử từng vai trò: quản trị, phòng đào tạo, giảng viên và sinh viên.
- Mở/đóng một phiên điểm danh thử và theo dõi trạng thái Realtime.
- Quét thẻ, xác minh khuôn mặt, thử quét trùng và thử thiết bị chưa ghép cặp.
- Gửi một yêu cầu điều chỉnh từ cổng sinh viên và kiểm tra audit log.
- Xuất báo cáo CSV, mở bằng Excel và kiểm tra dấu tiếng Việt.
