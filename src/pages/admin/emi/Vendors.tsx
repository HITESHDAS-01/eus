import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Label } from '../../../components/ui/basic';

// ---------------------------------------------------------------------------
// Vendors — electronics shops we pay on behalf of the EMI customer.
// Minimal CRUD: id (auto), name, address.
// ---------------------------------------------------------------------------

type Vendor = {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
};

export function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('vendors')
      .select('*')
      .order('name', { ascending: true });
    if (err) setError(err.message);
    else setVendors(data || []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setName(''); setAddress('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingId(v.id);
    setName(v.name);
    setAddress(v.address || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (!name.trim()) throw new Error('Vendor name is required');
      const payload = { name: name.trim(), address: address.trim() || null };
      if (editingId) {
        const { error: err } = await supabase.from('vendors').update(payload).eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('vendors').insert(payload);
        if (err) throw err;
      }
      setIsModalOpen(false);
      fetchVendors();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save vendor');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!vendorToDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { error: err } = await supabase.from('vendors').delete().eq('id', vendorToDelete.id);
      if (err) {
        // RESTRICT on emi_loans.vendor_id — report cleanly.
        if (err.message?.toLowerCase().includes('foreign key')) {
          throw new Error('This vendor has loans linked to it. Delete or reassign those loans first.');
        }
        throw err;
      }
      setVendorToDelete(null);
      fetchVendors();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete vendor');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">Vendors ({vendors.length})</h2>
        <Button onClick={openAdd} className="gap-2">
          <i className="fas fa-plus"></i> Add Vendor
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48] focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Address</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-500">Loading vendors...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-gray-500">
                  {vendors.length === 0 ? 'No vendors yet. Click "Add Vendor" to get started.' : 'No vendors match your search.'}
                </td></tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48]">
                          <i className="fas fa-store"></i>
                        </div>
                        <p className="font-bold text-gray-800">{v.name}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{v.address || <span className="text-gray-400 italic">—</span>}</td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => openEdit(v)} className="text-[#f7b05e] hover:text-[#e09d3e] text-sm" title="Edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => { setDeleteError(''); setVendorToDelete(v); }} className="text-red-500 hover:text-red-700 text-sm" title="Delete">
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

      {/* Add / Edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">{editingId ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6">
              {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{formError}</div>}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name <span className="text-red-500">*</span></Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Bajaj Electronics" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    placeholder="Shop address (optional)"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? 'Saving…' : (editingId ? 'Update Vendor' : 'Add Vendor')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Delete Vendor?</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Delete <strong>{vendorToDelete.name}</strong>? You cannot delete a vendor that has EMI loans linked to it.
              </p>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setVendorToDelete(null)} disabled={deleting}>Cancel</Button>
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
