'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  DoorOpen,
  Laptop,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type Room = {
  id: string;
  room_code: string;
  building: string;
  capacity: number;
  device_count: number;
  session_count: number;
};

type RoomForm = { roomCode: string; building: string; capacity: number };
const emptyForm: RoomForm = { roomCode: '', building: '', capacity: 40 };

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/admin/rooms', { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    if (response.ok) setRooms(body?.rooms || []);
    else setMessage({ tone: 'error', text: body?.message || 'Không thể tải danh sách phòng học.' });
    setLoading(false);
  }, []);

  useEffect(() => { void loadRooms(); }, [loadRooms]);

  const totals = useMemo(() => ({
    capacity: rooms.reduce((sum, room) => sum + room.capacity, 0),
    devices: rooms.reduce((sum, room) => sum + room.device_count, 0),
  }), [rooms]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage(null);
    setShowForm(true);
  }

  function openEdit(room: Room) {
    setEditingId(room.id);
    setForm({ roomCode: room.room_code, building: room.building, capacity: room.capacity });
    setMessage(null);
    setShowForm(true);
  }

  async function saveRoom(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch('/api/admin/rooms', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, id: editingId }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage({ tone: 'error', text: body?.message || 'Không thể lưu phòng học.' });
      setSaving(false);
      return;
    }
    setShowForm(false);
    setMessage({ tone: 'success', text: editingId ? `Đã cập nhật phòng ${body.room.room_code}.` : `Đã tạo phòng ${body.room.room_code}.` });
    await loadRooms();
    setSaving(false);
  }

  async function deleteRoom(room: Room) {
    if (!window.confirm(`Xóa phòng ${room.room_code}? Thao tác này không thể hoàn tác.`)) return;
    setMessage(null);
    const response = await fetch('/api/admin/rooms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: room.id }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage({ tone: 'error', text: body?.message || 'Không thể xóa phòng học.' });
      return;
    }
    setMessage({ tone: 'success', text: `Đã xóa phòng ${room.room_code}.` });
    await loadRooms();
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="page-header">
        <div>
          <p className="page-kicker">Cơ sở vật chất</p>
          <h1 className="page-title flex items-center gap-2"><Building2 className="h-6 w-6 text-secondary" /> Phòng học</h1>
          <p className="page-description">Tạo phòng trước khi xếp buổi học hoặc ghép máy quét điểm danh cố định.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void loadRooms()} className="icon-button" aria-label="Làm mới">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" /> Tạo phòng</button>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Tổng phòng</p><p className="mt-2 text-2xl font-extrabold text-primary">{rooms.length}</p></div>
        <div className="panel p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Tổng sức chứa</p><p className="mt-2 text-2xl font-extrabold text-primary">{totals.capacity} <span className="text-sm text-slate-500">chỗ</span></p></div>
        <div className="panel p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Máy quét đã gắn</p><p className="mt-2 text-2xl font-extrabold text-primary">{totals.devices}</p></div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : rooms.length === 0 ? (
        <section className="empty-state panel">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/5"><DoorOpen className="h-7 w-7 text-primary" /></div>
          <h2 className="mt-4 text-lg font-extrabold text-slate-950">Chưa có phòng học</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Tạo phòng đầu tiên để giảng viên chọn khi tạo buổi học và để Admin ghép máy quét đúng vị trí.</p>
          <button onClick={openCreate} className="btn-primary mx-auto mt-5"><Plus className="h-4 w-4" /> Tạo phòng đầu tiên</button>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <article key={room.id} className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white"><DoorOpen className="h-5 w-5" /></div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(room)} className="icon-button h-9 w-9" aria-label={`Sửa phòng ${room.room_code}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => void deleteRoom(room)} className="icon-button h-9 w-9 text-red-600" aria-label={`Xóa phòng ${room.room_code}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-slate-950">{room.room_code}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPin className="h-3.5 w-3.5" /> {room.building}</p>
              <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-4 text-center">
                <div><Users className="mx-auto h-4 w-4 text-secondary" /><strong className="mt-1 block text-sm">{room.capacity}</strong><span className="text-[9px] text-slate-500">chỗ</span></div>
                <div><Laptop className="mx-auto h-4 w-4 text-secondary" /><strong className="mt-1 block text-sm">{room.device_count}</strong><span className="text-[9px] text-slate-500">máy quét</span></div>
                <div><Building2 className="mx-auto h-4 w-4 text-secondary" /><strong className="mt-1 block text-sm">{room.session_count}</strong><span className="text-[9px] text-slate-500">buổi học</span></div>
              </div>
              {room.device_count === 0 && (
                <Link href="/devices" className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-bold text-primary hover:border-primary/40 hover:bg-primary/5">
                  Ghép máy quét cho phòng
                </Link>
              )}
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div><h2 className="text-lg font-extrabold text-slate-950">{editingId ? 'Cập nhật phòng học' : 'Tạo phòng học mới'}</h2><p className="mt-1 text-xs text-slate-500">Mã phòng phải duy nhất trong toàn hệ thống.</p></div>
              <button onClick={() => setShowForm(false)} className="icon-button h-9 w-9" aria-label="Đóng"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={saveRoom} className="space-y-4 p-5 sm:p-6">
              <label><span className="field-label">Mã phòng</span><input required autoFocus maxLength={20} className="field font-mono uppercase" value={form.roomCode} onChange={(event) => setForm({ ...form, roomCode: event.target.value })} placeholder="A201" /></label>
              <label><span className="field-label">Tòa nhà / khu</span><input required maxLength={80} className="field" value={form.building} onChange={(event) => setForm({ ...form, building: event.target.value })} placeholder="Tòa A" /></label>
              <label><span className="field-label">Sức chứa</span><input required min={1} max={500} type="number" className="field" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} /></label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Hủy</button>
                <button disabled={saving} className="btn-primary disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {editingId ? 'Lưu thay đổi' : 'Tạo phòng'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
