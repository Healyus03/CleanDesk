import React, { useState, useEffect } from "react";
import "./global.css";

function App() {
    const [rules, setRules] = useState([]);
    const [folder, setFolder] = useState("");
    const [log, setLog] = useState([]);
    const [type, setType] = useState("");
    const [namePattern, setNamePattern] = useState("");
    const [destination, setDestination] = useState("");

    // Load rules and log on start
    useEffect(() => {
        window.electronAPI.loadRules().then(setRules);
        window.electronAPI.loadLog().then(setLog);
    }, []);

    // Add rule
    const addRule = () => {
        if (!destination) return alert("Destination required");
        const newRule = { type, namePattern, destination };
        const updated = [...rules, newRule];
        setRules(updated);
        window.electronAPI.saveRules(updated);
        setType(""); setNamePattern(""); setDestination("");
    };

    // Delete rule
    const deleteRule = (index) => {
        const updated = rules.filter((_, i) => i !== index);
        setRules(updated);
        window.electronAPI.saveRules(updated);
    };

    // Organize files
    const organize = async () => {
        if (!folder) return alert("Choose a folder");
        const result = await window.electronAPI.organizeFiles(folder);
        setLog(result);
    };

    // Pick folder
    const pickFolder = async () => {
        const selected = await window.electronAPI.selectFolder();
        if (selected) setFolder(selected);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg p-6">
                <h1 className="text-3xl font-extrabold text-gray-800 mb-6">CleanDesk</h1>

                {/* Folder picker */}
                <div className="flex gap-3 items-center">
                    <input value={folder} readOnly placeholder="Folder to organize" className="flex-1 border border-gray-200 rounded px-3 py-2 bg-gray-50" />
                    <button onClick={pickFolder} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Choose Folder</button>
                </div>

                {/* Rules form */}
                <div className="mt-6">
                    <h2 className="text-xl font-semibold text-gray-700 mb-3">Add Rule</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input placeholder="File type (*.png)" value={type} onChange={e => setType(e.target.value)} className="border rounded px-3 py-2" />
                        <input placeholder="Name pattern (CV*)" value={namePattern} onChange={e => setNamePattern(e.target.value)} className="border rounded px-3 py-2" />
                        <input placeholder="Destination folder" value={destination} onChange={e => setDestination(e.target.value)} className="border rounded px-3 py-2" />
                        <div className="flex items-center">
                            <button onClick={addRule} className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Add Rule</button>
                        </div>
                    </div>
                </div>

                {/* Rules list */}
                <div className="mt-6">
                    <h2 className="text-xl font-semibold text-gray-700 mb-3">Rules</h2>
                    <ul>
                        {rules.map((r, i) => (
                            <li key={i} className="flex justify-between items-center bg-gray-50 p-3 rounded mb-2">
                                <div className="text-gray-700">{r.type || r.namePattern} → <span className="font-medium text-gray-800">{r.destination}</span></div>
                                <button onClick={() => deleteRule(i)} className="text-red-600 hover:underline">Delete</button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Organize button */}
                <div className="mt-6">
                    <button onClick={organize} className="bg-indigo-600 text-white px-6 py-3 rounded shadow hover:bg-indigo-700">Organize Now</button>
                </div>

                {/* Log */}
                <div className="mt-6">
                    <h2 className="text-xl font-semibold text-gray-700 mb-3">Log</h2>
                    <ul className="space-y-2">
                        {log.map((l, i) => (
                            <li key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                                <div className="text-sm text-gray-700">{l.file} → <span className="font-medium">{l.movedTo}</span></div>
                                <div className="text-xs text-gray-500">{new Date(l.timestamp).toLocaleTimeString()}</div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default App;
