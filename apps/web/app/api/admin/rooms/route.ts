import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossSiteMutation, requireApiRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const staffRoles = ['ADMIN', 'TRAINING_OFFICE'] as const;

export async function GET() {
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('id, room_code, building, capacity')
    .order('building')
    .order('room_code');
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, rooms: data || [] });
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;
  const auth = await requireApiRole([...staffRoles]);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const roomCode = typeof body.roomCode === 'string' ? body.roomCode.trim().toUpperCase().slice(0, 20) : '';
  const building = typeof body.building === 'string' ? body.building.trim().slice(0, 80) : '';
  const capacity = Number(body.capacity);
  if (!/^[A-Z0-9_-]{2,20}$/.test(roomCode) || building.length < 2 || !Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
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
