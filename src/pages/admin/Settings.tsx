import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { useAuth } from '../../lib/AuthContext';

export function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'system' | 'security'>('system');
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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
    'roi_category_b': 'Category B Interest Rate (%)',
    'roi_category_c_24': 'Category C (24 Months) Interest Rate (%)',
    'roi_category_c_36': 'Category C (36 Months) Interest Rate (%)',
  };

  useEffect(() => {
    fetchSettings();
    fetchAdmins();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*').order('id');
    if (data) setSettings(data);
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
        await supabase
          .from('settings')
          .update({ value: setting.value })
          .eq('id', setting.id);
      }
      setMessage('Settings updated successfully!');
    } catch (err) {
      console.error(err);
      setMessage('Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (id: number, newValue: string) => {
    setSettings(settings.map(s => s.id === id ? { ...s, value: Number(newValue) } : s));
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
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'security' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('security')}
          >
            Security & Accounts
          </button>
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
            <div key={setting.id} className="flex items-center justify-between border-b border-gray-50 pb-4">
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
                  onChange={(e) => handleChange(setting.id, e.target.value)}
                  required
                />
              </div>
            </div>
          ))}

          <div className="pt-4">
            <Button type="submit" disabled={saving} className="w-full md:w-auto bg-[#1e5a48] hover:bg-[#154636]">
              {saving ? 'Saving...' : 'Save All Settings'}
            </Button>
          </div>
          </form>
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
                <Button type="submit" disabled={isCreatingAdmin} className="bg-[#1e5a48] hover:bg-[#154636]">
                  {isCreatingAdmin ? 'Creating...' : 'Create Admin Account'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
