// REPLACE WITH YOUR GOOGLE WEB APP URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbxFsBuyiWOdTMMGeOgTXhvSmAfUK_uMbdwVO945ejPvnsEOQtX9ZtMCh9RQtBWzHSVj/exec";

let appState = { role: null, currentUser: null };
let appData = { students: [], transactions: [], stats: { income: 0, expense: 0, balance: 0 }, notices: [] };

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];
});

function showLoader(text="Loading...") { document.getElementById('loader-text').innerText = text; document.getElementById('loader').style.display = 'flex'; }
function hideLoader() { document.getElementById('loader').style.display = 'none'; }

// 1. Unified Login Execution
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const userid = document.getElementById('userid').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    document.getElementById('login-error').style.display = 'none';
    showLoader("Authenticating via Database...");

    try {
        const response = await fetch(`${GAS_URL}?action=login&id=${encodeURIComponent(userid)}&pass=${encodeURIComponent(pass)}`);
        const result = await response.json();
        
        if (result.error) {
            hideLoader();
            document.getElementById('login-error').innerText = result.error;
            document.getElementById('login-error').style.display = 'block';
        } else {
            appState.role = result.role;
            appData = result.data;
            appState.currentUser = result.userProfile;
            routeUser();
            hideLoader();
        }
    } catch (error) {
        hideLoader();
        document.getElementById('login-error').innerText = "Network error. Check connection.";
        document.getElementById('login-error').style.display = 'block';
    }
});

function routeUser() {
    if (appState.role === 'admin') {
        document.getElementById('welcome-text').innerText = "Admin Dashboard";
        document.getElementById('admin-broadcast-panel').style.display = 'block';
        document.getElementById('admin-controls').style.display = 'block';
        document.getElementById('financial-stats').style.display = 'grid';
        updateFinancials();
        switchTab('dashboard');
    } else if (appState.role === 'staff') {
        document.getElementById('welcome-text').innerText = "Staff View (Read Only)";
        document.getElementById('admin-broadcast-panel').style.display = 'none';
        document.getElementById('admin-controls').style.display = 'none'; 
        document.getElementById('financial-stats').style.display = 'grid';
        updateFinancials();
        switchTab('dashboard');
    } else if (appState.role === 'student') {
        renderStudentDashboard();
        switchTab('student-dash');
    }
}

// 2. Secured Saving Logic (Requires 'admin' password)
async function syncDatabaseToCloud(actionDescription) {
    if (appState.role !== 'admin') {
        alert("Action Denied: Only Admins can modify the database.");
        return;
    }

    // Checking the hardcoded rule: "password : admin"
    let writePass = sessionStorage.getItem("writeAuth");
    if (!writePass) {
        writePass = prompt(`Security Verification required for: ${actionDescription}\nEnter Admin Modification Password:`);
        if (writePass !== "admin") {
            alert("Incorrect Password. Changes dropped.");
            return;
        }
        sessionStorage.setItem("writeAuth", writePass); // Cache for session
    }

    showLoader("Syncing Changes securely...");
    const payload = { password: writePass, data: appData };

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.error) { alert("Server Error: " + result.error); sessionStorage.removeItem("writeAuth"); }
    } catch (error) {
        alert("Network error. Database sync failed.");
    }
    hideLoader();
}

function updateFinancials() {
    document.getElementById('dash-balance').innerText = "₹" + appData.stats.balance.toLocaleString('en-IN');
}

// 3. New Admission Logic
document.getElementById('admission-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if(appState.role !== 'admin') { alert("Only Admin can add students."); return; }

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
        appData.stats.balance += advancePaid;
        appData.stats.income += advancePaid;
    }

    updateFinancials();
    await syncDatabaseToCloud("Adding New Student");
    
    alert(`Success! Student Password auto-generated as: EI${name.split(' ')[0]}${dateStr.substring(0,4)}`);
    document.getElementById('admission-form').reset();
    switchTab('students');
});

function sendBroadcast() {
    const title = document.getElementById('bc-title').value;
    const msg = document.getElementById('bc-msg').value;
    if(!title || !msg) return alert("Please enter title and message.");
    
    if(!appData.notices) appData.notices = [];
    appData.notices.unshift({ title: title, message: msg, date: new Date().toLocaleDateString('en-IN') });
    
    syncDatabaseToCloud("Broadcasting Notice").then(() => {
        alert("Notice sent to all students!");
        document.getElementById('bc-title').value = '';
        document.getElementById('bc-msg').value = '';
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
    if(dues > 0) {
        dueEl.style.color = 'var(--danger)'; dueCard.style.borderLeftColor = 'var(--danger)';
    } else {
        dueEl.style.color = 'var(--success)'; dueCard.style.borderLeftColor = 'var(--success)'; dueEl.innerText = "Cleared";
    }

    const noticesEl = document.getElementById('stu-notices');
    noticesEl.innerHTML = '';
    if(appData.notices && appData.notices.length > 0) {
        appData.notices.forEach(n => {
            noticesEl.innerHTML += `<div style="border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;"><h4 style="font-size:14px; color:var(--primary);">${n.title}</h4><p style="font-size:12px; margin-top:4px;">${n.message}</p><p style="font-size:10px; color:var(--text-muted); margin-top:4px;">${n.date}</p></div>`;
        });
    } else { noticesEl.innerHTML = '<p style="color:var(--text-muted); font-size:12px; text-align:center;">No new notices.</p>'; }
}

function renderStudents() {
    const listEl = document.getElementById('student-list');
    listEl.innerHTML = '';
    if (appData.students.length === 0) { listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No students registered yet.</div>'; return; }

    appData.students.forEach(st => {
        const dues = st.totalFee - st.paidFee;
        const dueColor = dues > 0 ? 'var(--danger)' : 'var(--success)';
        listEl.innerHTML += `<div class="student-item"><div style="display: flex; align-items: center;"><div class="student-avatar">${st.name.charAt(0).toUpperCase()}</div><div><p style="font-weight: bold; font-size: 14px;">${st.name}</p><p style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${st.phone} • ${st.course}</p></div></div><div style="text-align: right;"><p style="font-size: 10px; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">Due</p><p style="font-weight: 900; color: ${dueColor};">₹${dues}</p></div></div>`;
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`screen-${tabId}`).classList.add('active');
    
    if(tabId === 'dashboard') document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(tabId === 'students') { document.querySelectorAll('.nav-item')[1].classList.add('active'); renderStudents(); }
}

function logout() {
    appState = { role: null, currentUser: null }; sessionStorage.removeItem("writeAuth");
    document.getElementById('password').value = ""; document.getElementById('userid').value = ""; switchTab('login');
}

function checkDues() {
    if(appState.role !== 'admin') return;
    let dueCount = 0; appData.students.forEach(st => { if((st.totalFee - st.paidFee) > 0) dueCount++; });
    if(dueCount > 0) { document.querySelector('.notification-icon').classList.add('has-alert'); alert(`Attention: ${dueCount} students have pending dues.`); } 
    else { alert("All clear! No students have pending dues."); }
}
setInterval(checkDues, 3600000); // Hourly in-app check
