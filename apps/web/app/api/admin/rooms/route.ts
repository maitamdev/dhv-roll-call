import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const staffRoles = ['ADMIN', 'TRAINING_OFFICE'] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRoom(body: Record<string, unknown>) {
  const roomCode = typeof body.roomCode === 'string' ? body.roomCode.trim().toUpperCase().slice(0, 20) : '';
  const building = typeof body.building === 'string' ? body.building.trim().slice(0, 80) : '';
  const capacity = Number(body.capacity);
  const valid = /^[A-Z0-9_-]{2,20}$/.test(roomCode)
    && building.length >= 2
    && Number.isInteger(capacity)
    && capacity >= 1
    && capacity <= 500;
  return { roomCode, building, capacity, valid };
}

export async function GET() {
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('id, room_code, building, capacity')
    .order('building')
    .order('room_code');
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  const rooms = data || [];
  const roomIds = rooms.map((room) => room.id);
  if (roomIds.length === 0) return NextResponse.json({ success: true, rooms: [] });

  const [{ data: devices }, { data: sessions }] = await Promise.all([
    supabaseAdmin.from('devices').select('room_id').in('room_id', roomIds),
    supabaseAdmin.from('attendance_sessions').select('room_id, status').in('room_id', roomIds),
  ]);
  const deviceCounts = new Map<string, number>();
  const sessionCounts = new Map<string, number>();
  for (const device of devices || []) {
    if (device.room_id) deviceCounts.set(device.room_id, (deviceCounts.get(device.room_id) || 0) + 1);
  }
  for (const session of sessions || []) {
    if (session.room_id) sessionCounts.set(session.room_id, (sessionCounts.get(session.room_id) || 0) + 1);
  }
  return NextResponse.json({
    success: true,
    rooms: rooms.map((room) => ({
      ...room,
      device_count: deviceCounts.get(room.id) || 0,
      session_count: sessionCounts.get(room.id) || 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { roomCode, building, capacity, valid } = parseRoom(body);
  if (!valid) {
    return NextResponse.json(
      { success: false, message: 'Mã phòng, tòa nhà hoặc sức chứa không hợp lệ.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .insert({ room_code: roomCode, building, capacity })
    .select('id, room_code, building, capacity')
    .single();
  if (error) {
    return NextResponse.json(
      { success: false, message: error.code === '23505' ? 'Mã phòng đã tồn tại.' : error.message },
      { status: 409 },
    );
  }
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'ROOM_CREATED',
    entity_type: 'ROOM',
    entity_id: data.id,
    new_value: data,
  });
  return NextResponse.json({ success: true, room: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  const { roomCode, building, capacity, valid } = parseRoom(body);
  if (!uuidPattern.test(id) || !valid) {
    return NextResponse.json({ success: false, message: 'Thông tin phòng học không hợp lệ.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .update({ room_code: roomCode, building, capacity })
    .eq('id', id)
    .select('id, room_code, building, capacity')
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { success: false, message: error.code === '23505' ? 'Mã phòng đã tồn tại.' : error.message },
      { status: error.code === '23505' ? 409 : 500 },
    );
  }
  if (!data) return NextResponse.json({ success: false, message: 'Phòng học không tồn tại.' }, { status: 404 });

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'ROOM_UPDATED',
    entity_type: 'ROOM',
    entity_id: id,
    new_value: data,
  });
  return NextResponse.json({ success: true, room: data });
}

export async function DELETE(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ success: false, message: 'Phòng học không hợp lệ.' }, { status: 400 });
  }

  const [{ count: deviceCount }, { count: sessionCount }, { count: scheduleCount }] = await Promise.all([
    supabaseAdmin.from('devices').select('id', { count: 'exact', head: true }).eq('room_id', id),
    supabaseAdmin.from('attendance_sessions').select('id', { count: 'exact', head: true }).eq('room_id', id),
    supabaseAdmin.from('schedules').select('id', { count: 'exact', head: true }).eq('room_id', id),
  ]);
  if ((deviceCount || 0) > 0 || (sessionCount || 0) > 0 || (scheduleCount || 0) > 0) {
    return NextResponse.json(
      { success: false, message: 'Không thể xóa phòng đã gắn máy quét, có lịch học hoặc lịch sử buổi học.' },
      { status: 409 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('rooms')
    .delete()
    .eq('id', id)
    .select('id, room_code')
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, message: 'Phòng học không tồn tại.' }, { status: 404 });

  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: auth.profile!.appUserId,
    action: 'ROOM_DELETED',
    entity_type: 'ROOM',
    entity_id: id,
    old_value: data,
  });
  return NextResponse.json({ success: true });
}
