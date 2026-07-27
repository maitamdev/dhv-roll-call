-- ==========================================
-- DHV TapAttend Database Schema (Supabase PostgreSQL)
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------
-- Custom Enums
-- ------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'TRAINING_OFFICE', 'LECTURER', 'STUDENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('NOT_MARKED', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE card_status AS ENUM ('ACTIVE', 'LOST', 'REVOKED', 'REPLACED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE device_status AS ENUM ('PENDING', 'APPROVED', 'BLOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------
-- 1. Users Table
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'STUDENT',
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------
-- 2. Organization: Faculties & Classes
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_code TEXT UNIQUE NOT NULL,
  faculty_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code TEXT UNIQUE NOT NULL,
  class_name TEXT NOT NULL,
  faculty_id UUID REFERENCES public.faculties(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------
-- 3. Profiles: Students & Lecturers
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'ACTIVE',
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lecturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lecturer_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  faculty_id UUID REFERENCES public.faculties(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------
-- 4. NFC Student Cards
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  uid_hash TEXT UNIQUE NOT NULL,
  uid_masked TEXT NOT NULL,
  uid_encrypted TEXT,
  card_type TEXT DEFAULT 'MIFARE_CLASSIC_1K',
  status card_status NOT NULL DEFAULT 'ACTIVE',
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_cards_uid_hash ON public.student_cards(uid_hash);

-- ------------------------------------------
-- 5. Devices Table
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_uuid TEXT UNIQUE NOT NULL,
  device_name TEXT NOT NULL,
  platform TEXT DEFAULT 'ANDROID',
  android_version TEXT,
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  public_key TEXT,
  status device_status NOT NULL DEFAULT 'PENDING',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------
-- 6. Academics Core
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_code TEXT UNIQUE NOT NULL,
  semester_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code TEXT UNIQUE NOT NULL,
  course_name TEXT NOT NULL,
  credits INT NOT NULL DEFAULT 3,
  faculty_id UUID REFERENCES public.faculties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.course_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_code TEXT UNIQUE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE,
  lecturer_id UUID REFERENCES public.lecturers(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'OPEN',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_section_id UUID REFERENCES public.course_sections(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_section_student UNIQUE(course_section_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,
  building TEXT NOT NULL,
  capacity INT DEFAULT 40,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_section_id UUID REFERENCES public.course_sections(id) ON DELETE CASCADE,
  weekday INT NOT NULL, -- 1=Monday, 7=Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------
-- 7. Attendance Core
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_section_id UUID REFERENCES public.course_sections(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  late_after TIMESTAMPTZ NOT NULL,
  scan_deadline TIMESTAMPTZ NOT NULL,
  opened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status session_status NOT NULL DEFAULT 'DRAFT',
  session_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'NOT_MARKED',
  first_scan_at TIMESTAMPTZ,
  last_scan_at TIMESTAMPTZ,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'ANDROID_NFC',
  offline_sync BOOLEAN DEFAULT FALSE,
  manual_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_session_student_record UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON public.attendance_records(student_id);

-- ------------------------------------------
-- 8. Audit Scan Events & Adjustments
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE NOT NULL,
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  card_uid_hash TEXT NOT NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  client_scanned_at TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ DEFAULT NOW(),
  result_code TEXT NOT NULL,
  latency_ms INT,
  offline BOOLEAN DEFAULT FALSE,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS public.attendance_adjustment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT DEFAULT 'PENDING',
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  device_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------
-- Enable Supabase Realtime for live UI
-- ------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;
