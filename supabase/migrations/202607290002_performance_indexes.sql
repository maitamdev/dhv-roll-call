-- Read-path indexes for dashboards, live attendance and fraud review.
-- All statements are additive and safe to re-run.

create index if not exists idx_scan_events_received_desc
  on public.scan_events(server_received_at desc);

create index if not exists idx_scan_events_session_received
  on public.scan_events(session_id, server_received_at desc);

create index if not exists idx_attendance_sessions_status_start
  on public.attendance_sessions(status, scheduled_start desc);

create index if not exists idx_attendance_sessions_section_start
  on public.attendance_sessions(course_section_id, scheduled_start desc);

create index if not exists idx_attendance_records_session_status
  on public.attendance_records(session_id, status);

create index if not exists idx_enrollments_student_status
  on public.enrollments(student_id, status);

create index if not exists idx_face_attempts_created_result
  on public.face_verification_attempts(created_at desc, result_code);

create index if not exists idx_biometric_profiles_status
  on public.biometric_profiles(status);

-- Aggregate report rows in PostgreSQL instead of downloading all raw records.
create or replace function public.attendance_report_summary()
returns table (
  student_id uuid,
  student_code text,
  full_name text,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    students.id,
    students.student_code,
    students.full_name,
    count(records.id) filter (where records.status = 'PRESENT'),
    count(records.id) filter (where records.status = 'LATE'),
    count(records.id) filter (where records.status = 'ABSENT'),
    count(records.id)
  from public.students
  left join public.attendance_records as records
    on records.student_id = students.id
  group by students.id, students.student_code, students.full_name
  order by students.student_code;
$$;

revoke all on function public.attendance_report_summary() from public;
grant execute on function public.attendance_report_summary() to authenticated, service_role;

analyze public.scan_events;
analyze public.attendance_sessions;
analyze public.attendance_records;
