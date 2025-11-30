import React from 'react';
import { Check, FileText, Folder } from 'lucide-react';

export default function Dashboard({ log, watched = [], startAuto, stopAuto, autoRunning = false }) {
  // controlled toggle: use parent prop directly to avoid flicker when remounting
  const autoOn = !!autoRunning;

  return (
    <main>
      <header className="mb-8">
        <h1 className="text-gray-900">Overview</h1>
      </header>

      <section className="grid grid-cols-2 gap-6 mb-8">
        <article className="card">
          <div className="stat">
            <div>
              <div className="stat-value">{log.length}</div>
              <div className="stat-label">files moved</div>
            </div>
            <div className="stat-icon"><Check className="w-5 h-5 text-green-600" /></div>
          </div>
        </article>

        <article className="card">
          <div className="stat">
            <div>
              <div className="stat-value">{Array.isArray(watched) ? watched.filter(w => (typeof w.enabled === 'undefined' || w.enabled === true)).length : 0}</div>
              <div className="stat-label">watched folders</div>
            </div>
            <div className="stat-icon"><Folder className="w-5 h-5 text-blue-600" /></div>
          </div>
        </article>

        <article className="card col-span-2">
          <header className="card-header">
            <div className="card-title">Auto-Organize</div>
          </header>

          <div className="stat">
            <div className="muted">{autoOn ? 'Running in background' : 'Disabled'}</div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={autoOn}
                onChange={async (e) => {
                  const on = e.target.checked;
                  if (on) {
                    // start periodic auto-organize (5s default)
                    if (startAuto) await startAuto(5000);
                  } else {
                    if (stopAuto) await stopAuto();
                  }
                }}
              />
              <div className="toggle-slider">
                <div className="toggle-thumb" />
              </div>
            </label>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="card-title mb-4">Recent Activity</div>
        <div className="recent-list">
          {log.slice(-3).reverse().map((l, i) => (
            <article key={i} className="recent-item">
              <div className="flex items-center gap-3">
                <span className="text-2xl"><FileText className="w-6 h-6" /></span>
                <div>
                  <div className="font-medium text-gray-900">{l.file}</div>
                  <div className="text-sm text-gray-500">{l.movedTo}</div>
                </div>
              </div>
              <div className="recent-meta">{new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </article>
          ))}

          {log.length === 0 && (
            <div className="text-gray-400 text-center py-8">No recent activity</div>
          )}
        </div>
      </section>
    </main>
  );
}