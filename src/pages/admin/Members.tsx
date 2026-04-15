import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { formatCurrency, safeFormatDate } from '../../lib/utils';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import StatementModal from '../../components/admin/StatementModal';

export function Members() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [importMessage, setImportMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Profile View Modal State
  const [statementMemberId, setStatementMemberId] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [joinDate, setJoinDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState('C');
  const [initialInvestment, setInitialInvestment] = useState('');
  const [term, setTerm] = useState('24');
  const [monthlyInstallment, setMonthlyInstallment] = useState('100');
  const [status, setStatus] = useState('active');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select(`
          *,
          profiles (full_name, phone)
        `)
        .order('join_date', { ascending: false });
      
      if (error) throw error;
      if (data) setMembers(data);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFullName(''); setPhone(''); setMemberCode(''); setJoinDate(format(new Date(), 'yyyy-MM-dd')); setCategory('C'); setInitialInvestment(''); setTerm('24'); setMonthlyInstallment('100'); setStatus('active');
    setEditingMemberId(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (member: any) => {
    setFullName(member.profiles?.full_name || '');
    setPhone(member.profiles?.phone || '');
    setMemberCode(member.member_code || '');
    setJoinDate(member.join_date || format(new Date(), 'yyyy-MM-dd'));
    setCategory(member.category || 'C');
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
      // 1. Find all loans for this member
      const { data: loans } = await supabase.from('loans').select('id').eq('member_id', memberToDelete);
      
      // 2. Delete loan repayments for those loans
      if (loans && loans.length > 0) {
        const loanIds = loans.map(l => l.id);
        const { error: lrError } = await supabase.from('loan_repayments').delete().in('loan_id', loanIds);
        if (lrError) throw lrError;
      }

      // 3. Delete loans
      const { error: loansError } = await supabase.from('loans').delete().eq('member_id', memberToDelete);
      if (loansError) throw loansError;

      // 4. Delete savings installments
      const { error: savingsError } = await supabase.from('savings_installments').delete().eq('member_id', memberToDelete);
      if (savingsError) throw savingsError;

      // 5. Delete from members
      const { error: memberError } = await supabase.from('members').delete().eq('id', memberToDelete);
      if (memberError) throw memberError;

      // 6. Delete from profiles
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', memberToDelete);
      if (profileError) throw profileError;

      setMemberToDelete(null);
      fetchMembers();
    } catch (err: any) {
      console.error(err);
      setDeleteError('Failed to delete member: ' + err.message);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      if (editingMemberId) {
        // Update existing member
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            phone: phone || null,
          })
          .eq('id', editingMemberId);
          
        if (profileError) throw profileError;

        const { error: memberError } = await supabase
          .from('members')
          .update({
            member_code: memberCode.trim() !== '' ? memberCode.trim() : undefined,
            join_date: joinDate,
            category: category,
            status: status,
            initial_investment: category === 'C' ? 0 : Number(initialInvestment),
            chosen_term_months: category === 'B' ? 36 : Number(term),
            monthly_installment: category === 'A' ? 1000 : (category === 'C' ? Number(monthlyInstallment) : null)
          })
          .eq('id', editingMemberId);

        if (memberError) throw memberError;
        setIsEditModalOpen(false);
      } else {
        // Add new member
        const newId = crypto.randomUUID();
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: newId,
            full_name: fullName,
            phone: phone || null,
            role: 'member'
          });
          
        if (profileError) throw profileError;

        const { error: memberError } = await supabase
          .from('members')
          .insert({
            id: newId,
            member_code: memberCode.trim() !== '' ? memberCode.trim() : undefined,
            join_date: joinDate,
            category: category,
            initial_investment: category === 'C' ? 0 : Number(initialInvestment),
            chosen_term_months: category === 'B' ? 36 : Number(term),
            monthly_installment: category === 'A' ? 1000 : (category === 'C' ? Number(monthlyInstallment) : null)
          });

        if (memberError) throw memberError;
        setIsAddModalOpen(false);
      }

      fetchMembers(); // Refresh the list
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save member.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportMessage({ type: '', text: '' });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          throw new Error("The uploaded file is empty.");
        }

        const profilesToInsert = [];
        const membersToInsert = [];

        for (const row of data as any[]) {
          const memberCode = row['MEMBER ID'] || row['Member ID'] || row['ID'] || '';
          const name = row['NAME'] || row['Name'] || row['Full Name'] || 'Unknown';
          const installment = Number(row['INSTALMENT'] || row['INSTALLMENT'] || row['Installment'] || 100);
          const phone = row['PHONE'] || row['Phone'] || null;
          const category = row['CATEGORY'] || row['Category'] || 'C';
          let joinDate = row['JOIN DATE'] || row['Join Date'];

          // Basic date formatting fallback
          if (!joinDate) {
            joinDate = format(new Date(), 'yyyy-MM-dd');
          } else if (typeof joinDate === 'number') {
            // Excel serial date conversion
            const excelEpoch = new Date(1899, 11, 30);
            const dateObj = new Date(excelEpoch.getTime() + joinDate * 86400000);
            joinDate = format(dateObj, 'yyyy-MM-dd');
          }

          const newId = crypto.randomUUID();
          profilesToInsert.push({
            id: newId,
            full_name: name,
            phone: phone ? String(phone) : null,
            role: 'member'
          });
          membersToInsert.push({
            id: newId,
            member_code: memberCode,
            join_date: joinDate,
            category: category,
            initial_investment: category === 'C' ? 0 : 0,
            chosen_term_months: 24,
            monthly_installment: installment
          });
        }

        const { error: profileError } = await supabase.from('profiles').insert(profilesToInsert);
        if (profileError) throw profileError;

        const { error: memberError } = await supabase.from('members').insert(membersToInsert);
        if (memberError) throw memberError;

        await fetchMembers();
        setImportMessage({ type: 'success', text: `Successfully imported ${data.length} members!` });
      } catch (err: any) {
        console.error(err);
        setImportMessage({ type: 'error', text: 'Error importing: ' + err.message });
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      (member.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.member_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.profiles?.phone || '').includes(searchQuery);
    
    const matchesCategory = categoryFilter === 'All' || member.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Members Directory</h2>
        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2 border-[#1e5a48] text-[#1e5a48] hover:bg-[#1e5a48] hover:text-white">
            <i className="fas fa-file-excel"></i> Import Excel
          </Button>
          <Button onClick={openAddModal} className="gap-2">
            <i className="fas fa-user-plus"></i> Add New Member
          </Button>
        </div>
      </div>

      {importMessage.text && (
        <div className={`p-4 rounded-lg border ${importMessage.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          <div className="flex justify-between items-center">
            <p>{importMessage.text}</p>
            <button onClick={() => setImportMessage({ type: '', text: '' })} className="text-current opacity-70 hover:opacity-100">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Search and Filter */}
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

      {/* Members Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Member ID</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">Loading members...</td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No members found matching your search.</td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/members/${member.id}`)}>
                    <td className="p-4 font-mono font-medium text-[#1e5a48]">{member.member_code}</td>
                    <td className="p-4 font-bold text-gray-800">{member.profiles?.full_name}</td>
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

      {/* Add/Edit Member Modal */}
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
                  <Input value={memberCode} onChange={(e) => setMemberCode(e.target.value)} placeholder="Leave blank to auto-generate (e.g. EUS/022026/C/045)" />
                  <p className="text-xs text-gray-500">If you leave this blank, the system will automatically generate it based on the Join Date.</p>
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
                  <Label>Category</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="C">Category C (Public - ₹100/mo)</option>
                    <option value="B">Category B (Investor - One time)</option>
                    <option value="A">Category A (Founder - ₹1000/mo)</option>
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
                    {formLoading ? 'Saving...' : (editingMemberId ? 'Update Member' : 'Create Member')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Confirm Deletion</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Are you sure you want to delete this member? This action cannot be undone and will remove all associated data.</p>
              
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setMemberToDelete(null)}>
                  Cancel
                </Button>
                <Button onClick={handleDeleteMember} className="bg-red-600 hover:bg-red-700 text-white">
                  Delete Member
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {statementMemberId && (
        <StatementModal 
          memberId={statementMemberId} 
          onClose={() => setStatementMemberId(null)} 
        />
      )}
    </div>
  );
}
