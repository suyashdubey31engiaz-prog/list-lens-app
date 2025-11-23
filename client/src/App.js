import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Tesseract from 'tesseract.js';
import './App.css';

// ⚠️ YOUR IP ADDRESS
const API_URL = 'http://10.226.30.182:5000/api'; 

const generateId = () => Date.now().toString() + Math.floor(Math.random() * 1000);

const sortItems = (items) => {
    if (!items) return [];
    return [...items].sort((a, b) => (a.isChecked === b.isChecked ? 0 : a.isChecked ? 1 : -1));
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); 
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [authError, setAuthError] = useState("");

  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const fetchLists = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_URL}/lists`, { params: { userId: user.userId } });
      setLists(res.data);
    } catch (err) { console.error(err); }
  }, [user]);

  useEffect(() => {
    const savedUser = localStorage.getItem('scan_app_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setView('home');
    }
  }, []);

  useEffect(() => {
    if (user && view === 'home') {
      fetchLists();
    }
  }, [user, view, fetchLists]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    const endpoint = isRegister ? '/register' : '/login';
    try {
      const res = await axios.post(`${API_URL}${endpoint}`, { username, password });
      const userData = res.data;
      setUser(userData);
      localStorage.setItem('scan_app_user', JSON.stringify(userData));
      setView('permissions'); 
    } catch (err) {
      setAuthError(err.response?.data?.error || "Connection Error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('scan_app_user');
    setUser(null);
    setLists([]);
    setView('login');
  };

  const createList = async () => {
    const name = prompt("New List Name:");
    if (!name) return;
    try {
      const res = await axios.post(`${API_URL}/lists`, { name, userId: user.userId });
      setLists([res.data, ...lists]);
      openList(res.data);
    } catch (error) { console.error(error); }
  };

  const deleteList = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this list?")) return;
    try {
        await axios.delete(`${API_URL}/lists/${id}`);
        setLists(lists.filter(l => l._id !== id));
    } catch (error) { console.error(error); }
  };

  const openList = (list) => { setCurrentList(list); setView('editor'); };

  const saveList = async (updatedItems, newName = null) => {
    const payload = newName ? { name: newName } : { items: updatedItems };
    const updatedList = { 
        ...currentList, 
        items: updatedItems || currentList.items,
        name: newName || currentList.name
    };
    setCurrentList(updatedList);
    setLists(lists.map(l => l._id === currentList._id ? updatedList : l));
    try { await axios.put(`${API_URL}/lists/${currentList._id}`, payload); } catch (error) { console.error(error); }
  };
  
  const handleRename = async () => {
    const newName = prompt("Enter new name:");
    if (!newName) return;
    await saveList(currentList.items, newName);
  };

  // --- 🛠️ NEW: EXPORT / SHARE FUNCTION ---
  const handleExport = () => {
    if (!currentList) return;

    // 1. Create the text content
    let content = `📄 LIST: ${currentList.name}\n`;
    content += `Created on: ${new Date().toLocaleDateString()}\n`;
    content += `--------------------------------\n\n`;

    currentList.items.forEach(item => {
        const checkMark = item.isChecked ? "[DONE]" : "[TODO]";
        const noteText = item.note ? ` | Note: ${item.note}` : "";
        content += `${checkMark} ${item.text}${noteText}\n`;
    });

    // 2. Check if Mobile Native Share is available
    if (navigator.share) {
        navigator.share({
            title: currentList.name,
            text: content,
        }).catch(console.error);
    } else {
        // 3. Desktop Fallback: Download .txt file
        const element = document.createElement("a");
        const file = new Blob([content], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `${currentList.name.replace(/\s+/g, '_')}_backup.txt`;
        document.body.appendChild(element);
        element.click();
    }
  };

  // --- ITEM LOGIC ---
  const toggleCheck = (itemId) => {
    const newItems = currentList.items.map(item => {
        if (item._id === itemId || item.tempId === itemId) return { ...item, isChecked: !item.isChecked };
        return item;
    });
    saveList(newItems);
  };

  const changeField = (itemId, field, value) => {
    const newItems = currentList.items.map(item => {
        if (item._id === itemId || item.tempId === itemId) return { ...item, [field]: value };
        return item;
    });
    saveList(newItems);
  };

  const deleteItem = (itemId) => {
    const newItems = currentList.items.filter(item => (item._id !== itemId && item.tempId !== itemId));
    saveList(newItems);
  };

  const addItemManual = () => {
    const newItem = { tempId: generateId(), text: "", note: "", isChecked: false };
    saveList([...currentList.items, newItem]);
  };

  const handleScan = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setStatus("🧠 AI Analyzing...");
    
    Tesseract.recognize(file, 'eng').then(({ data: { text } }) => {
      const lines = text.split('\n');
      const newItems = [];
      lines.forEach(line => {
        let clean = line.replace(/^[\d\.\-\*•]+\s*/, '').trim();
        if (clean.length > 1) {
           clean = clean.charAt(0).toUpperCase() + clean.slice(1);
           newItems.push({ tempId: generateId(), text: clean, note: "", isChecked: false });
        }
      });
      saveList([...currentList.items, ...newItems]);
      setLoading(false);
    }).catch(() => { alert("Scan failed."); setLoading(false); });
  };

  // --- RENDER ---
  if (view === 'login') { return ( <div className="auth-container"><div className="auth-box"> <h1>📸 Scan App</h1> <h2>{isRegister ? "Create Account" : "Welcome Back"}</h2> {authError && <p className="error">{authError}</p>} <form onSubmit={handleAuth}> <input type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} required /> <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required /> <button type="submit">{isRegister ? "Sign Up" : "Login"}</button> </form> <p onClick={() => setIsRegister(!isRegister)} className="switch-link"> {isRegister ? "Already have an account? Login" : "New here? Register"} </p> </div></div> ); }
  if (view === 'permissions') { return ( <div className="perm-container"> <div className="perm-box"> <h2>⚠️ Permissions Required</h2> <p>To use this application, we need access to:</p> <div className="perm-item">📸 Camera (To scan documents)</div> <div className="perm-item">💾 Storage (To save your lists)</div> <button className="allow-btn" onClick={() => setView('home')}>ALLOW ACCESS</button> </div> </div> ); }

  return (
    <div className="app-container">
      {loading && <div className="overlay"><h2>{status}</h2></div>}

      <header>
        {view === 'editor' ? (
          <button className="back-btn" onClick={() => setView('home')}>← Back</button>
        ) : (
          <> <h1>📸 Smart Scan</h1> <button className="logout-btn" onClick={handleLogout}>Logout</button> </>
        )}
        {view === 'editor' && 
            <div className="list-title-area">
                <span className="header-title">{currentList?.name}</span>
                {/* NEW SHARE BUTTON */}
                <button className="icon-btn" onClick={handleExport} title="Save/Share">📤</button>
                <button className="icon-btn" onClick={handleRename} title="Rename">✎</button>
            </div>
        }
      </header>

      {view === 'home' && (
        <>
          <div className="folder-grid">
            {lists.map(list => (
              <div key={list._id} className="folder" onClick={() => openList(list)}>
                <div className="folder-top">
                  <span className="folder-icon">📁</span>
                  <button className="delete-folder-btn" onClick={(e) => deleteList(e, list._id)}>🗑️</button>
                </div>
                <div className="folder-name">{list.name}</div>
              </div>
            ))}
          </div>
          <button className="fab" onClick={createList}>+</button>
        </>
      )}

      {view === 'editor' && currentList && (
        <>
          <div className="toolbar">
            <label className="scan-btn-label">
              📷 Scan & Add
              <input type="file" accept="image/*" style={{display:'none'}} onChange={handleScan} />
            </label>
          </div>
          <div className="list-area">
            {sortItems(currentList.items).map((item) => (
               <div key={item._id || item.tempId} className={`todo-item ${item.isChecked ? 'completed' : ''}`}>
                 <input type="checkbox" checked={item.isChecked} onChange={() => toggleCheck(item._id || item.tempId)} />
                 <div className="input-group">
                     <input className="scanned-text" type="text" value={item.text} placeholder="Scanned..." onChange={(e) => changeField(item._id || item.tempId, 'text', e.target.value)} />
                     <input className="note-text" type="text" value={item.note} placeholder="Add Note..." onChange={(e) => changeField(item._id || item.tempId, 'note', e.target.value)} />
                 </div>
                 <button className="delete-item-btn" onClick={() => deleteItem(item._id || item.tempId)}>×</button>
               </div>
            ))}
          </div>
          <button className="fab" onClick={addItemManual}>+</button>
        </>
      )}
    </div>
  );
}

export default App;