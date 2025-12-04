import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAutostartSetting();
  }, []);

  async function loadAutostartSetting() {
    try {
      const enabled = await window.electronAPI.getAutostartEnabled();
      setAutostartEnabled(enabled);
    } catch (err) {
      console.error('Failed to load autostart setting:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAutostart() {
    const newValue = !autostartEnabled;
    try {
      await window.electronAPI.setAutostartEnabled(newValue);
      setAutostartEnabled(newValue);
    } catch (err) {
      console.error('Failed to set autostart:', err);
    }
  }

  return (
    <main>
      <header className="mb-6">
        <h1 className="card-title">Settings</h1>
      </header>

      <section className="card">
        <h2 className="text-lg font-semibold mb-4">Application Settings</h2>

        <div className="space-y-4">
          {/* Autostart Setting */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Launch on Startup</h3>
              <p className="text-sm text-gray-600">Automatically start CleanDesk when you log in to Windows</p>
            </div>
            <button
              onClick={handleToggleAutostart}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autostartEnabled ? 'bg-blue-600' : 'bg-gray-300'
              } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-label="Toggle autostart"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autostartEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
