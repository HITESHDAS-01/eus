import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Label } from '../../../components/ui/basic';
import { safeFormatDate } from '../../../lib/utils';

// ---------------------------------------------------------------------------
// EMI Customers — external public who take product EMI from us.
// No auth/login; admin-managed CRUD with KYC fields.
// ---------------------------------------------------------------------------

type Customer = {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  father_husband_name: string | null;
  date_of_birth: string | null;
  aadhaar_vid: string | null;
  pan_number: string | null;
  occupation: string | null;
  monthly_income: number | null;
  nominee_name: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
};

type SortKey = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'code_asc' | 'code_desc';

export function EmiCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('created_desc');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [fatherHusbandName, setFatherHusbandName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [aadhaarVid, setAadhaarVid] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [occupation, setOccupation] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('emi_customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setCustomers(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setFullName(''); setPhone(''); setAddress(''); setFatherHusbandName('');
    setDateOfBirth(''); setAadhaarVid(''); setPanNumber('');
    setOccupation(''); setMonthlyIncome(''); setNomineeName('');
    setNotes(''); setPhotoUrl(''); setPhotoFile(null);
    setFormError('');
  };

  const openAdd = () => {
    resetForm();
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    resetForm();
    setEditingId(c.id);
    setFullName(c.full_name || '');
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setFatherHusbandName(c.father_husband_name || '');
    setDateOfBirth(c.date_of_birth || '');
    setAadhaarVid(c.aadhaar_vid || '');
    setPanNumber(c.pan_number || '');
    setOccupation(c.occupation || '');
    setMonthlyIncome(c.monthly_income?.toString() || '');
    setNomineeName(c.nominee_name || '');
    setNotes(c.notes || '');
    setPhotoUrl(c.photo_url || '');
    setIsModalOpen(true);
  };

  const uploadPhotoIfNeeded = async (): Promise<string> => {
    if (!photoFile) return photoUrl;
    const fileExt = photoFile.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `emi-customers/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('member-photos')
      .upload(filePath, photoFile);
    if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
    const { data: { publicUrl } } = supabase.storage.from('member-photos').getPublicUrl(filePath);
    return publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (!fullName.trim()) throw new Error('Full name is required');
      const finalPhoto = await uploadPhotoIfNeeded();
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        father_husband_name: fatherHusbandName.trim() || null,
        date_of_birth: dateOfBirth || null,
        aadhaar_vid: aadhaarVid.trim() || null,
        pan_number: panNumber.trim().toUpperCase() || null,
        occupation: occupation.trim() || null,
        monthly_income: monthlyIncome ? Number(monthlyIncome) : null,
        nominee_name: nomineeName.trim() || null,
        notes: notes.trim() || null,
        photo_url: finalPhoto || null,
      };

      if (editingId) {
        const { error: err } = await supabase.from('emi_customers').update(payload).eq('id', editingId);
        if (err) throw err;
        setSuccessMessage('Customer updated successfully.');
      } else {
        const { error: err } = await supabase.from('emi_customers').insert(payload);
        if (err) throw err;
        setSuccessMessage('Customer added.');
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { error: err } = await supabase.from('emi_customers').delete().eq('id', customerToDelete.id);
      if (err) {
        if (err.message?.toLowerCase().includes('foreign key')) {
          throw new Error('This customer has EMI loans linked. Delete those loans first.');
        }
        throw err;
      }
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = customers
    .filter(c => {
      const q = searchQuery.toLowerCase();
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.customer_code || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(searchQuery) ||
        (c.aadhaar_vid || '').includes(searchQuery)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':    return a.full_name.localeCompare(b.full_name);
        case 'name_desc':   return b.full_name.localeCompare(a.full_name);
        case 'code_asc':    return (a.customer_code || '').localeCompare(b.customer_code || '');
        case 'code_desc':   return (b.customer_code || '').localeCompare(a.customer_code || '');
        case 'created_asc': return a.created_at.localeCompare(b.created_at);
        case 'created_desc':
        default:            return b.created_at.localeCompare(a.created_at);
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">Customers ({customers.length})</h2>
        <Button onClick={openAdd} className="gap-2">
          <i className="fas fa-user-plus"></i> Add Customer
        </Button>
      </div>

      {successMessage && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200 flex justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="opacity-70 hover:opacity-100">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by name, code, phone or Aadhaar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48] focus:border-transparent"
          />
        </div>
        <div className="w-full sm:w-56">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48] focus:border-transparent bg-white"
          >
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="name_asc">Name A → Z</option>
            <option value="name_desc">Name Z → A</option>
            <option value="code_asc">Code A → Z</option>
            <option value="code_desc">Code Z → A</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">Aadhaar</th>
                <th className="p-4 font-medium">Joined</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading customers...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">
                  {customers.length === 0 ? 'No customers yet. Click "Add Customer" to get started.' : 'No customers match your search.'}
                </td></tr>
              ) : (
                filtered.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/emi/customers/${c.id}`)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt={c.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                          ) : (
                            <i className="fas fa-user"></i>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{c.full_name}</p>
                          <p className="text-xs font-mono text-[#1e5a48]">{c.customer_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs">{c.phone || <span className="text-gray-400">—</span>}</td>
                    <td className="p-4 font-mono text-xs">{c.aadhaar_vid ? `••••${c.aadhaar_vid.slice(-4)}` : <span className="text-gray-400">—</span>}</td>
                    <td className="p-4 text-xs text-gray-600">{safeFormatDate(c.created_at)}</td>
                    <td className="p-4 text-right space-x-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openEdit(c)} className="text-[#f7b05e] hover:text-[#e09d3e] text-sm" title="Edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => { setDeleteError(''); setCustomerToDelete(c); }} className="text-red-500 hover:text-red-700 text-sm" title="Delete">
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white shrink-0">
              <h3 className="font-bold text-lg">{editingId ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{formError}</div>}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name <span className="text-red-500">*</span></Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Rahul Sharma" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} pattern="[0-9]{10}" placeholder="10 digit number" />
                  </div>
                  <div className="space-y-2">
                    <Label>Father / Husband Name</Label>
                    <Input value={fatherHusbandName} onChange={(e) => setFatherHusbandName(e.target.value)} placeholder="Guardian or spouse name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Aadhaar / VID No.</Label>
                    <Input
                      type="text"
                      value={aadhaarVid}
                      onChange={(e) => setAadhaarVid(e.target.value.replace(/[\s-]/g, ''))}
                      maxLength={12}
                      placeholder="12-digit number"
                      autoComplete="off"
                    />
                    {aadhaarVid && !/^\d{12}$/.test(aadhaarVid) && (
                      <p className="text-xs text-yellow-700"><i className="fas fa-exclamation-triangle"></i> Should be 12 digits</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>PAN Number</Label>
                    <Input
                      type="text"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                      maxLength={10}
                      placeholder="e.g. ABCDE1234F"
                      autoComplete="off"
                    />
                    {panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber) && (
                      <p className="text-xs text-yellow-700"><i className="fas fa-exclamation-triangle"></i> Format: AAAAA9999A</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Occupation</Label>
                    <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="e.g. Shop owner, Teacher" />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Income (₹)</Label>
                    <Input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      min="0"
                      step="100"
                      placeholder="e.g. 25000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    placeholder="Residential address"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nominee Name</Label>
                  <Input value={nomineeName} onChange={(e) => setNomineeName(e.target.value)} placeholder="Nominee for this account" />
                </div>

                <div className="space-y-2">
                  <Label>Profile Picture (Optional)</Label>
                  <div className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50/50">
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-[#1e5a48]/20 flex items-center justify-center overflow-hidden shadow-sm">
                      {(photoFile || photoUrl) ? (
                        <img src={photoFile ? URL.createObjectURL(photoFile) : photoUrl} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <i className="fas fa-user text-gray-300 text-2xl"></i>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#1e5a48] file:text-white hover:file:bg-[#154033] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Any internal notes about this customer"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? 'Saving…' : (editingId ? 'Update Customer' : 'Add Customer')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Delete Customer?</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Delete <strong>{customerToDelete.full_name}</strong>? You cannot delete a customer that has active EMI loans.
              </p>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setCustomerToDelete(null)} disabled={deleting}>Cancel</Button>
                <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
