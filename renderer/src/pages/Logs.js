import React from 'react';

export default function Logs({ log }) {
  return (
    <main>
      <header className="mb-6">
        <h1 className="card-title">Logs</h1>
      </header>

      <section className="card">
        <div className="recent-list">
          {log.slice().reverse().map((l, i) => (
            <article key={i} className="recent-item">
              <div>
                <div className="font-medium">{l.file}</div>
                <div className="recent-meta">Moved to: {l.movedTo} — {new Date(l.timestamp).toLocaleString()}</div>
              </div>
            </article>
          ))}

          {log.length === 0 && <div className="text-gray-400">No log entries</div>}
        </div>
      </section>
    </main>
  );
}
