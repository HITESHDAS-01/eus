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
  profiles: {
    full_name: string | null;
    phone: string | null;
    photo_url: string | null;
    address: string | null;
    father_husband_name: string | null;
    gender: string | null;
    date_of_birth: string | null;
    aadhaar_vid: string | null;
    nominee_name: string | null;
  } | null;
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'join_desc' | 'join_asc' | 'name_asc' | 'name_desc' | 'code_asc' | 'code_desc'>('join_desc');
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
  // Personal info
  const [address, setAddress] = useState('');
  const [fatherHusbandName, setFatherHusbandName] = useState('');
  const [gender, setGender] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [aadhaarVid, setAadhaarVid] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [resetPassword, setResetPassword] = useState(''); // optional, edit modal only
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
      .select('id, member_code, category, status, join_date, initial_investment, monthly_installment, chosen_term_months, profiles(full_name, phone, photo_url, address, father_husband_name, gender, date_of_birth, aadhaar_vid, nominee_name)')
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
    setInitialPassword(''); setResetPassword(''); setError('');
    setAddress(''); setFatherHusbandName(''); setGender('');
    setDateOfBirth(''); setAadhaarVid(''); setNomineeName('');
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
    setAddress(profile?.address || '');
    setFatherHusbandName(profile?.father_husband_name || '');
    setGender(profile?.gender || '');
    setDateOfBirth(profile?.date_of_birth || '');
    setAadhaarVid(profile?.aadhaar_vid || '');
    setNomineeName(profile?.nominee_name || '');
    setResetPassword('');
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
      // If this member was in the selection set, drop it.
      setSelectedIds((prev) => {
        if (!prev.has(memberToDelete)) return prev;
        const next = new Set(prev);
        next.delete(memberToDelete);
        return next;
      });
      fetchMembers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete member.');
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    setBulkDeleteError('');
    try {
      const ids = Array.from(selectedIds);
      // members first (cascade), then profiles. Both via .in() for one round-trip each.
      const { error: memberErr } = await supabase.from('members').delete().in('id', ids);
      if (memberErr) throw memberErr;
      const { error: profileErr } = await supabase.from('profiles').delete().in('id', ids);
      if (profileErr) throw profileErr;

      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      setSuccessMessage(`${ids.length} member${ids.length === 1 ? '' : 's'} deleted.`);
      fetchMembers();
    } catch (err) {
      setBulkDeleteError(err instanceof Error ? err.message : 'Failed to delete selected members.');
    } finally {
      setBulkDeleting(false);
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
            address: address || null,
            father_husband_name: fatherHusbandName || null,
            gender: gender || null,
            date_of_birth: dateOfBirth || null,
            aadhaar_vid: aadhaarVid || null,
            nominee_name: nomineeName || null,
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

        // Optional password reset
        if (resetPassword.trim() !== '') {
          if (resetPassword.length < 6) {
            throw new Error('New password must be at least 6 characters.');
          }
          await callEdgeFunction<{ ok: boolean }>('admin-reset-member-password', {
            member_id: editingMemberId,
            new_password: resetPassword,
          });
        }

        setIsEditModalOpen(false);
        setSuccessMessage(
          resetPassword.trim() !== ''
            ? `Member updated. New password: ${resetPassword}`
            : 'Member updated successfully.'
        );
      } else {
        if (initialPassword && initialPassword.length < 6) {
          throw new Error('Initial password must be at least 6 characters (or leave blank to auto-generate).');
        }

        const result = await callEdgeFunction<{ id: string; member_code: string; login_email: string; password: string }>(
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
            password: initialPassword || '__AUTO__',
            address: address || null,
            father_husband_name: fatherHusbandName || null,
            gender: gender || null,
            date_of_birth: dateOfBirth || null,
            aadhaar_vid: aadhaarVid || null,
            nominee_name: nomineeName || null,
          },
        );

        setIsAddModalOpen(false);
        setSuccessMessage(`Member ${result.member_code} created.`);
        setLastCreatedCredentials({ code: result.member_code, password: result.password || initialPassword });
      }

      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save member.');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredMembers = members
    .filter((member) => {
      const matchesSearch =
        (member.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.member_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.profiles?.phone || '').includes(searchQuery);
      const matchesCategory = categoryFilter === 'All' || member.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const nameA = (a.profiles?.full_name || '').toLowerCase();
      const nameB = (b.profiles?.full_name || '').toLowerCase();
      const codeA = a.member_code || '';
      const codeB = b.member_code || '';
      const dateA = a.join_date || '';
      const dateB = b.join_date || '';
      switch (sortBy) {
        case 'name_asc':  return nameA.localeCompare(nameB);
        case 'name_desc': return nameB.localeCompare(nameA);
        case 'code_asc':  return codeA.localeCompare(codeB);
        case 'code_desc': return codeB.localeCompare(codeA);
        case 'join_asc':  return dateA.localeCompare(dateB);
        case 'join_desc':
        default:          return dateB.localeCompare(dateA);
      }
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
        <div className="w-full sm:w-56">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48] focus:border-transparent bg-white"
            title="Sort members"
          >
            <option value="join_desc">Newest first (join date)</option>
            <option value="join_asc">Oldest first (join date)</option>
            <option value="name_asc">Name A → Z</option>
            <option value="name_desc">Name Z → A</option>
            <option value="code_asc">Member ID A → Z</option>
            <option value="code_desc">Member ID Z → A</option>
          </select>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-900">
            <i className="fas fa-check-square text-amber-600"></i>
            <span><strong>{selectedIds.size}</strong> member{selectedIds.size === 1 ? '' : 's'} selected</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedIds(new Set())} className="gap-2">
              <i className="fas fa-times"></i> Clear
            </Button>
            <Button
              onClick={() => { setBulkDeleteError(''); setIsBulkDeleteModalOpen(true); }}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
            >
              <i className="fas fa-trash"></i> Delete Selected
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 cursor-pointer accent-[#1e5a48]"
                    aria-label="Select all on this page"
                    ref={(el) => {
                      if (!el) return;
                      const visibleIds = filteredMembers.map(m => m.id);
                      const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
                      const someSelected = visibleIds.some(id => selectedIds.has(id));
                      el.checked = allSelected;
                      el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={(e) => {
                      const visibleIds = filteredMembers.map(m => m.id);
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) {
                          visibleIds.forEach(id => next.add(id));
                        } else {
                          visibleIds.forEach(id => next.delete(id));
                        }
                        return next;
                      });
                    }}
                  />
                </th>
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading members...</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No members found matching your search.</td></tr>
              ) : (
                filteredMembers.map((member) => {
                  const isSelected = selectedIds.has(member.id);
                  return (
                    <tr
                      key={member.id}
                      className={`transition-colors cursor-pointer ${isSelected ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-gray-50'}`}
                      onClick={() => navigate(`/admin/members/${member.id}`)}
                    >
                      <td className="p-4 w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-[#1e5a48]"
                          aria-label={`Select ${member.profiles?.full_name || member.member_code}`}
                          checked={isSelected}
                          onChange={() => toggleSelectOne(member.id)}
                        />
                      </td>
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
                  );
                })
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

                <div className="space-y-2">
                  <Label>Father / Husband Name (Optional)</Label>
                  <Input value={fatherHusbandName} onChange={(e) => setFatherHusbandName(e.target.value)} placeholder="Guardian or spouse name" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Gender (Optional)</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth (Optional)</Label>
                    <Input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Address (Optional)</Label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    placeholder="Residential address"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Aadhaar / VID No. (Optional)</Label>
                  <Input
                    type="text"
                    value={aadhaarVid}
                    onChange={(e) => setAadhaarVid(e.target.value.replace(/[\s-]/g, ''))}
                    pattern="[0-9]{12}"
                    maxLength={12}
                    placeholder="12-digit Aadhaar / VID"
                    autoComplete="off"
                  />
                  {aadhaarVid && !/^\d{12}$/.test(aadhaarVid) && (
                    <p className="text-xs text-yellow-700"><i className="fas fa-exclamation-triangle"></i> Should be 12 digits</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Nominee Name (Optional)</Label>
                  <Input value={nomineeName} onChange={(e) => setNomineeName(e.target.value)} placeholder="Nominee for the account" />
                </div>

                {!editingMemberId && (
                  <div className="space-y-2 border-t border-gray-200 pt-4">
                    <Label>Initial Password <span className="text-gray-400 font-normal">— optional</span></Label>
                    <Input
                      type="text"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      minLength={6}
                      placeholder="Leave blank to auto-generate as EUS@<seq>"
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-gray-500">Blank → auto-generates <code className="bg-gray-100 px-1 rounded">EUS@001</code>-style password from the member's sequence number.</p>
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

                {editingMemberId && (
                  <div className="space-y-2 border-t border-gray-200 pt-4">
                    <Label>Reset Password <span className="text-gray-400 font-normal">— optional</span></Label>
                    <Input
                      type="text"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      minLength={6}
                      placeholder="Leave blank to keep current password"
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-gray-500">If set, the member's login password will be replaced. Min 6 characters. Share with the member after saving.</p>
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

      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Delete {selectedIds.size} Members?</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Permanently delete <strong>{selectedIds.size}</strong> selected member{selectedIds.size === 1 ? '' : 's'}? All their savings, loans, and repayments will be removed too. This cannot be undone.
              </p>
              <div className="max-h-40 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm space-y-1">
                {filteredMembers
                  .filter((m) => selectedIds.has(m.id))
                  .slice(0, 20)
                  .map((m) => (
                    <div key={m.id} className="flex justify-between">
                      <span className="font-medium">{m.profiles?.full_name || '—'}</span>
                      <span className="font-mono text-xs text-gray-500">{m.member_code}</span>
                    </div>
                  ))}
                {selectedIds.size > 20 && (
                  <p className="text-xs text-gray-500 italic pt-2 border-t border-gray-200">
                    …and {selectedIds.size - 20} more
                  </p>
                )}
              </div>
              {bulkDeleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{bulkDeleteError}</div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setIsBulkDeleteModalOpen(false)} disabled={bulkDeleting}>Cancel</Button>
                <Button onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-red-600 hover:bg-red-700 text-white">
                  {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size} Members`}
                </Button>
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
