'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Download, Upload, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StudentsPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [students, setStudents] = useState<any[]>([]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('students')
        .select(`
          id, student_code, full_name, email, phone, status,
          classes (class_name, class_code),
          student_cards (uid_masked, status)
        `);

      if (data) {
        const formatted = data.map((s: any) => {
          const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
          const card = Array.isArray(s.student_cards) ? s.student_cards[0] : s.student_cards;
          return {
            id: s.id,
            code: s.student_code,
            name: s.full_name,
            class: cls?.class_name || cls?.class_code || 'CT07PM',
            email: s.email,
            phone: s.phone || '',
            cardUidMasked: card?.uid_masked || 'Chưa gán',
            cardStatus: card?.status || 'INACTIVE'
          };
        });
        setStudents(formatted);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filtered = students.filter(s => {
    const matchClass = selectedClass === 'ALL' || s.class === selectedClass;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-white border-2 border-slate-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-red-600" />
            Quản Lý Sinh Viên & Thẻ NFC
          </h1>
          <p className="text-xs text-slate-600 font-medium mt-0.5">Danh sách sinh viên và thẻ NFC MIFARE Classic 1K từ Supabase DB</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchStudents} className="p-2.5 bg-slate-100 border border-slate-400 text-slate-800 hover:bg-slate-200">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase border border-slate-400 flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-emerald-700" />
            <span>Import Excel</span>
          </button>
          <button className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase border border-slate-400 flex items-center gap-1.5">
            <Download className="w-4 h-4 text-blue-700" />
            <span>Export Excel</span>
          </button>
          <button className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold uppercase border border-red-800 flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Thêm Sinh Viên</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-slate-300">
        <div className="flex items-center gap-2">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-400 text-slate-900 text-xs font-bold focus:outline-none"
          >
            <option value="ALL">Tất cả lớp học</option>
            <option value="CT07PM">Lớp CT07PM (K7)</option>
            <option value="CT08PM">Lớp CT08PM (K8)</option>
          </select>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm tên hoặc MSSV..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-400 text-slate-900 text-xs font-medium focus:outline-none focus:border-slate-900"
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white border-2 border-slate-900 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs sharp-table">
          <thead className="bg-slate-100 text-slate-700 border-b-2 border-slate-300 uppercase font-bold text-[11px] tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Sinh viên</th>
              <th className="py-3.5 px-4">Mã sinh viên</th>
              <th className="py-3.5 px-4">Lớp</th>
              <th className="py-3.5 px-4">Email / Điện thoại</th>
              <th className="py-3.5 px-4">Mã Thẻ (UID Masked)</th>
              <th className="py-3.5 px-4 text-center">Trạng thái thẻ</th>
              <th className="py-3.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="py-3.5 px-4 font-bold text-slate-900">{s.name}</td>
                <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{s.code}</td>
                <td className="py-3.5 px-4 text-slate-700 font-semibold">{s.class}</td>
                <td className="py-3.5 px-4 text-slate-600 font-mono">{s.email}</td>
                <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.cardUidMasked}</td>
                <td className="py-3.5 px-4 text-center">
                  {s.cardStatus === 'ACTIVE' ? (
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 font-extrabold text-[10px]">
                      HOẠT ĐỘNG
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-red-100 text-red-800 border border-red-400 font-extrabold text-[10px]">
                      BÁO MẤT (LOST)
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold mr-1">
                    Đổi thẻ
                  </button>
                  <button className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-slate-800 text-[11px] font-bold">
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
