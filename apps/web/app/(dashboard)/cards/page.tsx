'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Plus, Search, Trash2, Smartphone, Loader2, X, AlertCircle } from 'lucide-react';
import { fetchCardsAdmin, fetchStudentsAdmin, registerCardAdmin, deleteCardAdmin } from './actions';

export default function CardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    uid_hex: ''
  });
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    const [cardsData, studentsData] = await Promise.all([
      fetchCardsAdmin(),
      fetchStudentsAdmin()
    ]);
    setCards(cardsData);
    setStudents(studentsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    const res = await registerCardAdmin(formData.student_id, formData.uid_hex);
    if (res.success) {
      setShowModal(false);
      setFormData({ student_id: '', uid_hex: '' });
      loadData();
    } else {
      setErrorMsg(res.error || 'Có lỗi xảy ra');
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (cardId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa/hủy thẻ NFC này? Sinh viên sẽ không thể dùng thẻ này để điểm danh nữa.')) {
      await deleteCardAdmin(cardId);
      loadData();
    }
  };

  const filteredCards = cards.filter(c => {
    const student = Array.isArray(c.students) ? c.students[0] : c.students;
    const q = searchQuery.toLowerCase();
    return student?.full_name?.toLowerCase().includes(q) || 
           student?.student_code?.toLowerCase().includes(q) ||
           c.uid_hash.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-border rounded-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Quản lý Thẻ NFC
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Liên kết mã thẻ vật lý với thông tin sinh viên trên hệ thống
          </p>
        </div>
        
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Đăng ký thẻ mới
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white border border-border rounded-sm shadow-sm">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên, mã SV hoặc mã Hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-input rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Tổng cộng: <span className="font-semibold text-foreground">{cards.length}</span> thẻ đã cấp
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="py-3 px-6 font-medium">Mã sinh viên</th>
                <th className="py-3 px-6 font-medium">Họ và tên</th>
                <th className="py-3 px-6 font-medium">Lớp</th>
                <th className="py-3 px-6 font-medium">Mã Hash (UID Thẻ)</th>
                <th className="py-3 px-6 font-medium">Trạng thái</th>
                <th className="py-3 px-6 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    Không tìm thấy thẻ nào
                  </td>
                </tr>
              ) : (
                filteredCards.map((card) => {
                  const student = Array.isArray(card.students) ? card.students[0] : card.students;
                  const cls = Array.isArray(student?.classes) ? student.classes[0] : student?.classes;
                  return (
                    <tr key={card.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-4 px-6 font-medium text-foreground">{student?.student_code}</td>
                      <td className="py-4 px-6 text-muted-foreground">{student?.full_name}</td>
                      <td className="py-4 px-6 text-muted-foreground">{cls?.class_name}</td>
                      <td className="py-4 px-6 font-mono text-xs text-muted-foreground truncate max-w-[150px]" title={card.uid_hash}>
                        {card.uid_hash.substring(0, 12)}...
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          {card.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDelete(card.id)}
                          className="text-sm font-medium text-destructive hover:underline flex items-center justify-end w-full gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Hủy thẻ
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-md shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-secondary" />
                Đăng ký Thẻ NFC Mới
              </h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterCard} className="p-6 space-y-5">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 rounded-sm text-sm flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Chọn Sinh Viên</label>
                <select
                  required
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  className="w-full p-2 border border-input rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Chọn sinh viên --</option>
                  {students.map(st => {
                    const cls = Array.isArray(st.classes) ? st.classes[0] : st.classes;
                    return (
                      <option key={st.id} value={st.id}>
                        {st.student_code} - {st.full_name} ({cls?.class_name})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Mã UID của thẻ (Số sê-ri Hex)</label>
                <input
                  required
                  type="text"
                  placeholder="VD: 80:74:D7:0D"
                  value={formData.uid_hex}
                  onChange={(e) => setFormData({ ...formData, uid_hex: e.target.value })}
                  className="w-full p-2 border border-input rounded-sm text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground pt-1">
                  Mở ứng dụng NFC Tools trên điện thoại, quét thẻ và nhập mã Số sê-ri (UID) vào đây.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 text-foreground rounded-sm"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Đăng ký thẻ'
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
