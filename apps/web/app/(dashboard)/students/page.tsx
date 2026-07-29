'use client';

import { useState, useEffect } from 'react';
import { Users, Search, Download, Upload, Plus, RefreshCw, X, Loader2, AlertCircle } from 'lucide-react';
import { fetchStudentsPageAdmin, fetchClassesAdmin, addStudentAdmin } from './actions';

export default function StudentsPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    student_code: '',
    full_name: '',
    email: '',
    phone: '',
    class_id: ''
  });

  const loadData = async () => {
    setLoading(true);
    const [studentsData, classesData] = await Promise.all([
      fetchStudentsPageAdmin(),
      fetchClassesAdmin()
    ]);
    
    const formatted = studentsData.map((s: any) => {
      const cls = Array.isArray(s.classes) ? s.classes[0] : s.classes;
      const card = Array.isArray(s.student_cards) ? s.student_cards[0] : s.student_cards;
      return {
        id: s.id,
        code: s.student_code,
        name: s.full_name,
        class: cls?.class_name || cls?.class_code || 'Chưa xếp lớp',
        email: s.email || '--',
        phone: s.phone || '--',
        cardUidMasked: card?.uid_masked || 'Chưa gán',
        cardStatus: card?.status || 'INACTIVE'
      };
    });
    setStudents(formatted);
    setClasses(classesData);
    
    if (classesData.length > 0 && !formData.class_id) {
      setFormData(prev => ({ ...prev, class_id: classesData[0].id }));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    const res = await addStudentAdmin(formData);
    if (res.success) {
      setShowModal(false);
      setFormData({
        student_code: '',
        full_name: '',
        email: '',
        phone: '',
        class_id: classes.length > 0 ? classes[0].id : ''
      });
      loadData();
    } else {
      setErrorMsg(res.error || 'Có lỗi xảy ra');
    }
    setIsSubmitting(false);
  };

  const filtered = students.filter(s => {
    const matchClass = selectedClass === 'ALL' || s.class.includes(selectedClass);
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase());
    return matchClass && matchSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="page-kicker">Hồ sơ đào tạo</p>
          <h1 className="page-title flex items-center gap-2">
            <Users className="h-6 w-6 text-secondary" />
            Quản lý sinh viên
          </h1>
          <p className="page-description">Tìm kiếm, cập nhật và theo dõi trạng thái thẻ của sinh viên toàn trường.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadData} className="icon-button" aria-label="Làm mới">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn-secondary hidden sm:flex">
            <Upload className="w-4 h-4 text-emerald-700" />
            <span>Nhập Excel</span>
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Sinh Viên</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="toolbar">
        <div className="flex items-center gap-2">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="field w-auto py-2 text-xs font-bold"
          >
            <option value="ALL">Tất cả lớp học</option>
            {classes.map(c => (
              <option key={c.id} value={c.class_name}>{c.class_name}</option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm tên hoặc MSSV..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field pl-9 text-xs"
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="data-shell">
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th className="py-3.5 px-4">Sinh viên</th>
                <th className="py-3.5 px-4">Mã sinh viên</th>
                <th className="py-3.5 px-4">Lớp</th>
                <th className="py-3.5 px-4">Liên hệ</th>
                <th className="py-3.5 px-4">Trạng thái thẻ NFC</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                    Không tìm thấy sinh viên nào
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{s.code}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-semibold">{s.class}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[10px]">
                      <div>{s.email}</div>
                      <div>{s.phone}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {s.cardStatus === 'ACTIVE' ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 font-extrabold text-[10px] inline-flex items-center gap-1">
                          ĐÃ GÁN THẺ
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 font-extrabold text-[10px] inline-flex items-center gap-1">
                          CHƯA CÓ
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-slate-800 text-[11px] font-bold">
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-md">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h3 className="flex items-center gap-2 font-bold text-slate-950">
                <Plus className="h-5 w-5 text-secondary" />
                Thêm sinh viên mới
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-300 text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 uppercase">Họ và tên *</label>
                <input
                  required
                  type="text"
                  placeholder="VD: Nguyễn Văn A"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 uppercase">Mã số sinh viên *</label>
                <input
                  required
                  type="text"
                  placeholder="VD: 2151120000"
                  value={formData.student_code}
                  onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                  className="field font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 uppercase">Lớp học *</label>
                <select
                  required
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="field"
                >
                  <option value="">-- Chọn lớp --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 uppercase">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="field"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 uppercase">Điện thoại</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="field"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Lưu Sinh Viên'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
