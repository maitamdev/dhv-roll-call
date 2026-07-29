-- DHV TapAttend security hardening
-- Apply with Supabase CLI after taking a database backup.

create extension if not exists pgcrypto;

alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
-- Authentication is owned by Supabase Auth. Remove the legacy password column
-- so application profiles can never expose reusable credential material.
alter table public.users drop column if exists password_hash;

alter table public.devices
  add column if not exists room_id uuid references public.rooms(id) on delete set null,
  add column if not exists key_algorithm text default 'RSA-SHA256',
  add column if not exists pairing_code_hash text,
  add column if not exists pairing_expires_at timestamptz,
  add column if not exists paired_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists firmware_version text;

create unique index if not exists idx_devices_pairing_code_hash
  on public.devices(pairing_code_hash)
  where pairing_code_hash is not null;

alter table public.attendance_sessions
  add column if not exists face_verification_required boolean not null default true,
  add column if not exists random_rescan_required boolean not null default false,
  add column if not exists random_rescan_at timestamptz;

alter table public.attendance_records
  add column if not exists verification_method text,
  add column if not exists face_verified_at timestamptz,
  add column if not exists verification_attempt_id uuid,
  add column if not exists rescan_verified_at timestamptz,
  add column if not exists risk_score integer not null default 0;

alter table public.scan_events
  add column if not exists risk_score integer not null default 0;

create table if not exists public.biometric_profiles (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  provider text not null default 'COMPREFACE',
  provider_subject text not null unique default gen_random_uuid()::text,
  status text not null default 'NOT_ENROLLED'
    check (status in ('NOT_ENROLLED', 'ACTIVE', 'REVOKED', 'REVIEW_REQUIRED')),
  sample_count integer not null default 0 check (sample_count >= 0),
  consent_version text,
  consented_at timestamptz,
  enrolled_by uuid references public.users(id) on delete set null,
  enrolled_at timestamptz,
  revoked_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.face_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  scan_request_id text not null unique,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete restrict,
  card_uid_hash text not null,
  liveness_action text not null
    check (liveness_action in ('BLINK', 'TURN_LEFT', 'TURN_RIGHT')),
  challenge_type text not null default 'INITIAL'
    check (challenge_type in ('INITIAL', 'RANDOM_RESCAN')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'CANCELLED')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_face_challenges_pending
  on public.face_verification_challenges(device_id, status, expires_at);

create table if not exists public.face_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.face_verification_challenges(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete restrict,
  liveness_passed boolean not null default false,
  face_matched boolean not null default false,
  similarity numeric(6,5),
  threshold numeric(6,5),
  provider text not null default 'COMPREFACE',
  result_code text not null,
  processing_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.fraud_alerts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  session_id uuid references public.attendance_sessions(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  verification_attempt_id uuid references public.face_verification_attempts(id) on delete set null,
  alert_type text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  risk_score integer not null check (risk_score between 0 and 100),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN'
    check (status in ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fraud_alerts_open
  on public.fraud_alerts(status, severity, created_at desc);

alter table public.attendance_records
  drop constraint if exists attendance_records_verification_attempt_id_fkey;
alter table public.attendance_records
  add constraint attendance_records_verification_attempt_id_fkey
  foreign key (verification_attempt_id)
  references public.face_verification_attempts(id) on delete set null;

-- Synchronize Supabase Auth identities with the application profile.
create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'STUDENT' then 'STUDENT'::public.user_role
    else 'STUDENT'::public.user_role
  end;

  insert into public.users (
    auth_user_id, email, username, full_name, role, status
  )
  values (
    new.id,
    coalesce(new.email, new.id::text || '@invalid.local'),
    coalesce(nullif(new.raw_user_meta_data ->> 'student_code', ''), split_part(coalesce(new.email, new.id::text), '@', 1))
      || '_' || left(new.id::text, 8),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Người dùng DHV'), '@', 1)),
    requested_role,
    'ACTIVE'
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        updated_at = now();

  update public.students
     set user_id = (select id from public.users where auth_user_id = new.id),
         updated_at = now()
   where lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_auth_user_sync();

-- Helper used by RLS policies. Role comes from the trusted public.users row,
-- never from editable user metadata.
create or replace function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where auth_user_id = auth.uid() and status = 'ACTIVE'
  limit 1
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid() and status = 'ACTIVE'
  limit 1
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.current_app_user_id() from public;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.current_app_user_id() to authenticated, service_role;

-- Atomic attendance finalization. Only the trusted server may call this.
create or replace function public.finalize_verified_attendance(
  p_challenge_id uuid,
  p_attempt_id uuid
)
returns table (
  record_id uuid,
  attendance_status public.attendance_status,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.face_verification_challenges%rowtype;
  v_session public.attendance_sessions%rowtype;
  v_status public.attendance_status;
  v_record_id uuid;
  v_conflict uuid;
begin
  select * into v_challenge
  from public.face_verification_challenges
  where id = p_challenge_id
  for update;

  if not found or v_challenge.status <> 'VERIFIED' then
    raise exception 'CHALLENGE_NOT_VERIFIED';
  end if;

  select * into v_session
  from public.attendance_sessions
  where id = v_challenge.session_id
  for update;

  if v_session.status <> 'OPEN'
     or now() < v_session.scheduled_start - interval '5 minutes'
     or now() > v_session.scan_deadline then
    raise exception 'SESSION_NOT_OPEN';
  end if;

  if not exists (
    select 1 from public.enrollments
    where course_section_id = v_session.course_section_id
      and student_id = v_challenge.student_id
      and status = 'ACTIVE'
  ) then
    raise exception 'NOT_ENROLLED';
  end if;

  select ar.id into v_conflict
  from public.attendance_records ar
  join public.attendance_sessions other_session on other_session.id = ar.session_id
  where ar.student_id = v_challenge.student_id
    and ar.session_id <> v_challenge.session_id
    and ar.status in ('PRESENT', 'LATE')
    and tstzrange(other_session.scheduled_start, other_session.scheduled_end, '[)')
        && tstzrange(v_session.scheduled_start, v_session.scheduled_end, '[)')
  limit 1;

  if v_conflict is not null then
    insert into public.fraud_alerts (
      student_id, session_id, device_id, verification_attempt_id,
      alert_type, severity, risk_score, details
    ) values (
      v_challenge.student_id, v_challenge.session_id, v_challenge.device_id, p_attempt_id,
      'OVERLAPPING_ATTENDANCE', 'CRITICAL', 100,
      jsonb_build_object('conflicting_record_id', v_conflict)
    );
    raise exception 'OVERLAPPING_ATTENDANCE';
  end if;

  v_status := case when now() > v_session.late_after then 'LATE' else 'PRESENT' end;

  if v_challenge.challenge_type = 'RANDOM_RESCAN' then
    update public.attendance_records
      set last_scan_at = now(),
          rescan_verified_at = now(),
          verification_attempt_id = p_attempt_id,
          risk_score = greatest(0, risk_score - 20),
          updated_at = now()
      where session_id = v_challenge.session_id
        and student_id = v_challenge.student_id
        and status in ('PRESENT', 'LATE')
      returning id, status into v_record_id, v_status;
    if v_record_id is null then
      raise exception 'INITIAL_ATTENDANCE_NOT_FOUND';
    end if;
    return query select v_record_id, v_status, now();
    return;
  end if;

  insert into public.attendance_records (
    session_id, student_id, status, first_scan_at, last_scan_at,
    device_id, source, verification_method, face_verified_at,
    verification_attempt_id, updated_at
  ) values (
    v_challenge.session_id, v_challenge.student_id, v_status, now(), now(),
    v_challenge.device_id, 'FIXED_SCANNER_NFC_FACE', 'NFC_FACE_LIVENESS', now(),
    p_attempt_id, now()
  )
  on conflict (session_id, student_id) do update
    set status = excluded.status,
        first_scan_at = coalesce(public.attendance_records.first_scan_at, excluded.first_scan_at),
        last_scan_at = excluded.last_scan_at,
        device_id = excluded.device_id,
        source = excluded.source,
        verification_method = excluded.verification_method,
        face_verified_at = excluded.face_verified_at,
        verification_attempt_id = excluded.verification_attempt_id,
        updated_at = now()
  returning id into v_record_id;

  update public.biometric_profiles
    set last_verified_at = now(), updated_at = now()
    where student_id = v_challenge.student_id;

  return query select v_record_id, v_status, now();
end;
$$;

revoke all on function public.finalize_verified_attendance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_verified_attendance(uuid, uuid) to service_role;

-- Lock down every public table. The service role used by server routes bypasses
-- these policies; browser clients receive only explicitly granted rows.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users','faculties','classes','students','lecturers','student_cards','devices',
    'semesters','courses','course_sections','enrollments','rooms','schedules',
    'attendance_sessions','attendance_records','scan_events',
    'attendance_adjustment_requests','audit_logs','biometric_profiles',
    'face_verification_challenges','face_verification_attempts','fraud_alerts'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
  end loop;
end $$;

-- Administrative staff have controlled browser read access. Mutations are
-- intentionally routed through authenticated server actions/APIs.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users','faculties','classes','students','lecturers','student_cards','devices',
    'semesters','courses','course_sections','enrollments','rooms','schedules',
    'attendance_sessions','attendance_records','scan_events',
    'attendance_adjustment_requests','biometric_profiles',
    'face_verification_attempts','fraud_alerts'
  ]
  loop
    execute format('drop policy if exists staff_read on public.%I', table_name);
    execute format(
      'create policy staff_read on public.%I for select to authenticated using (public.current_app_role() in (''ADMIN'', ''TRAINING_OFFICE''))',
      table_name
    );
  end loop;
end $$;

-- Lecturers see academic data for sections assigned to their own profile.
drop policy if exists lecturer_reference_read on public.faculties;
create policy lecturer_reference_read on public.faculties for select to authenticated
  using (public.current_app_role() = 'LECTURER');
drop policy if exists lecturer_reference_read on public.classes;
create policy lecturer_reference_read on public.classes for select to authenticated
  using (public.current_app_role() = 'LECTURER');
drop policy if exists lecturer_reference_read on public.courses;
create policy lecturer_reference_read on public.courses for select to authenticated
  using (public.current_app_role() = 'LECTURER');
drop policy if exists lecturer_reference_read on public.semesters;
create policy lecturer_reference_read on public.semesters for select to authenticated
  using (public.current_app_role() = 'LECTURER');
drop policy if exists lecturer_reference_read on public.rooms;
create policy lecturer_reference_read on public.rooms for select to authenticated
  using (public.current_app_role() = 'LECTURER');

drop policy if exists lecturer_read_self on public.lecturers;
create policy lecturer_read_self on public.lecturers for select to authenticated
  using (user_id = public.current_app_user_id());

drop policy if exists lecturer_sections on public.course_sections;
create policy lecturer_sections on public.course_sections for select to authenticated
  using (lecturer_id in (select id from public.lecturers where user_id = public.current_app_user_id()));

drop policy if exists lecturer_enrollments on public.enrollments;
create policy lecturer_enrollments on public.enrollments for select to authenticated
  using (course_section_id in (
    select id from public.course_sections
    where lecturer_id in (select id from public.lecturers where user_id = public.current_app_user_id())
  ));

drop policy if exists lecturer_students on public.students;
create policy lecturer_students on public.students for select to authenticated
  using (id in (
    select e.student_id from public.enrollments e
    join public.course_sections cs on cs.id = e.course_section_id
    where cs.lecturer_id in (select id from public.lecturers where user_id = public.current_app_user_id())
  ));

drop policy if exists lecturer_schedules on public.schedules;
create policy lecturer_schedules on public.schedules for select to authenticated
  using (course_section_id in (
    select id from public.course_sections
    where lecturer_id in (select id from public.lecturers where user_id = public.current_app_user_id())
  ));

drop policy if exists lecturer_sessions on public.attendance_sessions;
create policy lecturer_sessions on public.attendance_sessions for select to authenticated
  using (course_section_id in (
    select id from public.course_sections
    where lecturer_id in (select id from public.lecturers where user_id = public.current_app_user_id())
  ));

drop policy if exists lecturer_records on public.attendance_records;
create policy lecturer_records on public.attendance_records for select to authenticated
  using (session_id in (
    select ats.id from public.attendance_sessions ats
    join public.course_sections cs on cs.id = ats.course_section_id
    where cs.lecturer_id in (select id from public.lecturers where user_id = public.current_app_user_id())
  ));

drop policy if exists lecturer_scan_events on public.scan_events;
create policy lecturer_scan_events on public.scan_events for select to authenticated
  using (session_id in (
    select ats.id from public.attendance_sessions ats
    join public.course_sections cs on cs.id = ats.course_section_id
    where cs.lecturer_id in (select id from public.lecturers where user_id = public.current_app_user_id())
  ));

drop policy if exists users_read_self on public.users;
create policy users_read_self on public.users for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists students_read_self on public.students;
create policy students_read_self on public.students for select to authenticated
  using (user_id = public.current_app_user_id());

drop policy if exists attendance_read_self on public.attendance_records;
create policy attendance_read_self on public.attendance_records for select to authenticated
  using (
    student_id in (
      select id from public.students where user_id = public.current_app_user_id()
    )
  );

drop policy if exists sessions_read_enrolled on public.attendance_sessions;
create policy sessions_read_enrolled on public.attendance_sessions for select to authenticated
  using (
    course_section_id in (
      select e.course_section_id
      from public.enrollments e
      join public.students s on s.id = e.student_id
      where s.user_id = public.current_app_user_id()
    )
  );

-- Add the new tables to Realtime if they are not already members.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fraud_alerts'
  ) then
    alter publication supabase_realtime add table public.fraud_alerts;
  end if;
end $$;
