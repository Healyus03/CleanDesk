import React, { useState, useEffect } from "react";
import "./global.css";
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';

// lucide icons
import { Home, FileText, Folder, RefreshCw, List, Settings as Cog } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Rules from './pages/Rules';
import Watched from './pages/Watched';
import AutoOrganize from './pages/AutoOrganize';
import Logs from './pages/Logs';
import Settings from './pages/Settings';

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

        // listen for auto-organize updates from main (guarded)
        if (window.electronAPI && typeof window.electronAPI.onAutoOrganizeLog === 'function') {
            window.electronAPI.onAutoOrganizeLog((newLog) => {
                setLog(newLog);
            });
        }
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

    // Organize files (one-off)
    const organize = async () => {
        if (!folder) return alert("Choose a folder");
        const result = await window.electronAPI.organizeFiles(folder);
        setLog(result);
    };

    // Start/stop periodic auto-organize
    const startAuto = async (intervalMs = 5000) => {
        if (!folder) return alert("Choose a folder");
        if (!window.electronAPI) return alert('IPC not available');
        const fn = window.electronAPI.startAutoOrganize || window.electronAPI.startAuto;
        if (typeof fn !== 'function') return alert('Auto-organize API not available');
        try {
            await fn(folder, intervalMs);
        } catch (err) {
            console.error('startAuto failed', err);
            alert('Failed to start auto-organize: ' + err.message);
        }
    };

    const stopAuto = async () => {
        if (!window.electronAPI) return;
        const fn = window.electronAPI.stopAutoOrganize || window.electronAPI.stopAuto;
        if (typeof fn !== 'function') return;
        try {
            await fn();
        } catch (err) {
            console.error('stopAuto failed', err);
        }
    };

    // Pick folder
    const pickFolder = async () => {
        const selected = await window.electronAPI.selectFolder();
        if (selected) setFolder(selected);
    };

    return (
        <Router>
            <div className="min-h-screen bg-gray-50 flex">
                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xl">
                            <Folder className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-bold text-lg">CleanDesk</div>
                            <div className="text-sm text-gray-500">Organizer</div>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        <Link to="/" className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg font-medium">
                            <Home className="text-xl" /> Dashboard
                        </Link>
                        <Link to="/rules" className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                            <FileText className="text-xl" /> Rules
                        </Link>
                        <Link to="/watched" className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                            <Folder className="text-xl" /> Watched Folder
                        </Link>
                        <Link to="/auto" className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                            <RefreshCw className="text-xl" /> Auto-organize
                        </Link>
                        <Link to="/logs" className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                            <List className="text-xl" /> Logs
                        </Link>
                        <Link to="/settings" className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                            <Cog className="text-xl" /> Settings
                        </Link>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8">
                    <Routes>
                        <Route path="/" element={<Dashboard log={log} folder={folder} pickFolder={pickFolder} organize={organize} startAuto={startAuto} stopAuto={stopAuto} />} />
                        <Route path="/rules" element={<Rules rules={rules} addRule={addRule} deleteRule={deleteRule} type={type} setType={setType} namePattern={namePattern} setNamePattern={setNamePattern} destination={destination} setDestination={setDestination} />} />
                        <Route path="/watched" element={<Watched folder={folder} pickFolder={pickFolder} />} />
                        <Route path="/auto" element={<AutoOrganize />} />
                        <Route path="/logs" element={<Logs log={log} />} />
                        <Route path="/settings" element={<Settings />} />
                    </Routes>

                    {/* Hidden functionality (accessible through sidebar) */}
                    <div className="hidden">
                        <button onClick={organize} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">Organize Now</button>
                        <button onClick={addRule} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Add Rule</button>
                    </div>
                </main>
            </div>
        </Router>
    );
}

export default App;
