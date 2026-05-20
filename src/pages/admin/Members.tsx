import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { format } from 'date-fns';
import StatementModal from '../../components/admin/StatementModal';
import { MemberImportModal } from '../../components/admin/MemberImportModal';

type MemberRow = {
  id: string;
  member_code: string;
  category: 'A' | 'B' | 'C';
  status: string;
  join_date: string;
  initial_investment: number | null;
  monthly_installment: number | null;
  chosen_term_months: number | null;
  profiles: { full_name: string | null; phone: string | null; photo_url: string | null } | null;
};

async function callEdgeFunction<T>(name: string, payload: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.error || `${name} failed (${resp.status})`);
  }
  return body as T;
}

export function Members() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statementMemberId, setStatementMemberId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [memberCode, setMemberCode] = useState('');
  const [joinDate, setJoinDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState<'A' | 'B' | 'C'>('C');
  const [initialInvestment, setInitialInvestment] = useState('');
  const [term, setTerm] = useState('24');
  const [monthlyInstallment, setMonthlyInstallment] = useState('100');
  const [status, setStatus] = useState('active');
  const [initialPassword, setInitialPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState<{ code: string; password: string } | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('members')
      .select('id, member_code, category, status, join_date, initial_investment, monthly_installment, chosen_term_months, profiles(full_name, phone, photo_url)')
      .order('join_date', { ascending: false });
    if (err) {
      setError(err.message);
    } else if (data) {
      setMembers(data as unknown as MemberRow[]);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFullName(''); setPhone(''); setPhotoUrl(''); setPhotoFile(null);
    setMemberCode(''); setJoinDate(format(new Date(), 'yyyy-MM-dd'));
    setCategory('C'); setInitialInvestment(''); setTerm('24');
    setMonthlyInstallment('100'); setStatus('active');
    setInitialPassword(''); setError('');
  };

  const openAddModal = () => {
    resetForm();
    setEditingMemberId(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (member: MemberRow) => {
    const profile = member.profiles;
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setPhotoUrl(profile?.photo_url || '');
    setPhotoFile(null);
    setMemberCode(member.member_code || '');
    setJoinDate(member.join_date || format(new Date(), 'yyyy-MM-dd'));
    setCategory(member.category);
    setInitialInvestment(member.initial_investment?.toString() || '');
    setTerm(member.chosen_term_months?.toString() || '24');
    setMonthlyInstallment(member.monthly_installment?.toString() || '100');
    setStatus(member.status || 'active');
    setEditingMemberId(member.id);
    setIsEditModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setDeleteError('');
    setMemberToDelete(id);
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    try {
      // Delete from members first (savings/loans/repayments cascade from members FK)
      const { error: memberErr } = await supabase
        .from('members')
        .delete()
        .eq('id', memberToDelete);
      if (memberErr) throw memberErr;

      // Then delete the profile row (auth.users orphan is harmless — they can't log in without a profile)
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', memberToDelete);
      if (profileErr) throw profileErr;

      setMemberToDelete(null);
      fetchMembers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete member.');
    }
  };

  const uploadPhotoIfNeeded = async (): Promise<string> => {
    if (!photoFile) return photoUrl;
    const fileExt = photoFile.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('member-photos')
      .upload(filePath, photoFile);
    if (uploadError) {
      throw new Error(`Photo upload failed: ${uploadError.message}`);
    }
    const { data: { publicUrl } } = supabase.storage.from('member-photos').getPublicUrl(filePath);
    return publicUrl;
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    setLastCreatedCredentials(null);

    try {
      const finalPhotoUrl = await uploadPhotoIfNeeded();

      if (editingMemberId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            phone: phone || null,
            photo_url: finalPhotoUrl || null,
          })
          .eq('id', editingMemberId);
        if (profileError) throw profileError;

        const { error: memberError } = await supabase
          .from('members')
          .update({
            ...(memberCode.trim() !== '' && { member_code: memberCode.trim() }),
            join_date: joinDate,
            category,
            status,
            initial_investment: category === 'C' ? 0 : Number(initialInvestment),
            chosen_term_months: category === 'B' ? 36 : Number(term),
            monthly_installment: category === 'A' ? 1000 : (category === 'C' ? Number(monthlyInstallment) : null),
          })
          .eq('id', editingMemberId);
        if (memberError) throw memberError;

        setIsEditModalOpen(false);
        setSuccessMessage('Member updated successfully.');
      } else {
        if (!initialPassword || initialPassword.length < 6) {
          throw new Error('Initial password must be at least 6 characters. Share this with the member; they can change it later.');
        }

        const result = await callEdgeFunction<{ id: string; member_code: string; login_email: string }>(
          'admin-create-member',
          {
            full_name: fullName,
            phone: phone || null,
            photo_url: finalPhotoUrl || null,
            member_code: memberCode.trim() || null,
            category,
            initial_investment: category === 'C' ? 0 : Number(initialInvestment),
            monthly_installment: category === 'A' ? 1000 : (category === 'C' ? Number(monthlyInstallment) : null),
            chosen_term_months: category === 'B' ? 36 : Number(term),
            join_date: joinDate,
            password: initialPassword,
          },
        );

        setIsAddModalOpen(false);
        setSuccessMessage(`Member ${result.member_code} created.`);
        setLastCreatedCredentials({ code: result.member_code, password: initialPassword });
      }

      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save member.');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      (member.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.member_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.profiles?.phone || '').includes(searchQuery);
    const matchesCategory = categoryFilter === 'All' || member.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Members Directory</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="gap-2 border-[#1e5a48] text-[#1e5a48] hover:bg-[#1e5a48] hover:text-white">
            <i className="fas fa-file-excel"></i> Import Excel
          </Button>
          <Button onClick={openAddModal} className="gap-2">
            <i className="fas fa-user-plus"></i> Add New Member
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-lg border bg-green-50 text-green-700 border-green-200">
          <div className="flex justify-between items-center">
            <div>
              <p>{successMessage}</p>
              {lastCreatedCredentials && (
                <p className="mt-2 text-sm">
                  <strong>Login credentials</strong> — share with the member, then dismiss:&nbsp;
                  ID&nbsp;<code className="bg-white px-1 rounded">{lastCreatedCredentials.code}</code>&nbsp;|&nbsp;
                  Password&nbsp;<code className="bg-white px-1 rounded">{lastCreatedCredentials.password}</code>
                </p>
              )}
            </div>
            <button
              onClick={() => { setSuccessMessage(''); setLastCreatedCredentials(null); }}
              className="text-current opacity-70 hover:opacity-100"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by name, ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48] focus:border-transparent"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48] focus:border-transparent bg-white"
          >
            <option value="All">All Categories</option>
            <option value="A">Category A</option>
            <option value="B">Category B</option>
            <option value="C">Category C</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading members...</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">No members found matching your search.</td></tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/members/${member.id}`)}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10">
                          {member.profiles?.photo_url ? (
                            <img
                              src={member.profiles.photo_url}
                              alt={member.profiles?.full_name || 'Member'}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          ) : (
                            <i className="fas fa-user"></i>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{member.profiles?.full_name}</p>
                          <p className="text-xs font-mono text-[#1e5a48]">{member.member_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        member.category === 'A' ? 'bg-purple-100 text-purple-700' :
                        member.category === 'B' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        Cat {member.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="bg-green-50 text-green-600 px-2 py-1 rounded text-xs font-medium border border-green-200">
                        {member.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setStatementMemberId(member.id)} className="text-[#1e5a48] hover:text-[#154033] font-medium text-sm" title="Print Statement">
                        <i className="fas fa-print"></i>
                      </button>
                      <button onClick={() => openEditModal(member)} className="text-[#f7b05e] hover:text-[#e09d3e] font-medium text-sm" title="Edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => confirmDelete(member.id)} className="text-red-500 hover:text-red-700 font-medium text-sm" title="Delete">
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">{editingMemberId ? 'Edit Member' : 'Add New Member'}</h3>
              <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}

              <form onSubmit={handleSaveMember} className="space-y-4">
                <div className="space-y-2">
                  <Label>Member ID (Optional)</Label>
                  <Input value={memberCode} onChange={(e) => setMemberCode(e.target.value)} placeholder="Leave blank to auto-generate" />
                  <p className="text-xs text-gray-500">If blank, the system auto-generates it based on Join Date.</p>
                </div>

                <div className="space-y-2">
                  <Label>Join Date</Label>
                  <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} required />
                </div>

                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Rahul Sharma" />
                </div>

                <div className="space-y-2">
                  <Label>Mobile Number (Optional)</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} pattern="[0-9]{10}" placeholder="10 digit number" />
                </div>

                {!editingMemberId && (
                  <div className="space-y-2">
                    <Label>Initial Password</Label>
                    <Input
                      type="text"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Min 6 chars — share with member"
                    />
                    <p className="text-xs text-gray-500">The member can change this themselves after first login.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50/50">
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-[#1e5a48]/20 flex items-center justify-center overflow-hidden shadow-sm">
                      {(photoFile || photoUrl) ? (
                        <img src={photoFile ? URL.createObjectURL(photoFile) : photoUrl} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <i className="fas fa-user text-gray-300 text-2xl"></i>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1e5a48] file:text-white hover:file:bg-[#154033] cursor-pointer"
                      />
                      <p className="text-[10px] text-gray-400">JPG, PNG or WebP. Max 2MB.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'A' | 'B' | 'C')}
                  >
                    <option value="C">Category C (Public — ₹100/mo)</option>
                    <option value="B">Category B (Investor — One time)</option>
                    <option value="A">Category A (Founder — ₹1000/mo)</option>
                  </select>
                </div>

                {(category === 'A' || category === 'B') && (
                  <div className="space-y-2">
                    <Label>Initial Investment (₹)</Label>
                    <Input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(e.target.value)} required min="0" placeholder="e.g. 10000" />
                  </div>
                )}

                {category === 'C' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Term Duration</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                      >
                        <option value="24">24 Months (16% ROI)</option>
                        <option value="36">36 Months (27% ROI)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Monthly Installment (₹)</Label>
                      <Input type="number" value={monthlyInstallment} onChange={(e) => setMonthlyInstallment(e.target.value)} required min="100" step="100" placeholder="e.g. 100, 200, 500" />
                    </div>
                  </div>
                )}

                {category === 'A' && (
                  <div className="space-y-2">
                    <Label>Term Duration</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                    >
                      <option value="36">36 Months</option>
                      <option value="0">No Fixed Term</option>
                    </select>
                  </div>
                )}

                {editingMemberId && (
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="matured">Matured</option>
                    </select>
                  </div>
                )}

                <div className="pt-4">
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? 'Saving…' : (editingMemberId ? 'Update Member' : 'Create Member')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Confirm Deletion</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Delete this member? Their auth login and all associated savings, loans, and repayments will be permanently removed.</p>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setMemberToDelete(null)}>Cancel</Button>
                <Button onClick={handleDeleteMember} className="bg-red-600 hover:bg-red-700 text-white">Delete Member</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {statementMemberId && (
        <StatementModal memberId={statementMemberId} onClose={() => setStatementMemberId(null)} />
      )}

      <MemberImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={fetchMembers}
      />
    </div>
  );
}
