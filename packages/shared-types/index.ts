// ==========================================
// DHV TapAttend Shared Types & Enums
// ==========================================

export type UserRole = 'ADMIN' | 'TRAINING_OFFICE' | 'LECTURER' | 'STUDENT';
export type AttendanceStatus = 'NOT_MARKED' | 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type SessionStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type CardStatus = 'ACTIVE' | 'LOST' | 'REVOKED' | 'REPLACED';
export type DeviceStatus = 'PENDING' | 'APPROVED' | 'BLOCKED';

export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: string;
  createdAt: string;
}

export interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  className: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  status: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  student?: Student;
  status: AttendanceStatus;
  firstScanAt?: string;
  lastScanAt?: string;
  deviceId?: string;
  source: string;
  offlineSync: boolean;
  manualOverride: boolean;
  overrideReason?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface AttendanceSession {
  id: string;
  courseSectionId: string;
  courseName: string;
  courseCode: string;
  sectionCode: string;
  className: string;
  lecturerName: string;
  roomCode: string;
  building: string;
  scheduledStart: string;
  scheduledEnd: string;
  openedAt?: string;
  closedAt?: string;
  lateAfter: string;
  scanDeadline: string;
  status: SessionStatus;
  sessionToken: string;
  totalEnrolled: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
}

export interface NFCScanRequestPayload {
  sessionId: string;
  cardUid: string; // Plain Hex UID read by Android / Simulator
  deviceId?: string;
  clientScannedAt: string;
  source: 'ANDROID_NFC' | 'WEB_SIMULATOR';
  offline?: boolean;
  requestId: string;
  signature?: string;
}

export interface NFCScanResponsePayload {
  success: boolean;
  code: 
    | 'ATTENDANCE_RECORDED' 
    | 'ALREADY_ATTENDED' 
    | 'CARD_NOT_FOUND' 
    | 'NOT_ENROLLED' 
    | 'SESSION_CLOSED' 
    | 'DEVICE_BLOCKED' 
    | 'INVALID_CARD_STATUS'
    | 'INVALID_REQUEST'
    | 'WRONG_ROOM'
    | 'FACE_NOT_ENROLLED'
    | 'FACE_VERIFICATION_REQUIRED'
    | 'SERVER_ERROR';
  message: string;
  student?: Student;
  attendance?: {
    status: AttendanceStatus;
    recordedAt: string;
  };
  verification?: {
    challengeId?: string;
    livenessAction?: 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT';
    expiresAt?: string;
    similarity?: number;
    threshold?: number;
  };
}

export interface LiveScanEventPayload {
  event: 'attendance.created' | 'attendance.updated' | 'attendance.rejected' | 'session.opened' | 'session.closed';
  sessionId: string;
  record?: {
    studentCode: string;
    fullName: string;
    className: string;
    avatarUrl?: string;
    status: AttendanceStatus;
    recordedAt: string;
    source: string;
  };
  reason?: string;
}
