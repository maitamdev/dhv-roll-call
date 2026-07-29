'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Copy, Laptop, Plus, RefreshCw, ShieldCheck } from 'lucide-react';

type Room = { id: string; room_code: string; building: string; capacity: number };
type Device = {
  id: string;
  device_uuid: string;
  device_name: string;
  android_version: string | null;
  status: 'PENDING' | 'APPROVED' | 'BLOCKED';
  last_seen_at: string | null;
  paired_at: string | null;
  room_id?: string | null;
  rooms?: { room_code?: string } | { room_code?: string }[] | null;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomForm, setRoomForm] = useState({ roomCode: '', building: '', capacity: 40 });
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string; roomCode: string } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    const [deviceResponse, roomResponse] = await Promise.all([
      fetch('/api/admin/devices', { cache: 'no-store' }),
      fetch('/api/admin/rooms', { cache: 'no-store' }),
    ]);
    const [deviceBody, roomBody] = await Promise.all([
      deviceResponse.json().catch(() => null),
      roomResponse.json().catch(() => null),
    ]);
    setDevices(deviceBody?.devices || []);
    setRooms(roomBody?.rooms || []);
    setRoomId((current) => current || roomBody?.rooms?.[0]?.id || '');
    if (!deviceResponse.ok || !roomResponse.ok) {
      setMessage({ tone: 'error', text: deviceBody?.message || roomBody?.message || 'Không thể tải dữ liệu thiết bị.' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchWorkspace(); }, [fetchWorkspace]);

  async function createRoom(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch('/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomForm),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage({ tone: 'error', text: body?.message || 'Không thể tạo phòng.' });
    } else {
      setMessage({ tone: 'success', text: `Đã tạo phòng ${body.room.room_code}.` });
      setRoomForm({ roomCode: '', building: '', capacity: 40 });
      setRoomId(body.room.id);
      await fetchWorkspace();
    }
    setSaving(false);
  }

  async function createPairing() {
    if (!name.trim() || !roomId) {
      setMessage({ tone: 'error', text: 'Hãy nhập tên máy quét và chọn phòng cố định.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const response = await fetch('/api/admin/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, roomId }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage({ tone: 'error', text: body?.message || 'Không thể tạo mã ghép nối.' });
    } else {
      const room = rooms.find((item) => item.id === roomId);
      setPairing({ code: body.pairingCode, expiresAt: body.expiresAt, roomCode: room?.room_code || '' });
      setName('');
      setMessage({ tone: 'success', text: 'Mã ghép nối đã sẵn sàng trong 10 phút.' });
      await fetchWorkspace();
    }
    setSaving(false);
  }

  async function patchDevice(id: string, payload: { status?: 'APPROVED' | 'BLOCKED'; roomId?: string }) {
    setMessage(null);
    const response = await fetch('/api/admin/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) setMessage({ tone: 'error', text: body?.message || 'Không thể cập nhật máy quét.' });
    await fetchWorkspace();
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="page-header">
        <div>
          <p className="page-kicker">Chuỗi tin cậy phần cứng</p>
          <h1 className="page-title flex items-center gap-2"><Laptop className="h-6 w-6 text-secondary" /> Máy quét cố định</h1>
          <p className="mt-1 text-sm text-slate-500">Mỗi máy chỉ ghép một lần và được khóa với đúng phòng học.</p>
        </div>
        <button onClick={() => void fetchWorkspace()} className="icon-button" aria-label="Làm mới"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <form onSubmit={createRoom} className="panel p-5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-primary"><Building2 className="h-4 w-4 text-secondary" /> Tạo phòng học</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Tạo phòng trước, sau đó gắn máy quét cố định vào phòng.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label><span className="field-label">Mã phòng</span><input required className="field font-mono uppercase" value={roomForm.roomCode} onChange={(event) => setRoomForm({ ...roomForm, roomCode: event.target.value })} placeholder="A201" /></label>
            <label><span className="field-label">Tòa nhà</span><input required className="field" value={roomForm.building} onChange={(event) => setRoomForm({ ...roomForm, building: event.target.value })} placeholder="Nhà A" /></label>
            <label><span className="field-label">Sức chứa</span><input required min={1} max={500} type="number" className="field" value={roomForm.capacity} onChange={(event) => setRoomForm({ ...roomForm, capacity: Number(event.target.value) })} /></label>
            <button disabled={saving} className="btn-secondary self-end disabled:opacity-50"><Plus className="h-4 w-4" /> Tạo phòng</button>
          </div>
        </form>

        <section className="panel grid gap-5 p-5 lg:grid-cols-[1fr_.8fr]">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold text-primary"><ShieldCheck className="h-4 w-4 text-secondary" /> Ghép máy quét một lần</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Mã hết hạn sau 10 phút. Thiết bị tạo khóa riêng trong Android Keystore.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label><span className="field-label">Tên máy quét</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Máy quét A201" /></label>
              <label><span className="field-label">Phòng cố định</span><select className="field" value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Chọn phòng</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.room_code} · {room.building}</option>)}</select></label>
            </div>
            <button disabled={saving || rooms.length === 0} className="btn-primary mt-3 disabled:opacity-50" onClick={() => void createPairing()}><Plus className="h-4 w-4" /> Tạo mã ghép nối</button>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {pairing ? (
              <>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Mã cho máy tại phòng {pairing.roomCode}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <strong className="font-mono text-3xl tracking-[0.16em] text-primary">{pairing.code}</strong>
                  <button className="icon-button" onClick={() => navigator.clipboard.writeText(pairing.code)} aria-label="Sao chép"><Copy className="h-4 w-4" /></button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Hết hạn lúc {new Date(pairing.expiresAt).toLocaleTimeString('vi-VN')}</p>
              </>
            ) : <div className="flex min-h-24 items-center gap-3 text-sm text-slate-500"><ShieldCheck className="h-7 w-7 text-emerald-600" /> Chưa cấp mã ghép nối.</div>}
          </div>
        </section>
      </div>

      <div className="data-shell overflow-x-auto">
        <table className="data-table text-xs">
          <thead><tr><th>Thiết bị</th><th>UUID</th><th>Phòng cố định</th><th>Lần cuối</th><th>Trạng thái</th><th className="text-right">Thao tác</th></tr></thead>
          <tbody>
            {devices.map((device) => {
              const room = Array.isArray(device.rooms) ? device.rooms[0] : device.rooms;
              return (
                <tr key={device.id}>
                  <td><strong>{device.device_name}</strong><span className="mt-1 block text-[10px] text-slate-500">{device.android_version || 'Chưa ghép nối'}</span></td>
                  <td className="font-mono text-[11px]">{device.device_uuid}</td>
                  <td>
                    <select className="field min-w-36 py-2 text-xs" value={device.room_id || ''} onChange={(event) => void patchDevice(device.id, { roomId: event.target.value })}>
                      <option value="">Chưa gán</option>
                      {rooms.map((item) => <option key={item.id} value={item.id}>{item.room_code}</option>)}
                    </select>
                    {!device.room_id && <span className="mt-1 block text-[10px] font-bold text-amber-700">{room?.room_code || 'Cần gán phòng'}</span>}
                  </td>
                  <td>{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('vi-VN') : 'Chưa kết nối'}</td>
                  <td><span className={`status-chip ${device.status === 'APPROVED' ? 'status-success' : device.status === 'BLOCKED' ? 'status-danger' : 'status-warning'}`}>{device.status === 'APPROVED' ? 'Đã tin cậy' : device.status === 'BLOCKED' ? 'Đã khóa' : 'Chờ ghép'}</span></td>
                  <td className="text-right">{device.status === 'BLOCKED' ? <button className="btn-secondary px-3 py-2" onClick={() => void patchDevice(device.id, { status: 'APPROVED' })}>Mở khóa</button> : <button className="btn-secondary px-3 py-2 text-red-600" onClick={() => void patchDevice(device.id, { status: 'BLOCKED' })}>Khóa</button>}</td>
                </tr>
              );
            })}
            {!loading && devices.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-500">Chưa có máy quét nào được đăng ký.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
