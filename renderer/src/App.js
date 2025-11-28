import React, { useState, useEffect } from "react";

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
        <div style={{ padding: "20px" }}>
            <h1>CleanDesk - Smart Desktop Organizer</h1>

            {/* Folder picker */}
            <div>
                <input value={folder} readOnly placeholder="Folder to organize" style={{ width: "80%" }} />
                <button onClick={pickFolder}>Choose Folder</button>
            </div>

            {/* Rules form */}
            <div style={{ marginTop: "20px" }}>
                <h2>Add Rule</h2>
                <input placeholder="File type (*.png)" value={type} onChange={e => setType(e.target.value)} />
                <input placeholder="Name pattern (CV*)" value={namePattern} onChange={e => setNamePattern(e.target.value)} />
                <input placeholder="Destination folder" value={destination} onChange={e => setDestination(e.target.value)} />
                <button onClick={addRule}>Add Rule</button>
            </div>

            {/* Rules list */}
            <div style={{ marginTop: "20px" }}>
                <h2>Rules</h2>
                <ul>
                    {rules.map((r, i) => (
                        <li key={i}>
                            {r.type || r.namePattern} → {r.destination}
                            <button onClick={() => deleteRule(i)}>Delete</button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Organize button */}
            <div style={{ marginTop: "20px" }}>
                <button onClick={organize}>Organize Now</button>
            </div>

            {/* Log */}
            <div style={{ marginTop: "20px" }}>
                <h2>Log</h2>
                <ul>
                    {log.map((l, i) => (
                        <li key={i}>{l.file} → {l.movedTo} at {new Date(l.timestamp).toLocaleTimeString()}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default App;
