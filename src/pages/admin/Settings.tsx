import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { useAuth } from '../../lib/AuthContext';
import { branding } from '../../config/branding';

type OrgProfile = {
  id?: string;
  name: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type SettingRow = { id?: number; key: string; value: number };
type AdminRow = { id: string; full_name: string | null };

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

export function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'system' | 'security' | 'organization' | 'backup'>('system');
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');

  const [orgProfile, setOrgProfile] = useState<OrgProfile>({
    name: branding.orgName, logo_url: null, email: null, phone: null, address: null,
  });
  const [orgMessage, setOrgMessage] = useState('');

  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [secMessage, setSecMessage] = useState('');

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const settingLabels: Record<string, string> = {
    penalty_percentage: 'Penalty Percentage (%)',
    loan_eligibility_percent: 'Loan Eligibility (%)',
    monthly_due_day: 'Monthly Due Day (Date)',
    grace_period_days: 'Late Fee Grace Period (Days)',
    roi_category_b: 'Category B Interest Rate (%)',
    roi_category_c_24: 'Category C (24 Months) Interest Rate (%)',
    roi_category_c_36: 'Category C (36 Months) Interest Rate (%)',
  };

  useEffect(() => {
    setNewEmail(user?.email || '');
    fetchSettings();
    fetchAdmins();
    fetchOrgProfile();
  }, [user?.email]);

  const fetchOrgProfile = async () => {
    const { data } = await supabase.from('org_profile').select('*').limit(1).maybeSingle();
    if (data) setOrgProfile(data as OrgProfile);
  };

  const handleSaveOrgProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setOrgMessage('');
    try {
      if (orgProfile.id) {
        const { error } = await supabase
          .from('org_profile')
          .update({ ...orgProfile, updated_at: new Date().toISOString() })
          .eq('id', orgProfile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('org_profile').insert(orgProfile);
        if (error) throw error;
      }
      setOrgMessage('Organization profile updated successfully.');
      fetchOrgProfile();
    } catch (err) {
      setOrgMessage(err instanceof Error ? err.message : 'Error saving organization profile.');
    } finally {
      setSaving(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*').order('id');
    const rows = (data as SettingRow[] | null) ?? [];
    if (!rows.find((s) => s.key === 'grace_period_days')) {
      rows.push({ key: 'grace_period_days', value: 3 });
    }
    setSettings(rows);
    setLoading(false);
  };

  const fetchAdmins = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'admin');
    if (data) setAdmins(data as AdminRow[]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      for (const setting of settings) {
        if (setting.id) {
          const { error } = await supabase
            .from('settings').update({ value: setting.value }).eq('id', setting.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('settings').insert({ key: setting.key, value: setting.value });
          if (error) throw error;
        }
      }
      setMessage('Settings updated successfully.');
      fetchSettings();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (idOrKey: number | string, newValue: string) => {
    setSettings(settings.map((s) => {
      const match = (s.id !== undefined && s.id === idOrKey) || (s.id === undefined && s.key === idOrKey);
      return match ? { ...s, value: Number(newValue) } : s;
    }));
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSecMessage('');
    try {
      const updates: { email?: string; password?: string } = {};
      if (newEmail && newEmail !== user?.email) updates.email = newEmail;
      if (newPassword) updates.password = newPassword;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
        setSecMessage('Credentials updated. You may need to verify the new email.');
        setNewPassword('');
      } else {
        setSecMessage('No changes made.');
      }
    } catch (err) {
      setSecMessage(err instanceof Error ? err.message : 'Failed to update credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAdmin(true);
    setSecMessage('');
    try {
      await callEdgeFunction('admin-create-subadmin', {
        email: newAdminEmail,
        password: newAdminPassword,
        full_name: newAdminName || 'Administrator',
      });
      setSecMessage(`Sub-admin ${newAdminEmail} created. Share the password with them.`);
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminName('');
      fetchAdmins();
    } catch (err) {
      setSecMessage(err instanceof Error ? err.message : 'Failed to create sub-admin.');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleExportBackup = async () => {
    setBackupLoading(true);
    setBackupMessage('');
    try {
      const tables = ['profiles', 'members', 'savings_installments', 'loans', 'loan_repayments', 'settings', 'org_profile'] as const;
      const backupData: Record<string, unknown> = {};

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(50000);
        if (error) {
          backupData[table] = { error: error.message };
        } else {
          backupData[table] = data;
        }
      }

      backupData._metadata = {
        exportedAt: new Date().toISOString(),
        exportedBy: user?.email,
        systemName: orgProfile.name,
        version: '1.0',
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateString = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `${branding.orgShort.toLowerCase()}_database_backup_${dateString}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      setBackupMessage('Backup exported. Download should start automatically.');
    } catch (err) {
      setBackupMessage(err instanceof Error ? err.message : 'Failed to export backup.');
    } finally {
      setBackupLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading settings...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>

        <div className="flex bg-gray-200 p-1 rounded-lg">
          {(['system', 'organization', 'security', 'backup'] as const).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'system' && 'System Parameters'}
              {tab === 'organization' && 'Organization Profile'}
              {tab === 'security' && 'Security & Accounts'}
              {tab === 'backup' && 'Data Backup'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'system' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {message && (
            <div className={`mb-6 p-3 rounded-lg text-sm border ${message.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
            {settings.map((setting) => (
              <div key={setting.id ?? setting.key} className="flex items-center justify-between border-b border-gray-50 pb-4">
                <div className="flex-1">
                  <Label className="text-base font-semibold text-gray-800">
                    {settingLabels[setting.key] || setting.key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">System configuration key: {setting.key}</p>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    value={setting.value}
                    onChange={(e) => handleChange(setting.id ?? setting.key, e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}

            <div className="pt-4">
              <Button type="submit" disabled={saving} className="w-full md:w-auto">
                {saving ? 'Saving...' : 'Save All Settings'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'organization' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {orgMessage && (
              <div className={`p-3 rounded-lg text-sm border ${orgMessage.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                {orgMessage}
              </div>
            )}
            <form onSubmit={handleSaveOrgProfile} className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input value={orgProfile.name} onChange={(e) => setOrgProfile({ ...orgProfile, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input value={orgProfile.logo_url || ''} onChange={(e) => setOrgProfile({ ...orgProfile, logo_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" value={orgProfile.email || ''} onChange={(e) => setOrgProfile({ ...orgProfile, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Support Phone</Label>
                  <Input value={orgProfile.phone || ''} onChange={(e) => setOrgProfile({ ...orgProfile, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Registered Address</Label>
                <Input value={orgProfile.address || ''} onChange={(e) => setOrgProfile({ ...orgProfile, address: e.target.value })} />
              </div>

              <div className="pt-4">
                <Button type="submit" disabled={saving} className="w-full md:w-auto bg-[#ffc800] text-gray-900 hover:bg-[#e6b400]">
                  {saving ? 'Saving...' : 'Update Organization Profile'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6 max-w-2xl">
          {secMessage && (
            <div className={`p-3 rounded-lg text-sm border ${secMessage.includes('success') || secMessage.includes('created') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {secMessage}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Update Credentials</h3>
            <form onSubmit={handleUpdateCredentials} className="space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Updating...' : 'Update Login Info'}
              </Button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Admin Accounts</h3>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-600 mb-2">Current Admins</h4>
              <ul className="space-y-2">
                {admins.map((admin) => (
                  <li key={admin.id} className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg border">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                      {(admin.full_name || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">{admin.full_name || 'Admin User'}</span>
                      <span className="text-xs text-gray-500 block">ID: {admin.id.substring(0, 8)}...</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="font-semibold text-gray-800 mb-3">Add New Sub-Admin</h4>
              <form onSubmit={handleCreateSubAdmin} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Jane Admin" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} required placeholder="admin@example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Temporary Password</Label>
                  <Input type="text" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} required placeholder="Min 6 characters" minLength={6} />
                </div>
                <Button type="submit" disabled={isCreatingAdmin}>
                  {isCreatingAdmin ? 'Creating...' : 'Create Admin Account'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl shrink-0">
              <i className="fas fa-file-export"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Export Full Database Backup</h3>
              <p className="text-sm text-gray-500 mt-1">Download a complete snapshot of all system records in JSON format.</p>
            </div>
          </div>

          {backupMessage && (
            <div className={`mb-6 p-4 rounded-xl text-sm border ${backupMessage.includes('exported') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {backupMessage}
            </div>
          )}

          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 mb-6 space-y-3">
            <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <i className="fas fa-info-circle text-gray-400"></i>
              What's included
            </h4>
            <ul className="text-sm text-gray-600 space-y-2 ml-6 list-disc">
              <li>All Member profiles and personal data</li>
              <li>Savings and installment history</li>
              <li>Loans, statuses, repayment ledgers</li>
              <li>System configuration parameters</li>
            </ul>
          </div>

          <Button
            onClick={handleExportBackup}
            disabled={backupLoading}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
          >
            {backupLoading ? (
              <><i className="fas fa-spinner fa-spin"></i> Generating Backup...</>
            ) : (
              <><i className="fas fa-download"></i> Download Full Backup (.json)</>
            )}
          </Button>
          <p className="text-xs text-gray-400 mt-3">The backup file is generated locally in your browser. Note: tables larger than 50,000 rows are paged silently — for very large datasets, use pg_dump.</p>
        </div>
      )}
    </div>
  );
}
