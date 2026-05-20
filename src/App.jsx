import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Trophy, Users, Lock, Settings, 
  Plus, Trash2, Edit3, Download, CheckCircle, 
  XCircle, ChevronRight, UserCheck, Database,
  Search, List, Layout, Clock, AlertCircle, FileText, BarChart3, Move, UserCog,
  Share2, PlayCircle, LogOut, ArrowLeft, UploadCloud, Medal, Star, Crown, Flag,
  Award, FileImage, Cloud, Loader2, Archive
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// --- Firebase Initialization ---
const localFirebaseConfig = {
  apiKey: "AIzaSyAcpSBOSCORdEORCAFlUvzCCrgZjTPNwc4",
  authDomain: "mmmeetmanager.firebaseapp.com",
  projectId: "mmmeetmanager",
  storageBucket: "mmmeetmanager.firebasestorage.app",
  messagingSenderId: "172347741761",
  appId: "1:172347741761:web:293174a830c2e3c8dd58c0"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : localFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'swim-meet-pro-cloud';

const App = () => {
  // --- Auth & User State ---
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [passwordInput, setPasswordInput] = useState('');
  const [masterPassword, setMasterPassword] = useState('123456');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [superView, setSuperView] = useState('meets'); 
  
  // --- Cloud Database States ---
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- UI App States ---
  const [activeMeetId, setActiveMeetId] = useState(null);
  const [showNewMeetModal, setShowNewMeetModal] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [newMeetForm, setNewMeetForm] = useState({ name: '', date: '', location: '', adminPin: '' });

  // --- Point Editor States ---
  const [editingPointsType, setEditingPointsType] = useState(null); // 'standard' or 'alternative'
  const [tempPoints, setTempPoints] = useState([]);

  // --- Centralized Custom Dialog State ---
  const [dialog, setDialog] = useState(null); 
  const showDialog = (title, message, type = 'info', onConfirm = null) => {
    setDialog({ title, message, type, onConfirm, customActions: null });
  };
  const closeDialog = () => setDialog(null);

  // --- Firebase Auth Effect ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Firebase Cloud Sync Effect ---
  useEffect(() => {
    if (!user) return;
    
    // Strict Database Path
    const meetsRef = collection(db, 'artifacts', appId, 'public', 'data', 'meets');
    
    const unsubscribe = onSnapshot(meetsRef, (snapshot) => {
      const meetsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMeets(meetsData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- UI States for Active Meet ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingEntry, setEditingEntry] = useState(null);
  const [leaderboardMode] = useState('standard'); 
  const [reportTab, setReportTab] = useState('points');
  const [runEventId, setRunEventId] = useState(null);
  const [runHeat, setRunHeat] = useState(1);
  const [isImporting, setIsImporting] = useState(false); 
  const [isImportingSwimmers, setIsImportingSwimmers] = useState(false);
  const [importProgress, setImportProgress] = useState(''); 
  const [entryMode, setEntryMode] = useState('individual');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState('overall');

  // --- Certificate States ---
  const [certPrintTextOnly, setCertPrintTextOnly] = useState(false);
  const [partCertMode, setPartCertMode] = useState('all_merged');

  const activeMeet = meets.find(m => m.id === activeMeetId) || {};
  
  // Optimistic UI Update & Cloud Sync Function
  const updateActiveMeet = async (updates) => {
    if (!activeMeetId) return;
    
    setMeets(prevMeets => prevMeets.map(m => m.id === activeMeetId ? { ...m, ...updates } : m));

    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'meets', activeMeetId);
    try {
      await setDoc(docRef, updates, { merge: true });
    } catch (err) {
      console.error("Sinkronisasi gagal:", err);
    }
  };

  const {
    meetInfo = {}, adminPin = '', scoringTable = { standard: [], alternative: [] }, ageGroups = [],
    events = [], teams = [], swimmers = [], entries = [], laneCount = 8, isSeeded = false, certBg = null, certCoords = {}
  } = activeMeet;

  useEffect(() => {
    if (!runEventId && events.length > 0) setRunEventId(events[0].id);
  }, [events, runEventId, activeMeetId]);

  // --- Auth Handlers ---
  const handleLogin = () => {
    if (passwordInput === masterPassword) {
      setRole('master'); setActiveMeetId(null); setSuperView('meets'); setIsLoggedIn(true);
    } else {
      const matchedMeet = meets.find(m => m.adminPin === passwordInput);
      if (matchedMeet) {
        setRole('admin'); setActiveMeetId(matchedMeet.id); setActiveTab('admin-panel'); setIsLoggedIn(true);
      } else { showDialog("Akses Ditolak", "Password Master atau PIN Lomba tidak valid!", "error"); }
    }
    setPasswordInput('');
  };

  const handleLogout = () => { setIsLoggedIn(false); setRole(null); setActiveMeetId(null); };

  // --- Cloud Meet Controllers ---
  const createNewMeet = async (e) => {
    e.preventDefault();
    if (!user) return showDialog("Error", "Anda belum terkoneksi ke Cloud.", "error");

    const newId = 'meet-' + Date.now();
    const newMeet = {
      id: newId,
      meetInfo: { name: newMeetForm.name, date: newMeetForm.date, location: newMeetForm.location },
      adminPin: newMeetForm.adminPin || 'PIN-' + Math.floor(1000 + Math.random() * 9000),
      scoringTable: { standard: [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0], alternative: [9, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      ageGroups: [], events: [], teams: [], swimmers: [], entries: [], laneCount: 8, isSeeded: false, certBg: null,
      certCoords: { name: { show: true, x: 148, y: 95 }, team: { show: true, x: 148, y: 110 }, event: { show: true, x: 148, y: 125 }, time: { show: true, x: 148, y: 140 }, rank: { show: true, x: 148, y: 155 } }
    };
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'meets', newId), newMeet);
      setShowNewMeetModal(false); 
      setNewMeetForm({ name: '', date: '', location: '', adminPin: '' });
    } catch (err) {
      showDialog("Gagal Simpan", "Terjadi error saat membuat lomba di Cloud.", "error");
    }
  };

  const deleteMeet = (id) => {
    showDialog('Konfirmasi Hapus', 'PERINGATAN: Seluruh data lomba ini akan dihapus permanen dari Cloud. Lanjutkan?', 'warning', async () => {
      if (!user) return;
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'meets', id));
      } catch (err) {
        console.error(err);
      }
    });
  };

  const timeToSeconds = (timeStr) => {
    if (!timeStr) return Infinity; const parts = timeStr.split(':');
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    return parseFloat(parts[0]);
  };

  const formatTime = (val) => {
    if (!val) return val; if (val.includes(':') || val.includes('.')) return val;
    const digits = val.replace(/\D/g, '');
    if (digits.length === 4) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}`;
    if (digits.length === 5) return `${digits.slice(0, 1)}:${digits.slice(1, 3)}.${digits.slice(3, 5)}`;
    if (digits.length === 6) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}.${digits.slice(4, 6)}`;
    return val;
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return dateStr;
  };

  // --- Setup & Age Groups ---
  const [newKU, setNewKU] = useState({ name: '', minAge: '', maxAge: '' });
  const fileInputRef = useRef(null); 
  const swimmerFileInputRef = useRef(null);

  const addAgeGroup = () => {
    if(!newKU.name || !newKU.minAge || !newKU.maxAge) return;
    updateActiveMeet({ ageGroups: [...ageGroups, { ...newKU, id: 'ku_' + Date.now(), minAge: parseInt(newKU.minAge), maxAge: parseInt(newKU.maxAge) }] });
    setNewKU({ name: '', minAge: '', maxAge: '' });
  };

  const removeAgeGroup = (id) => updateActiveMeet({ ageGroups: ageGroups.filter(ku => ku.id !== id) });

  const addEvent = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const distance = formData.get('distance');
    const stroke = formData.get('stroke').trim();
    const gender = formData.get('gender');
    const category = formData.get('category');
    const type = formData.get('type');

    const isDuplicate = events.some(ev => ev.distance === distance && ev.stroke.toLowerCase() === stroke.toLowerCase() && ev.gender === gender && ev.category === category && ev.type === type);
    if (isDuplicate) return showDialog('Ditolak', 'Acara lomba ini sudah ada di daftar!', 'warning');

    const name = `${distance}m Gaya ${stroke} ${gender} ${category} ${type === 'Estafet' ? '(ESTAFET)' : ''}`;
    updateActiveMeet({ events: [...events, { id: 'ev-' + Date.now(), distance, stroke, gender, category, type, name }] });
    e.target.reset();
  };

  // --- Point Editor Controllers ---
  const handleOpenPointEditor = (type) => {
    setEditingPointsType(type);
    setTempPoints([...(scoringTable[type] || Array(20).fill(0))]);
  };

  const handleSavePoints = () => {
    updateActiveMeet({
        scoringTable: {
            ...scoringTable,
            [editingPointsType]: tempPoints.map(p => parseInt(p) || 0)
        }
    });
    setEditingPointsType(null);
    showDialog('Tersimpan', `Poin ${editingPointsType === 'standard' ? 'Standar' : 'Alternatif'} berhasil diperbarui.\n\nJangan lupa tekan tombol Re-Score pada Run Screen jika lomba sudah berjalan.`, 'success');
  };

  // --- Teams Management ---
  const [teamForm, setTeamForm] = useState({ name: '', abbr: '' });
  const registerTeam = (e) => {
    e.preventDefault();
    if (!teamForm.name) return; // Hanya butuh nama tim

    // Auto ABBR Generation Logic
    let finalAbbr = teamForm.abbr.trim().toUpperCase();
    if (!finalAbbr) {
      const words = teamForm.name.trim().split(/\s+/);
      if (words.length > 1) {
        finalAbbr = words.map(w => w[0]).join('').substring(0, 5).toUpperCase();
      } else {
        finalAbbr = teamForm.name.trim().substring(0, 3).toUpperCase();
      }
    }

    const isDup = teams.some(t => t.name.toLowerCase() === teamForm.name.trim().toLowerCase() || t.abbr.toLowerCase() === finalAbbr.toLowerCase());
    if (isDup) return showDialog('Ditolak', 'Nama Tim atau ABBR sudah digunakan!', 'error');
    
    updateActiveMeet({ teams: [...teams, { id: 'tm-' + Date.now(), name: teamForm.name.trim(), abbr: finalAbbr }] });
    setTeamForm({ name: '', abbr: '' });
  };

  const deleteTeamFromMeet = (id) => {
    const isUsed = swimmers.some(s => s.teamId === id) || entries.some(en => en.teamId === id);
    if (isUsed) return showDialog('Ditolak', 'Tim ini tidak bisa dihapus karena masih ada data/atlet yang terdaftar di dalamnya.', 'error');
    showDialog('Hapus Tim', 'Yakin ingin menghapus tim ini dari daftar?', 'warning', () => updateActiveMeet({ teams: teams.filter(t => t.id !== id) }));
  };

  // --- Athletes Management ---
  const [swimmerForm, setSwimmerForm] = useState({ name: '', teamId: '', district: '-', grade: '-' });
  const [formDob, setFormDob] = useState('');
  const [debouncedDob, setDebouncedDob] = useState('');
  const [formGender, setFormGender] = useState('Putra');
  const [athleteSearch, setAthleteSearch] = useState('');
  const [editingAthlete, setEditingAthlete] = useState(null);

  useEffect(() => { const timer = setTimeout(() => { setDebouncedDob(formDob); }, 1000); return () => clearTimeout(timer); }, [formDob]);

  const calculatedAgeInfo = useMemo(() => {
    if (!debouncedDob) return null;
    const birthYear = new Date(debouncedDob).getFullYear();
    if (isNaN(birthYear) || birthYear < 1900 || birthYear > 2100) return null;
    const age = new Date(meetInfo.date).getFullYear() - birthYear;
    const matchedKUs = ageGroups.filter(ku => age >= ku.minAge && age <= ku.maxAge);
    return { age, kuNames: matchedKUs.map(ku => ku.name), kuNameDisplay: matchedKUs.length > 0 ? matchedKUs.map(ku => ku.name).join(', ') : 'TIDAK MASUK KU', isValid: matchedKUs.length > 0 };
  }, [debouncedDob, meetInfo.date, ageGroups]);

  const registerAthleteOnly = (e) => {
    e.preventDefault();
    if(!calculatedAgeInfo || !calculatedAgeInfo.isValid) return showDialog("Gagal", "Umur atlet tidak masuk dalam Kelompok Umur (KU) manapun!", "error");
    if(!swimmerForm.teamId) return showDialog("Perhatian", "Pilih Klub terlebih dahulu.", "warning");

    const team = teams.find(t => t.id === swimmerForm.teamId);
    if (swimmers.find(s => s.name.trim().toLowerCase() === swimmerForm.name.trim().toLowerCase() && s.dob === formDob)) return showDialog("Ditolak", "Atlet dengan nama dan DOB ini sudah terdaftar!", "error");

    const newSwimmer = {
      id: 'sw-' + Date.now(), name: swimmerForm.name.trim(), teamId: team.id, org: team.name, abbr: team.abbr, district: swimmerForm.district || '-', 
      grade: swimmerForm.grade || '-', gender: formGender, dob: formDob, age: calculatedAgeInfo.age, category: calculatedAgeInfo.kuNameDisplay
    };

    updateActiveMeet({ swimmers: [...swimmers, newSwimmer] });
    e.target.reset(); setSwimmerForm({ name: '', teamId: swimmerForm.teamId, district: '-', grade: '-' }); setFormDob('');
    showDialog("Sukses", `Atlet atas nama ${newSwimmer.name.toUpperCase()} berhasil ditambahkan!`, "success");
  };

  const handleSaveEditAthlete = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const team = teams.find(t => t.id === formData.get('teamId'));
    const age = new Date(meetInfo.date).getFullYear() - new Date(formData.get('dob')).getFullYear();
    const matchedKUs = ageGroups.filter(ku => age >= ku.minAge && age <= ku.maxAge);
    
    if (matchedKUs.length === 0) return showDialog("Gagal Update", "Tanggal lahir baru membuat atlet ini tidak masuk ke KU manapun!", "error");

    const updatedSwimmers = swimmers.map(s => {
      if (s.id === editingAthlete.id) {
        return { ...s, name: formData.get('name').trim(), teamId: team.id, org: team.name, abbr: team.abbr, gender: formData.get('gender'), dob: formData.get('dob'), district: formData.get('district') || '-', grade: formData.get('grade') || '-', age: age, category: matchedKUs.map(ku => ku.name).join(', ') };
      }
      return s;
    });

    updateActiveMeet({ swimmers: updatedSwimmers }); setEditingAthlete(null); showDialog('Sukses', 'Data atlet diperbarui.', 'success');
  };

  const deleteSwimmer = (id) => {
    showDialog('Hapus Atlet', 'Hapus atlet ini dan SELURUH pendaftaran lombanya?', 'warning', () => {
      updateActiveMeet({ swimmers: swimmers.filter(s => s.id !== id), entries: entries.filter(en => en.swimmerId !== id) });
      if(selectedEntryEntity?.id === id) setSelectedEntryEntity(null);
    });
  };

  // --- Entries Management ---
  const [selectedEntryEntity, setSelectedEntryEntity] = useState(null); 
  const [entrySearch, setEntrySearch] = useState('');

  const handleToggleEntry = (eventId, seedTime) => {
    if (!selectedEntryEntity) return;
    
    const isRelayMode = entryMode === 'relay';
    const existingEntry = entries.find(en => 
      en.eventId === eventId && 
      (isRelayMode ? en.teamId === selectedEntryEntity.id : en.swimmerId === selectedEntryEntity.id)
    );
    
    if (existingEntry) {
      updateActiveMeet({ entries: entries.filter(en => en.id !== existingEntry.id) });
    } else {
      const newEntry = {
        id: 'en-' + Math.random().toString(36).substr(2, 9), 
        eventId: eventId,
        swimmerId: isRelayMode ? null : selectedEntryEntity.id, 
        teamId: isRelayMode ? selectedEntryEntity.id : null,
        seedTime: seedTime || '99:99.99', 
        resultTime: '', status: '', standardPoints: 0, alternativePoints: 0, pl: '', hpl: '', heat: 0, lane: 0,
        isSparring: false
      };
      updateActiveMeet({ entries: [...entries, newEntry] });
    }
  };

  const handleToggleSparring = (entryId) => {
    const existingEntry = entries.find(en => en.id === entryId);
    if (existingEntry) {
      updateActiveMeet({ entries: entries.map(en => en.id === entryId ? { ...en, isSparring: !en.isSparring } : en) });
    }
  };

  const handleUpdateEntrySeed = (eventId, newSeedTime) => {
    if (!selectedEntryEntity) return;
    const isRelayMode = entryMode === 'relay';
    const existingEntry = entries.find(en => en.eventId === eventId && (isRelayMode ? en.teamId === selectedEntryEntity.id : en.swimmerId === selectedEntryEntity.id));
    if (existingEntry) {
      updateActiveMeet({ entries: entries.map(en => en.id === existingEntry.id ? { ...en, seedTime: formatTime(newSeedTime) } : en) });
    }
  };

  // --- Seeding & Running ---
  const runSeeding = () => {
    if(laneCount < 1) return showDialog('Error', 'Jumlah lintasan tidak valid.', 'error');
    const updatedEntries = [...entries];
    
    events.forEach(event => {
      let eventEntries = updatedEntries.filter(en => en.eventId === event.id);
      
      const noTimeEntries = eventEntries.filter(en => !en.seedTime || en.seedTime === '99:99.99' || en.seedTime.toLowerCase() === 'nt');
      const seededEntries = eventEntries.filter(en => en.seedTime && en.seedTime !== '99:99.99' && en.seedTime.toLowerCase() !== 'nt');

      for (let i = noTimeEntries.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [noTimeEntries[i], noTimeEntries[j]] = [noTimeEntries[j], noTimeEntries[i]];
      }

      seededEntries.sort((a, b) => a.seedTime.localeCompare(b.seedTime));
      eventEntries = [...seededEntries, ...noTimeEntries];

      const totalSwimmers = eventEntries.length;
      if (totalSwimmers === 0) return;

      const numHeats = Math.ceil(totalSwimmers / laneCount);

      eventEntries.forEach((entry, index) => {
        const heatIndexFromEnd = Math.floor(index / laneCount);
        const heatNum = numHeats - heatIndexFromEnd;
        const indexInHeat = index % laneCount;
        
        let lanes = [];
        let center = Math.floor(laneCount / 2) + (laneCount % 2 !== 0 ? 1 : 0);
        lanes.push(center);
        for(let l = 1; l <= laneCount; l++) {
            if(center + l <= laneCount) lanes.push(center + l);
            if(center - l >= 1) lanes.push(center - l);
        }
        
        const targetEntry = updatedEntries.find(e => e.id === entry.id);
        if (targetEntry) {
            targetEntry.heat = heatNum;
            targetEntry.lane = lanes[indexInHeat];
        }
      });
    });
    
    updateActiveMeet({ entries: updatedEntries, isSeeded: true });
    showDialog('Seeding Selesai', `Seeding FINA untuk kolam ${laneCount} lintasan telah berhasil di-generate!\n(Perenang tanpa seed time telah diacak)`, 'success');
  };

  const moveEntry = (entryId, newHeat, newLane) => {
    const targetHeat = parseInt(newHeat); const targetLane = parseInt(newLane);
    const currentEntry = entries.find(e => e.id === entryId);
    if (!currentEntry) return;

    const isOccupied = entries.some(e => e.eventId === currentEntry.eventId && e.id !== entryId && e.heat === targetHeat && e.lane === targetLane);
    if (isOccupied) return showDialog('Posisi Terisi', `PERINGATAN!\nSeri ${targetHeat} Lintasan ${targetLane} sudah terisi.`, 'warning');

    updateActiveMeet({ entries: entries.map(en => en.id === entryId ? { ...en, heat: targetHeat, lane: targetLane } : en) });
    setEditingEntry(null);
  };

  const handleTimeInputChange = (entryId, val) => {
    let newTime = val;
    let newStatus = '';
    const lowerVal = (val || '').toLowerCase().trim();

    if (lowerVal === 'nt') { newTime = ''; newStatus = 'NT'; }
    else if (lowerVal === 'ns' || lowerVal === 'dns') { newTime = ''; newStatus = 'DNS'; }
    else if (lowerVal === 'dq') { newTime = ''; newStatus = 'DQ'; }
    else if (lowerVal === 'dnf') { newTime = ''; newStatus = 'DNF'; }
    else if (lowerVal === 'scr') { newTime = ''; newStatus = 'SCR'; }

    updateActiveMeet({ entries: entries.map(en => en.id === entryId ? { ...en, resultTime: newTime, status: newStatus } : en) });
  };

  const handleTimeInputBlur = (entryId, val) => {
    const lowerVal = (val || '').toLowerCase().trim();
    if (['nt', 'ns', 'dns', 'dq', 'dnf', 'scr'].includes(lowerVal)) return;
    updateActiveMeet({ entries: entries.map(en => en.id === entryId ? { ...en, resultTime: formatTime(val) } : en) });
  };

  const handleStatusChange = (entryId, newStatus) => {
    updateActiveMeet({ entries: entries.map(en => {
      if (en.id === entryId) return { ...en, status: newStatus, resultTime: newStatus ? '' : en.resultTime };
      return en;
    }) });
  };

  const calculatePoints = (eventId, force = false) => {
    const eventEntriesAll = entries.filter(en => en.eventId === eventId);
    const missingTimes = eventEntriesAll.filter(en => !en.resultTime && !en.status);

    if (missingTimes.length > 0 && !force) {
      showDialog('Belum Semua Seri Selesai', `Masih ada ${missingTimes.length} lintasan di acara ini yang belum diinput waktunya.\n\nYakin ingin mengkalkulasi skor sementara?`, 'warning', () => calculatePoints(eventId, true));
      return;
    }

    const validRegular = eventEntriesAll.filter(en => en.resultTime && !en.status && !en.isSparring);
    const validSparring = eventEntriesAll.filter(en => en.resultTime && !en.status && en.isSparring);

    validRegular.sort((a, b) => a.resultTime.localeCompare(b.resultTime));
    validSparring.sort((a, b) => a.resultTime.localeCompare(b.resultTime));

    const updatedEntries = entries.map(en => {
      if (en.eventId === eventId) {
        if (en.status || !en.resultTime) {
          return { ...en, standardPoints: 0, alternativePoints: 0, pl: '-', hpl: '-' };
        }
        
        const heatEntries = eventEntriesAll.filter(heatEn => heatEn.heat === en.heat && heatEn.resultTime && !heatEn.status);
        heatEntries.sort((a,b) => a.resultTime.localeCompare(b.resultTime));
        const heatRank = heatEntries.findIndex(sorted => sorted.id === en.id) + 1;

        if (en.isSparring) {
          return { ...en, standardPoints: 0, alternativePoints: 0, pl: 'X', hpl: heatRank };
        } else {
          const rank = validRegular.findIndex(sorted => sorted.id === en.id);
          const stdPts = rank < 20 ? scoringTable.standard[rank] : 0;
          const altPts = rank < 20 ? scoringTable.alternative[rank] : 0;
          return { ...en, standardPoints: stdPts, alternativePoints: altPts, pl: rank + 1, hpl: heatRank };
        }
      }
      return en;
    });
    updateActiveMeet({ entries: updatedEntries });
    
    if (force) showDialog('Skor Disimpan', 'Skor berhasil dihitung. Jangan lupa untuk Re-Score jika seri selanjutnya sudah diinput.', 'info');
    else showDialog('Skor Diperbarui', 'Poin dan Peringkat (PL) berhasil dikalkulasi secara final!', 'success');
  };

  // --- Reports Calculation (Memos) ---
  const swimmerScores = useMemo(() => {
    const pointKey = leaderboardMode === 'standard' ? 'standardPoints' : 'alternativePoints';
    const stats = {};
    swimmers.forEach(s => stats[s.id] = { ...s, totalPoints: 0 });
    entries.forEach(en => {
      if (en.swimmerId && stats[en.swimmerId]) {
        stats[en.swimmerId].totalPoints += (en[pointKey] || 0);
      }
    });
    return Object.values(stats).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [swimmers, entries, leaderboardMode]);

  const medalTally = useMemo(() => {
    const tally = {};
    teams.forEach(t => tally[t.id] = { name: t.name, abbr: t.abbr, gold: 0, silver: 0, bronze: 0 });
    entries.forEach(en => {
      if (!en.status && en.pl >= 1 && en.pl <= 3) {
        const teamId = en.teamId || swimmers.find(s => s.id === en.swimmerId)?.teamId;
        if (teamId && tally[teamId]) {
          if (en.pl === 1) tally[teamId].gold++;
          else if (en.pl === 2) tally[teamId].silver++;
          else if (en.pl === 3) tally[teamId].bronze++;
        }
      }
    });
    return Object.values(tally).sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
  }, [teams, swimmers, entries]);

  const bestSwimmersData = useMemo(() => {
    const pointKey = leaderboardMode === 'standard' ? 'standardPoints' : 'alternativePoints';
    const stats = {};
    swimmers.forEach(s => stats[s.id] = { ...s, gold: 0, silver: 0, bronze: 0, points: 0 });
    entries.forEach(en => {
      if (en.swimmerId && stats[en.swimmerId] && !en.status) {
        if (en.pl === 1) stats[en.swimmerId].gold++;
        if (en.pl === 2) stats[en.swimmerId].silver++;
        if (en.pl === 3) stats[en.swimmerId].bronze++;
        stats[en.swimmerId].points += (en[pointKey] || 0);
      }
    });
    const grouped = {};
    Object.values(stats).forEach(s => {
      const key = `${s.category} - ${s.gender}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    Object.keys(grouped).forEach(k => {
      grouped[k].sort((a,b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || b.points - a.points);
    });
    return grouped;
  }, [swimmers, entries, leaderboardMode]);

  const clubScores = useMemo(() => {
    const pointKey = leaderboardMode === 'standard' ? 'standardPoints' : 'alternativePoints';
    const orgs = {};
    teams.forEach(t => orgs[t.id] = { name: t.name, abbr: t.abbr, points: 0 });
    entries.forEach(en => {
      const teamId = en.teamId || swimmers.find(sw => sw.id === en.swimmerId)?.teamId;
      if (teamId && orgs[teamId]) orgs[teamId].points += (en[pointKey] || 0);
    });
    return Object.values(orgs).sort((a, b) => b.points - a.points);
  }, [teams, swimmers, entries, leaderboardMode]);

  // --- Utilities & Export ---
  const loadXlsx = async () => {
    if (window.XLSX) return window.XLSX;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://unpkg.com/xlsx/dist/xlsx.full.min.js'; 
      script.onload = () => resolve(window.XLSX); script.onerror = reject; document.head.appendChild(script);
    });
  };

  const loadJsPDF = async () => {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => {
        const scriptAutoTable = document.createElement('script'); scriptAutoTable.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
        scriptAutoTable.onload = () => resolve(window.jspdf.jsPDF); document.head.appendChild(scriptAutoTable);
      };
      script.onerror = reject; document.head.appendChild(script);
    });
  };

  const loadJSZip = async () => {
    if (window.JSZip && window.saveAs) return { JSZip: window.JSZip, saveAs: window.saveAs };
    return new Promise((resolve, reject) => {
      const scriptZip = document.createElement('script'); scriptZip.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      scriptZip.onload = () => {
        const scriptSaver = document.createElement('script'); scriptSaver.src = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
        scriptSaver.onload = () => resolve({ JSZip: window.JSZip, saveAs: window.saveAs });
        scriptSaver.onerror = reject; document.head.appendChild(scriptSaver);
      };
      scriptZip.onerror = reject; document.head.appendChild(scriptZip);
    });
  };

  const handleExportEventListPDF = async () => {
    if (events.length === 0) return showDialog("Kosong", "Belum ada acara lomba yang didaftarkan.", "warning");
    setImportProgress('Men-generate PDF...'); setIsImporting(true);

    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF();
      let finalY = 15;

      doc.setFontSize(14); doc.setFont("helvetica", "bold");
      doc.text(`${meetInfo.name.toUpperCase()} - ${meetInfo.date}`, 105, finalY, { align: "center" });
      finalY += 6;
      doc.setFontSize(12);
      doc.text("Event List - By Event Number", 105, finalY, { align: "center" });
      finalY += 10;

      const tableData = [];
      const halfLength = Math.ceil(events.length / 2);
      
      for (let i = 0; i < halfLength; i++) {
        const leftEvent = events[i];
        const rightEvent = events[i + halfLength];
        
        const row = [
          i + 1, 
          leftEvent ? leftEvent.name : '', 
          rightEvent ? i + halfLength + 1 : '', 
          rightEvent ? rightEvent.name : ''
        ];
        tableData.push(row);
      }

      doc.autoTable({
        startY: finalY,
        head: [['Event #', 'Event Name', 'Event #', 'Event Name']],
        body: tableData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [0, 0, 0] },
        columnStyles: { 
          0: { cellWidth: 15, halign: 'center' }, 
          1: { cellWidth: 75 }, 
          2: { cellWidth: 15, halign: 'center' }, 
          3: { cellWidth: 75 } 
        }
      });

      const pageCount = doc.internal.getNumberOfPages();
      const printStamp = `MMMeet Manager | Generated at ${new Date().toLocaleString('id-ID')}`;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
        doc.text(printStamp, 14, 10); doc.text(`Halaman ${i}`, 196, 10, { align: "right" });
      }

      doc.save(`Event_List_${meetInfo.name.replace(/\s+/g, '_')}.pdf`);
      showDialog("Sukses", `PDF Event List berhasil dibuat!`, "success");
    } catch (err) {
      console.error(err);
      showDialog("Error", "Gagal men-generate file. Pastikan internet aktif.", "error");
    } finally {
      setIsImporting(false);
      setImportProgress('');
    }
  };

  const exportToXLSX = async (data, filename, sheetName = "Data", customCols = null) => {
    if (data.length === 0) return showDialog('Kosong', 'Tidak ada data untuk diekspor.', 'warning');
    try {
      const XLSX = await loadXlsx();
      const ws = Array.isArray(data[0]) ? XLSX.utils.aoa_to_sheet(data) : XLSX.utils.json_to_sheet(data);
      if (customCols) ws['!cols'] = customCols;
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName); XLSX.writeFile(wb, `${filename}.xlsx`);
    } catch (err) { showDialog('Error', 'Gagal memuat Excel.', 'error'); }
  };

  const handleDownloadEventTemplate = () => {
    const templateData = [
      { 'Jarak (Angka Saja)': '50', 'Gaya Lomba': 'Bebas', 'Gender': 'Putra', 'Kelompok Umur': 'SMP', 'Tipe (Individual/Estafet)': 'Individual' },
      { 'Jarak (Angka Saja)': '4x50', 'Gaya Lomba': 'Bebas', 'Gender': 'Putra', 'Kelompok Umur': 'SMP', 'Tipe (Individual/Estafet)': 'Estafet' }
    ];
    exportToXLSX(templateData, 'Template_Setup_Lomba', 'Template Lomba');
  };

  const handleDownloadSwimmerTemplate = () => {
    const templateData = [
      { 'Nama Lengkap': 'CALVERT GIOVANNO', 'Sekolah / Klub': 'SMPN 240 JAKARTA', 'ABBR': 'KB', 'Kecamatan': 'KEBAYORAN BARU', 'Kelas': '8', 'Jenis Kelamin': 'Putra', 'Tanggal Lahir (DOB)': '2012-03-21', 'Acara Lomba': '50 Bebas', 'Seed Time': '99:99.99' }
    ];
    exportToXLSX(templateData, 'Template_Import_Atlet_dan_Entri', 'Data Atlet');
  };

  const handleExportMeetProgramPDF = async () => {
    if (!isSeeded) return showDialog("Peringatan", "Lakukan seeding terlebih dahulu.", "warning");
    setImportProgress('Men-generate PDF...'); setIsImportingSwimmers(true); 

    try {
      const jsPDF = await loadJsPDF(); const doc = new jsPDF(); let finalY = 20;

      doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(meetInfo.name.toUpperCase(), 105, finalY, { align: "center" });
      finalY += 6; doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text("Meet Program", 105, finalY, { align: "center" }); finalY += 15;

      events.forEach((event, eIdx) => {
        const eventEntries = entries.filter(en => en.eventId === event.id && en.heat > 0);
        if (eventEntries.length === 0) return;

        const heatsCount = Math.max(...eventEntries.map(e => e.heat));
        if (finalY > 260) { doc.addPage(); finalY = 20; }

        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text(`Event ${eIdx + 1}  ${event.distance}m Gaya ${event.stroke} ${event.gender} ${event.category} ${event.type === 'Estafet' ? '(ESTAFET)' : ''}`, 14, finalY);
        finalY += 1; doc.setLineWidth(0.5); doc.line(14, finalY, 196, finalY); finalY += 5;

        for (let heatNum = 1; heatNum <= heatsCount; heatNum++) {
          if (finalY > 260) { doc.addPage(); finalY = 20; }
          doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(`Heat ${heatNum} of ${heatsCount} Timed Finals`, 14, finalY); finalY += 4;

          const tableData = [];
          for (let i = 1; i <= laneCount; i++) {
            const en = eventEntries.find(e => e.heat === heatNum && e.lane === i);
            if (en) {
              const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name.toUpperCase() : teams.find(t => t.id === en.teamId)?.name.toUpperCase() + ' (A)';
              const age = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.age.toString() : '';
              const org = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.org.toUpperCase() : teams.find(t => t.id === en.teamId)?.abbr.toUpperCase();
              tableData.push([ i.toString(), name || '', age || '', org || '', en.seedTime, '________________', '______' ]);
            } else {
              tableData.push([ i.toString(), '', '', '', '', '________________', '______' ]);
            }
          }

          doc.autoTable({
            startY: finalY, head: [['Lane', 'Name / Team', 'Age', 'Team', 'Seed Time', 'Finals', 'Place']], body: tableData,
            theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, headStyles: { fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [0, 0, 0] },
            columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 55 }, 2: { cellWidth: 10, halign: 'center' }, 3: { cellWidth: 40 }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 30, halign: 'center' }, 6: { cellWidth: 15, halign: 'center' } },
            didDrawPage: function (data) { finalY = data.cursor.y; }
          });
          finalY = doc.lastAutoTable.finalY + 10;
        }
      });

      const pageCount = doc.internal.getNumberOfPages();
      const now = new Date(); const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateStr = `${now.getDate().toString().padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
      const printStamp = `MMMeet Manager - ${timeStr} ${dateStr}`;

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100); 
        doc.text(printStamp, 14, 10); doc.text(`Halaman ${i}`, 196, 10, { align: "right" });
      }

      doc.save(`Meet_Program_${meetInfo.name.replace(/\s+/g, '_')}.pdf`);
      showDialog("Sukses", "Meet Program PDF berhasil dibuat dan diunduh!", "success");
    } catch (error) { showDialog("Error", "Gagal men-generate PDF. Pastikan internet aktif.", "error"); } finally { setIsImportingSwimmers(false); setImportProgress(''); }
  };

  const handleExportPsychSheet = async (mode, format) => {
    setIsImportingSwimmers(true);
    setImportProgress(`Men-generate ${format.toUpperCase()}...`);
    setShowExportModal(false);

    try {
      if (format === 'xlsx') {
        const XLSX = await loadXlsx();
        const wb = XLSX.utils.book_new();

        if (mode === 'overall') {
          const aoa = [[meetInfo.name.toUpperCase()], ['Psych Sheet (Keseluruhan)'], []];
          events.forEach((ev, eIdx) => {
            let evEntries = entries.filter(en => en.eventId === ev.id);
            if (evEntries.length === 0) return;
            evEntries.sort((a, b) => a.seedTime.localeCompare(b.seedTime));

            aoa.push([`Event ${eIdx + 1} - ${ev.name}`]);
            aoa.push(['Rank', 'Name/Team', 'Age', 'Team', 'Seed Time']);

            evEntries.forEach((en, rank) => {
              const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name.toUpperCase() : teams.find(t => t.id === en.teamId)?.name.toUpperCase() + ' (A)';
              const age = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.age?.toString() : '';
              const org = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.abbr.toUpperCase() : teams.find(t => t.id === en.teamId)?.abbr.toUpperCase();
              const seed = (en.seedTime === '99:99.99' || !en.seedTime) ? 'NT' : en.seedTime;
              aoa.push([rank + 1, name || '', age || '', org || '', seed]);
            });
            aoa.push([]);
          });
          const ws = XLSX.utils.aoa_to_sheet(aoa);
          ws['!cols'] = [{wch: 8}, {wch: 40}, {wch: 8}, {wch: 15}, {wch: 15}];
          XLSX.utils.book_append_sheet(wb, ws, "Psych Sheet");
        } else {
          teams.forEach(team => {
            const teamEntries = entries.filter(en => {
              if (en.teamId === team.id) return true;
              if (en.swimmerId) {
                const sw = swimmers.find(s => s.id === en.swimmerId);
                return sw && sw.teamId === team.id;
              }
              return false;
            });

            if (teamEntries.length === 0) return;

            teamEntries.sort((a, b) => {
              const eA = events.findIndex(e => e.id === a.eventId);
              const eB = events.findIndex(e => e.id === b.eventId);
              return eA - eB;
            });

            const aoa = [[meetInfo.name.toUpperCase()], [`Entry List - ${team.name}`], []];
            aoa.push(['Event', 'Nama Atlet / Estafet', 'Kategori', 'Gender', 'Seed Time']);

            teamEntries.forEach(en => {
              const ev = events.find(e => e.id === en.eventId);
              const eventName = ev ? `Evt ${events.indexOf(ev) + 1}: ${ev.distance}m ${ev.stroke}` : '';
              const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name.toUpperCase() : team.name.toUpperCase() + ' (A)';
              const cat = ev ? ev.category : '';
              const gen = ev ? ev.gender : '';
              const seed = (en.seedTime === '99:99.99' || !en.seedTime) ? 'NT' : en.seedTime;
              aoa.push([eventName, name || '', cat, gen, seed]);
            });

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = [{wch: 25}, {wch: 40}, {wch: 15}, {wch: 10}, {wch: 15}];
            
            let sheetName = team.abbr.replace(/[^a-zA-Z0-9]/g, '').substring(0, 31);
            if (!sheetName) sheetName = "Team";
            
            let counter = 1;
            let finalSheetName = sheetName;
            while(wb.SheetNames.includes(finalSheetName)) {
               finalSheetName = `${sheetName.substring(0, 28)}_${counter}`;
               counter++;
            }
            
            XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
          });
          
          if(wb.SheetNames.length === 0) {
             const ws = XLSX.utils.aoa_to_sheet([["Tidak ada data"]]);
             XLSX.utils.book_append_sheet(wb, ws, "Kosong");
          }
        }

        XLSX.writeFile(wb, `${mode === 'overall' ? 'Psych_Sheet' : 'Entry_List_Per_Tim'}_${meetInfo.name.replace(/\s+/g, '_')}.xlsx`);
        showDialog("Sukses", `Excel berhasil dibuat!`, "success");

      } else {
        const jsPDF = await loadJsPDF();
        const doc = new jsPDF();
        let finalY = 20;
        let hasData = false;

        if (mode === 'overall') {
          doc.setFontSize(14); doc.setFont("helvetica", "bold");
          doc.text(meetInfo.name.toUpperCase(), 105, finalY, { align: "center" });
          finalY += 6;
          doc.setFontSize(11); doc.setFont("helvetica", "normal");
          doc.text('Psych Sheet (Keseluruhan)', 105, finalY, { align: "center" });
          finalY += 15;

          events.forEach((ev, eIdx) => {
            let evEntries = entries.filter(en => en.eventId === ev.id);
            if (evEntries.length === 0) return;
            hasData = true;

            evEntries.sort((a, b) => a.seedTime.localeCompare(b.seedTime));

            if (finalY > 260) { doc.addPage(); finalY = 20; }

            doc.setFontSize(11); doc.setFont("helvetica", "bold");
            doc.text(`Event ${eIdx + 1} - ${ev.name}`, 14, finalY);
            finalY += 2;

            const tableData = evEntries.map((en, rank) => {
              const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name.toUpperCase() : teams.find(t => t.id === en.teamId)?.name.toUpperCase() + ' (A)';
              const age = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.age?.toString() : '';
              const org = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.abbr.toUpperCase() : teams.find(t => t.id === en.teamId)?.abbr.toUpperCase();
              const seed = (en.seedTime === '99:99.99' || !en.seedTime) ? 'NT' : en.seedTime;
              return [rank + 1, name || '', age || '', org || '', seed];
            });

            doc.autoTable({
              startY: finalY,
              head: [['Rank', 'Name/Team', 'Age', 'Team', 'Seed Time']],
              body: tableData,
              theme: 'plain',
              styles: { fontSize: 9, cellPadding: 1 },
              headStyles: { fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [0, 0, 0] },
              columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 80 }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 30 }, 4: { cellWidth: 30, halign: 'center' } },
              didDrawPage: function (data) { finalY = data.cursor.y; }
            });
            finalY = doc.lastAutoTable.finalY + 10;
          });
        } else {
          let isFirstTeam = true;
          teams.forEach(team => {
            const teamEntries = entries.filter(en => {
              if (en.teamId === team.id) return true;
              if (en.swimmerId) {
                const sw = swimmers.find(s => s.id === en.swimmerId);
                return sw && sw.teamId === team.id;
              }
              return false;
            });

            if (teamEntries.length === 0) return;
            hasData = true;

            if (!isFirstTeam) {
              doc.addPage();
              finalY = 20;
            }
            isFirstTeam = false;

            doc.setFontSize(14); doc.setFont("helvetica", "bold");
            doc.text(meetInfo.name.toUpperCase(), 105, finalY, { align: "center" });
            finalY += 6;
            doc.setFontSize(11); doc.setFont("helvetica", "normal");
            doc.text(`Entry List - ${team.name}`, 105, finalY, { align: "center" });
            finalY += 15;

            teamEntries.sort((a, b) => {
              const eA = events.findIndex(e => e.id === a.eventId);
              const eB = events.findIndex(e => e.id === b.eventId);
              return eA - eB;
            });

            const tableData = teamEntries.map(en => {
              const ev = events.find(e => e.id === en.eventId);
              const eventName = ev ? `Evt ${events.indexOf(ev) + 1}: ${ev.distance}m ${ev.stroke}` : '';
              const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name.toUpperCase() : team.name.toUpperCase() + ' (A)';
              const cat = ev ? ev.category : '';
              const gen = ev ? ev.gender : '';
              const seed = (en.seedTime === '99:99.99' || !en.seedTime) ? 'NT' : en.seedTime;
              return [eventName, name || '', cat, gen, seed];
            });

            doc.autoTable({
              startY: finalY,
              head: [['Event', 'Nama Atlet / Estafet', 'Kategori', 'Gender', 'Seed Time']],
              body: tableData,
              theme: 'plain',
              styles: { fontSize: 9, cellPadding: 1 },
              headStyles: { fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [0, 0, 0] },
              columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 70 }, 2: { cellWidth: 25 }, 3: { cellWidth: 20 }, 4: { cellWidth: 25, halign: 'center' } },
              didDrawPage: function (data) { finalY = data.cursor.y; }
            });
            finalY = doc.lastAutoTable.finalY + 10;
          });
        }

        if (!hasData) {
            doc.setFontSize(11);
            doc.text("Tidak ada data pendaftaran yang ditemukan.", 105, 50, { align: "center" });
        }

        const pageCount = doc.internal.getNumberOfPages();
        const printStamp = `MMMeet Manager - Generated at ${new Date().toLocaleString('id-ID')}`;
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
          doc.text(printStamp, 14, 10); doc.text(`Halaman ${i}`, 196, 10, { align: "right" });
        }

        doc.save(`${mode === 'overall' ? 'Psych_Sheet' : 'Entry_List_Per_Tim'}_${meetInfo.name.replace(/\s+/g, '_')}.pdf`);
        showDialog("Sukses", `PDF berhasil dibuat!`, "success");
      }
    } catch (err) {
      console.error(err);
      showDialog("Error", "Gagal men-generate file. Pastikan internet aktif.", "error");
    } finally {
      setIsImportingSwimmers(false);
      setImportProgress('');
    }
  };

  const exportEventResult = async (eventId, includePoints, format = 'pdf') => {
    if (!eventId) return showDialog('Error', 'Tidak ada acara yang dipilih.', 'error');
    const activeEvent = events.find(e => e.id === eventId);
    if (!activeEvent) return;

    const eventEntries = entries.filter(e => e.eventId === eventId && (e.resultTime || e.status));
    if (eventEntries.length === 0) return showDialog('Kosong', 'Belum ada hasil waktu/status yang diinput.', 'warning');

    const eIdx = events.findIndex(e => e.id === eventId);
    const docTitle = includePoints ? "Event Scores" : "Event Results";
    const modeSuffix = includePoints ? 'Scores' : 'Results';
    const eventNameFull = `Event ${eIdx + 1} - ${activeEvent.distance}m Gaya ${activeEvent.stroke} ${activeEvent.gender} ${activeEvent.category} ${activeEvent.type === 'Estafet' ? '(ESTAFET)' : ''}`;

    const sortedEntries = [...eventEntries].sort((a, b) => {
      if (a.status && !b.status) return 1;
      if (!a.status && b.status) return -1;
      
      const aIsSparring = a.isSparring || a.pl === 'X';
      const bIsSparring = b.isSparring || b.pl === 'X';
      if (!aIsSparring && bIsSparring) return -1;
      if (aIsSparring && !bIsSparring) return 1;

      if (a.resultTime && b.resultTime) return a.resultTime.localeCompare(b.resultTime);
      return 0;
    });

    if (format === 'xlsx') {
      setImportProgress('Men-generate Excel...'); setIsImportingSwimmers(true); 
      try {
        const XLSX = await loadXlsx();
        const aoa = [ [meetInfo.name.toUpperCase()], [docTitle], [], [eventNameFull], [], includePoints ? ['Place', 'Name/Team', 'Age', 'Team', 'Seed Time', 'Finals Time', 'Points'] : ['Place', 'Name/Team', 'Age', 'Team', 'Seed Time', 'Finals Time'] ];
        sortedEntries.forEach(en => {
          const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name.toUpperCase() : teams.find(t => t.id === en.teamId)?.name.toUpperCase() + ' (A)';
          const age = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.age.toString() : '';
          const org = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.org.toUpperCase() : teams.find(t => t.id === en.teamId)?.abbr.toUpperCase();
          
          let displayTime = en.status ? en.status : en.resultTime;
          if (en.isSparring && en.resultTime && !en.status) displayTime = `X ${en.resultTime}`;

          const row = [ en.status ? en.status : (en.pl || '-'), name || '', age || '', org || '', en.seedTime || 'NT', displayTime ];
          if (includePoints) {
            const pts = leaderboardMode === 'standard' ? en.standardPoints : en.alternativePoints;
            row.push(pts > 0 ? pts : '-');
          }
          aoa.push(row);
        });
        const customCols = includePoints ? [{wch: 8}, {wch: 35}, {wch: 6}, {wch: 30}, {wch: 15}, {wch: 15}, {wch: 8}] : [{wch: 8}, {wch: 35}, {wch: 6}, {wch: 30}, {wch: 15}, {wch: 15}];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = customCols;
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Results"); XLSX.writeFile(wb, `${modeSuffix}_Event_${eIdx + 1}_${activeEvent.name.replace(/\s+/g, '_')}.xlsx`);
        showDialog("Sukses", `Excel ${modeSuffix} berhasil dibuat dan diunduh!`, "success");
      } catch (err) { showDialog("Error", "Gagal men-generate Excel.", "error"); } finally { setIsImportingSwimmers(false); setImportProgress(''); }
      return;
    }

    setImportProgress('Men-generate PDF...'); setIsImportingSwimmers(true); 
    try {
      const jsPDF = await loadJsPDF(); const doc = new jsPDF(); let finalY = 20;

      doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(meetInfo.name.toUpperCase(), 105, finalY, { align: "center" });
      finalY += 6; doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text(docTitle, 105, finalY, { align: "center" });
      finalY += 15; doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text(eventNameFull, 14, finalY);
      finalY += 1; doc.setLineWidth(0.5); doc.line(14, finalY, 196, finalY); finalY += 5;

      const tableData = sortedEntries.map(en => {
        const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name.toUpperCase() : teams.find(t => t.id === en.teamId)?.name.toUpperCase() + ' (A)';
        const age = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.age.toString() : '';
        const org = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.org.toUpperCase() : teams.find(t => t.id === en.teamId)?.abbr.toUpperCase();
        
        let displayTime = en.status ? en.status : en.resultTime;
        if (en.isSparring && en.resultTime && !en.status) displayTime = `X ${en.resultTime}`;

        const row = [ en.status ? en.status : (en.pl || '-'), name || '', age || '', org || '', en.seedTime || 'NT', displayTime ];
        if (includePoints) {
          const pts = leaderboardMode === 'standard' ? en.standardPoints : en.alternativePoints; row.push(pts > 0 ? pts.toString() : '-');
        }
        return row;
      });

      const head = includePoints ? [['Place', 'Name/Team', 'Age', 'Team', 'Seed Time', 'Finals', 'Pts']] : [['Place', 'Name/Team', 'Age', 'Team', 'Seed Time', 'Finals']];
      const colStyles = includePoints ? { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 55 }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 40 }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 20, halign: 'center' }, 6: { cellWidth: 15, halign: 'center' } } 
                                      : { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 60 }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 50 }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 20, halign: 'center' } };

      doc.autoTable({
        startY: finalY, head: head, body: tableData, theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, headStyles: { fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [0, 0, 0] }, columnStyles: colStyles
      });

      const pageCount = doc.internal.getNumberOfPages();
      const now = new Date(); const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateStr = `${now.getDate().toString().padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
      const printStamp = `MMMeet Manager - ${timeStr} ${dateStr}`;

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100); 
        doc.text(printStamp, 14, 10); doc.text(`Halaman ${i}`, 196, 10, { align: "right" });
      }

      doc.save(`${modeSuffix}_Event_${eIdx + 1}_${activeEvent.name.replace(/\s+/g, '_')}.pdf`);
      showDialog("Sukses", `PDF ${modeSuffix} berhasil dibuat!`, "success");
    } catch (error) { showDialog("Error", "Gagal men-generate PDF.", "error"); } finally { setIsImportingSwimmers(false); setImportProgress(''); }
  };

  const promptExportFormat = (eventId, includePoints) => {
    if (!eventId) return showDialog('Error', 'Tidak ada acara yang dipilih.', 'error');
    setDialog({
      title: 'Pilih Format Export', message: 'Anda ingin menyimpan laporan hasil lomba ini dalam format apa?', type: 'info',
      customActions: (
        <div className="flex flex-col gap-3 w-full">
          <button onClick={() => { closeDialog(); exportEventResult(eventId, includePoints, 'pdf'); }} className="w-full px-6 py-4 rounded-xl font-black uppercase bg-red-600 text-white hover:bg-red-700 shadow-sm transition active:scale-95 text-sm tracking-widest flex items-center justify-center gap-2"><FileText size={18}/> Format PDF (Siap Cetak)</button>
          <button onClick={() => { closeDialog(); exportEventResult(eventId, includePoints, 'xlsx'); }} className="w-full px-6 py-4 rounded-xl font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition active:scale-95 text-sm tracking-widest flex items-center justify-center gap-2"><Layout size={18}/> Format Excel (.XLSX)</button>
          <button onClick={closeDialog} className="w-full mt-2 px-6 py-3 rounded-xl font-black uppercase text-slate-500 hover:bg-slate-100 transition text-sm">Batal</button>
        </div>
      )
    });
  };

  const handleExportFullResultsPDF = async () => {
    setImportProgress('Men-generate Full Results...'); 
    setIsImportingSwimmers(true); 

    try {
      const jsPDF = await loadJsPDF(); 
      const doc = new jsPDF(); 
      let finalY = 20;

      doc.setFontSize(16); doc.setFont("helvetica", "bold"); 
      doc.text(meetInfo.name.toUpperCase(), 105, finalY, { align: "center" });
      finalY += 8; 
      doc.setFontSize(12); doc.setFont("helvetica", "normal"); 
      doc.text("FULL MEET RESULTS", 105, finalY, { align: "center" });
      finalY += 15;

      let hasData = false;

      events.forEach((activeEvent, eIdx) => {
        const eventEntries = entries.filter(e => e.eventId === activeEvent.id && (e.resultTime || e.status));
        if (eventEntries.length === 0) return;
        hasData = true;

        const eventNameFull = `Event ${eIdx + 1} - ${activeEvent.distance}m Gaya ${activeEvent.stroke} ${activeEvent.gender} ${activeEvent.category} ${activeEvent.type === 'Estafet' ? '(ESTAFET)' : ''}`;

        const sortedEntries = [...eventEntries].sort((a, b) => {
          if (a.status && !b.status) return 1;
          if (!a.status && b.status) return -1;
          
          const aIsSparring = a.isSparring || a.pl === 'X';
          const bIsSparring = b.isSparring || b.pl === 'X';
          if (!aIsSparring && bIsSparring) return -1;
          if (aIsSparring && !bIsSparring) return 1;

          if (a.resultTime && b.resultTime) return a.resultTime.localeCompare(b.resultTime);
          return 0;
        });

        if (finalY > 260) { doc.addPage(); finalY = 20; }

        doc.setFontSize(11); doc.setFont("helvetica", "bold"); 
        doc.text(eventNameFull, 14, finalY);
        finalY += 2; doc.setLineWidth(0.5); doc.line(14, finalY, 196, finalY); finalY += 4;

        const tableData = sortedEntries.map(en => {
          const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name.toUpperCase() : teams.find(t => t.id === en.teamId)?.name.toUpperCase() + ' (A)';
          const age = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.age?.toString() : '';
          const org = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.org.toUpperCase() : teams.find(t => t.id === en.teamId)?.abbr.toUpperCase();
          
          let displayTime = en.status ? en.status : en.resultTime;
          if (en.isSparring && en.resultTime && !en.status) displayTime = `X ${en.resultTime}`;

          const pts = leaderboardMode === 'standard' ? en.standardPoints : en.alternativePoints; 
          return [ en.status ? en.status : (en.pl || '-'), name || '', age || '', org || '', en.seedTime || 'NT', displayTime, pts > 0 ? pts.toString() : '-' ];
        });

        const head = [['Place', 'Name/Team', 'Age', 'Team', 'Seed Time', 'Finals', 'Pts']];
        const colStyles = { 0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 55 }, 2: { cellWidth: 15, halign: 'center' }, 3: { cellWidth: 40 }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 20, halign: 'center' }, 6: { cellWidth: 15, halign: 'center' } };

        doc.autoTable({
          startY: finalY, head: head, body: tableData, theme: 'plain', styles: { fontSize: 9, cellPadding: 1 }, headStyles: { fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [0, 0, 0] }, columnStyles: colStyles,
          didDrawPage: function (data) { finalY = data.cursor.y; }
        });
        
        finalY = doc.lastAutoTable.finalY + 10;
      });

      if (!hasData) {
         doc.setFontSize(11); doc.setFont("helvetica", "normal");
         doc.text("Belum ada hasil yang diinput.", 105, finalY + 20, { align: "center" });
      }

      const pageCount = doc.internal.getNumberOfPages();
      const now = new Date(); const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateStr = `${now.getDate().toString().padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
      const printStamp = `MMMeet Manager - ${timeStr} ${dateStr}`;

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100); 
        doc.text(printStamp, 14, 10); doc.text(`Halaman ${i}`, 196, 10, { align: "right" });
      }

      doc.save(`Full_Results_${meetInfo.name.replace(/\s+/g, '_')}.pdf`);
      showDialog("Sukses", `Full Results PDF berhasil dibuat!`, "success");
    } catch (error) { 
      showDialog("Error", "Gagal men-generate PDF.", "error"); 
    } finally { 
      setIsImportingSwimmers(false); setImportProgress(''); 
    }
  };

  // --- Certificate Generator ---
  const handleCertBgUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => updateActiveMeet({ certBg: event.target.result });
      reader.readAsDataURL(file);
    }
  };

  const drawCertPage = (doc, en, ev, pdfWidth, pdfHeight, isTextOnly, overrideRank) => {
    if (!isTextOnly && certBg) {
      doc.addImage(certBg, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    }

    const name = en?.swimmerId ? swimmers.find(s=>s.id === en.swimmerId)?.name : teams.find(t=>t.id===en?.teamId)?.name + ' (ESTAFET)';
    const org = en?.swimmerId ? swimmers.find(s=>s.id === en.swimmerId)?.org : teams.find(t=>t.id===en?.teamId)?.name;

    doc.setFont("helvetica", "bold");

    if (certCoords.name?.show && name) { doc.setFontSize(28); doc.text(name.toUpperCase(), certCoords.name.x, certCoords.name.y, { align: 'center' }); }
    if (certCoords.team?.show && org) { doc.setFontSize(16); doc.text(org.toUpperCase(), certCoords.team.x, certCoords.team.y, { align: 'center' }); }
    if (certCoords.event?.show && ev) { doc.setFontSize(14); doc.text(ev.name.toUpperCase(), certCoords.event.x, certCoords.event.y, { align: 'center' }); }
    if (certCoords.time?.show && en?.resultTime) { doc.setFontSize(14); doc.text(en.resultTime, certCoords.time.x, certCoords.time.y, { align: 'center' }); }
    
    if (certCoords.rank?.show) { 
      doc.setFontSize(18); 
      if (overrideRank) {
        doc.text(overrideRank, certCoords.rank.x, certCoords.rank.y, { align: 'center' }); 
      } else if (en?.pl && parseInt(en.pl) > 0) {
        doc.text(`JUARA ${en.pl}`, certCoords.rank.x, certCoords.rank.y, { align: 'center' }); 
      }
    }
  };

  const handlePreviewCert = async () => {
    if (!certBg) return showDialog('Error', 'Upload background sertifikat terlebih dahulu untuk melihat preview!', 'error');
    setImportProgress('Membuat Preview...'); setIsImportingSwimmers(true);

    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      const dummyDrawCertPage = () => {
        if (!certPrintTextOnly && certBg) doc.addImage(certBg, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        doc.setFont("helvetica", "bold");
        if (certCoords.name?.show) { doc.setFontSize(28); doc.text("NAMA ATLET CONTOH", certCoords.name.x, certCoords.name.y, { align: 'center' }); }
        if (certCoords.team?.show) { doc.setFontSize(16); doc.text("KLUB AQUATIC CONTOH", certCoords.team.x, certCoords.team.y, { align: 'center' }); }
        if (certCoords.event?.show) { doc.setFontSize(14); doc.text("50M GAYA BEBAS PUTRA", certCoords.event.x, certCoords.event.y, { align: 'center' }); }
        if (certCoords.time?.show) { doc.setFontSize(14); doc.text("00:25.50", certCoords.time.x, certCoords.time.y, { align: 'center' }); }
        if (certCoords.rank?.show) { doc.setFontSize(18); doc.text("JUARA 1", certCoords.rank.x, certCoords.rank.y, { align: 'center' }); }
      };

      dummyDrawCertPage();
      doc.save(`Preview_Sertifikat.pdf`);
      showDialog("Sukses", "Preview Sertifikat berhasil diunduh!", "success");
    } catch (error) {
      showDialog("Error", "Gagal memproses preview PDF.", "error");
    } finally { setIsImportingSwimmers(false); setImportProgress(''); }
  };

  const handleGenerateCerts = async (eventId, topN) => {
    if (!certBg && !certPrintTextOnly) return showDialog('Error', 'Upload background sertifikat terlebih dahulu!', 'error');
    if (!eventId) return showDialog('Error', 'Pilih acara lomba yang ingin dicetak.', 'error');
    
    const event = events.find(e => e.id === eventId);
    const evEntries = entries.filter(e => e.eventId === eventId && e.pl && e.pl <= topN && !e.status);
    evEntries.sort((a,b) => a.pl - b.pl);

    if (evEntries.length === 0) return showDialog('Kosong', `Belum ada juara (Top ${topN}) di acara ini yang sudah ter-score.`, 'warning');
    setImportProgress('Men-generate Sertifikat...'); setIsImportingSwimmers(true); 

    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();

      evEntries.forEach((en, idx) => {
        if (idx > 0) doc.addPage();
        drawCertPage(doc, en, event, pdfWidth, pdfHeight, certPrintTextOnly, null);
      });

      doc.save(`Sertifikat_Juara_${event.name.replace(/\s+/g, '_')}.pdf`);
      showDialog("Sukses", "Sertifikat Juara berhasil dibuat dan diunduh!", "success");
    } catch (error) {
      showDialog("Error", "Gagal memproses sertifikat PDF.", "error");
    } finally { setIsImportingSwimmers(false); setImportProgress(''); }
  };

  const handleGenerateParticipantCerts = async () => {
    if (!certBg && !certPrintTextOnly) return showDialog('Error', 'Upload background sertifikat terlebih dahulu!', 'error');
    setImportProgress('Menyiapkan E-Sertifikat...'); setIsImportingSwimmers(true); 

    try {
      const validEntries = entries.filter(e => e.swimmerId || e.teamId);
      if (validEntries.length === 0) throw new Error("Belum ada data pendaftaran atlet.");

      const jsPDF = await loadJsPDF();
      let JSZip, saveAs;
      
      if (partCertMode !== 'all_merged') {
        setImportProgress('Memuat Engine ZIP...');
        const loaded = await loadJSZip();
        JSZip = loaded.JSZip; saveAs = loaded.saveAs;
      }

      setImportProgress('Sedang Render PDF...');
      
      if (partCertMode === 'all_merged') {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pW = doc.internal.pageSize.getWidth(); const pH = doc.internal.pageSize.getHeight();
        let isFirst = true;

        validEntries.forEach(en => {
          const ev = events.find(e => e.id === en.eventId);
          if (!ev) return;
          if (!isFirst) doc.addPage();
          isFirst = false;
          drawCertPage(doc, en, ev, pW, pH, certPrintTextOnly, "PESERTA");
        });
        doc.save(`Semua_E-Sertifikat_Peserta.pdf`);

      } else if (partCertMode === 'per_person') {
        const zip = new JSZip();
        swimmers.forEach(sw => {
            const swEntries = validEntries.filter(en => en.swimmerId === sw.id);
            if(swEntries.length === 0) return;

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pW = doc.internal.pageSize.getWidth(); const pH = doc.internal.pageSize.getHeight();
            let isFirst = true;
            swEntries.forEach(en => {
                const ev = events.find(e => e.id === en.eventId);
                if (!isFirst) doc.addPage();
                isFirst = false;
                drawCertPage(doc, en, ev, pW, pH, certPrintTextOnly, "PESERTA");
            });
            const safeName = sw.name.replace(/[^a-zA-Z0-9 ]/g, '');
            const safeOrg = sw.abbr.replace(/[^a-zA-Z0-9 ]/g, '');
            zip.file(`${safeOrg}/${safeName}.pdf`, doc.output('blob'));
        });
        
        setImportProgress('Sedang Mengkompres ZIP...');
        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, `E-Sertifikat_Peserta_Per_Individu.zip`);

      } else if (partCertMode === 'per_team') {
        const zip = new JSZip();
        teams.forEach(team => {
            const tEntries = validEntries.filter(en => en.teamId === team.id || (en.swimmerId && swimmers.find(s=>s.id === en.swimmerId)?.teamId === team.id));
            if(tEntries.length === 0) return;

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pW = doc.internal.pageSize.getWidth(); const pH = doc.internal.pageSize.getHeight();
            let isFirst = true;
            tEntries.forEach(en => {
                const ev = events.find(e => e.id === en.eventId);
                if (!isFirst) doc.addPage();
                isFirst = false;
                drawCertPage(doc, en, ev, pW, pH, certPrintTextOnly, "PESERTA");
            });
            const safeOrg = team.abbr.replace(/[^a-zA-Z0-9 ]/g, '');
            zip.file(`Sertifikat_${safeOrg}.pdf`, doc.output('blob'));
        });

        setImportProgress('Sedang Mengkompres ZIP...');
        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, `E-Sertifikat_Peserta_Per_Klub.zip`);
      }

      showDialog("Sukses", "Sertifikat Peserta berhasil di-generate secara massal!", "success");
    } catch (error) {
      console.error(error);
      showDialog("Error", "Gagal memproses sertifikat PDF.", "error");
    } finally { setIsImportingSwimmers(false); setImportProgress(''); }
  };

  const handleImportEvents = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const fileName = file.name.toLowerCase();

    const processEventsData = (jsonData) => {
      if (jsonData.length < 2) return showDialog('Format Salah', 'File kosong atau format tidak sesuai.', 'error');
      let headerIdx = -1; let distIdx = -1, strokeIdx = -1, genderIdx = -1, catIdx = -1, typeIdx = -1;
      
      for(let i = 0; i < Math.min(jsonData.length, 10); i++) { 
        if(!jsonData[i]) continue; const h = jsonData[i].map(x => String(x).toLowerCase().replace(/['"]/g, '').trim());
        if (h.some(x => x.includes('jarak'))) {
          headerIdx = i; distIdx = h.findIndex(x => x.includes('jarak')); strokeIdx = h.findIndex(x => x.includes('gaya'));
          genderIdx = h.findIndex(x => x.includes('gender')); catIdx = h.findIndex(x => x.includes('kelompok') || x.includes('umur')); 
          typeIdx = h.findIndex(x => x.includes('tipe') || x.includes('individual')); break;
        }
      }

      if (headerIdx === -1 || distIdx === -1 || strokeIdx === -1 || genderIdx === -1 || catIdx === -1) {
        return showDialog('Header Tidak Ditemukan', 'Format salah!\nPastikan baris pertama memiliki kolom:\nJarak, Gaya Lomba, Gender, Kelompok Umur', 'error');
      }

      const newEventsToImport = []; const missingKUs = new Set(); const existingKUNames = ageGroups.map(ku => ku.name.toLowerCase().trim());
      let duplicateCount = 0;

      for (let i = headerIdx + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0 || row[distIdx] === undefined || String(row[distIdx]).trim() === '') continue;

        const distance = String(row[distIdx]).replace(/['"]/g, '').trim(); const stroke = String(row[strokeIdx] || '').replace(/['"]/g, '').trim();
        const gender = String(row[genderIdx] || '').replace(/['"]/g, '').trim(); const category = String(row[catIdx] || '').replace(/['"]/g, '').trim(); 
        const typeStr = typeIdx !== -1 ? String(row[typeIdx] || '').toLowerCase() : '';
        const type = typeStr.includes('estafet') || typeStr.includes('relay') ? 'Estafet' : 'Individual';
        
        if (!existingKUNames.includes(category.toLowerCase())) { missingKUs.add(category); } else {
          const matchedKU = ageGroups.find(ku => ku.name.toLowerCase().trim() === category.toLowerCase()); const exactCategoryName = matchedKU ? matchedKU.name : category;
          const isDup = events.some(ev => ev.distance === distance && ev.stroke.toLowerCase() === stroke.toLowerCase() && ev.gender.toLowerCase() === gender.toLowerCase() && ev.category === exactCategoryName && ev.type === type) ||
                        newEventsToImport.some(ev => ev.distance === distance && ev.stroke.toLowerCase() === stroke.toLowerCase() && ev.gender.toLowerCase() === gender.toLowerCase() && ev.category === exactCategoryName && ev.type === type);

          if (isDup) { duplicateCount++; } else {
            const name = `${distance}m Gaya ${stroke} ${gender} ${exactCategoryName} ${type === 'Estafet' ? '(ESTAFET)' : ''}`;
            newEventsToImport.push({ id: 'ev-' + Date.now() + '-' + i, distance, stroke, gender, category: exactCategoryName, type, name });
          }
        }
      }

      if (newEventsToImport.length > 0) {
        updateActiveMeet({ events: [...events, ...newEventsToImport] });
        let successMsg = `Berhasil mengimpor ${newEventsToImport.length} Acara Lomba.`;
        if (duplicateCount > 0) successMsg += `\n\n[Dicegah] ${duplicateCount} Acara lomba duplikat diabaikan.`;
        if (missingKUs.size > 0) successMsg += `\n\nPERHATIAN:\nBeberapa lomba dilewati karena Kelompok Umur belum dibuat di Tahap 2:\n[ ${Array.from(missingKUs).join(', ')} ]`;
        showDialog('Sukses Import Acara', successMsg, 'success');
      } else if (duplicateCount > 0 && missingKUs.size === 0) { showDialog('Informasi', `Semua acara dalam file tersebut sudah terdaftar di dalam sistem.`, 'warning');
      } else if (missingKUs.size > 0) { showDialog('Gagal Import', `Semua Kelompok Umur di dalam file BELUM DIBUAT di sistem:\n\n[ ${Array.from(missingKUs).join(', ')} ]`, 'error'); }
    };

    if (fileName.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target.result; const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
          const delimiter = lines[0].includes(';') ? ';' : ','; const jsonData = lines.map(line => line.split(delimiter));
          processEventsData(jsonData);
        } catch (err) { showDialog("Error", "Terjadi kesalahan saat membaca file CSV.", "error"); } 
        finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
      }; reader.readAsText(file);
    } else {
      try {
        const XLSX = await loadXlsx(); const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false });
            processEventsData(jsonData);
          } catch (parseErr) { showDialog("Error", "Terjadi kesalahan saat membaca isi file Excel.", "error"); } 
          finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        }; reader.readAsArrayBuffer(file);
      } catch (err) { showDialog("Error", "Gagal memuat mesin Excel.", "error"); setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    }
  };

  const handleImportSwimmers = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImportingSwimmers(true); setImportProgress('Menyiapkan data...'); const fileName = file.name.toLowerCase();

    const parseBirthYear = (dateStr) => {
      if (!dateStr) return NaN; const str = String(dateStr).trim();
      if (/^\d{4}$/.test(str)) return parseInt(str); const d = new Date(str);
      if (!isNaN(d.getFullYear())) return d.getFullYear(); const parts = str.split(/[\/\-\.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) return parseInt(parts[0]); if (parts[2].length === 4) return parseInt(parts[2]);
        if (parts[2].length === 2) { const y = parseInt(parts[2]); return y < 50 ? 2000 + y : 1900 + y; }
      } return NaN;
    };

    const processSwimmerData = async (rawJsonData) => {
      const jsonData = rawJsonData.map(row => row.map(cell => String(cell || '').replace(/['"]/g, '').replace(/[\r\n\t]/g, '').trim()));
      if (jsonData.length < 2) return showDialog("File Kosong", "Data kosong atau tidak sesuai.", "error");

      let headerIdx = -1; let hMap = { name: -1, org: -1, abbr: -1, district: -1, grade: -1, gender: -1, dob: -1, event: -1, seed: -1 };
      
      for(let i = 0; i < Math.min(jsonData.length, 10); i++) { 
        if(!jsonData[i]) continue; const h = jsonData[i].map(x => x.toLowerCase());
        if (h.some(x => x.includes('nama') || x.includes('lengkap'))) {
          headerIdx = i; hMap.name = h.findIndex(x => x.includes('nama')); hMap.org = h.findIndex(x => x.includes('sekolah') || x.includes('klub') || x.includes('team'));
          hMap.abbr = h.findIndex(x => x.includes('abbr')); hMap.district = h.findIndex(x => x.includes('kecamatan')); hMap.grade = h.findIndex(x => x.includes('kelas'));
          hMap.gender = h.findIndex(x => x.includes('jenis') || x.includes('gender')); hMap.dob = h.findIndex(x => x.includes('dob') || x.includes('lahir'));
          hMap.event = h.findIndex(x => x.includes('acara') || x.includes('lomba')); hMap.seed = h.findIndex(x => x.includes('seed') || x.includes('time') || x.includes('waktu')); break;
        }
      }

      if (headerIdx === -1 || hMap.name === -1) return showDialog("Format Header Salah", "Pastikan ada kolom 'Nama Lengkap'.", "error");

      const tempTeams = [...teams]; const tempSwimmers = [...swimmers]; const tempEntries = [...entries];
      const teamMap = new Map(); tempTeams.forEach(t => { teamMap.set(t.name.toLowerCase(), t); teamMap.set(t.abbr.toLowerCase(), t); });
      const swimmerMap = new Map(); tempSwimmers.forEach(s => swimmerMap.set(`${s.name.toLowerCase()}|${s.dob}`, s));
      const entrySet = new Set(); tempEntries.forEach(en => entrySet.add(`${en.swimmerId}|${en.eventId}`));

      const validRows = []; let duplicateEntryCount = 0; let missingEventCount = 0; let invalidAgeCount = 0;
      const unmatchedEventsList = new Set(); const invalidAgeNames = new Set(); const currentMeetYear = new Date(meetInfo.date).getFullYear();

      const totalRows = jsonData.length - headerIdx - 1;
      for (let i = headerIdx + 1; i < jsonData.length; i++) {
        if (i % 50 === 0) { setImportProgress(`Inspeksi ${i - headerIdx} / ${totalRows}...`); await new Promise(resolve => setTimeout(resolve, 5)); }

        const row = jsonData[i]; if (!row || row.length === 0 || row[hMap.name] === undefined || row[hMap.name] === '') continue;

        const nameStr = row[hMap.name]; const orgStr = hMap.org !== -1 ? (row[hMap.org] || 'Independen') : 'Independen';
        
        let rawAbbr = hMap.abbr !== -1 ? String(row[hMap.abbr] || '').trim() : '';
        let abbrStr = 'IND';
        if (rawAbbr) {
            abbrStr = rawAbbr.toUpperCase();
        } else if (orgStr.toLowerCase() !== 'independen') {
            const words = orgStr.trim().split(/\s+/);
            if (words.length > 1) {
                abbrStr = words.map(w => w[0]).join('').substring(0, 5).toUpperCase();
            } else {
                abbrStr = orgStr.trim().substring(0, 3).toUpperCase();
            }
        }
        
        const distStr = hMap.district !== -1 ? (row[hMap.district] || '-') : '-';
        const gradeStr = hMap.grade !== -1 ? (row[hMap.grade] || '-') : '-'; const genderStr = hMap.gender !== -1 ? (row[hMap.gender] || 'Putra') : 'Putra';
        const dobStrRaw = hMap.dob !== -1 ? (row[hMap.dob] || '') : ''; const dobStr = formatDateForInput(dobStrRaw);
        const eventStr = hMap.event !== -1 ? (row[hMap.event] || '') : ''; const seedStr = hMap.seed !== -1 ? (row[hMap.seed] || '99:99.99') : '99:99.99';

        const birthYear = parseBirthYear(dobStr);
        if (isNaN(birthYear)) { invalidAgeCount++; invalidAgeNames.add(nameStr); continue; }
        
        const age = currentMeetYear - birthYear; const matchedKUs = ageGroups.filter(ku => age >= ku.minAge && age <= ku.maxAge);
        if (matchedKUs.length === 0) { invalidAgeCount++; invalidAgeNames.add(`${nameStr} (${age} Thn)`); continue; }
        const kuNames = matchedKUs.map(ku => ku.name); const kuNameDisplay = kuNames.join(', ');

        if (eventStr) {
          const distMatch = eventStr.match(/\d+/);
          if (!distMatch) { missingEventCount++; unmatchedEventsList.add(`- ${eventStr} (Jarak tidak terbaca)`); continue; }
          const distance = distMatch[0]; const strokeMatch = eventStr.toLowerCase().replace(distance, '').replace(/meter|meters/g, '').replace(/^m\s*/, '').replace(/putra|putri|mix/gi, '').trim();

          const matchedEvent = events.find(ev => {
            const strokeIsMatch = ev.stroke.toLowerCase().includes(strokeMatch) || strokeMatch.includes(ev.stroke.toLowerCase());
            const genderIsMatch = ev.gender.toLowerCase() === genderStr.toLowerCase() || ev.gender.toLowerCase() === 'mix';
            return ev.distance === distance && strokeIsMatch && genderIsMatch && kuNames.includes(ev.category) && ev.type === 'Individual';
          });

          if (!matchedEvent) { missingEventCount++; unmatchedEventsList.add(`- ${eventStr} (${genderStr} - ${kuNameDisplay})`); continue; }
          validRows.push({ nameStr, orgStr, abbrStr, distStr, gradeStr, genderStr, dobStr, age, kuNameDisplay, matchedEvent, seedStr, i });
        }
      }

      setImportProgress('Menyimpan Data...'); await new Promise(resolve => setTimeout(resolve, 100)); 
      const newTeamsToAdd = []; const newSwimmersToAdd = []; const newEntriesToAdd = [];

      for (const validData of validRows) {
        let team = teamMap.get(validData.orgStr.toLowerCase()) || teamMap.get(validData.abbrStr.toLowerCase());
        if (!team) {
          team = { id: 'tm-' + Date.now() + '-' + validData.i, name: validData.orgStr, abbr: validData.abbrStr };
          teamMap.set(validData.orgStr.toLowerCase(), team); teamMap.set(validData.abbrStr.toLowerCase(), team);
          newTeamsToAdd.push(team); tempTeams.push(team);
        }

        const swimmerKey = `${validData.nameStr.toLowerCase()}|${validData.dobStr}`; let swimmer = swimmerMap.get(swimmerKey);
        if (!swimmer) {
          swimmer = { id: 'sw-' + Date.now() + '-' + validData.i, name: validData.nameStr, teamId: team.id, org: team.name, abbr: team.abbr, district: validData.distStr, grade: validData.gradeStr, gender: validData.genderStr, dob: validData.dobStr, age: validData.age, category: validData.kuNameDisplay };
          swimmerMap.set(swimmerKey, swimmer); newSwimmersToAdd.push(swimmer); tempSwimmers.push(swimmer);
        }

        const entryKey = `${swimmer.id}|${validData.matchedEvent.id}`;
        if (entrySet.has(entryKey)) { duplicateEntryCount++; } else {
          const entry = { id: 'en-' + Date.now() + '-' + validData.i + Math.random().toString(16).slice(2, 6), swimmerId: swimmer.id, teamId: null, eventId: validData.matchedEvent.id, seedTime: formatTime(validData.seedStr) || '99:99.99', resultTime: '', status: '', standardPoints: 0, alternativePoints: 0, pl: '', hpl: '', heat: 0, lane: 0 };
          entrySet.add(entryKey); newEntriesToAdd.push(entry);
        }
      }

      if (newTeamsToAdd.length > 0 || newSwimmersToAdd.length > 0 || newEntriesToAdd.length > 0) {
        updateActiveMeet({ teams: [...teams, ...newTeamsToAdd], swimmers: [...swimmers, ...newSwimmersToAdd], entries: [...entries, ...newEntriesToAdd] });
        let msg = `• ${newSwimmersToAdd.length} Biodata Atlet berhasil masuk.\n• ${newEntriesToAdd.length} Pendaftaran Acara berhasil masuk.`;
        if (newTeamsToAdd.length > 0) msg = `• ${newTeamsToAdd.length} Klub/Tim baru terdaftar otomatis.\n` + msg;
        if (duplicateEntryCount > 0) msg += `\n\n[Dicegah] ${duplicateEntryCount} Pendaftaran Ganda diabaikan.`;
        if (missingEventCount > 0) msg += `\n[Tolak] ${missingEventCount} Baris dibuang karena acara belum dibuat di Setup:\n${Array.from(unmatchedEventsList).join('\n')}`;
        if (invalidAgeCount > 0) msg += `\n[Tolak] ${invalidAgeCount} Baris dibuang karena Umur tidak valid/TIDAK MASUK KU:\n${Array.from(invalidAgeNames).join(', ')}`;
        
        showDialog("Sukses Import Atlet", msg, "success");
      } else {
        let errMsg = `Data yang Anda berikan tidak dapat diproses.\nAlasan:\n1. Seluruh data yang valid sudah terdaftar sebelumnya (Duplikat)\n2. Atau, baris ditolak seluruhnya karena kesalahan referensi.`;
        if (missingEventCount > 0) errMsg += `\n\nDaftar Acara yang ditolak:\n${Array.from(unmatchedEventsList).join('\n')}`;
        if (invalidAgeCount > 0) errMsg += `\n\nAtlet yang ditolak (TIDAK MASUK KU):\n${Array.from(invalidAgeNames).join(', ')}`;
        showDialog("Gagal Memproses Atlet", errMsg, "error");
      }
    };

    if (fileName.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target.result; const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
          const delimiter = lines[0].includes(';') ? ';' : ','; const jsonData = lines.map(line => line.split(delimiter));
          await processSwimmerData(jsonData);
        } catch (err) { showDialog("Error", "Terjadi kesalahan saat membaca file CSV.", "error"); } 
        finally { setIsImportingSwimmers(false); setImportProgress(''); if (swimmerFileInputRef.current) swimmerFileInputRef.current.value = ''; }
      }; reader.readAsText(file);
    } else {
      try {
        const XLSX = await loadXlsx(); const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false });
            await processSwimmerData(jsonData);
          } catch (err) { showDialog("Error", "Terjadi kesalahan saat membaca isi file Excel.", "error"); } 
          finally { setIsImportingSwimmers(false); setImportProgress(''); if (swimmerFileInputRef.current) swimmerFileInputRef.current.value = ''; }
        }; reader.readAsArrayBuffer(file);
      } catch (err) { showDialog("Error Jaringan", "Gagal memuat mesin Excel. Pastikan koneksi internet aktif.", "error"); setIsImportingSwimmers(false); setImportProgress(''); if (swimmerFileInputRef.current) swimmerFileInputRef.current.value = ''; }
    }
  };

  // ==========================================
  // RENDER PARTIALS
  // ==========================================
  const renderDialog = () => {
    if (!dialog) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-6 animate-in fade-in">
        <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 border border-slate-100 flex flex-col max-h-[90vh]">
          <div className="flex items-center gap-4 mb-6 shrink-0">
            {dialog.type === 'error' && <div className="bg-red-100 text-red-600 p-3 rounded-full"><XCircle size={28}/></div>}
            {dialog.type === 'success' && <div className="bg-green-100 text-green-600 p-3 rounded-full"><CheckCircle size={28}/></div>}
            {dialog.type === 'warning' && <div className="bg-orange-100 text-orange-600 p-3 rounded-full"><AlertCircle size={28}/></div>}
            {dialog.type === 'info' && <div className="bg-blue-100 text-blue-600 p-3 rounded-full"><AlertCircle size={28}/></div>}
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">{dialog.title}</h3>
          </div>
          <div className="text-sm font-bold text-slate-600 whitespace-pre-wrap flex-1 overflow-y-auto pr-2 leading-relaxed">{dialog.message}</div>
          {dialog.customActions ? (
            <div className="mt-8 pt-4 flex shrink-0 border-t border-slate-100 justify-center">{dialog.customActions}</div>
          ) : (
            <div className="mt-8 pt-4 flex gap-3 shrink-0 border-t border-slate-100 justify-end">
              {dialog.onConfirm ? (
                  <>
                    <button onClick={closeDialog} className="px-6 py-3 rounded-xl font-black uppercase text-slate-500 hover:bg-slate-100 transition text-sm">Batal</button>
                    <button onClick={() => { dialog.onConfirm(); closeDialog(); }} className="px-6 py-3 rounded-xl font-black uppercase bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200 transition active:scale-95 text-sm">Ya, Lanjutkan</button>
                  </>
              ) : (
                  <button onClick={closeDialog} className="w-full px-6 py-4 rounded-2xl font-black uppercase bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-300 transition active:scale-95 text-sm tracking-widest">Tutup / Mengerti</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMainDatabase = () => {
    const allResults = [];
    meets.forEach(meet => {
      meet.entries.forEach(en => {
        if (en.resultTime && !en.status && en.resultTime.trim() !== '') {
          const swimmer = meet.swimmers.find(s => s.id === en.swimmerId);
          const event = meet.events.find(e => e.id === en.eventId);
          if (swimmer && event && event.type === 'Individual') {
            allResults.push({
              meetName: meet.meetInfo.name, swimmerName: swimmer.name.toUpperCase(), swimmerDob: swimmer.dob,
              gender: swimmer.gender, org: swimmer.org, abbr: swimmer.abbr, eventKey: `${event.distance}m Gaya ${event.stroke}`,
              distance: parseInt(event.distance), stroke: event.stroke, timeStr: en.resultTime, timeSecs: timeToSeconds(en.resultTime)
            });
          }
        }
      });
    });

    const records = {};
    allResults.forEach(res => {
      const recKey = `${res.eventKey} ${res.gender}`;
      if (!records[recKey] || res.timeSecs < records[recKey].timeSecs) records[recKey] = res;
    });
    const sortedRecords = Object.values(records).sort((a, b) => a.distance - b.distance || a.stroke.localeCompare(b.stroke));

    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in pb-20">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden flex justify-between items-center">
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-indigo-300 font-black uppercase tracking-widest text-sm mb-4"><Database size={18}/> Induk Rekam Jejak</div>
            <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter leading-tight">Database Utama <br/>& Hall of Fame</h1>
            <p className="mt-4 text-indigo-100/80 font-medium max-w-xl">Merekam dan mengompilasi seluruh catatan waktu terbaik (Personal Best) dari setiap kejuaraan yang pernah diselenggarakan dalam sistem.</p>
          </div>
          <Crown size={200} className="text-white/5 absolute -right-10 -bottom-10 rotate-12" />
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Trophy className="text-yellow-500" size={28}/><h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Rekor Tercepat Nasional (All-Time)</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sortedRecords.map((rec, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-indigo-100 text-indigo-700 font-black uppercase text-[10px] px-3 py-1 rounded-md tracking-widest border border-indigo-200">{rec.eventKey} • {rec.gender}</div>
                    <Medal className="text-slate-300 group-hover:text-yellow-500 transition-colors" size={24}/>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{rec.swimmerName}</h3>
                  <div className="text-xs font-bold text-slate-500 mt-1 uppercase flex items-center gap-2"><span>{rec.org}</span><span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[9px] shadow-sm">[{rec.abbr}]</span></div>
                </div>
                <div className="mt-6 flex justify-between items-end border-t border-slate-200 pt-4">
                    <div className="text-[10px] text-slate-400 font-medium max-w-[150px] leading-tight">Dicetak pada:<br/><span className="font-bold text-slate-600">{rec.meetName}</span></div>
                    <div className="text-right"><span className="block text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Rekor Waktu</span><span className="text-3xl font-mono font-black text-indigo-700 tracking-tighter leading-none">{rec.timeStr}</span></div>
                </div>
              </div>
            ))}
            {sortedRecords.length === 0 && (
              <div className="col-span-2 text-center p-12 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400"><Star size={48} className="mx-auto mb-4 opacity-30"/><p className="font-bold">Belum ada rekor yang tercatat.</p><p className="text-sm mt-1">Sistem akan secara otomatis menyusun rekor saat ada hasil perlombaan yang dimasukkan.</p></div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSuperuserDashboard = () => (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in">
      <div className="flex flex-col gap-2 mb-2">
        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-800">Pusat Kendali Master</h2>
        <p className="text-slate-500 font-medium">Silakan buat lomba baru, atau klik <span className="font-bold text-blue-600">"Kelola Lomba"</span> untuk membuka menu Setup, Tim, dan Atlet.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between group">
          <div className="relative z-10">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/30"><Database size={32} className="text-white"/></div>
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Database Induk</h2>
            <p className="text-blue-100 text-sm font-medium leading-relaxed max-w-sm mb-8">Pusat agregasi data. Lihat rekor dan catatan waktu terbaik (Personal Best) dari seluruh atlet lintas kejuaraan.</p>
          </div>
          <button onClick={() => setSuperView('main_db')} className="relative z-10 bg-white text-indigo-700 px-6 py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-blue-50 transition shadow-lg active:scale-95 w-fit flex items-center gap-2">Buka Database Utama <ChevronRight size={18}/></button>
          <Crown size={150} className="absolute -right-10 -bottom-10 text-white/10 transform rotate-12 transition-transform group-hover:scale-110 duration-500"/>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="bg-slate-100 p-6 rounded-full mb-6"><Trophy size={48} className="text-slate-400"/></div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Sistem Lomba Terisolasi</h3>
          <p className="text-slate-500 text-sm max-w-sm">Buat kejuaraan tak terbatas. Setiap kejuaraan memiliki database tersendiri dan dilindungi oleh PIN unik untuk Admin lapangan.</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2"><List size={24} className="text-blue-600"/> Daftar Kejuaraan</h2>
          <button onClick={() => setShowNewMeetModal(true)} className="bg-slate-900 hover:bg-black text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-md transition active:scale-95"><Plus size={16} /> Buat Lomba Baru</button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 bg-slate-50 p-5 border-b border-slate-200 text-xs font-black uppercase text-slate-400 tracking-widest">
            <div className="col-span-4">Lomba & Detail</div><div className="col-span-3 text-center">Jadwal & Lokasi</div><div className="col-span-2 text-center">Status / Data</div><div className="col-span-3 text-right">Aksi</div>
          </div>
          <div className="divide-y divide-slate-100">
            {meets.map(meet => {
              const meetStatus = meet.isSeeded ? 'Seeded' : 'Preparation';
              return (
                <div key={meet.id} className="grid grid-cols-12 p-5 items-center hover:bg-slate-50 transition group">
                  <div className="col-span-4">
                    <h3 className="font-black text-lg text-slate-800 uppercase">{meet.meetInfo.name}</h3>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-2"><span>ID: {meet.id.split('-')[1]}</span><span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">PIN Admin: {meet.adminPin}</span></div>
                  </div>
                  <div className="col-span-3 text-center">
                    <div className="font-bold text-slate-700 flex items-center justify-center gap-1"><Clock size={14}/> {meet.meetInfo.date}</div>
                    <div className="text-xs text-slate-500 flex items-center justify-center gap-1 mt-1"><Database size={12}/> {meet.meetInfo.location}</div>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${meet.isSeeded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{meetStatus}</span>
                    <div className="text-[10px] text-slate-400 font-bold mt-2 uppercase">{(meet.swimmers || []).length} Atlet • {(meet.events || []).length} Lomba</div>
                  </div>
                  <div className="col-span-3 flex justify-end gap-3">
                    <button onClick={() => deleteMeet(meet.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition"><Trash2 size={20}/></button>
                    <button onClick={() => { setActiveMeetId(meet.id); setActiveTab('dashboard'); }} className="bg-blue-50 text-blue-600 font-black text-xs uppercase px-5 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-100">Kelola Lomba</button>
                  </div>
                </div>
              )
            })}
            {meets.length === 0 && <div className="p-16 text-center text-slate-400"><Trophy size={48} className="mx-auto mb-4 opacity-50"/><p className="font-bold text-lg">Belum ada perlombaan yang dibuat.</p></div>}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {renderStatCard(<Flag />, "Tim / Klub", teams.length, "indigo")}
        {renderStatCard(<Users />, "Total Atlet", swimmers.length, "blue")}
        {renderStatCard(<CheckCircle />, "Entri Masuk", entries.filter(e => e.resultTime).length, "green")}
        {renderStatCard(<Trophy />, "Total Entri", entries.length, "yellow")}
      </div>
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-10 rounded-[2rem] relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter">{meetInfo.name}</h2>
          <div className="flex flex-wrap gap-6 text-indigo-200 font-bold uppercase text-sm tracking-widest">
            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full"><Clock size={16}/> {meetInfo.date}</span>
            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full"><Database size={16}/> {meetInfo.location}</span>
            <span className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full border border-yellow-500/30"><Lock size={16}/> PIN Admin: {adminPin}</span>
          </div>
        </div>
        <Cloud className="absolute right-[-40px] bottom-[-40px] text-white/5" size={300} />
      </div>
    </div>
  );

  const renderStatCard = (icon, title, value, color) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5">
      <div className={`p-4 rounded-xl bg-${color}-50 text-${color}-600`}>{icon}</div>
      <div><h4 className="text-3xl font-black text-slate-800 leading-none">{value}</h4><p className="text-slate-400 text-xs font-bold uppercase mt-1 tracking-wider">{title}</p></div>
    </div>
  );

  const renderMasterSetup = () => {
    return (
      <div className="space-y-8 pb-20">
        <section className="bg-white p-8 rounded-3xl border shadow-sm">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2 uppercase text-slate-800"><Settings className="text-blue-500" /> Tahap 1: Edit Info Kejuaraan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Judul Kejuaraan</label>
                <input className="w-full p-3 bg-slate-50 border rounded-xl font-bold focus:border-blue-500 outline-none" value={meetInfo.name} onChange={(e) => updateActiveMeet({ meetInfo: {...meetInfo, name: e.target.value} })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Tanggal</label>
                  <input type="date" className="w-full p-3 bg-slate-50 border rounded-xl font-bold focus:border-blue-500 outline-none" value={meetInfo.date} onChange={(e) => updateActiveMeet({ meetInfo: {...meetInfo, date: e.target.value} })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Lokasi</label>
                  <input className="w-full p-3 bg-slate-50 border rounded-xl font-bold focus:border-blue-500 outline-none" value={meetInfo.location} onChange={(e) => updateActiveMeet({ meetInfo: {...meetInfo, location: e.target.value} })} />
                </div>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Ganti PIN Akses Admin Lomba Ini</label>
                <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-center text-xl uppercase focus:border-blue-500 outline-none tracking-widest text-slate-700" type="text" value={adminPin} onChange={(e) => updateActiveMeet({ adminPin: e.target.value })} />
              </div>
              <p className="text-[10px] text-slate-500 font-bold leading-relaxed bg-slate-50 p-4 rounded-xl border">
                <span className="text-blue-500 uppercase font-black tracking-widest block mb-1">Security Isolation:</span> Berikan PIN di atas kepada staf Operator Lapangan Anda. Saat mereka login dengan PIN ini, mereka HANYA bisa mengakses Run Screen untuk perlombaan ini.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white p-8 rounded-3xl border shadow-sm">
          <h3 className="text-xl font-black mb-6 flex items-center gap-2 uppercase text-slate-800"><UserCog className="text-indigo-500" /> Tahap 2: Aturan Kelompok Umur & Poin</h3>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
              <h4 className="font-black text-xs uppercase mb-6 text-indigo-800 tracking-widest flex items-center gap-2"><Layout size={14}/> Definisi Kelompok Umur (KU)</h4>
              <div className="grid grid-cols-12 gap-3 mb-6 bg-white p-4 rounded-2xl border shadow-sm items-end">
                <div className="col-span-12 md:col-span-5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nama KU</label><input className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="Misal: KU 3" value={newKU.name} onChange={e => setNewKU({...newKU, name: e.target.value})} /></div>
                <div className="col-span-5 md:col-span-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Min Umur</label><input type="number" className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="10" value={newKU.minAge} onChange={e => setNewKU({...newKU, minAge: e.target.value})} /></div>
                <div className="col-span-5 md:col-span-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Max Umur</label><input type="number" className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="11" value={newKU.maxAge} onChange={e => setNewKU({...newKU, maxAge: e.target.value})} /></div>
                <div className="col-span-2 md:col-span-1 flex justify-end"><button onClick={addAgeGroup} className="w-full h-[46px] bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 shadow-md active:scale-95 transition"><Plus size={20}/></button></div>
              </div>
              <div className="space-y-3">
                {ageGroups.map(ku => (
                  <div key={ku.id} className="flex justify-between items-center bg-white p-4 border rounded-xl shadow-sm text-sm">
                    <span className="font-black text-slate-700 uppercase">{ku.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-indigo-100">{ku.minAge} - {ku.maxAge} Tahun</span>
                      <button onClick={() => removeAgeGroup(ku.id)} className="text-red-400 hover:text-red-600 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5 bg-slate-50 p-6 rounded-3xl border text-center flex flex-col justify-center">
              <Trophy className="mx-auto text-yellow-500 mb-4" size={40} />
              <h4 className="font-black text-sm uppercase text-slate-800 tracking-widest">Pengaturan Poin Peringkat</h4>
              <p className="text-xs text-slate-500 font-medium pb-6 mt-2 px-4">Tentukan perolehan poin dari peringkat 1 hingga 20. Klik tombol di bawah untuk mengatur.</p>
              <div className="flex flex-col gap-4">
                <button onClick={() => handleOpenPointEditor('standard')} className="w-full p-4 bg-white border-2 border-indigo-100 text-indigo-700 rounded-2xl font-black uppercase tracking-widest hover:border-indigo-400 hover:bg-indigo-50 transition shadow-sm flex items-center justify-center gap-3"><Edit3 size={18}/> Set Poin Standar</button>
                <button onClick={() => handleOpenPointEditor('alternative')} className="w-full p-4 bg-white border-2 border-orange-100 text-orange-600 rounded-2xl font-black uppercase tracking-widest hover:border-orange-400 hover:bg-orange-50 transition shadow-sm flex items-center justify-center gap-3"><Edit3 size={18}/> Set Poin Alternatif</button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white p-8 rounded-3xl border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black flex items-center gap-2 uppercase text-slate-800"><List className="text-emerald-500" /> Tahap 3: Buat Acara Lomba</h3>
            <div className="flex gap-2">
              <button onClick={handleExportEventListPDF} className={`bg-white hover:bg-slate-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2 border-2 border-indigo-100 shadow-sm active:scale-95 ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}><FileText size={14}/> Event List (PDF)</button>
              <button onClick={handleDownloadEventTemplate} className="bg-white hover:bg-slate-50 text-emerald-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2 border-2 border-emerald-100 shadow-sm active:scale-95"><Download size={14}/> Template Setup</button>
              <div>
                <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={handleImportEvents} className="hidden" id="import-excel" />
                <label htmlFor="import-excel" className={`bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition flex items-center gap-2 shadow-sm active:scale-95 ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}><UploadCloud size={14}/> {isImporting ? 'Memproses...' : 'Import Excel / CSV'}</label>
              </div>
            </div>
          </div>
          <form onSubmit={addEvent} className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8 bg-emerald-50 p-6 rounded-2xl items-end border border-emerald-100">
            <div><label className="text-[10px] font-black uppercase text-emerald-600 block mb-1">Tipe Lomba</label><select name="type" className="w-full p-3 border border-white rounded-xl font-black bg-white focus:ring-2 outline-none shadow-sm text-center"><option value="Individual">Individu</option><option value="Estafet">Estafet</option></select></div>
            <div><label className="text-[10px] font-black uppercase text-emerald-600 block mb-1">Jarak</label><select name="distance" className="w-full p-3 border border-white rounded-xl font-black bg-white focus:ring-2 outline-none shadow-sm text-center">{['25', '50', '100', '200', '400', '800', '1500', '4x50', '4x100'].map(d => <option key={d} value={d}>{d}m</option>)}</select></div>
            <div><label className="text-[10px] font-black uppercase text-emerald-600 block mb-1">Gaya Lomba</label><input name="stroke" className="w-full p-3 border border-white rounded-xl font-black bg-white focus:ring-2 outline-none shadow-sm" placeholder="Bebas/Ganti..." required /></div>
            <div><label className="text-[10px] font-black uppercase text-emerald-600 block mb-1">Gender</label><select name="gender" className="w-full p-3 border border-white rounded-xl font-black bg-white focus:ring-2 outline-none shadow-sm text-center"><option>Putra</option><option>Putri</option><option>Mix</option></select></div>
            <div><label className="text-[10px] font-black uppercase text-emerald-600 block mb-1">Kelompok Umur</label><select name="category" className="w-full p-3 border border-white rounded-xl font-black bg-white focus:ring-2 outline-none shadow-sm text-center">{ageGroups.length === 0 && <option value="">Buat KU Dulu!</option>}{ageGroups.map(ku => <option key={ku.id} value={ku.name}>{ku.name}</option>)}</select></div>
            <button className="bg-emerald-600 text-white p-3 rounded-xl font-black hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center justify-center gap-2 border border-emerald-700 active:scale-95"><Plus size={20}/> Tambah</button>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.length === 0 && <div className="col-span-3 text-center p-10 text-slate-400 font-bold border-2 border-dashed rounded-xl">Belum ada acara lomba.</div>}
            {events.map((e, idx) => (
              <div key={e.id} className="p-4 border rounded-2xl flex justify-between items-center group hover:border-emerald-400 transition bg-white shadow-sm">
                <div>
                  <div className="flex gap-2 items-center mb-2">
                    <span className="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded uppercase">EVT #{idx + 1}</span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase border border-emerald-200 px-2 py-0.5 rounded bg-emerald-50">{e.category}</span>
                    {e.type === 'Estafet' && <span className="text-[10px] font-black text-orange-600 uppercase border border-orange-200 px-2 py-0.5 rounded bg-orange-50">Estafet</span>}
                  </div>
                  <h4 className="font-black text-slate-800 uppercase text-sm mt-2">Event {idx + 1} - {e.distance}m {e.stroke} {e.gender}</h4>
                </div>
                <button onClick={() => updateActiveMeet({events: events.filter(ev => ev.id !== e.id)})} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  };

  const renderTeams = () => (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border-t-[10px] border-indigo-600">
        <div className="flex items-center gap-3 mb-8">
          <Flag className="text-indigo-600" size={32}/>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">Registrasi Klub / Kontingen</h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Daftarkan tim sebelum memasukkan biodata atlet di tahap selanjutnya.</p>
          </div>
        </div>

        <form onSubmit={registerTeam} className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-8">
          <div className="md:col-span-7">
              <label className="text-[10px] font-black uppercase text-indigo-700 block mb-1">Nama Lengkap Klub / Kontingen</label>
              <input value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} className="w-full p-4 bg-white border border-indigo-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contoh: MILLENNIUM AQUATIC" required />
          </div>
          <div className="md:col-span-3">
              <label className="text-[10px] font-black uppercase text-indigo-700 block mb-1">Singkatan (ABBR)</label>
              <input value={teamForm.abbr} onChange={e => setTeamForm({...teamForm, abbr: e.target.value})} className="w-full p-4 bg-white border border-indigo-200 rounded-xl font-black text-center uppercase focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-300" placeholder="Otomatis" maxLength={5} />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black uppercase hover:bg-indigo-700 shadow-md transition active:scale-95 h-[58px]">Tambah</button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.length === 0 && <div className="col-span-full text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold">Belum ada tim yang didaftarkan.</div>}
          {teams.map((t, idx) => (
            <div key={t.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition">
              <div className="flex gap-4 items-center">
                <div className="bg-slate-100 w-10 h-10 rounded-xl flex items-center justify-center font-black text-slate-400">{idx+1}</div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase text-sm truncate max-w-[150px]" title={t.name}>{t.name}</h4>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black uppercase border border-indigo-100 mt-1 inline-block">[{t.abbr}]</span>
                </div>
              </div>
              <button onClick={() => deleteTeamFromMeet(t.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAthletes = () => {
    const filteredAthletes = swimmers.filter(s => 
      s.name.toLowerCase().includes(athleteSearch.toLowerCase()) || s.org.toLowerCase().includes(athleteSearch.toLowerCase()) || s.abbr.toLowerCase().includes(athleteSearch.toLowerCase())
    );

    return (
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border-t-[10px] border-blue-600">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-2">Biodata Atlet</h2>
              <p className="text-slate-500 font-medium text-sm">Tambahkan atlet secara manual atau gunakan Import Excel (Otomatis mendaftarkan tim jika belum ada).</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleDownloadSwimmerTemplate} className="bg-white hover:bg-slate-50 text-blue-600 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2 border-2 border-blue-100 shadow-sm active:scale-95">
                <Download size={16}/> Template Import
              </button>
              <div>
                <input type="file" accept=".xlsx, .xls, .csv" ref={swimmerFileInputRef} onChange={handleImportSwimmers} className="hidden" id="import-swimmers" />
                <label htmlFor="import-swimmers" className={`bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-black transition flex items-center gap-2 shadow-lg active:scale-95 ${isImportingSwimmers ? 'opacity-50 pointer-events-none' : ''}`}>
                  <UploadCloud size={16}/> {isImportingSwimmers ? (importProgress || 'Memproses...') : 'Import Excel Atlet'}
                </label>
              </div>
            </div>
          </div>
          
          <form onSubmit={registerAthleteOnly} className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-slate-100">
            <div className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-7">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Nama Lengkap Atlet</label>
                  <input value={swimmerForm.name} onChange={e => setSwimmerForm({...swimmerForm, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama atlet..." required />
                </div>
                <div className="col-span-5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Klub / Kontingen</label>
                  <select value={swimmerForm.teamId} onChange={e => setSwimmerForm({...swimmerForm, teamId: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required>
                    <option value="" disabled>Pilih Tim...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Gender</label>
                  <select className="w-full p-4 bg-white border border-slate-200 rounded-xl font-black text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500" value={formGender} onChange={(e) => setFormGender(e.target.value)}>
                    <option value="Putra">Putra</option><option value="Putri">Putri</option>
                  </select>
                </div>
                <div className="col-span-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">DOB</label>
                  <input type="date" className="w-full p-4 bg-white border border-slate-200 rounded-xl font-black text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500" value={formDob} onChange={(e) => setFormDob(e.target.value)} required />
                </div>
                <div className="col-span-4">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Sistem KU</label>
                  <div className="w-full p-4 bg-slate-100 border border-slate-200 rounded-xl font-black text-slate-500 text-center uppercase truncate">
                    {calculatedAgeInfo ? `${calculatedAgeInfo.age}TH (${calculatedAgeInfo.kuNameDisplay})` : '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex items-end">
              <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-2xl font-black text-lg shadow-lg hover:bg-blue-700 transition active:scale-95 uppercase tracking-widest h-[60px] mb-[2px]">
                Simpan Atlet
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
          <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="font-black flex items-center gap-2 uppercase tracking-tighter"><Users size={20}/> Database Atlet Tersimpan</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input value={athleteSearch} onChange={e => setAthleteSearch(e.target.value)} type="text" placeholder="Cari nama / klub..." className="w-64 bg-white/10 border border-white/20 rounded-xl p-2 pl-9 text-sm font-bold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"/>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0">{filteredAthletes.length} / {swimmers.length} Atlet</div>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left whitespace-nowrap relative">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-5">Nama Atlet</th>
                  <th className="p-5">Klub / Tim</th>
                  <th className="p-5">Gender</th>
                  <th className="p-5">Umur (KU)</th>
                  <th className="p-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAthletes.map(s => (
                  <tr key={s.id} className="text-sm hover:bg-slate-50 transition group">
                    <td className="p-5 font-black text-slate-800 uppercase">{s.name}</td>
                    <td className="p-5">
                      <div className="font-bold text-slate-600 uppercase text-xs">{s.org}</div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black uppercase border border-indigo-100 mt-1 inline-block">[{s.abbr}]</span>
                    </td>
                    <td className="p-5 text-xs font-black text-slate-400 uppercase">{s.gender}</td>
                    <td className="p-5 text-xs">
                      <span className="font-black text-slate-800">{s.age} THN</span> <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded ml-2 uppercase border border-blue-100">{s.category}</span>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingAthlete(s)} className="text-blue-500 hover:text-blue-700 transition p-2 rounded-lg hover:bg-blue-50"><Edit3 size={18}/></button>
                        <button onClick={() => deleteSwimmer(s.id)} className="text-red-400 hover:text-red-600 transition p-2 rounded-lg hover:bg-red-50"><Trash2 size={18}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAthletes.length === 0 && <tr><td colSpan="5" className="text-center p-12 font-bold text-slate-300 uppercase">Tidak ada atlet yang ditemukan</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Edit Athlete */}
        {editingAthlete && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9990] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in border border-slate-100">
              <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter text-slate-800">Edit Profil Atlet</h3>
              <p className="text-slate-400 text-sm mb-8 font-medium">Perbarui biodata atlet. Perubahan pada DOB akan langsung memengaruhi Kelompok Umur (KU).</p>
              
              <form onSubmit={handleSaveEditAthlete} className="space-y-4">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-7">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Nama Lengkap</label>
                    <input name="name" defaultValue={editingAthlete.name} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required />
                  </div>
                  <div className="col-span-12 md:col-span-5">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Klub / Kontingen</label>
                    <select name="teamId" defaultValue={editingAthlete.teamId} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6 md:col-span-6">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Gender</label>
                    <select name="gender" defaultValue={editingAthlete.gender} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-black text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="Putra">Putra</option><option value="Putri">Putri</option>
                    </select>
                  </div>
                  <div className="col-span-6 md:col-span-6">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Tgl Lahir (DOB)</label>
                    <input name="dob" type="date" defaultValue={formatDateForInput(editingAthlete.dob)} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-black text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-3 pb-4">
                  <div className="col-span-6">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Kecamatan</label>
                    <input name="district" defaultValue={editingAthlete.district} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="col-span-6">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 ml-1">Kelas</label>
                    <input name="grade" defaultValue={editingAthlete.grade} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setEditingAthlete(null)} className="flex-1 p-4 rounded-2xl font-black uppercase text-slate-500 hover:bg-slate-100 transition">Batal</button>
                  <button type="submit" className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black uppercase hover:bg-blue-700 shadow-xl shadow-blue-200 transition active:scale-95">Simpan Perubahan</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEntries = () => {
    const listEntities = entryMode === 'individual' 
      ? swimmers.filter(s => s.name.toLowerCase().includes(entrySearch.toLowerCase()) || s.org.toLowerCase().includes(entrySearch.toLowerCase()))
      : teams.filter(t => t.name.toLowerCase().includes(entrySearch.toLowerCase()) || t.abbr.toLowerCase().includes(entrySearch.toLowerCase()));

    const eligibleEvents = selectedEntryEntity 
      ? events.filter(ev => {
          if (entryMode === 'individual') {
            return ev.type === 'Individual' && (ev.gender === selectedEntryEntity.gender || ev.gender === 'Mix') && selectedEntryEntity.category.includes(ev.category);
          } else {
            return ev.type === 'Estafet'; 
          }
        })
      : [];

    return (
      <div className="h-[85vh] flex gap-6 pb-10">
        <div className="w-[40%] bg-white rounded-3xl shadow-sm border flex flex-col overflow-hidden">
          <div className="p-6 bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black uppercase tracking-tighter text-lg flex items-center gap-2"><Edit3 size={20}/> Pendaftaran</h3>
              <div className="flex gap-3">
                <button onClick={() => setShowExportModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1 shadow-sm"><Download size={14}/> Psych Sheet</button>
                <div className="flex bg-slate-800 p-1 rounded-lg">
                  <button onClick={() => { setEntryMode('individual'); setSelectedEntryEntity(null); }} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition ${entryMode === 'individual' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Individu</button>
                  <button onClick={() => { setEntryMode('relay'); setSelectedEntryEntity(null); }} className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition ${entryMode === 'relay' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>Estafet</button>
                </div>
              </div>
            </div>
            <div className="relative">
              <input value={entrySearch} onChange={e => setEntrySearch(e.target.value)} type="text" placeholder={entryMode === 'individual' ? "Cari atlet..." : "Cari tim..."} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 pl-10 text-sm font-bold text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"/>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {listEntities.map(entity => {
              const entCount = entries.filter(en => entryMode === 'individual' ? en.swimmerId === entity.id : en.teamId === entity.id).length;
              return (
                <div key={entity.id} onClick={() => setSelectedEntryEntity(entity)} className={`p-4 cursor-pointer transition-all ${selectedEntryEntity?.id === entity.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50 border-l-4 border-transparent'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className={`font-black uppercase text-sm ${selectedEntryEntity?.id === entity.id ? 'text-blue-800' : 'text-slate-800'}`}>{entity.name}</h4>
                        {entryMode === 'individual' 
                          ? <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">{entity.org} [{entity.abbr}]</div>
                          : <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">[{entity.abbr}]</div>
                        }
                      </div>
                      <div className={`text-[10px] font-black px-2 py-1 rounded ${entCount > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{entCount} Acara</div>
                    </div>
                </div>
              )
            })}
            {listEntities.length === 0 && <div className="p-10 text-center font-bold text-slate-300 uppercase">Tidak ditemukan</div>}
          </div>
        </div>

        <div className="w-[60%] bg-white rounded-3xl shadow-sm border flex flex-col overflow-hidden">
          {!selectedEntryEntity ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                <Edit3 size={64} className="mb-4 opacity-50"/>
                <h3 className="text-xl font-black uppercase text-slate-400">Pilih {entryMode === 'individual' ? 'Atlet' : 'Tim'} di Samping</h3>
                <p className="font-medium text-sm mt-1 text-center">Klik salah satu nama atlet untuk mulai mendaftarkan<br/>mereka ke dalam acara perlombaan.</p>
            </div>
          ) : (
            <>
              <div className="p-6 bg-blue-50 border-b border-blue-100 shrink-0">
                <div className="flex items-center gap-3 mb-2">
                  {entryMode === 'individual' ? <UserCheck className="text-blue-600" size={24}/> : <Flag className="text-blue-600" size={24}/>}
                  <h2 className="text-2xl font-black uppercase text-blue-900 tracking-tight">{selectedEntryEntity.name}</h2>
                </div>
                <div className="flex gap-3 text-xs font-black uppercase tracking-widest text-blue-700 mt-2">
                  {entryMode === 'individual' ? (
                    <>
                      <span className="bg-white px-2 py-1 rounded border border-blue-100 shadow-sm">{selectedEntryEntity.org}</span>
                      <span className="bg-white px-2 py-1 rounded border border-blue-100 shadow-sm">{selectedEntryEntity.gender}</span>
                      <span className="bg-white px-2 py-1 rounded border border-blue-100 shadow-sm">{selectedEntryEntity.age} TH ({selectedEntryEntity.category})</span>
                    </>
                  ) : (
                      <span className="bg-white px-2 py-1 rounded border border-blue-100 shadow-sm">[{selectedEntryEntity.abbr}]</span>
                  )}
                </div>
              </div>
              <div className="p-4 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 grid grid-cols-12 shrink-0">
                <div className="col-span-8 pl-4">Nomor Lomba {entryMode === 'individual' ? 'Individu' : 'Estafet'}</div><div className="col-span-4 text-center">Entry Time (PB)</div>
              </div>
              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-3">
                {eligibleEvents.length === 0 && <div className="text-center p-10 font-bold text-slate-400">Tidak ada acara yang dibuat untuk kategori umur ini.</div>}
                {eligibleEvents.map((ev, eIdx) => {
                  const isEntered = entries.some(en => en.eventId === ev.id && (entryMode === 'individual' ? en.swimmerId === selectedEntryEntity.id : en.teamId === selectedEntryEntity.id));
                  const currentEntry = entries.find(en => en.eventId === ev.id && (entryMode === 'individual' ? en.swimmerId === selectedEntryEntity.id : en.teamId === selectedEntryEntity.id));
                  
                  return (
                    <div key={ev.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between shadow-sm ${isEntered ? 'bg-white border-blue-400 shadow-blue-100' : 'bg-white border-slate-200 opacity-70 hover:opacity-100'}`}>
                        <div className="flex items-center gap-4 col-span-7 cursor-pointer" onClick={() => handleToggleEntry(ev.id, '99:99.99')}>
                          <div className={`w-6 h-6 rounded flex items-center justify-center border-2 shrink-0 ${isEntered ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>{isEntered && <CheckCircle size={16}/>}</div>
                          <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Event {events.findIndex(e=>e.id===ev.id) + 1}</div>
                            <div className={`font-black uppercase text-sm ${isEntered ? 'text-slate-800' : 'text-slate-500'}`}>{ev.distance}m Gaya {ev.stroke} {ev.gender} {ev.category}</div>
                          </div>
                        </div>
                        <div className="col-span-5 flex justify-end items-center gap-2">
                          {isEntered && (
                            <button 
                              onClick={() => handleToggleSparring(currentEntry.id)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentEntry?.isSparring ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                              title="Tandai sebagai Sparring/Exhibition (Tidak dihitung poin)"
                            >
                              EXH
                            </button>
                          )}
                          <input 
                              type="text" disabled={!isEntered}
                              className={`w-28 p-3 text-center font-mono font-black text-sm rounded-xl outline-none transition-all ${isEntered ? 'bg-slate-100 border-2 border-slate-200 focus:border-blue-500 focus:bg-white text-blue-700' : 'bg-transparent border-none text-transparent'}`}
                              value={currentEntry ? currentEntry.seedTime : ''}
                              onChange={(e) => handleUpdateEntrySeed(ev.id, e.target.value)}
                              onBlur={(e) => handleUpdateEntrySeed(ev.id, formatTime(e.target.value))}
                              placeholder="99:99.99"
                          />
                        </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSeedingModule = () => (
    <div className="max-w-6xl mx-auto space-y-8">
      {!isSeeded ? (
        <div className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-slate-200 text-center space-y-8 shadow-sm">
          <div className="bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-blue-500"><Layout size={48} /></div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Otomatisasi Seeding FINA</h2>
            <p className="text-slate-400 font-medium">Tentukan jumlah lintasan kolam. Algoritma akan menempatkan perenang tercepat di heat terakhir.</p>
          </div>
          <div className="max-w-xs mx-auto space-y-4">
            <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Input Jumlah Lintasan</label>
            <input type="number" className="w-full text-center text-4xl font-black text-slate-800 bg-slate-50 border-4 border-slate-100 rounded-3xl p-6 focus:border-blue-500 focus:bg-white focus:ring-0 outline-none transition" value={laneCount} onChange={(e) => updateActiveMeet({ laneCount: parseInt(e.target.value) || '' })} min="1" max="20"/>
          </div>
          <button onClick={runSeeding} className="bg-slate-900 text-white px-16 py-5 rounded-3xl font-black text-xl hover:bg-black shadow-2xl transition-all transform active:scale-95">JALANKAN SEEDING SEKARANG</button>
        </div>
      ) : (
        <div className="space-y-8 pb-20">
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">Meet Program Preview</h2>
              <p className="text-blue-500 text-xs font-black uppercase tracking-widest mt-1 bg-blue-50 inline-block px-3 py-1 rounded-full border border-blue-100">Setup Kolam {laneCount} Lintasan</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleExportMeetProgramPDF} className="text-xs font-black text-emerald-600 border-2 border-emerald-200 bg-emerald-50 px-6 py-3 rounded-xl hover:bg-emerald-100 uppercase hover:border-emerald-300 transition shadow-sm active:scale-95 flex items-center gap-2"><Download size={16}/> {isImportingSwimmers ? importProgress : 'Generate Meet Program PDF'}</button>
              <button onClick={() => updateActiveMeet({ isSeeded: false })} className="text-xs font-black text-red-500 border-2 border-red-100 bg-white px-6 py-3 rounded-xl hover:bg-red-50 uppercase hover:border-red-200 transition shadow-sm active:scale-95 flex items-center gap-2"><XCircle size={16}/> Reset Seeding</button>
            </div>
          </div>

          {events.map((event, eIdx) => {
            const eventEntries = entries.filter(en => en.eventId === event.id);
            if (eventEntries.length === 0) return null;
            
            const seededEntries = eventEntries.filter(en => en.heat > 0);
            const unseededEntries = eventEntries.filter(en => en.heat === 0 || !en.heat);
            const heatsCount = seededEntries.length > 0 ? Math.max(...seededEntries.map(e => e.heat)) : 0;
            
            return (
              <div key={event.id} className="bg-white rounded-[2rem] border shadow-xl overflow-hidden mb-12">
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-xl uppercase tracking-tighter leading-none">Event {eIdx + 1} - {event.name}</h3>
                    <p className="text-indigo-300 text-[10px] font-black uppercase mt-2 tracking-widest bg-white/10 inline-block px-2 py-0.5 rounded">Event ID: {event.id.split('-')[1]}</p>
                  </div>
                  <Trophy size={24} className="text-slate-600"/>
                </div>
                
                <div className="p-8 space-y-12">
                  {heatsCount === 0 && unseededEntries.length > 0 && <div className="text-center text-slate-400 font-bold p-6">Belum ada seri yang di-generate. Silakan jalankan Seeding terlebih dahulu.</div>}
                  {Array.from({length: heatsCount}).map((_, i) => {
                    const heatNum = i + 1;
                    return (
                      <div key={heatNum} className="space-y-4">
                        <div className="flex items-center gap-4">
                          <span className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 border border-indigo-700">Seri {heatNum}</span>
                          <div className="h-[2px] bg-slate-100 flex-1"></div>
                        </div>
                        <div className="grid grid-cols-12 text-[10px] font-black text-slate-300 uppercase tracking-widest px-4 border-b border-slate-100 pb-2">
                          <div className="col-span-1 text-center">Lnt</div><div className="col-span-5">Nama Perenang / Tim</div><div className="col-span-4">Klub / ABBR</div><div className="col-span-2 text-right">Entry Time</div>
                        </div>
                        <div className="divide-y border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                          {Array.from({length: laneCount}).map((_, lIndex) => {
                            const laneNum = lIndex + 1;
                            const en = seededEntries.find(e => e.heat === heatNum && e.lane === laneNum);
                            
                            if (en) {
                              const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name : teams.find(t => t.id === en.teamId)?.name + ' (ESTAFET)';
                              const org = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.org : teams.find(t => t.id === en.teamId)?.name;
                              const abbr = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.abbr : teams.find(t => t.id === en.teamId)?.abbr;

                              return (
                                <div key={en.id} className="grid grid-cols-12 p-4 text-sm items-center hover:bg-slate-50 transition group relative">
                                  <div className="col-span-1 font-black text-indigo-600 text-xl text-center bg-indigo-50 w-10 h-10 rounded-xl flex items-center justify-center border border-indigo-100 shadow-inner">{en.lane}</div>
                                  <div className="col-span-5 pl-4 font-black uppercase text-slate-800">{name}</div>
                                  <div className="col-span-4 text-slate-500 font-bold text-xs uppercase leading-tight"><div>{org}</div><div className="text-[10px] text-indigo-500 font-black tracking-widest mt-0.5">[{abbr}]</div></div>
                                  <div className="col-span-2 text-right font-mono font-black text-slate-400 italic">{en.seedTime}</div>
                                  {role === 'master' && (
                                    <div className="absolute right-[-100px] group-hover:right-4 top-1/2 -translate-y-1/2 transition-all flex gap-1 z-10">
                                      <button onClick={() => setEditingEntry(en)} className="bg-blue-600 text-white p-3 rounded-xl shadow-xl hover:bg-blue-700 transition"><Edit3 size={16}/></button>
                                    </div>
                                  )}
                                </div>
                              );
                            } else {
                              return (
                                <div key={`empty-${heatNum}-${laneNum}`} className="grid grid-cols-12 p-4 text-sm items-center bg-slate-50/50 opacity-60">
                                  <div className="col-span-1 font-black text-slate-400 text-xl text-center bg-white w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">{laneNum}</div>
                                  <div className="col-span-5 pl-4 font-black uppercase text-slate-400 tracking-widest">--- KOSONG ---</div><div className="col-span-6"></div>
                                </div>
                              );
                            }
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {unseededEntries.length > 0 && (
                    <div className="mt-8 border-2 border-orange-200 bg-orange-50 rounded-2xl p-6 shadow-sm">
                        <h4 className="font-black text-orange-600 mb-4 flex items-center gap-2"><AlertCircle size={18}/> Karantina: Atlet Belum Masuk Seri</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {unseededEntries.map(en => {
                            const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name : teams.find(t => t.id === en.teamId)?.name + ' (ESTAFET)';
                            const abbr = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.abbr : teams.find(t => t.id === en.teamId)?.abbr;
                            return (
                              <div key={en.id} className="bg-white p-4 rounded-xl border border-orange-200 flex justify-between items-center shadow-sm">
                                  <div>
                                    <div className="font-black text-slate-800 uppercase text-sm">{name}</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">[{abbr}] • PB: {en.seedTime}</div>
                                  </div>
                                  {role === 'master' && <button onClick={() => setEditingEntry(en)} className="bg-orange-500 text-white p-2.5 rounded-lg shadow-sm hover:bg-orange-600 transition text-xs font-black uppercase flex items-center gap-1 active:scale-95"><Move size={14}/> Adjust</button>}
                              </div>
                            );
                          })}
                        </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingEntry && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9990] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in border border-slate-100">
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter text-slate-800">Adjust Entry Manual</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium">Timpa hasil seeding otomatis. Pindahkan atlet ke seri dan lintasan baru.</p>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Pindah Ke Seri</label><input type="number" id="manualHeat" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-center text-xl focus:border-indigo-500 outline-none" defaultValue={editingEntry.heat} /></div>
                <div><label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Pindah Ke Lintasan</label><input type="number" id="manualLane" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-center text-xl focus:border-indigo-500 outline-none" defaultValue={editingEntry.lane} /></div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-slate-100">
                <button onClick={() => setEditingEntry(null)} className="flex-1 p-4 rounded-2xl font-black uppercase text-slate-500 hover:bg-slate-100 transition">Batal</button>
                <button onClick={() => moveEntry(editingEntry.id, document.getElementById('manualHeat').value, document.getElementById('manualLane').value)} className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black uppercase hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition active:scale-95">Simpan Posisi</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAdminPanel = () => {
    const activeEvent = events.find(e => e.id === runEventId);
    const eventEntries = entries.filter(e => e.eventId === runEventId);
    const heatsCount = eventEntries.length > 0 ? Math.max(...eventEntries.map(e => e.heat)) : 1;

    const handleTimeKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll('.result-time-input'));
        const currentIndex = inputs.indexOf(e.target);
        if (currentIndex > -1 && currentIndex < inputs.length - 1) { inputs[currentIndex + 1].focus(); inputs[currentIndex + 1].select(); } else { e.target.blur(); }
      }
    };

    return (
      <div className="flex flex-col h-[85vh] bg-[#d4d0c8] border-[3px] border-slate-400 font-sans text-xs shadow-2xl relative">
        <div className="bg-[#ece9d8] flex gap-4 px-3 py-1.5 text-black border-b border-slate-400 text-[11px] shadow-sm">
          <span className="cursor-default"><u>E</u>vents</span><span className="cursor-default">A<u>t</u>hletes</span><span className="cursor-default"><u>R</u>elays</span><span className="cursor-default"><u>S</u>eeding</span><span className="cursor-default">R<u>u</u>n</span><span className="cursor-default">Re<u>p</u>orts</span><span className="cursor-default text-indigo-700 font-bold ml-auto hover:underline" onClick={() => setActiveTab('leaderboard')}>[ Switch To Reports ]</span>
        </div>
        
        <div className="bg-blue-900 text-white p-1 px-4 font-bold flex justify-between tracking-wider shadow-inner text-sm">
          <span>SWIMMEET PRO - RUN SCREEN (ADMIN MODE)</span><span className="opacity-80">Meet Manager Licensed to: Admin - {adminPin}</span>
        </div>

        <div className="flex flex-1 overflow-hidden p-1.5 gap-1.5">
          <div className="w-[35%] flex flex-col bg-white border border-slate-500 shadow-inner">
            <div className="bg-[#cdd5ea] text-blue-900 font-bold p-1.5 border-b border-slate-500 text-center tracking-wider text-[11px]">EVENT LIST - All Events</div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left whitespace-nowrap cursor-default">
                <thead className="bg-[#ece9d8] sticky top-0 shadow-sm outline outline-1 outline-slate-400">
                  <tr><th className="border-r border-b border-slate-400 px-1 text-center w-8">Evt #</th><th className="border-r border-b border-slate-400 px-1 text-center w-8">Rnd</th><th className="border-r border-b border-slate-400 px-1 text-center w-16">Status</th><th className="border-b border-slate-400 px-2">Event Name</th></tr>
                </thead>
                <tbody>
                  {events.map((ev, idx) => {
                    const evEntries = entries.filter(e => e.eventId === ev.id);
                    const isScored = evEntries.some(e => e.standardPoints > 0 || e.alternativePoints > 0);
                    const isDone = evEntries.length > 0 && evEntries.every(e => (e.resultTime && e.resultTime.trim() !== '') || e.status);
                    const isUnseeded = evEntries.length === 0 || evEntries.some(e => e.heat === 0);
                    
                    let status = 'Un-Seeded'; let statusColor = '';
                    if (isScored) { status = 'Scored'; statusColor = 'bg-[#ffccff]'; } else if (isDone) { status = 'Done'; statusColor = 'bg-[#ccffcc]'; } else if (!isUnseeded) { status = 'Seeded'; statusColor = 'bg-[#ffffcc]'; }

                    return (
                      <tr key={ev.id} onClick={() => { setRunEventId(ev.id); setRunHeat(1); }} className={`${runEventId === ev.id ? 'bg-blue-700 text-white' : 'hover:bg-[#f0f0f0] text-black'} border-b border-slate-200`}>
                        <td className="border-r border-slate-300 px-1 text-center">{idx + 1}</td><td className="border-r border-slate-300 px-1 text-center">F</td><td className={`border-r border-slate-300 px-1 text-center font-bold ${statusColor} ${statusColor ? 'text-black' : ''}`}>{status}</td><td className="px-2 truncate py-1 text-[11px] font-semibold">Event {idx + 1} - {ev.name}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="w-[65%] flex flex-col gap-1.5">
            <div className="bg-[#ece9d8] border border-slate-500 p-1.5 flex justify-between shadow-sm">
                <div className="flex gap-1.5">
                  <button className="bg-[#dfdfdf] border border-slate-500 px-4 py-1 text-[11px] font-bold shadow-[inset_1px_1px_0_#fff,inset_-1px_-1px_0_#888] active:shadow-[inset_1px_1px_0_#888,inset_-1px_-1px_0_#fff]" onClick={() => setRunHeat(Math.max(1, runHeat - 1))}>{'< Prev Heat'}</button>
                  <button className="bg-[#dfdfdf] border border-slate-500 px-4 py-1 text-[11px] font-bold shadow-[inset_1px_1px_0_#fff,inset_-1px_-1px_0_#888] active:shadow-[inset_1px_1px_0_#888,inset_-1px_-1px_0_#fff]" onClick={() => setRunHeat(Math.min(heatsCount, runHeat + 1))}>{'Next Heat >'}</button>
                </div>
                <div className="flex gap-1.5">
                  <button className="bg-[#dfdfdf] border border-slate-500 px-3 py-1 text-[10px] font-bold shadow-[inset_1px_1px_0_#fff,inset_-1px_-1px_0_#888] active:shadow-[inset_1px_1px_0_#888,inset_-1px_-1px_0_#fff]" onClick={() => calculatePoints(runEventId)}>Score : Ctrl-S</button>
                  <button className="bg-[#dfdfdf] border border-slate-500 px-3 py-1 text-[10px] font-bold shadow-[inset_1px_1px_0_#fff,inset_-1px_-1px_0_#888] active:shadow-[inset_1px_1px_0_#888,inset_-1px_-1px_0_#fff] text-blue-700" onClick={() => promptExportFormat(runEventId, false)}>Gen. Result</button>
                  <button className="bg-[#dfdfdf] border border-slate-500 px-3 py-1 text-[10px] font-bold shadow-[inset_1px_1px_0_#fff,inset_-1px_-1px_0_#888] active:shadow-[inset_1px_1px_0_#888,inset_-1px_-1px_0_#fff] text-red-700" onClick={() => promptExportFormat(runEventId, true)}>Gen. Score</button>
                  <button className="bg-[#dfdfdf] border border-slate-500 px-3 py-1 text-[10px] font-bold shadow-[inset_1px_1px_0_#fff,inset_-1px_-1px_0_#888] active:shadow-[inset_1px_1px_0_#888,inset_-1px_-1px_0_#fff] text-purple-700" onClick={handleExportFullResultsPDF}>Full Results</button>
                </div>
            </div>

            <div className="bg-[#ccddff] border border-slate-500 p-1.5 text-center font-bold text-black tracking-wide text-sm shadow-inner">
              Heat {runHeat} of {heatsCount} == Finals == {activeEvent ? `Event ${events.indexOf(activeEvent) + 1} - ${activeEvent.name}` : 'No Event Selected'}
            </div>

            <div className="flex-1 bg-white border border-slate-500 overflow-y-auto shadow-inner relative">
              <table className="w-full text-left border-collapse whitespace-nowrap text-[11px]">
                <thead className="bg-[#ece9d8] sticky top-0 outline outline-1 outline-slate-400 z-10">
                  <tr>
                    <th className="border-r border-b border-slate-400 px-2 py-1 text-center font-semibold">Lane</th><th className="border-r border-b border-slate-400 px-2 py-1 font-semibold">Athlete/Team Name</th><th className="border-r border-b border-slate-400 px-2 py-1 text-center font-semibold">Age</th><th className="border-r border-b border-slate-400 px-2 py-1 font-semibold">Team</th><th className="border-r border-b border-slate-400 px-2 py-1 text-center font-semibold">Seed Time</th><th className="border-r border-b border-slate-400 px-2 py-1 text-center font-semibold bg-yellow-100">Finals Time</th><th className="border-r border-b border-slate-400 px-1 py-1 text-center font-semibold text-red-700">Status</th><th className="border-r border-b border-slate-400 px-1 py-1 text-center font-semibold text-blue-700">HPL</th><th className="border-r border-b border-slate-400 px-1 py-1 text-center font-semibold text-blue-700">PL</th><th className="border-b border-slate-400 px-1 py-1 text-center font-semibold text-blue-700">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({length: laneCount}).map((_, i) => {
                    const laneNum = i + 1; const en = eventEntries.find(e => e.heat === runHeat && e.lane === laneNum);
                    if (en) {
                      const name = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.name : teams.find(t => t.id === en.teamId)?.name + ' (ESTAFET)';
                      const age = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.age : '';
                      const org = en.swimmerId ? swimmers.find(s => s.id === en.swimmerId)?.org : teams.find(t => t.id === en.teamId)?.abbr;
                      
                      return (
                        <tr key={en.id} className={`${en.status ? 'bg-red-50 text-red-900' : 'hover:bg-[#fff9cc] text-black'} border-b border-slate-200`}>
                          <td className="border-r border-slate-300 px-2 py-1.5 text-center font-bold bg-[#f4f4f4]">{en.lane}</td>
                          <td className="border-r border-slate-300 px-2 py-1.5 font-medium">
                            {name}
                            {en.isSparring && <span className="ml-2 text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 px-1 py-0.5 rounded">EXH</span>}
                          </td>
                          <td className="border-r border-slate-300 px-2 py-1.5 text-center font-medium">{age}</td>
                          <td className="border-r border-slate-300 px-2 py-1.5 truncate max-w-[120px] font-medium" title={org}>{org}</td>
                          <td className="border-r border-slate-300 px-2 py-1.5 text-center bg-slate-50 relative"><span className="font-mono font-bold text-[11px] text-slate-500">{en.seedTime}</span></td>
                          <td className="border-r border-slate-400 p-0 text-center bg-[#fffcdb] relative">
                            <input 
                              type="text" 
                              className={`result-time-input absolute inset-0 w-full h-full px-2 text-center font-mono font-bold outline-none bg-transparent focus:bg-white focus:ring-[1.5px] focus:ring-blue-600 focus:z-20 transition-all ${en.status ? 'text-red-600 tracking-widest' : 'text-slate-800'}`} 
                              placeholder="  :  .  " 
                              value={en.status || en.resultTime} 
                              onChange={(e) => handleTimeInputChange(en.id, e.target.value)} 
                              onBlur={(e) => handleTimeInputBlur(en.id, e.target.value)} 
                              onKeyDown={handleTimeKeyDown}
                            />
                          </td>
                          <td className="border-r border-slate-300 p-0 text-center bg-white relative">
                            <select className={`absolute inset-0 w-full h-full bg-transparent outline-none text-center font-bold text-[10px] ${en.status === 'DQ' ? 'text-red-600' : en.status ? 'text-orange-600' : 'text-slate-400'}`} value={en.status || ''} onChange={(e) => handleStatusChange(en.id, e.target.value)}>
                              <option value="">-</option>
                              <option value="NT" className="text-orange-600">NT</option>
                              <option value="DQ" className="text-red-600">DQ</option>
                              <option value="DNS" className="text-orange-600">DNS</option>
                              <option value="DNF" className="text-orange-600">DNF</option>
                              <option value="SCR" className="text-slate-600">SCR</option>
                            </select>
                          </td>
                          <td className="border-r border-slate-300 px-1 py-1.5 text-center font-bold text-slate-600">{en.hpl || ''}</td><td className="border-r border-slate-300 px-1 py-1.5 text-center font-bold text-slate-600">{en.pl || ''}</td><td className="px-1 py-1.5 text-center font-bold text-slate-600">{en.standardPoints > 0 ? en.standardPoints : ''}</td>
                        </tr>
                      )
                    } else {
                      return (
                        <tr key={`empty-run-${laneNum}`} className="border-b border-slate-200 bg-[#f9f9f9] opacity-70">
                          <td className="border-r border-slate-300 px-2 py-1.5 text-center font-bold bg-[#f4f4f4] text-slate-400">{laneNum}</td><td className="border-r border-slate-300 px-2 py-1.5 font-bold tracking-widest text-slate-300 text-center uppercase text-[9px]">- EMPTY -</td><td className="border-r border-slate-300 px-2 py-1.5"></td><td className="border-r border-slate-300 px-2 py-1.5"></td><td className="border-r border-slate-300 px-2 py-1.5"></td><td className="border-r border-slate-400 p-0 text-center bg-[#eaeaea]"></td><td className="border-r border-slate-300 p-0 text-center"></td><td className="border-r border-slate-300 px-1 py-1.5"></td><td className="border-r border-slate-300 px-1 py-1.5"></td><td className="px-1 py-1.5"></td>
                        </tr>
                      )
                    }
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800">Reports & Analytics</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Klasemen medali, poin, perenang terbaik, hingga sertifikat otomatis.</p>
        </div>
        <div className="flex bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto">
          <button onClick={() => setReportTab('points')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${reportTab === 'points' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Klasemen Poin</button>
          <button onClick={() => setReportTab('medals')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${reportTab === 'medals' ? 'bg-white text-yellow-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Perolehan Medali</button>
          <button onClick={() => setReportTab('best')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${reportTab === 'best' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Perenang Terbaik</button>
          <button onClick={() => setReportTab('cert')} className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${reportTab === 'cert' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Sertifikat</button>
        </div>
      </div>

      {reportTab === 'points' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in">
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2"><Trophy className="text-yellow-500"/> Individual Best</h3>
              <button onClick={() => {
                const data = swimmerScores.map((s, i) => ({ Peringkat: i+1, Nama: s.name, Tim: s.org, ABBR: s.abbr, Gender: s.gender, KU: s.category, Total_Poin: s.totalPoints }));
                exportToXLSX(data, 'IndividualScores', 'Individual Best');
              }} className="text-[10px] bg-slate-900 text-white px-4 py-2 rounded-lg font-black uppercase tracking-widest shadow-lg hover:bg-black active:scale-95 transition flex items-center gap-2">Export Excel</button>
            </div>
            <div className="bg-white rounded-[2.5rem] border shadow-xl overflow-hidden">
              <div className="divide-y divide-slate-50">
                {swimmerScores.slice(0, 15).map((s, idx) => (
                  <div key={s.id} className="p-6 flex items-center gap-6 hover:bg-slate-50 transition group">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg border ${idx === 0 ? 'bg-yellow-400 text-white border-yellow-500' : idx === 1 ? 'bg-slate-200 text-slate-600 border-slate-300' : idx === 2 ? 'bg-orange-300 text-white border-orange-400' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{idx + 1}</div>
                    <div className="flex-1">
                      <h5 className="font-black text-slate-800 uppercase text-sm">{s.name}</h5>
                      <div className="flex gap-2 mt-1"><span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded font-black uppercase tracking-widest">[{s.abbr}]</span><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 px-2 py-0.5 rounded">{s.category} • {s.gender}</span></div>
                    </div>
                    <div className="text-right bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                      <div className="text-3xl font-black text-slate-800 leading-none">{s.totalPoints}</div><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Points</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2"><BarChart3 className="text-blue-500"/> Team Standings</h3>
              <button onClick={() => {
                const data = clubScores.map((c, i) => ({ Peringkat: i+1, Tim: c.name, ABBR: c.abbr, Total_Poin: c.points }));
                exportToXLSX(data, 'TeamScores', 'Team Standings');
              }} className="text-[10px] bg-slate-900 text-white px-4 py-2 rounded-lg font-black uppercase tracking-widest shadow-lg hover:bg-black active:scale-95 transition flex items-center gap-2">Export Excel</button>
            </div>
            <div className="bg-white rounded-[2.5rem] border shadow-xl overflow-hidden">
              <div className="divide-y divide-slate-50">
                {clubScores.slice(0, 15).map((c, idx) => (
                  <div key={c.name} className="p-6 flex items-center gap-6 hover:bg-slate-50 transition">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-600 text-lg shadow-sm">{idx + 1}</div>
                    <div className="flex-1">
                      <h5 className="font-black text-slate-800 uppercase text-sm">{c.name}</h5>
                      <span className="text-[10px] bg-indigo-600 text-white px-3 py-1 mt-1 inline-block rounded-md font-black uppercase tracking-widest shadow-sm">[{c.abbr}]</span>
                    </div>
                    <div className="text-right bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                      <div className="text-3xl font-black text-indigo-700 leading-none">{c.points}</div><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Poin</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {reportTab === 'medals' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center px-4">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2"><Medal className="text-yellow-500"/> Klasemen Medali Tim</h3>
              <button onClick={() => {
                const data = medalTally.map((c, i) => ({ Peringkat: i+1, Tim: c.name, ABBR: c.abbr, Emas: c.gold, Perak: c.silver, Perunggu: c.bronze }));
                exportToXLSX(data, 'MedalTally', 'Klasemen Medali');
              }} className="text-[10px] bg-slate-900 text-white px-4 py-2 rounded-lg font-black uppercase tracking-widest shadow-lg hover:bg-black active:scale-95 transition flex items-center gap-2">Export Excel</button>
          </div>
          <div className="bg-white rounded-[2.5rem] border shadow-xl overflow-hidden">
            <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">
                  <tr><th className="p-5 text-center w-16">Pos</th><th className="p-5">Klub / Tim</th><th className="p-5 text-center text-yellow-600">Emas</th><th className="p-5 text-center text-slate-500">Perak</th><th className="p-5 text-center text-orange-600">Perunggu</th><th className="p-5 text-center">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {medalTally.map((t, idx) => (
                    <tr key={t.abbr} className="hover:bg-slate-50 transition text-sm">
                      <td className="p-5 text-center font-black text-slate-400">{idx+1}</td>
                      <td className="p-5 font-black text-slate-800 uppercase">{t.name} <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 ml-2 rounded border border-indigo-100">[{t.abbr}]</span></td>
                      <td className="p-5 text-center font-black text-yellow-600 text-lg">{t.gold}</td>
                      <td className="p-5 text-center font-black text-slate-500 text-lg">{t.silver}</td>
                      <td className="p-5 text-center font-black text-orange-600 text-lg">{t.bronze}</td>
                      <td className="p-5 text-center font-black text-indigo-800 text-xl">{t.gold + t.silver + t.bronze}</td>
                    </tr>
                  ))}
                  {medalTally.length === 0 && <tr><td colSpan="6" className="text-center p-12 font-bold text-slate-400">Belum ada medali yang direbut.</td></tr>}
                </tbody>
            </table>
          </div>
        </div>
      )}

      {reportTab === 'best' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="px-4 flex justify-between items-end">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2"><Crown className="text-emerald-500"/> Kandidat Perenang Terbaik</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Dihitung otomatis berdasarkan perolehan Emas, Perak, Perunggu, dan Poin.</p>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(bestSwimmersData).map(([groupKey, swimmersList]) => {
                const topSwimmer = swimmersList[0];
                if (!topSwimmer || topSwimmer.points === 0) return null;
                return (
                  <div key={groupKey} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                    <span className="bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-200">{groupKey}</span>
                    <h4 className="text-2xl font-black text-slate-800 uppercase mt-4 tracking-tight leading-none">{topSwimmer.name}</h4>
                    <p className="text-xs font-bold text-slate-500 uppercase mt-2">{topSwimmer.org} [{topSwimmer.abbr}]</p>
                    
                    <div className="mt-6 flex gap-4">
                      <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 text-center flex-1">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Medali</div>
                        <div className="font-black text-slate-800 flex items-center justify-center gap-2">
                          <span className="text-yellow-500">{topSwimmer.gold}</span>-
                          <span className="text-slate-400">{topSwimmer.silver}</span>-
                          <span className="text-orange-500">{topSwimmer.bronze}</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 text-center flex-1">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Poin</div>
                        <div className="font-black text-indigo-600 text-xl leading-none">{topSwimmer.points}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {reportTab === 'cert' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="px-4 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-2"><Award className="text-indigo-500"/> Cetak Sertifikat Otomatis</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Sistem Mail-Merge canggih PDF. Bisa cetak full-desain, atau mencetak tulisan saja ke atas blangko fisik.</p>
              </div>
              <label className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition active:scale-95">
                <input type="checkbox" checked={certPrintTextOnly} onChange={(e) => setCertPrintTextOnly(e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"/>
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">Mode Teks Saja (Blangko)</span>
              </label>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
                    <h4 className="font-black text-sm uppercase text-slate-800 tracking-widest border-b pb-3">1. Upload Background (Opsional)</h4>
                    <input type="file" accept="image/*" onChange={handleCertBgUpload} className="hidden" id="cert-upload"/>
                    <label htmlFor="cert-upload" className="w-full h-32 border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50 text-indigo-500 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-100 transition">
                      <FileImage size={32} className="mb-2"/>
                      <span className="font-bold text-sm">Klik untuk Unggah Gambar</span>
                    </label>
                    {certBg && <div className="text-xs font-bold text-emerald-600 text-center bg-emerald-50 py-2 rounded-lg">✓ Gambar termuat!</div>}
                </div>

                <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
                    <h4 className="font-black text-sm uppercase text-yellow-600 tracking-widest border-b pb-3">Cetak Sertifikat JUARA</h4>
                    <form onSubmit={(e) => { e.preventDefault(); const formData = new FormData(e.target); handleGenerateCerts(formData.get('eventId'), parseInt(formData.get('topN'))); }} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Pilih Acara</label>
                        <select name="eventId" className="w-full p-3 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-yellow-500 outline-none text-sm" required>
                          {events.map(ev => <option key={ev.id} value={ev.id}>Event {events.indexOf(ev)+1} - {ev.distance}m {ev.stroke} {ev.gender} {ev.category}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Cetak Untuk Peringkat</label>
                        <select name="topN" className="w-full p-3 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-yellow-500 outline-none text-sm">
                          <option value="3">Top 3 (Peraih Medali)</option>
                          <option value="8">Top 8 (Finalis)</option>
                          <option value="20">Top 20</option>
                        </select>
                      </div>
                      <button type="submit" className="w-full bg-yellow-500 text-white p-4 rounded-xl font-black uppercase hover:bg-yellow-600 shadow-md transition active:scale-95 flex items-center justify-center gap-2"><Trophy size={18}/> Generate Juara</button>
                    </form>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border shadow-sm space-y-4">
                    <h4 className="font-black text-sm uppercase text-blue-600 tracking-widest border-b pb-3">Cetak Sertifikat PESERTA (Massal)</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Metode Ekspor File</label>
                        <select className="w-full p-3 bg-slate-50 border rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={partCertMode} onChange={(e) => setPartCertMode(e.target.value)}>
                          <option value="all_merged">1 File PDF (Semua Peserta Digabung)</option>
                          <option value="per_person">ZIP: Pisah 1 PDF untuk Tiap Atlet</option>
                          <option value="per_team">ZIP: Pisah 1 PDF untuk Tiap Tim/Klub</option>
                        </select>
                      </div>
                      <button onClick={handleGenerateParticipantCerts} disabled={isImportingSwimmers} className={`w-full bg-blue-600 text-white p-4 rounded-xl font-black uppercase hover:bg-blue-700 shadow-md transition active:scale-95 flex items-center justify-center gap-2 ${isImportingSwimmers ? 'opacity-50' : ''}`}>
                         {isImportingSwimmers ? <Loader2 size={18} className="animate-spin" /> : (partCertMode === 'all_merged' ? <FileText size={18}/> : <Archive size={18}/>)}
                         {isImportingSwimmers ? importProgress : 'Generate E-Sertifikat'}
                      </button>
                    </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] border shadow-sm h-fit">
                <h4 className="font-black text-sm uppercase text-slate-800 tracking-widest border-b pb-3 mb-6">2. Kalibrasi Koordinat Posisi Teks</h4>
                {(certBg || certPrintTextOnly) && (
                  <div className={`mt-8 mb-6 border-2 border-slate-200 rounded-xl overflow-hidden relative w-full shadow-inner group ${certPrintTextOnly ? 'bg-white' : 'bg-slate-100'}`} style={{ aspectRatio: '297/210' }}>
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg backdrop-blur-sm z-10 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Live Preview {certPrintTextOnly && "(Teks Saja)"}
                    </div>
                    {!certPrintTextOnly && certBg && <img src={certBg} alt="Certificate Background" className="absolute inset-0 w-full h-full object-cover" />}
                    
                    {certCoords.name?.show && (
                      <div className="absolute font-bold text-slate-800 text-xl md:text-2xl whitespace-nowrap" style={{ left: `${(certCoords.name.x / 297) * 100}%`, top: `${(certCoords.name.y / 210) * 100}%`, transform: 'translate(-50%, -100%)' }}>
                        NAMA ATLET CONTOH
                      </div>
                    )}
                    {certCoords.team?.show && (
                      <div className="absolute font-bold text-slate-800 text-sm md:text-base whitespace-nowrap" style={{ left: `${(certCoords.team.x / 297) * 100}%`, top: `${(certCoords.team.y / 210) * 100}%`, transform: 'translate(-50%, -100%)' }}>
                        KLUB AQUATIC CONTOH
                      </div>
                    )}
                    {certCoords.event?.show && (
                      <div className="absolute font-bold text-slate-800 text-xs md:text-sm whitespace-nowrap" style={{ left: `${(certCoords.event.x / 297) * 100}%`, top: `${(certCoords.event.y / 210) * 100}%`, transform: 'translate(-50%, -100%)' }}>
                        50M GAYA BEBAS PUTRA
                      </div>
                    )}
                    {certCoords.time?.show && (
                      <div className="absolute font-bold text-slate-800 text-sm md:text-base whitespace-nowrap" style={{ left: `${(certCoords.time.x / 297) * 100}%`, top: `${(certCoords.time.y / 210) * 100}%`, transform: 'translate(-50%, -100%)' }}>
                        00:25.50
                      </div>
                    )}
                    {certCoords.rank?.show && (
                      <div className="absolute font-bold text-slate-800 text-lg md:text-xl whitespace-nowrap" style={{ left: `${(certCoords.rank.x / 297) * 100}%`, top: `${(certCoords.rank.y / 210) * 100}%`, transform: 'translate(-50%, -100%)' }}>
                        JUARA 1
                      </div>
                    )}
                  </div>
                )}
                
                <button onClick={handlePreviewCert} className="w-full mt-2 bg-emerald-600 text-white p-3 rounded-xl font-black uppercase hover:bg-emerald-700 shadow-md transition active:scale-95 flex items-center justify-center gap-2">
                  <FileImage size={18}/> Download Preview PDF (Opsional)
                </button>

                <p className="text-[10px] font-bold text-slate-400 mt-4 leading-relaxed bg-slate-100 p-3 rounded-lg">Kertas PDF bersifat Landscape A4 (297mm x 210mm).<br/>Sumbu X (0 - 297) = Jarak teks dari kiri ke kanan. Gunakan X=148 agar teks berada tepat di tengah (Center Align).<br/>Sumbu Y (0 - 210) = Jarak teks dari atas ke bawah.</p>
              </div>
          </div>
        </div>
      )}
    </div>
  );

  // ==========================================
  // MAIN APP RENDER
  // ==========================================
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <Loader2 className="animate-spin mb-4 text-blue-500" size={48} />
      <p className="font-black uppercase tracking-widest text-xs text-blue-200">Menghubungkan ke Cloud...</p>
    </div>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-2xl space-y-10 border border-slate-100 animate-in fade-in">
          <div className="text-center">
            <div className="bg-blue-600 w-24 h-24 rounded-3xl mx-auto flex items-center justify-center text-white mb-6 shadow-2xl shadow-blue-500/50 ring-8 ring-blue-50"><Cloud size={48} /></div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">SwimMeet Cloud</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3">Firebase Multi-User System</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-3 tracking-widest">Kredensial Akses</label>
              <div className="relative">
                <input type="password" className="w-full p-5 pl-14 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-xl transition-all" placeholder="PIN Lomba / Master..." value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
              </div>
            </div>
            <button onClick={handleLogin} className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black text-lg shadow-2xl hover:bg-black transition-all active:scale-95 uppercase tracking-widest">Masuk Cloud</button>
            <div className="text-[9px] text-center font-bold text-slate-300 uppercase tracking-widest">Pusat Database Online</div>
          </div>
        </div>
        {dialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[2.5rem] max-w-sm text-center shadow-2xl animate-in zoom-in">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600"><AlertCircle size={32}/></div>
              <h3 className="text-xl font-black uppercase mb-2">{dialog.title}</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">{dialog.message}</p>
              <button onClick={closeDialog} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs">Mengerti</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans selection:bg-blue-100">
      
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-[#0b1120] text-slate-300 flex flex-col shrink-0 z-20 h-screen overflow-hidden shadow-2xl">
        <div className="flex flex-col gap-4 p-6 border-b border-white/10">
          {role === 'master' && (
            <button onClick={() => { setActiveMeetId(null); setSuperView('meets'); }} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition">
              <ArrowLeft size={12}/> Kembali ke Daftar Lomba
            </button>
          )}
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg"><Cloud size={24} className="text-white" /></div>
            <div>
              <h1 className="text-xl font-black text-white uppercase truncate max-w-[130px]">{meetInfo?.name || "Master"}</h1>
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest mt-1 block">✓ Terkoneksi Cloud</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {activeMeetId === null ? (
            <>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-2">Manajemen Cloud</div>
              <NavItem active={superView === 'meets'} icon={<List size={18}/>} label="Daftar Kejuaraan" onClick={() => setSuperView('meets')} />
              <NavItem active={superView === 'main_db'} icon={<Database size={18}/>} label="Database Induk" onClick={() => setSuperView('main_db')} />
            </>
          ) : (
            <>
              <NavItem active={activeTab === 'dashboard'} icon={<Layout size={18}/>} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
              {role === 'master' && (
                <>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-8 mb-3 ml-2">Pre-Meet</div>
                  <NavItem active={activeTab === 'master-setup'} icon={<Settings size={18}/>} label="1. Setup & Events" onClick={() => setActiveTab('master-setup')} />
                  <NavItem active={activeTab === 'teams'} icon={<Flag size={18}/>} label="2. Tim" onClick={() => setActiveTab('teams')} />
                  <NavItem active={activeTab === 'athletes'} icon={<Users size={18}/>} label="3. Atlet" onClick={() => setActiveTab('athletes')} />
                  <NavItem active={activeTab === 'entries'} icon={<Edit3 size={18}/>} label="4. Entries" onClick={() => setActiveTab('entries')} />
                  <NavItem active={activeTab === 'seeding'} icon={<Share2 size={18}/>} label="5. Seeding" onClick={() => setActiveTab('seeding')} />
                </>
              )}
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-8 mb-3 ml-2">Meet Day</div>
              <NavItem active={activeTab === 'admin-panel'} icon={<PlayCircle size={18}/>} label="6. Run (Meja Juri)" onClick={() => setActiveTab('admin-panel')} />
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-8 mb-3 ml-2">Post-Meet</div>
              <NavItem active={activeTab === 'leaderboard'} icon={<FileText size={18}/>} label="7. Reports" onClick={() => setActiveTab('leaderboard')} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          {role === 'master' && activeMeetId === null && (
            <button onClick={() => setShowChangePinModal(true)} className="w-full flex items-center gap-3 p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all font-bold text-sm">
              <Lock size={18} /> Ubah PIN Master
            </button>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all font-bold text-sm">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto h-screen p-6 md:p-12 relative">
        <div className="absolute top-0 left-0 w-full h-64 bg-slate-900 -z-10 rounded-b-[4rem]"></div>
        
        {activeMeetId === null ? (
          superView === 'main_db' ? renderMainDatabase() : renderSuperuserDashboard()
        ) : (
          <div className="p-6 bg-white rounded-3xl shadow-xl min-h-[400px]">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'master-setup' && renderMasterSetup()}
            {activeTab === 'teams' && renderTeams()}
            {activeTab === 'athletes' && renderAthletes()}
            {activeTab === 'entries' && renderEntries()}
            {activeTab === 'seeding' && renderSeedingModule()}
            {activeTab === 'admin-panel' && renderAdminPanel()}
            {activeTab === 'leaderboard' && renderLeaderboard()}
          </div>
        )}
      </div>
      
      {/* Create Meet Modal */}
      {showNewMeetModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <form onSubmit={createNewMeet} className="bg-white w-full max-w-lg rounded-[2rem] p-10 shadow-2xl animate-in zoom-in">
            <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter text-slate-800">Buat Kejuaraan Cloud</h3>
            <div className="space-y-4">
              <input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Nama Kejuaraan" value={newMeetForm.name} onChange={e => setNewMeetForm({...newMeetForm, name: e.target.value})} />
              <input type="date" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required value={newMeetForm.date} onChange={e => setNewMeetForm({...newMeetForm, date: e.target.value})} />
              <input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Lokasi Kolam" value={newMeetForm.location} onChange={e => setNewMeetForm({...newMeetForm, location: e.target.value})} />
              <div className="flex gap-2 pt-6">
                <button type="button" onClick={()=>setShowNewMeetModal(false)} className="flex-1 p-4 rounded-2xl font-black uppercase text-slate-500 hover:bg-slate-100 transition">Batal</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 transition active:scale-95">Deploy ke Cloud</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Editor Poin Standar & Alternatif Modal */}
      {editingPointsType && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9990] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in border border-slate-100 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="shrink-0 mb-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Edit Poin {editingPointsType === 'standard' ? 'Standar' : 'Alternatif'}</h3>
                <p className="text-slate-400 text-sm font-medium">Tentukan perolehan poin untuk juara 1 hingga peringkat ke 20.</p>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                {tempPoints.map((pts, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Juara {idx + 1}</label>
                        <input type="number" className="w-full p-2 bg-white border rounded-lg font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none" value={pts} onChange={(e) => {
                            const newPts = [...tempPoints];
                            newPts[idx] = e.target.value;
                            setTempPoints(newPts);
                        }} />
                    </div>
                ))}
            </div>
            <div className="flex gap-4 pt-6 mt-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setEditingPointsType(null)} className="flex-1 p-4 rounded-2xl font-black uppercase text-slate-500 hover:bg-slate-100 transition">Batal</button>
              <button onClick={handleSavePoints} className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black uppercase hover:bg-blue-700 shadow-xl shadow-blue-200 transition active:scale-95">Simpan Poin</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Export Psych Sheet */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9990] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in border border-slate-100">
            <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter text-slate-800">Export Psych Sheet</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">Unduh daftar seluruh atlet beserta entry time mereka yang diurutkan berdasarkan event (Daftar Start / Entry List).</p>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Tipe Laporan</label>
                <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700" value={exportMode} onChange={e => setExportMode(e.target.value)}>
                  <option value="overall">Data Keseluruhan (Urut Berdasarkan Event)</option>
                  <option value="per_team">Data Per Tim (Dikelompokkan Per Kontingen)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleExportPsychSheet(exportMode, 'pdf')} className="bg-red-600 text-white p-4 rounded-2xl font-black uppercase shadow-xl shadow-red-200 hover:bg-red-700 transition active:scale-95 flex items-center justify-center gap-2"><FileText size={18}/> Format PDF</button>
                <button onClick={() => handleExportPsychSheet(exportMode, 'xlsx')} className="bg-emerald-600 text-white p-4 rounded-2xl font-black uppercase shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition active:scale-95 flex items-center justify-center gap-2"><Layout size={18}/> Format Excel</button>
              </div>
              <button onClick={() => setShowExportModal(false)} className="w-full p-4 rounded-2xl font-black uppercase text-slate-500 hover:bg-slate-100 transition mt-2">Batal</button>
            </div>
          </div>
        </div>
      )}

      { }
      {/* Change PIN Master Modal */}
      {showChangePinModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-10 shadow-2xl animate-in zoom-in border border-slate-100">
            <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter text-slate-800">Ubah PIN Master</h3>
            <div className="space-y-4">
              <input type="password" id="newMasterPin" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="PIN Master Baru" />
              <div className="flex gap-2 pt-6">
                <button type="button" onClick={() => setShowChangePinModal(false)} className="flex-1 p-4 rounded-2xl font-black uppercase text-slate-500 hover:bg-slate-100 transition">Batal</button>
                <button type="button" onClick={() => {
                  const val = document.getElementById('newMasterPin').value;
                  if (val) {
                    setMasterPassword(val);
                    setShowChangePinModal(false);
                    showDialog("Sukses", "PIN Master berhasil diperbarui secara lokal!", "success");
                  } else {
                    showDialog("Gagal", "PIN tidak boleh kosong.", "error");
                  }
                }} className="flex-1 bg-blue-600 text-white p-4 rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 transition">Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialog && renderDialog()}
    </div>
  );
};

const NavItem = ({ active, icon, label, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
    {icon} <span className="font-semibold text-sm tracking-wide">{label}</span>
  </button>
);

export default App;