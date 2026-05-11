// REPLACE WITH YOUR GOOGLE WEB APP URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbxFsBuyiWOdTMMGeOgTXhvSmAfUK_uMbdwVO945ejPvnsEOQtX9ZtMCh9RQtBWzHSVj/exec";

let appState = { 
    actualRole: null,   // What they ACTUALLY logged in as ('admin', 'staff', 'student')
    currentRole: null,  // What they are CURRENTLY viewing as
    currentUser: null,  // Profile object for student view
    password: "" 
};

let appData = { students: [], transactions: [], stats: { income: 0, expense: 0, balance: 0 }, notices: [] };
let analyticsChartInstance = null;

// Ensure default date on load
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];
});

// --- UI Helpers ---
function showLoader(text="Loading...") { document.getElementById('loader-text').innerText = text; document.getElementById('loader').classList.remove('hidden'); document.getElementById('loader').classList.add('flex'); }
function hideLoader() { document.getElementById('loader').classList.add('hidden'); document.getElementById('loader').classList.remove('flex'); }

function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`view-${tabId}`).classList.add('active');
    
    // Bottom nav highlighting & titles
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
        if(titles[tabId].nav >= 0) {
            document.querySelectorAll('#bottom-nav .nav-btn')[titles[tabId].nav].classList.add('active');
        }
    }

    // Refresh specific data when tab opens
    if(tabId === 'students') renderStudents();
    if(tabId === 'job') renderList('job');
    if(tabId === 'print') renderList('print');
    if(tabId === 'expense') renderList('expense');
    if(tabId === 'analytics') renderChart();
}

// --- Login & Role Routing ---
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const userid = document.getElementById('userid').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    document.getElementById('login-error').classList.add('hidden');
    showLoader("Authenticating...");

    try {
        const response = await fetch(`${GAS_URL}?action=login&id=${encodeURIComponent(userid)}&pass=${encodeURIComponent(pass)}`);
        const result = await response.json();
        
        if (result.error) {
            hideLoader();
            document.getElementById('login-error').innerText = result.error;
            document.getElementById('login-error').classList.remove('hidden');
        } else {
            appState.actualRole = result.role;
            appState.currentRole = result.role; // Default view is actual view
            appState.password = pass;
            appData = result.data;
            appState.currentUser = result.userProfile;
            
            setupApplicationUI();
            hideLoader();
        }
    } catch (error) {
        hideLoader();
        document.getElementById('login-error').innerText = "Network error. Check connection.";
        document.getElementById('login-error').classList.remove('hidden');
    }
});

function setupApplicationUI() {
    // Hide login, show main app
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.add('flex');

    // Admin specific controls
    if(appState.actualRole === 'admin') {
        document.getElementById('btn-admin-view').classList.remove('hidden');
        populatePreviewList();
    }

    routeCurrentView();
}

function routeCurrentView() {
    const role = appState.currentRole;
    
    // Hide/Show specific Nav buttons based on role
    document.getElementById('nav-analytics-btn').style.display = (role === 'admin') ? 'flex' : 'none';
    document.getElementById('nav-students-btn').style.display = (role === 'student') ? 'none' : 'flex';

    if (role === 'admin') {
        document.getElementById('admin-broadcast-panel').classList.remove('hidden');
        updateDashboardFinancials();
        switchTab('dashboard');
    } else if (role === 'staff') {
        document.getElementById('admin-broadcast-panel').classList.add('hidden');
        updateDashboardFinancials();
        switchTab('dashboard');
    } else if (role === 'student') {
        renderStudentDashboard();
        switchTab('student-dash');
    }
}

function updateDashboardFinancials() {
    document.getElementById('dash-balance').innerText = `₹${appData.stats.balance.toLocaleString('en-IN')}`;
    document.getElementById('dash-income').innerText = `₹${appData.stats.income.toLocaleString('en-IN')}`;
    document.getElementById('dash-expense').innerText = `₹${appData.stats.expense.toLocaleString('en-IN')}`;
}

// --- Admin "View As" Feature ---
function populatePreviewList() {
    const select = document.getElementById('preview-student-select');
    select.innerHTML = '<option disabled selected>Select a Student...</option>';
    appData.students.forEach((st, index) => {
        select.innerHTML += `<option value="${index}">${st.name} (${st.course})</option>`;
    });
}

function openViewSwitcher() { document.getElementById('view-switcher-modal').classList.remove('hidden'); }
function closeViewSwitcher() { document.getElementById('view-switcher-modal').classList.add('hidden'); }

function changeAdminView(targetRole) {
    appState.currentRole = targetRole;
    
    if (targetRole === 'student') {
        const index = document.getElementById('preview-student-select').value;
        if (index === "" || index === "Select a Student...") return alert("Please select a student.");
        appState.currentUser = appData.students[index];
    }
    
    closeViewSwitcher();
    document.getElementById('admin-view-banner').classList.remove('hidden');
    routeCurrentView();
}

function exitAdminPreview() {
    appState.currentRole = 'admin';
    appState.currentUser = null;
    document.getElementById('admin-view-banner').classList.add('hidden');
    routeCurrentView();
}

function logout() {
    appState = { actualRole: null, currentRole: null, currentUser: null, password: "" };
    document.getElementById('userid').value = ""; document.getElementById('password').value = "";
    
    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
    document.getElementById('bottom-nav').classList.remove('flex');
    document.getElementById('admin-view-banner').classList.add('hidden');
    document.getElementById('btn-admin-view').classList.add('hidden');
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-login').classList.add('active');
}

// --- Secure Database Sync ---
async function syncDatabase(actionDesc) {
    if (appState.actualRole !== 'admin') { alert("Action Denied: View Only Mode."); return false; }
    showLoader("Syncing Database...");
    
    const payload = { password: "admin", data: appData }; // Your requested hardcoded admin pass for changes
    
    try {
        const response = await fetch(GAS_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
        const result = await response.json();
        hideLoader();
        if (result.error) { alert("Server Error: " + result.error); return false; }
        return true;
    } catch (error) {
        hideLoader(); alert("Network error. Sync failed."); return false;
    }
}

// --- Modules Logic ---

// Recalculate global stats
function recalcStats() {
    appData.stats.income = 0; appData.stats.expense = 0;
    appData.transactions.forEach(tx => {
        if(tx.type === 'income') appData.stats.income += parseFloat(tx.amount);
        if(tx.type === 'expense') appData.stats.expense += parseFloat(tx.amount);
    });
    appData.stats.balance = appData.stats.income - appData.stats.expense;
    updateDashboardFinancials();
}

// 1. Admission
document.getElementById('admission-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if(appState.actualRole !== 'admin') return alert("Admin access required.");
    
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const course = document.getElementById('reg-course').value;
    const totalFee = parseFloat(document.getElementById('reg-fee').value);
    const advancePaid = parseFloat(document.getElementById('reg-paid').value);
    const dateStr = document.getElementById('reg-date').value;
    
    const stId = 'STU' + Math.floor(Math.random() * 90000 + 10000);
    appData.students.unshift({ id: stId, name: name, course: course, totalFee: totalFee, paidFee: advancePaid, phone: phone, date: dateStr });
    
    if (advancePaid > 0) {
        appData.transactions.push({ id: 'TXN'+Math.floor(Math.random()*90000+10000), type: "income", title: `Admission - ${name}`, amount: advancePaid, date: dateStr });
    }
    
    recalcStats();
    if(await syncDatabase("Add Student")) {
        alert(`Registered! Pass: EI${name.split(' ')[0]}${dateStr.substring(0,4)}`);
        this.reset(); document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];
        switchTab('students');
    }
});

// 2. Job Desk
document.getElementById('job-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if(appState.actualRole !== 'admin') return alert("Admin access required.");
    const amount = parseFloat(document.getElementById('job-amount').value);
    appData.transactions.push({ id: 'TXN'+Date.now(), type: "income", title: `Job Desk: ${document.getElementById('job-name').value}`, description: document.getElementById('job-post').value, amount: amount, date: new Date().toISOString().split('T')[0] });
    recalcStats();
    if(await syncDatabase("Job Entry")) { this.reset(); renderList('job'); }
});

// 3. Print Desk
document.getElementById('print-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if(appState.actualRole !== 'admin') return alert("Admin access required.");
    const amount = parseFloat(document.getElementById('print-amount').value);
    appData.transactions.push({ id: 'TXN'+Date.now(), type: "income", title: `Print Desk: ${document.getElementById('print-service').value}`, amount: amount, date: new Date().toISOString().split('T')[0] });
    recalcStats();
    if(await syncDatabase("Print Entry")) { this.reset(); renderList('print'); }
});

// 4. Expenses
document.getElementById('expense-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if(appState.actualRole !== 'admin') return alert("Admin access required.");
    const amount = parseFloat(document.getElementById('exp-amount').value);
    appData.transactions.push({ id: 'TXN'+Date.now(), type: "expense", title: document.getElementById('exp-category').value, amount: amount, date: new Date().toISOString().split('T')[0] });
    recalcStats();
    if(await syncDatabase("Expense Entry")) { this.reset(); renderList('expense'); }
});

// Generic List Renderer (Jobs, Prints, Expenses)
function renderList(type) {
    const listEl = document.getElementById(`${type}-list`);
    listEl.innerHTML = '';
    
    let filtered = [];
    if(type === 'job') filtered = appData.transactions.filter(t => t.title.includes('Job Desk'));
    if(type === 'print') filtered = appData.transactions.filter(t => t.title.includes('Print Desk'));
    if(type === 'expense') filtered = appData.transactions.filter(t => t.type === 'expense');

    if(filtered.length === 0) { listEl.innerHTML = `<p class="text-xs text-center text-slate-400 mt-4">No recent records.</p>`; return; }

    filtered.slice().reverse().slice(0, 15).forEach(tx => {
        const isInc = tx.type === 'income';
        const color = isInc ? 'text-emerald-600' : 'text-rose-600';
        const sign = isInc ? '+' : '-';
        listEl.innerHTML += `
            <div class="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <div><p class="font-bold text-sm text-slate-800">${tx.title.replace('Job Desk: ', '').replace('Print Desk: ', '')}</p><p class="text-[10px] text-slate-400">${tx.date}</p></div>
                <p class="font-black ${color}">${sign}₹${tx.amount}</p>
            </div>
        `;
    });
}

// 5. Broadcast Notice
async function sendBroadcast() {
    if(appState.actualRole !== 'admin') return alert("Admin access required.");
    const title = document.getElementById('bc-title').value; const msg = document.getElementById('bc-msg').value;
    if(!title || !msg) return alert("Enter both title and message.");
    
    if(!appData.notices) appData.notices = [];
    appData.notices.unshift({ title: title, message: msg, date: new Date().toLocaleDateString('en-IN') });
    
    if(await syncDatabase("Broadcast Notice")) {
        alert("Notice sent to all students!"); document.getElementById('bc-title').value = ''; document.getElementById('bc-msg').value = '';
    }
}

// 6. View Renderers (Students & Student Dash)
function renderStudents() {
    const query = (document.getElementById('student-search').value || '').toLowerCase();
    const listEl = document.getElementById('student-list');
    listEl.innerHTML = '';
    
    const filtered = appData.students.filter(s => s.name.toLowerCase().includes(query) || s.phone.includes(query));
    if (filtered.length === 0) { listEl.innerHTML = '<p class="text-center text-slate-400 p-4 text-xs">No students found.</p>'; return; }

    filtered.forEach(st => {
        const dues = st.totalFee - st.paidFee;
        const dueColor = dues > 0 ? 'text-rose-500' : 'text-emerald-500';
        listEl.innerHTML += `
            <div class="premium-card p-3 flex justify-between items-center">
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg mr-3 shadow-inner">${st.name.charAt(0).toUpperCase()}</div>
                    <div><p class="font-bold text-sm text-slate-800">${st.name}</p><p class="text-[10px] text-slate-500">${st.phone} • ${st.course}</p></div>
                </div>
                <div class="text-right"><p class="text-[9px] font-bold text-slate-400 uppercase">Due</p><p class="font-black text-sm ${dueColor}">₹${dues}</p></div>
            </div>`;
    });
}

function renderStudentDashboard() {
    const student = appState.currentUser;
    document.getElementById('stu-name').innerText = student.name;
    document.getElementById('stu-avatar').innerText = student.name.charAt(0).toUpperCase();
    document.getElementById('stu-course').innerText = student.course;
    document.getElementById('stu-date').innerText = student.date;
    
    const dues = student.totalFee - student.paidFee;
    const dueEl = document.getElementById('stu-due-amount');
    const dueCard = document.getElementById('stu-due-card');
    
    dueEl.innerText = `₹${dues}`;
    if(dues > 0) { dueEl.style.color = '#f43f5e'; dueCard.style.borderLeftColor = '#f43f5e'; } 
    else { dueEl.style.color = '#10b981'; dueCard.style.borderLeftColor = '#10b981'; dueEl.innerText = "Cleared"; }

    const noticesEl = document.getElementById('stu-notices');
    noticesEl.innerHTML = '';
    if(appData.notices && appData.notices.length > 0) {
        appData.notices.forEach(n => {
            noticesEl.innerHTML += `<div class="border-b border-slate-100 last:border-0 pb-2 mb-2 last:pb-0 last:mb-0"><h4 class="text-sm font-bold text-indigo-600">${n.title}</h4><p class="text-xs text-slate-600 mt-1">${n.message}</p><p class="text-[9px] text-slate-400 mt-1">${n.date}</p></div>`;
        });
    } else { noticesEl.innerHTML = '<p class="text-slate-400 text-xs text-center">No notices.</p>'; }
}

// 7. Analytics Chart
function renderChart() {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    if(analyticsChartInstance) analyticsChartInstance.destroy();
    
    // Group last 6 months logic (simplified for immediate render)
    let incMap = {}, expMap = {};
    appData.transactions.forEach(tx => {
        let month = tx.date.substring(0,7); // YYYY-MM
        if(tx.type === 'income') incMap[month] = (incMap[month]||0) + parseFloat(tx.amount);
        if(tx.type === 'expense') expMap[month] = (expMap[month]||0) + parseFloat(tx.amount);
    });

    let labels = Object.keys(incMap).concat(Object.keys(expMap)).filter((v,i,a) => a.indexOf(v)===i).sort().slice(-6); // last 6 active months
    let incData = labels.map(l => incMap[l]||0);
    let expData = labels.map(l => expMap[l]||0);

    analyticsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No Data'],
            datasets: [
                { label: 'Income', data: incData.length ? incData : [0], backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'Expense', data: expData.length ? expData : [0], backgroundColor: '#f43f5e', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
    });
}

// Hourly notification check
function checkDues() {
    if(appState.actualRole !== 'admin') return;
    let dueCount = 0; appData.students.forEach(st => { if((st.totalFee - st.paidFee) > 0) dueCount++; });
    if(dueCount > 0) { document.getElementById('notif-dot').classList.remove('hidden'); alert(`Alert: ${dueCount} students have pending dues.`); } 
    else { document.getElementById('notif-dot').classList.add('hidden'); alert("All clear! No pending dues."); }
}
setInterval(checkDues, 3600000);
