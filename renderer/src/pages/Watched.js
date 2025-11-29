import React, { useState } from 'react';
import { CheckCircle, Slash, Trash2, Settings } from 'lucide-react';
import IconToggle from '../components/IconToggle';
import IconAction from '../components/IconAction';

export default function Watched({ watched = [], removeWatched, toggleWatchedEnabled, pickAndAddWatched, updateWatched, rules = [] }) {
  const [openOverrides, setOpenOverrides] = useState(null);

  const toggleOverride = (folder, ruleId) => {
    const current = folder.ruleOverrides || {};
    const next = Object.assign({}, current);
    next[ruleId] = !next[ruleId];
    const updated = { ...folder, ruleOverrides: next };
    updateWatched(updated);
  };

  return (
    <main>
      <header className="mb-6">
        <h1 className="card-title">Watched Folders</h1>
      </header>

      <section className="card">
        <div className="mb-4 flex gap-2">
          <button onClick={pickAndAddWatched} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add folder</button>
        </div>

        {watched.length === 0 && (
          <div className="text-gray-600">No watched folders yet. Click "Add folder" to start watching a folder.</div>
        )}

        <ul className="mt-4 space-y-3">
          {watched.map(w => (
            <li key={w.id} className="border p-3 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium truncate" style={{ maxWidth: 500 }}>{w.path}</div>
                  <div className="text-sm text-gray-500">{w.enabled ? 'Enabled' : 'Disabled'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <IconToggle
                    enabled={!!w.enabled}
                    onClick={() => toggleWatchedEnabled(w.id)}
                    EnabledIcon={CheckCircle}
                    DisabledIcon={Slash}
                    enabledTitle="Disable folder"
                    disabledTitle="Enable folder"
                  />

                  <IconAction onClick={() => removeWatched(w.id)} Icon={Trash2} title="Remove folder" className="bg-red-100 text-red-700" />

                  <IconAction onClick={() => setOpenOverrides(openOverrides === w.id ? null : w.id)} Icon={Settings} title="Rule overrides" />
                </div>
              </div>

              {openOverrides === w.id && (
                <div className="mt-3 border-t pt-3">
                  <div className="text-sm text-gray-600 mb-2">Per-folder rule overrides (toggle to enable/disable this rule for this folder):</div>
                  <ul className="space-y-2">
                    {rules.map(rule => {
                      const val = w.ruleOverrides && Object.prototype.hasOwnProperty.call(w.ruleOverrides, rule.id) ? !!w.ruleOverrides[rule.id] : undefined;
                      const inherited = (typeof val === 'undefined');
                      const enabledForFolder = inherited ? (rule.enabled !== false) : val;
                      return (
                        <li key={rule.id} className="flex items-center justify-between">
                          <div className="text-sm">{rule.type || rule.namePattern || rule.destination || rule.id} {inherited && <span className="text-xs text-gray-400">(inherited)</span>}</div>
                          <div>
                            <button onClick={() => toggleOverride(w, rule.id)} className={`px-3 py-1 rounded ${enabledForFolder ? 'bg-green-100' : 'bg-red-100'}`}>
                              {enabledForFolder ? 'Enabled' : 'Disabled'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
