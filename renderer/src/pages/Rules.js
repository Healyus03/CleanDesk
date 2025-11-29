import React from 'react';

export default function Rules({ rules, addRule, deleteRule, type, setType, namePattern, setNamePattern, destination, setDestination }) {
  return (
    <main>
      <header className="mb-6">
        <h1 className="card-title">Rules</h1>
      </header>

      <section className="card mb-6">
        <div className="mb-4">
          <label className="block text-sm text-gray-700">Type</label>
          <input value={type} onChange={e => setType(e.target.value)} className="mt-1 block w-full rounded-md border-gray-200 shadow-sm p-2" />
        </div>
        <div className="mb-4">
          <label className="block text-sm text-gray-700">Name pattern</label>
          <input value={namePattern} onChange={e => setNamePattern(e.target.value)} className="mt-1 block w-full rounded-md border-gray-200 shadow-sm p-2" />
        </div>
        <div className="mb-4">
          <label className="block text-sm text-gray-700">Destination</label>
          <input value={destination} onChange={e => setDestination(e.target.value)} className="mt-1 block w-full rounded-md border-gray-200 shadow-sm p-2" />
        </div>
        <div className="flex gap-2">
          <button onClick={addRule} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Add Rule</button>
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-2">Existing Rules</h2>
        <div className="recent-list">
          {rules.map((r) => (
            <article key={r.id || r.destination} className="recent-item flex items-center justify-between">
              <div>
                <div className="font-medium">{r.type} — {r.namePattern}</div>
                <div className="recent-meta">{r.destination}</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => deleteRule(r.id)} className="text-red-600">Delete</button>
              </div>
            </article>
          ))}
          {rules.length === 0 && <div className="text-gray-400">No rules defined</div>}
        </div>
      </section>
    </main>
  );
}
