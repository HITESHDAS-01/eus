import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';

export function Settings() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*').order('id');
    if (data) setSettings(data);
    setLoading(false);
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

  if (loading) return <div className="p-6">Loading settings...</div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {message && (
          <div className={`mb-6 p-3 rounded-lg text-sm border ${message.includes('success') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {settings.map((setting) => (
            <div key={setting.id} className="flex items-center justify-between border-b border-gray-50 pb-4">
              <div className="flex-1">
                <Label className="text-base font-semibold text-gray-800">
                  {setting.key.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
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
            <Button type="submit" disabled={saving} className="w-full md:w-auto">
              {saving ? 'Saving...' : 'Save All Settings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
