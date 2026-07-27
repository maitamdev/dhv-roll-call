# Tài Liệu API & Swagger - DHV TapAttend

## REST API Endpoints

### 1. Quét Thẻ NFC (NFC Scan Engine)
- **Endpoint**: `POST /api/nfc/scans`
- **Mô tả**: Endpoint chính xử lý lượt chạm thẻ NFC từ Android App hoặc Web Simulator.
- **Request Body**:
  ```json
  {
    "sessionId": "ses11111-1111-1111-1111-111111111111",
    "cardUid": "8074A1B2",
    "deviceId": "dev11111-1111-1111-1111-111111111111",
    "clientScannedAt": "2026-07-27T07:34:21.000Z",
    "source": "ANDROID_NFC",
    "requestId": "REQ_20260727_0001"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "code": "ATTENDANCE_RECORDED",
    "message": "Điểm danh thành công (Có mặt)",
    "student": {
      "id": "st000001-0000-0000-0000-000000000001",
      "studentCode": "2305CT2001",
      "fullName": "Mai Trần Thiện Tâm",
      "className": "CT07PM",
      "avatarUrl": "https://..."
    },
    "attendance": {
      "status": "PRESENT",
      "recordedAt": "2026-07-27T07:34:21.000Z"
    }
  }
  ```

### 2. Đồng Bộ Hàng Loạt Ngoại Tuyến (Batch Sync)
- **Endpoint**: `POST /api/nfc/scans/batch-sync`
- **Mô tả**: Được WorkManager Android gọi tự động khi có mạng trở lại.
- **Request Body**:
  ```json
  {
    "scans": [
      {
        "sessionId": "ses11111-1111-1111-1111-111111111111",
        "cardUid": "8074A1B2",
        "clientScannedAt": "2026-07-27T07:34:21.000Z",
        "requestId": "OFFLINE_001"
      }
    ]
  }
  ```

### 3. Lấy Lịch Học Hôm Nay
- **Endpoint**: `GET /api/attendance-sessions/today`

### 4. Mở / Đóng Phiên Điểm Danh
- **Endpoint**: `POST /api/attendance-sessions/:id/open`
- **Endpoint**: `POST /api/attendance-sessions/:id/close`
