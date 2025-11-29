import React from 'react';

export default function Watched({ folder, pickFolder }) {
  return (
    <main>
      <header className="mb-6">
        <h1 className="card-title">Watched Folder</h1>
      </header>

      <section className="card">
        <div className="mb-3">Current watched folder:</div>
        <div className="watched-folder mb-4">{folder || 'D:/Documents'}</div>
        <button onClick={pickFolder} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Change folder</button>
      </section>
    </main>
  );
}
