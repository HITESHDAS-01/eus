import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { useAuth } from '../../lib/AuthContext';

export function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'system' | 'security' | 'organization' | 'backup'>('system');
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Backup States
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  
  // Organization States
  const [orgProfile, setOrgProfile] = useState<any>(null);
  const [needsOrgSetup, setNeedsOrgSetup] = useState(false);
  const [orgMessage, setOrgMessage] = useState('');

  // Security States
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [secMessage, setSecMessage] = useState('');
  
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const settingLabels: Record<string, string> = {
    'penalty_percentage': 'Penalty Percentage (%)',
    'loan_eligibility_percent': 'Loan Eligibility (%)',
    'monthly_due_day': 'Monthly Due Day (Date)',
    'grace_period_days': 'Late Fee Grace Period (Days)',
    'roi_category_b': 'Category B Interest Rate (%)',
    'roi_category_c_24': 'Category C (24 Months) Interest Rate (%)',
    'roi_category_c_36': 'Category C (36 Months) Interest Rate (%)',
  };

  useEffect(() => {
    fetchSettings();
    fetchAdmins();
    fetchOrgProfile();
  }, []);

  const fetchOrgProfile = async () => {
    try {
      const { data, error } = await supabase.from('org_profile').select('*').limit(1).single();
      if (error) {
        if (error.code === '42P01' || error.message?.includes('schema cache')) {
          setNeedsOrgSetup(true);
        } else if (error.code !== 'PGRST116') { // PGRST116 is row not found
          console.error(error);
        }
      } else if (data) {
        setOrgProfile(data);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSaveOrgProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setOrgMessage('');
    try {
      if (orgProfile?.id) {
        const { error } = await supabase
          .from('org_profile')
          .update(orgProfile)
          .eq('id', orgProfile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('org_profile')
          .insert(orgProfile);
        if (error) throw error;
      }
      setOrgMessage('Organization profile updated successfully!');
      fetchOrgProfile();
    } catch (err: any) {
      setOrgMessage(err.message || 'Error saving organization profile.');
    } finally {
      setSaving(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    let { data, error } = await supabase.from('settings').select('*').order('id');
    
    // Fallback if data is null for some reason
    if (!data) data = [];

    // Auto-append grace_period_days if missing so it shows in UI
    if (!data.find((s: any) => s.key === 'grace_period_days')) {
      data.push({ key: 'grace_period_days', value: 3 });
    }

    setSettings(data);
    setLoading(false);
  };

  const fetchAdmins = async () => {
    try {
      // Assuming 'profiles' table has users and email might not be directly queryable unless added
      // We will try to fetch profiles where role is 'admin'
      const { data } = await supabase.from('profiles').select('*').eq('role', 'admin');
      if (data) setAdmins(data);
    } catch (err) {
      console.error('Error fetching admins', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      for (const setting of settings) {
        if (setting.id) {
          const { data, error } = await supabase
            .from('settings')
            .update({ value: setting.value })
            .eq('id', setting.id)
            .select();
          
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`Permission denied to update settings. Please run: ALTER TABLE settings DISABLE ROW LEVEL SECURITY; in your Supabase SQL editor.`);
          }
        } else {
          // If it doesn't have an ID, it needs to be inserted
          const { error } = await supabase
            .from('settings')
            .insert({ key: setting.key, value: setting.value });
          if (error) throw error;
        }
      }
      setMessage('Settings updated successfully!');
      fetchSettings();
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('ALTER TABLE settings')) {
        setMessage(err.message);
      } else if (err.message && err.message.includes('row-level security')) {
        setMessage('Database policy prevents adding new settings automatically. Please run this SQL in Supabase: INSERT INTO settings (key, value) VALUES (\'grace_period_days\', 3);');
      } else {
        setMessage(err.message || 'Error updating settings.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (idOrKey: any, newValue: string) => {
    setSettings(settings.map(s => {
      // It might have an ID (if from DB) or just a key (if newly appended)
      const match = (s.id && s.id === idOrKey) || (!s.id && s.key === idOrKey);
      return match ? { ...s, value: Number(newValue) } : s;
    }));
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSecMessage('');
    
    // Check if mock user
    if (user?.id?.startsWith('admin-')) {
      setSecMessage('Cannot update credentials in demo/mock mode.');
      setSaving(false);
      return;
    }

    try {
      const updates: any = {};
      if (newEmail && newEmail !== user?.email) updates.email = newEmail;
      if (newPassword) updates.password = newPassword;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
        setSecMessage('Credentials updated successfully! You may need to verify the new email.');
        setNewPassword('');
      } else {
        setSecMessage('No changes made.');
      }
    } catch (err: any) {
      setSecMessage(err.message || 'Failed to update credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAdmin(true);
    setSecMessage('');

    try {
      // Create user via auth
      const { data, error } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
      });

      if (error) throw error;

      if (data.user) {
        // Update profile role to admin
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', data.user.id);
        
        if (profileError) {
          // If profile update fails, they might be stuck as member depending on triggers
          console.error('Profile role update failed', profileError);
        }
      }

      setSecMessage('Sub-Admin added successfully!');
      setNewAdminEmail('');
      setNewAdminPassword('');
      fetchAdmins();
    } catch (err: any) {
      setSecMessage(err.message || 'Failed to create sub-admin. They might already exist.');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleExportBackup = async () => {
    setBackupLoading(true);
    setBackupMessage('');
    try {
      const tables = ['profiles', 'members', 'savings_installments', 'loan_applications', 'loan_repayments', 'settings', 'org_profile'];
      const backupData: Record<string, any> = {};

      for (const table of tables) {
        // Special case for members or other tables to avoid huge joins if only full contents are needed
        // but select * handles it.
        const { data, error } = await supabase.from(table).select('*').limit(10000); // safety limit
        if (error) {
          console.warn(`Could not fetch ${table}:`, error);
          // If org_profile fails, it might not exist yet, which is fine
          if (error.code !== '42P01') { 
            backupData[table] = { error: error.message };
          }
        } else {
          backupData[table] = data;
        }
      }

      // Add metadata
      backupData['_metadata'] = {
        exportedAt: new Date().toISOString(),
        exportedBy: user?.email,
        systemName: orgProfile?.name || 'Excellent Urban Society',
        version: '1.0'
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const dateString = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `eus_database_backup_${dateString}.json`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      setBackupMessage('Database backup exported successfully! Download should start automatically.');
    } catch (err: any) {
      console.error('Backup error:', err);
      setBackupMessage(err.message || 'Failed to export backup.');
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
          <button
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'system' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('system')}
          >
            System Parameters
          </button>
          <button
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'organization' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('organization')}
          >
            Organization Profile
          </button>
          <button
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'security' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('security')}
          >
            Security & Accounts
          </button>
          <button
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'backup' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('backup')}
          >
            Data Backup
          </button>
        </div>
      </div>
      
      {activeTab === 'system' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {message && (
            <div className={`mb-6 p-3 rounded-lg text-sm border ${message.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              <span className="block font-medium">{message}</span>
              {message.includes('INSERT INTO') && (
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded text-red-800 break-all whitespace-pre-wrap font-mono">
                  INSERT INTO settings (key, value) VALUES ('grace_period_days', 3);
                </pre>
              )}
              {message.includes('ALTER TABLE') && (
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded text-red-800 break-all whitespace-pre-wrap font-mono">
                  ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
                </pre>
              )}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
          {settings.map((setting) => (
            <div key={setting.id || setting.key} className="flex items-center justify-between border-b border-gray-50 pb-4">
              <div className="flex-1">
                <Label className="text-base font-semibold text-gray-800">
                  {settingLabels[setting.key] || setting.key.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </Label>
                <p className="text-xs text-gray-500 mt-1">System configuration key: {setting.key}</p>
              </div>
              <div className="w-32">
                <Input 
                  type="number" 
                  value={setting.value} 
                  onChange={(e) => handleChange(setting.id || setting.key, e.target.value)}
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
          {needsOrgSetup ? (
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                <i className="fas fa-database"></i>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Database Setup Required</h2>
              <p className="text-gray-600 mb-6">The table for Organization Profile doesn't exist yet. Please run the following SQL script.</p>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-xl text-left overflow-x-auto text-sm font-mono mb-6">
                <pre>{`CREATE TABLE org_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO org_profile (name, logo_url, email, phone, address) 
VALUES ('Excellent Urban Society', 'https://i.ibb.co/xKRYj0f4/euslogo.png', 'info@eus.com', '+91 9999999999', 'Sector 1, City Center');

ALTER TABLE org_profile DISABLE ROW LEVEL SECURITY;`}</pre>
              </div>
              <Button onClick={() => window.location.reload()}>Reload Page</Button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              {orgMessage && (
                <div className={`p-3 rounded-lg text-sm border ${orgMessage.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                  {orgMessage}
                </div>
              )}
              <form onSubmit={handleSaveOrgProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input 
                    value={orgProfile?.name || ''} 
                    onChange={(e) => setOrgProfile({...orgProfile, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input 
                    value={orgProfile?.logo_url || ''} 
                    onChange={(e) => setOrgProfile({...orgProfile, logo_url: e.target.value})} 
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input 
                      type="email"
                      value={orgProfile?.email || ''} 
                      onChange={(e) => setOrgProfile({...orgProfile, email: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Phone</Label>
                    <Input 
                      value={orgProfile?.phone || ''} 
                      onChange={(e) => setOrgProfile({...orgProfile, phone: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Registered Address</Label>
                  <Input 
                    value={orgProfile?.address || ''} 
                    onChange={(e) => setOrgProfile({...orgProfile, address: e.target.value})} 
                  />
                </div>

                <div className="pt-4">
                  <Button type="submit" disabled={saving} className="w-full md:w-auto bg-[#ffc800] text-gray-900 hover:bg-[#e6b400]">
                    {saving ? 'Saving...' : 'Update Organization Profile'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6 max-w-2xl">
          {secMessage && (
            <div className={`p-3 rounded-lg text-sm border ${secMessage.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {secMessage}
            </div>
          )}

          {/* Update Own Credentials */}
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

          {/* Add Sub Admin */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Admin Accounts</h3>
            
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-600 mb-2">Current Admins</h4>
              <ul className="space-y-2">
                {admins.map(admin => (
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
                    <Label>Email Address</Label>
                    <Input type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} required placeholder="admin@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Temporary Password</Label>
                    <Input type="text" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} required placeholder="Set a password" minLength={6} />
                  </div>
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
              <p className="text-sm text-gray-500 mt-1">Download a complete snapshot of all the system records in JSON format. This includes members, loans, installments, and settings.</p>
            </div>
          </div>

          {backupMessage && (
            <div className={`mb-6 p-4 rounded-xl text-sm border ${backupMessage.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              <div className="flex items-center gap-2">
                <i className={`fas ${backupMessage.includes('success') ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                <span className="font-medium">{backupMessage}</span>
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 mb-6 space-y-3">
            <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <i className="fas fa-info-circle text-gray-400"></i>
              What's included in the backup?
            </h4>
            <ul className="text-sm text-gray-600 space-y-2 ml-6 list-disc">
              <li>All registered Member profiles and personal data</li>
              <li>Complete savings and installment history</li>
              <li>All loan applications, statuses, and history</li>
              <li>Loan repayment ledgers</li>
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
          <p className="text-xs text-gray-400 mt-3">The backup file will be securely generated locally on your browser.</p>
        </div>
      )}
    </div>
  );
}
