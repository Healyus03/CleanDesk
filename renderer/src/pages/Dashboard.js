import React from 'react';

export default function Dashboard({ log, folder, pickFolder }) {
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
            <div className="stat-icon">✓</div>
          </div>
        </article>

        <article className="card">
          <header className="card-header">
            <div className="card-title">Auto-Organize</div>
          </header>

          <div className="stat">
            <div className="muted">Running in background</div>
            <label className="toggle-switch">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="toggle-slider">
                <div className="toggle-thumb" />
              </div>
            </label>
          </div>
        </article>
      </section>

      <section className="card mb-8">
        <div className="card-header">
          <div className="card-title">Watched folder</div>
          <button onClick={pickFolder} className="text-blue-600 hover:underline">Change folder</button>
        </div>
        <p className="watched-folder">{folder || "D:/Documents"}</p>
      </section>

      <section className="card">
        <div className="card-title mb-4">Recent Activity</div>
        <div className="recent-list">
          {log.slice(-3).reverse().map((l, i) => (
            <article key={i} className="recent-item">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <div className="font-medium text-gray-900">{l.file}</div>
                  <div className="text-sm text-gray-500">{l.movedTo}</div>
                </div>
              </div>
              <div className="recent-meta">{new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ago</div>
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
