import React, { useState, useEffect } from "react";
import "./global.css";
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';

// lucide icons
import { Home, FileText, Folder, List, Settings as Cog } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Rules from './pages/Rules';
import Watched from './pages/Watched';
import Logs from './pages/Logs';
import Settings from './pages/Settings';

function App() {
    const [rules, setRules] = useState([]);
    const [log, setLog] = useState([]);
    const [type, setType] = useState("");
    const [namePattern, setNamePattern] = useState("");
    const [destination, setDestination] = useState("");
    const [watched, setWatched] = useState([]);
    const [autoRunningPaths, setAutoRunningPaths] = useState([]);

    // Load rules, log, and watched on start
    useEffect(() => {
        window.electronAPI.loadRules().then(setRules);
        window.electronAPI.loadLog().then(setLog);
        if (window.electronAPI && typeof window.electronAPI.loadWatched === 'function') {
            window.electronAPI.loadWatched().then((list) => {
                if (Array.isArray(list)) setWatched(list);
                else if (Array.isArray(list.watched)) setWatched(list.watched);
                else setWatched([]);
            }).catch(() => setWatched([]));
        }

        // fetch which watched folders currently have auto running
        if (window.electronAPI && typeof window.electronAPI.getAutoRunning === 'function') {
            window.electronAPI.getAutoRunning().then((paths) => {
                if (Array.isArray(paths)) setAutoRunningPaths(paths);
            }).catch(() => setAutoRunningPaths([]));
        }

        // listen for auto-organize updates from main (guarded)
        if (window.electronAPI && typeof window.electronAPI.onAutoOrganizeLog === 'function') {
            window.electronAPI.onAutoOrganizeLog((payload) => {
                // payload: { folderPath, log }
                if (payload && payload.log) setLog(payload.log);
            });
        }

        // listen for running watchers changes
        if (window.electronAPI && typeof window.electronAPI.onAutoRunningChanged === 'function') {
            window.electronAPI.onAutoRunningChanged((paths) => {
                if (Array.isArray(paths)) setAutoRunningPaths(paths);
            });
        }
    }, []);

    // start auto for a specific folder (or legacy first watched)
    const startAuto = async (intervalMs = 5000, folderPath) => {
        try {
            // If no folderPath provided, ask main to start auto for all enabled watched folders.
            // Previously we selected the first enabled folder locally, which resulted in only that
            // folder being started. Let main handle starting all when folderPath is undefined.
            let ok;
            if (!folderPath) {
                ok = await window.electronAPI.startAuto(undefined, intervalMs);
            } else {
                ok = await window.electronAPI.startAuto(folderPath, intervalMs);
            }

            if (ok) {
                // refresh running paths from main process to get the full set
                try {
                    const paths = await window.electronAPI.getAutoRunning();
                    if (Array.isArray(paths)) setAutoRunningPaths(paths);
                } catch (e) {
                    // fallback: if main didn't return running paths, add folderPath if provided
                    if (folderPath) setAutoRunningPaths(prev => Array.from(new Set([...prev, folderPath])));
                }
            }
            return ok;
        } catch (err) {
            return false;
        }
    };

    const stopAuto = async (folderPath) => {
        try {
            // if folderPath not provided, stop all
            const ok = await window.electronAPI.stopAuto(folderPath);
            if (ok) {
                // refresh running paths from main
                try {
                    const paths = await window.electronAPI.getAutoRunning();
                    if (Array.isArray(paths)) setAutoRunningPaths(paths);
                    else setAutoRunningPaths([]);
                } catch (e) {
                    if (folderPath) setAutoRunningPaths(prev => prev.filter(p => p !== folderPath));
                    else setAutoRunningPaths([]);
                }
            }
            return ok;
        } catch (err) {
            return false;
        }
    };

    const isAutoRunning = () => {
        // treat auto as running if any watcher paths are active (more robust against transient watched state changes)
        return Array.isArray(autoRunningPaths) && autoRunningPaths.length > 0;
    };

    // Add rule
    const addRule = () => {
        if (!destination) return alert("Destination required");
        const newRule = { id: `rule_${Date.now()}`, type, namePattern, destination, enabled: true };
        const updated = [...rules, newRule];
        setRules(updated);
        window.electronAPI.saveRules(updated);
        setType(""); setNamePattern(""); setDestination("");
    };

    // Delete rule by id
    const deleteRule = (id) => {
        const updated = rules.filter(r => r.id !== id);
        setRules(updated);
        window.electronAPI.saveRules(updated);
    };

    // Watched folder helpers (multiple)
    const removeWatched = (id) => {
        const updated = watched.filter(w => w.id !== id);
        setWatched(updated);
        window.electronAPI.saveWatched(updated);
    };

    const toggleWatchedEnabled = async (id) => {
        const updated = watched.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
        setWatched(updated);
        await window.electronAPI.saveWatched(updated);

        // If a folder was just enabled and auto-organize is active, start auto for that folder immediately
        const changed = updated.find(w => w.id === id);
        if (changed && changed.enabled === true) {
            try {
                // Always refresh current running watchers from main to avoid stale state
                const paths = await window.electronAPI.getAutoRunning();
                if (Array.isArray(paths)) setAutoRunningPaths(paths);
                const autoActive = Array.isArray(paths) && paths.length > 0;
                if (autoActive) {
                    // use per-folder interval if present, otherwise default to 5000
                    const interval = (changed && changed.autoIntervalMs) ? changed.autoIntervalMs : 5000;
                    await startAuto(interval, changed.path);
                }
            } catch (e) {
                // fallback: if getAutoRunning fails, attempt to start the folder anyway
                try {
                    const interval = (changed && changed.autoIntervalMs) ? changed.autoIntervalMs : 5000;
                    await startAuto(interval, changed.path);
                } catch (ee) {
                    // ignore
                }
            }
        }

        // Previously we stopped auto for the folder when it was disabled; remove that behavior so
        // the global Auto-Organize switch remains on until the user explicitly turns it off.
        // (Keep persisted state only.)
    };

    const updateWatched = (updatedEntry) => {
        const updated = watched.map(w => w.id === updatedEntry.id ? updatedEntry : w);
        setWatched(updated);
        window.electronAPI.saveWatched(updated);
    };

    // Pick folder and add to watched
    const pickAndAddWatched = async () => {
        const selected = await window.electronAPI.selectFolder();
        if (!selected) return;
        if (watched.find(w => w.path === selected)) return alert('Folder already watched');
        const entry = { id: `folder_${Date.now()}`, path: selected, enabled: true, autoIntervalMs: 5000, ruleOverrides: {} };
        const updated = [...watched, entry];
        setWatched(updated);
        window.electronAPI.saveWatched(updated);
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
                            <h3>CleanDesk</h3>
                            <div className="text-sm text-gray-500">Organizer</div>
                        </div>
                    </div>

                    <nav className="space-y-2">
                        <NavLink to="/" end className={({isActive}) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <Home className="text-xl" /> Dashboard
                        </NavLink>
                        <NavLink to="/rules" className={({isActive}) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <FileText className="text-xl" /> Rules
                        </NavLink>
                        <NavLink to="/watched" className={({isActive}) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <Folder className="text-xl" /> Watched Folder
                        </NavLink>

                        <NavLink to="/logs" className={({isActive}) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <List className="text-xl" /> Logs
                        </NavLink>
                        <NavLink to="/settings" className={({isActive}) => `w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                            <Cog className="text-xl" /> Settings
                        </NavLink>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-8">
                    <Routes>
                        <Route path="/" element={<Dashboard log={log} watched={watched} startAuto={startAuto} stopAuto={stopAuto} autoRunning={isAutoRunning()} />} />
                        <Route path="/rules" element={<Rules rules={rules} addRule={addRule} deleteRule={deleteRule} type={type} setType={setType} namePattern={namePattern} setNamePattern={setNamePattern} destination={destination} setDestination={setDestination} />} />
                        <Route path="/watched" element={<Watched watched={watched} removeWatched={removeWatched} toggleWatchedEnabled={toggleWatchedEnabled} pickAndAddWatched={pickAndAddWatched} updateWatched={updateWatched} rules={rules} />} />
                        <Route path="/logs" element={<Logs log={log} />} />
                        <Route path="/settings" element={<Settings />} />
                        {/* Auto-organize page removed */}
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
