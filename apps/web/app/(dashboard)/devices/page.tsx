'use client';

import { useState, useEffect } from 'react';
import { Smartphone, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DevicesPage() {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<any[]>([]);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('devices')
        .select(`
          id, device_uuid, device_name, android_version, status, last_seen_at,
          users (full_name)
        `);

      if (data) {
        const formatted = data.map((d: any) => {
          const owner = Array.isArray(d.users) ? d.users[0] : d.users;
          return {
            id: d.id,
            uuid: d.device_uuid,
            name: d.device_name,
            version: d.android_version || 'Android 13',
            owner: owner?.full_name || 'TS. Nguyễn Văn An',
            status: d.status,
            lastSeen: d.last_seen_at ? new Date(d.last_seen_at).toLocaleTimeString('vi-VN') : 'Vừa xong'
          };
        });
        setDevices(formatted);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const toggleStatus = async (id: string, newStatus: 'APPROVED' | 'BLOCKED') => {
    try {
      await supabase
        .from('devices')
        .update({ status: newStatus })
        .eq('id', id);

      fetchDevices();
    } catch (err) {
      console.error('Error updating device:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      <div className="bg-white border-2 border-slate-900 p-6 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-purple-700" />
            Quản Lý Thiết Bị Android Quét NFC
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">Phê duyệt hoặc khóa quyền quét thẻ NFC của điện thoại từ Supabase DB</p>
        </div>

        <button onClick={fetchDevices} className="p-2.5 bg-slate-100 border border-slate-400 text-slate-800 hover:bg-slate-200">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white border-2 border-slate-900 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs sharp-table">
          <thead className="bg-slate-100 text-slate-700 border-b-2 border-slate-300 uppercase font-bold text-[11px] tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Tên điện thoại</th>
              <th className="py-3.5 px-4">Mã UUID</th>
              <th className="py-3.5 px-4">Hệ điều hành</th>
              <th className="py-3.5 px-4">Chủ sở hữu</th>
              <th className="py-3.5 px-4">Lần truy cập cuối</th>
              <th className="py-3.5 px-4 text-center">Trạng thái</th>
              <th className="py-3.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {devices.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="py-3.5 px-4 font-bold text-slate-900">{d.name}</td>
                <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{d.uuid}</td>
                <td className="py-3.5 px-4 text-slate-700 font-medium">{d.version}</td>
                <td className="py-3.5 px-4 text-slate-800 font-bold">{d.owner}</td>
                <td className="py-3.5 px-4 text-slate-600 font-mono">{d.lastSeen}</td>
                <td className="py-3.5 px-4 text-center">
                  {d.status === 'APPROVED' && (
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 font-extrabold text-[10px]">
                      ĐÃ PHÊ DUYỆT
                    </span>
                  )}
                  {d.status === 'PENDING' && (
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-400 font-extrabold text-[10px]">
                      CHỜ PHÊ DUYỆT
                    </span>
                  )}
                  {d.status === 'BLOCKED' && (
                    <span className="px-2.5 py-0.5 bg-red-100 text-red-800 border border-red-400 font-extrabold text-[10px]">
                      ĐÃ KHÓA
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right">
                  {d.status !== 'APPROVED' && (
                    <button
                      onClick={() => toggleStatus(d.id, 'APPROVED')}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold mr-1 border border-emerald-900"
                    >
                      Phê duyệt
                    </button>
                  )}
                  {d.status !== 'BLOCKED' && (
                    <button
                      onClick={() => toggleStatus(d.id, 'BLOCKED')}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold border border-red-800"
                    >
                      Khóa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
