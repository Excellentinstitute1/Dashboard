// REPLACE WITH YOUR GOOGLE WEB APP URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbxFsBuyiWOdTMMGeOgTXhvSmAfUK_uMbdwVO945ejPvnsEOQtX9ZtMCh9RQtBWzHSVj/exec";

let appState = { role: null, currentUser: null, authString: "" };
let appData = { students: [], transactions: [], stats: { income: 0, expense: 0, balance: 0 }, notices: [] };
let analyticsChartInstance = null;

// Ensure default date on load & trigger boot logic
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];
    bootApplication();
});

function bootApplication() {
    const savedRole = localStorage.getItem("ei_role");
    const savedPinEnabled = localStorage.getItem("ei_usePin") === "true";
    const savedAuth = localStorage.getItem("ei_auth"); // used for auto-login
    
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('opacity-0');
        setTimeout(() => {
            document.getElementById('splash-screen').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden-initially');
            
            if (savedPinEnabled && savedRole) {
                document.getElementById('panel-standard-login').classList.add('hidden');
                document.getElementById('panel-pin-login').classList.remove('hidden');
                document.getElementById('pin-welcome-text').innerText = `Welcome, ${savedRole.charAt(0).toUpperCase() + savedRole.slice(1)}`;
            } else if (savedAuth) {
                // Auto-login flow could be placed here, but forcing standard login is safer unless PIN is used.
                // For this request, we'll let them login normally if no PIN is set.
            }
        }, 300);
    }, 1500); // Initial logo splash duration
}

function showLoader() { document.getElementById('splash-screen').classList.remove('hidden'); document.getElementById('splash-screen').classList.remove('opacity-0'); }
function hideLoader() { document.getElementById('splash-screen').classList.add('opacity-0'); setTimeout(()=>document.getElementById('splash-screen').classList.add('hidden'), 300); }

// --- Login Handlers ---
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const userid = document.getElementById('userid').value.trim();
    const pass = document.getElementById('password').value.trim();
    const remember = document.getElementById('remember-me').checked;
    
    document.getElementById('login-error').classList.add('hidden');
    showLoader();

    try {
        const response = await fetch(`${GAS_URL}?action=login&id=${encodeURIComponent(userid)}&pass=${encodeURIComponent(pass)}`);
        const result = await response.json();
        
        if (result.error) {
            hideLoader(); document.getElementById('login-error').innerText = result.error; document.getElementById('login-error').classList.remove('hidden');
        } else {
            appState.role = result.role; appData = result.data; appState.currentUser = result.userProfile; appState.authString = pass;
            
            if (remember) {
                localStorage.setItem("ei_role", result.role);
                localStorage.setItem("ei_auth", pass); // Store for future PIN setups
            }
            setupApplicationUI(); hideLoader();
        }
    } catch (error) { hideLoader(); document.getElementById('login-error').classList.remove('hidden'); }
});

// PIN Login
document.getElementById('pin-login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const pin = document.getElementById('pin-input').value;
    const role = localStorage.getItem("ei_role");
    
    document.getElementById('pin-error').classList.add('hidden');
    showLoader();

    try {
        const response = await fetch(`${GAS_URL}?action=verifyPin&role=${role}&pin=${pin}`);
        const result = await response.json();
        
        if (result.error) {
            hideLoader(); document.getElementById('pin-error').classList.remove('hidden'); document.getElementById('pin-input').value = '';
        } else {
            appState.role = result.role; appData = result.data; 
            setupApplicationUI(); hideLoader();
        }
    } catch (error) { hideLoader(); document.getElementById('pin-error').classList.remove('hidden'); }
});

function setupApplicationUI() {
    // Reveal app structure
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.add('flex');

    // Role-specific UI
    document.getElementById('nav-analytics-btn').style.display = (appState.role === 'admin') ? 'flex' : 'none';
    document.getElementById('nav-students-btn').style.display = (appState.role === 'student') ? 'none' : 'flex';
    document.getElementById('admin-staff-modules').style.display = (appState.role === 'student') ? 'none' : 'block';
    
    if (appState.role === 'admin' || appState.role === 'staff') {
        document.getElementById('btn-setup-pin').classList.remove('hidden');
        updateDashboardFinancials(); checkDuesSilently(); switchTab('dashboard');
    } else {
        renderStudentDashboard(); switchTab('student-dash');
    }
}

// --- Navigation & Splash Transition ---
function switchTab(tabId) {
    // Quick flash transition
    document.getElementById('splash-screen').classList.remove('hidden');
    document.getElementById('splash-screen').classList.remove('opacity-0');
    
    setTimeout(() => {
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('#bottom-nav .nav-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`view-${tabId}`).classList.add('active');
        
        const titles = {
            'dashboard': {title: 'Dashboard', sub: 'Financial Overview', nav: 0},
            'students': {title: 'Students', sub: 'Database', nav: 1},
            'analytics': {title: 'Analytics', sub: 'P&L Chart', nav: 2},
            'admission': {title: 'New Admission', sub: 'Add Student', nav: -1},
            'job': {title: 'Job Desk', sub: 'Applications', nav: -1},
            'print': {title: 'Print Desk', sub: 'Revenue', nav: -1},
            'expense': {title: 'Expenditure', sub: 'Deductions', nav: -1},
            'student-dash': {title: 'My Profile', sub: 'Student Portal', nav: 0}
        };
        
        if(titles[tabId]) {
            document.getElementById('page-title').innerText = titles[tabId].title;
            document.getElementById('page-subtitle').innerText = titles[tabId].sub;
            if(titles[tabId].nav >= 0) document.querySelectorAll('#bottom-nav .nav-btn')[titles[tabId].nav].classList.add('active');
        }

        if(tabId === 'students') renderStudents();
        if(['job','print','expense'].includes(tabId)) renderList(tabId);
        if(tabId === 'analytics') renderChart();

        document.getElementById('splash-screen').classList.add('opacity-0');
        setTimeout(() => document.getElementById('splash-screen').classList.add('hidden'), 200);
    }, 150);
}

// --- Detail Renderers ---
function updateDashboardFinancials() {
    document.getElementById('dash-balance').innerText = `₹${appData.stats.balance}`;
    document.getElementById('dash-income').innerText = `₹${appData.stats.income}`;
    document.getElementById('dash-expense').innerText = `₹${appData.stats.expense}`;
}

function checkDuesSilently() {
    let count = 0; appData.students.forEach(st => { if((st.totalFee - st.paidFee) > 0) count++; });
    if(count > 0) document.getElementById('notif-dot').classList.remove('hidden');
}

function openNotificationModal() {
    const listEl = document.getElementById('notif-list-details'); listEl.innerHTML = '';
    let found = false;
    appData.students.forEach(st => {
        const dues = st.totalFee - st.paidFee;
        if(dues > 0) {
            found = true;
            listEl.innerHTML += `<div class="flex justify-between items-center py-3 border-b last:border-0"><div><p class="font-bold text-sm text-slate-800">${st.name}</p><p class="text-[10px] text-slate-500">${st.course}</p></div><p class="font-black text-rose-500">₹${dues}</p></div>`;
        }
    });
    if(!found) listEl.innerHTML = `<p class="text-center text-slate-400 text-sm py-4">No pending dues.</p>`;
    
    document.getElementById('modal-notifications').classList.remove('hidden');
    setTimeout(() => document.getElementById('notif-modal-content').classList.remove('translate-y-full'), 10);
}
function closeNotificationModal() { document.getElementById('notif-modal-content').classList.add('translate-y-full'); setTimeout(() => document.getElementById('modal-notifications').classList.add('hidden'), 300); }

// --- Settings & Auth ---
function openSettingsModal() { document.getElementById('modal-settings').classList.remove('hidden'); setTimeout(() => document.getElementById('settings-modal-content').classList.remove('translate-y-full'), 10); }
function closeSettingsModal() { document.getElementById('settings-modal-content').classList.add('translate-y-full'); setTimeout(() => document.getElementById('modal-settings').classList.add('hidden'), 300); }

async function promptSetPin() {
    closeSettingsModal();
    const pin = prompt("Enter a new 4-Digit PIN:");
    if(!pin || !/^\d{4}$/.test(pin)) return alert("Must be exactly 4 digits.");
    
    const masterPass = prompt("Enter Master Admin Password to authorize this change:");
    if(!masterPass) return;

    showLoader();
    try {
        const res = await fetch(GAS_URL, { method: 'POST', headers: {"Content-Type": "text/plain"}, body: JSON.stringify({action: 'setPin', role: appState.role, pin: pin, auth: masterPass}) });
        const result = await res.json();
        hideLoader();
        if(result.success) {
            localStorage.setItem("ei_usePin", "true");
            alert("PIN saved successfully. You can use it on your next login.");
        } else { alert(result.error); }
    } catch(e) { hideLoader(); alert("Network error saving PIN."); }
}

function clearSavedLogin() {
    localStorage.removeItem("ei_role"); localStorage.removeItem("ei_usePin"); localStorage.removeItem("ei_auth");
    window.location.reload(); // Reload cleans memory and resets view completely
}

// --- Render Functions (Same secure logic as previous) ---
function renderStudents() {
    const query = (document.getElementById('student-search').value || '').toLowerCase();
    const listEl = document.getElementById('student-list'); listEl.innerHTML = '';
    const filtered = appData.students.filter(s => s.name.toLowerCase().includes(query) || s.phone.includes(query));
    if (filtered.length === 0) return listEl.innerHTML = '<p class="text-center text-slate-400 p-4 text-xs">No students found.</p>';
    filtered.forEach(st => {
        const dues = st.totalFee - st.paidFee;
        listEl.innerHTML += `<div class="premium-card p-3 flex justify-between items-center"><div class="flex items-center"><div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg mr-3 shadow-inner">${st.name.charAt(0).toUpperCase()}</div><div><p class="font-bold text-sm text-slate-800">${st.name}</p><p class="text-[10px] text-slate-500">${st.phone} • ${st.course}</p></div></div><div class="text-right"><p class="font-black text-sm ${dues > 0 ? 'text-rose-500' : 'text-emerald-500'}">₹${dues}</p></div></div>`;
    });
}

function renderList(type) {
    const listEl = document.getElementById(`${type}-list`); listEl.innerHTML = '';
    let f = []; if(type==='job') f=appData.transactions.filter(t=>t.title.includes('Job Desk')); if(type==='print') f=appData.transactions.filter(t=>t.title.includes('Print Desk')); if(type==='expense') f=appData.transactions.filter(t=>t.type==='expense');
    if(f.length===0) return listEl.innerHTML = `<p class="text-xs text-center text-slate-400 mt-4">No records.</p>`;
    f.slice().reverse().slice(0, 15).forEach(tx => {
        listEl.innerHTML += `<div class="flex justify-between items-center p-3 bg-white border rounded-xl shadow-sm mb-2"><div><p class="font-bold text-sm text-slate-800">${tx.title.replace('Job Desk: ','').replace('Print Desk: ','')}</p><p class="text-[10px] text-slate-400">${tx.date}</p></div><p class="font-black ${tx.type==='income'?'text-emerald-600':'text-rose-600'}">${tx.type==='income'?'+':'-'}₹${tx.amount}</p></div>`;
    });
}

function renderStudentDashboard() {
    const st = appState.currentUser;
    document.getElementById('stu-name').innerText = st.name; document.getElementById('stu-avatar').innerText = st.name.charAt(0).toUpperCase(); document.getElementById('stu-course').innerText = st.course;
    const dues = st.totalFee - st.paidFee; document.getElementById('stu-due-amount').innerText = `₹${dues}`; document.getElementById('stu-due-amount').style.color = dues > 0 ? '#f43f5e' : '#10b981';
}

function renderChart() {
    if(analyticsChartInstance) analyticsChartInstance.destroy();
    let incMap = {}, expMap = {};
    appData.transactions.forEach(tx => {
        let m = tx.date.substring(0,7);
        if(tx.type==='income') incMap[m] = (incMap[m]||0) + parseFloat(tx.amount);
        if(tx.type==='expense') expMap[m] = (expMap[m]||0) + parseFloat(tx.amount);
    });
    let labels = Object.keys(incMap).concat(Object.keys(expMap)).filter((v,i,a)=>a.indexOf(v)===i).sort().slice(-6);
    analyticsChartInstance = new Chart(document.getElementById('analyticsChart').getContext('2d'), { type: 'bar', data: { labels: labels.length ? labels : ['No Data'], datasets: [{ label: 'Income', data: labels.map(l=>incMap[l]||0), backgroundColor: '#10b981', borderRadius: 4 }, { label: 'Expense', data: labels.map(l=>expMap[l]||0), backgroundColor: '#f43f5e', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false } });
}
