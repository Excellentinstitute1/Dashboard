/* ==========================================================================
   EXCELLENT INSTITUTE - CORE APPLICATION LOGIC
   Handles Auth, State, Routing, File Uploads, Syncing, and Rendering
   ========================================================================== */

// 🛑 REPLACE THIS WITH YOUR DEPLOYED GOOGLE APPS SCRIPT WEB APP URL
const GAS_URL = "https://script.google.com/macros/s/AKfycbxFsBuyiWOdTMMGeOgTXhvSmAfUK_uMbdwVO945ejPvnsEOQtX9ZtMCh9RQtBWzHSVj/exec";

// --- GLOBAL STATE ---
let appState = { 
    actualRole: null,   
    role: null,         
    actualUser: null,   
    currentUser: null,  
    authString: ""      
};

let appData = { 
    students: [], transactions: [], stats: { income: 0, expense: 0, balance: 0 }, 
    notices: [], materials: [], certificates: [] 
};
let analyticsChartInstance = null;

// ==========================================================================
// 1. BULLETPROOF PULL-TO-REFRESH KILLER (NATIVE APP FEEL)
// ==========================================================================
document.addEventListener('touchmove', function(event) {
    const isScrollable = event.target.closest('.content-area, .custom-scrollbar, [style*="overflow-y: auto"]');
    if (!isScrollable) {
        event.preventDefault(); 
    }
}, { passive: false });

// ==========================================================================
// 2. HELPER FUNCTIONS (Base64 File Encoding)
// ==========================================================================
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// ==========================================================================
// 3. BOOT SEQUENCE & SPLASH SCREEN
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];
    bootApplication();
});

function bootApplication() {
    const savedRole = localStorage.getItem("ei_role");
    const savedPinEnabled = localStorage.getItem("ei_usePin") === "true";
    
    setTimeout(() => {
        hideLoader(); 
        document.getElementById('app-container').classList.remove('hidden-initially');
        
        if (savedPinEnabled && savedRole) {
            document.getElementById('panel-standard-login').classList.add('hidden-initially');
            document.getElementById('panel-pin-login').classList.remove('hidden-initially');
            
            const formattedRole = savedRole.charAt(0).toUpperCase() + savedRole.slice(1);
            document.getElementById('pin-welcome-text').innerText = `Welcome, ${formattedRole}`;
        }
    }, 1500); 
}

function showLoader() { document.getElementById('global-loader').classList.remove('hide'); }
function hideLoader() { document.getElementById('global-loader').classList.add('hide'); }

function getDynamicPaidFee(student) {
    let total = 0;
    if (appData.transactions) {
        appData.transactions.forEach(tx => {
            if (tx.type === 'income' && !tx.title.includes('Job Desk:') && !tx.title.includes('Print Desk:')) {
                if (tx.title.includes(`[${student.id}]`) || tx.title.includes(student.name)) {
                    total += parseFloat(tx.amount) || 0;
                }
            }
        });
    }
    return Math.max(total, parseFloat(student.paidFee) || 0);
}

// ==========================================================================
// 4. AUTHENTICATION (STANDARD & PIN)
// ==========================================================================
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const userid = document.getElementById('userid').value.trim();
    const pass = document.getElementById('password').value.trim();
    const remember = document.getElementById('remember-me').checked;
    
    document.getElementById('login-error').classList.add('hidden-initially');
    showLoader();

    try {
        const response = await fetch(`${GAS_URL}?action=login&id=${encodeURIComponent(userid)}&pass=${encodeURIComponent(pass)}`);
        const result = await response.json();
        
        if (result.error) {
            hideLoader(); 
            document.getElementById('login-error').innerText = result.error; 
            document.getElementById('login-error').classList.remove('hidden-initially');
        } else {
            appState.actualRole = result.role;
            appState.role = result.role; 
            appState.actualUser = result.userProfile;
            appState.currentUser = result.userProfile; 
            appState.authString = pass;
            appData = result.data; 
            
            if(!appData.materials) appData.materials = [];
            if(!appData.certificates) appData.certificates = [];
            
            if (remember) {
                localStorage.setItem("ei_role", result.role);
                localStorage.setItem("ei_auth", pass); 
            }
            setupApplicationUI(); hideLoader();
        }
    } catch (error) { 
        hideLoader(); 
        document.getElementById('login-error').innerText = "Network Error. Please check connection.";
        document.getElementById('login-error').classList.remove('hidden-initially'); 
    }
});

document.getElementById('pin-login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const pin = document.getElementById('pin-input').value;
    const role = localStorage.getItem("ei_role");
    
    document.getElementById('pin-error').classList.add('hidden-initially');
    showLoader();

    try {
        const response = await fetch(`${GAS_URL}?action=verifyPin&role=${role}&pin=${pin}`);
        const result = await response.json();
        
        if (result.error) {
            hideLoader(); 
            document.getElementById('pin-error').innerText = result.error;
            document.getElementById('pin-error').classList.remove('hidden-initially'); 
            document.getElementById('pin-input').value = ''; 
        } else {
            appState.actualRole = result.role; 
            appState.role = result.role; 
            appData = result.data; 
            
            if(!appData.materials) appData.materials = [];
            if(!appData.certificates) appData.certificates = [];
            
            setupApplicationUI(); hideLoader();
        }
    } catch (error) { 
        hideLoader(); 
        document.getElementById('pin-error').innerText = "Network Error.";
        document.getElementById('pin-error').classList.remove('hidden-initially'); 
    }
});

// ==========================================================================
// 5. UI ROUTING & PERSPECTIVE SWITCHER
// ==========================================================================
function setupApplicationUI() {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('main-header').classList.remove('hidden-initially');
    document.getElementById('main-content').classList.remove('hidden-initially');
    document.getElementById('bottom-nav').classList.remove('hidden-initially');

    const btnAdminView = document.getElementById('btn-admin-view');
    if (appState.actualRole === 'admin') {
        btnAdminView.classList.remove('hidden-initially');
        populatePreviewLists(); 
    } else {
        btnAdminView.classList.add('hidden-initially');
    }

    document.getElementById('nav-analytics-btn').style.display = (appState.role === 'admin') ? 'flex' : 'none';
    document.getElementById('nav-students-btn').style.display = (appState.role === 'student') ? 'none' : 'flex';
    document.getElementById('admin-staff-modules').style.display = (appState.role === 'student') ? 'none' : 'block';
    
    if (appState.role === 'admin' || appState.role === 'staff') {
        document.getElementById('admin-broadcast-panel').style.display = 'block'; 
        updateDashboardFinancials(); 
        checkDuesSilently(); 
        switchTab('dashboard');
    } else if (appState.role === 'student') {
        renderStudentDashboard(); 
        switchTab('student-dash');
    }
}

function switchTab(tabId) {
    // Reroute students clicking "Home" to their profile instead of admin dashboard
    if (tabId === 'dashboard' && appState.role === 'student') {
        tabId = 'student-dash';
    }

    showLoader();
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
            'uploads': {title: 'File Hub', sub: 'Share Materials & Certs', nav: -1},
            
            // Student Specific Routes
            'student-dash': {title: 'My Profile', sub: 'Student Portal', nav: 0},
            'stu-materials': {title: 'Study Materials', sub: 'Downloads', nav: 0},
            'stu-certs': {title: 'Certificates', sub: 'My Awards', nav: 0},
            'stu-notices': {title: 'Notice Board', sub: 'Alerts', nav: 0}
        };
        
        if(titles[tabId]) {
            document.getElementById('page-title').innerText = titles[tabId].title;
            document.getElementById('page-subtitle').innerText = titles[tabId].sub;
            if(titles[tabId].nav >= 0) document.querySelectorAll('#bottom-nav .nav-btn')[titles[tabId].nav].classList.add('active');
        }

        if(tabId === 'students') renderStudents();
        if(['job','print','expense'].includes(tabId)) renderList(tabId);
        if(tabId === 'analytics') renderChart();

        hideLoader();
    }, 200); 
}

function populatePreviewLists() {
    const selectView = document.getElementById('preview-student-select');
    selectView.innerHTML = '<option value="" disabled selected>Select a Student...</option>';
    
    const selectCert = document.getElementById('cert-student');
    if (selectCert) selectCert.innerHTML = '<option value="" disabled selected>Select Student to Issue Cert...</option>';
    
    if (appData.students) {
        appData.students.forEach(st => {
            selectView.innerHTML += `<option value="${st.id}">${st.name} (${st.course})</option>`;
            if (selectCert) selectCert.innerHTML += `<option value="${st.id}">${st.name} (${st.course})</option>`;
        });
    }
}

function openViewSwitcher() { document.getElementById('view-switcher-modal').classList.add('active'); }
function closeViewSwitcher() { document.getElementById('view-switcher-modal').classList.remove('active'); }

function changeAdminView(targetRole) {
    if (targetRole === 'student') {
        const targetId = document.getElementById('preview-student-select').value;
        if (!targetId) return alert("Please select a student to preview.");
        appState.currentUser = appData.students.find(s => s.id === targetId);
    } else {
        appState.currentUser = appState.actualUser; 
    }
    
    appState.role = targetRole;
    closeViewSwitcher();
    document.getElementById('admin-view-banner').classList.remove('hidden-initially');
    setupApplicationUI();
}

function exitAdminPreview() {
    appState.role = appState.actualRole;
    appState.currentUser = appState.actualUser;
    document.getElementById('admin-view-banner').classList.add('hidden-initially');
    setupApplicationUI();
}

// ==========================================================================
// 6. DATA SYNCING LOGIC
// ==========================================================================
async function syncDatabase(actionDesc) {
    if (appState.actualRole !== 'admin') { 
        alert("Action Denied: You do not have Write Permissions."); 
        return false; 
    }
    
    showLoader();
    const payload = { password: "admin", data: appData }; 
    
    try {
        const response = await fetch(GAS_URL, { 
            method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) 
        });
        const result = await response.json();
        hideLoader();
        if (result.error) { alert("Server Sync Error: " + result.error); return false; }
        return true;
    } catch (error) {
        hideLoader(); alert("Network error. Database sync failed."); return false;
    }
}

// ==========================================================================
// 7. MODALS (HISTORY, NOTIFICATIONS, SETTINGS, STUDENT DETAILS)
// ==========================================================================
function openHistoryModal(type) {
    const container = document.getElementById('history-list-container');
    const title = document.getElementById('history-modal-title');
    container.innerHTML = '';
    
    let filtered = [];
    if (type === 'income') { title.innerText = "Total Income History"; filtered = appData.transactions.filter(t => t.type === 'income'); } 
    else if (type === 'expense') { title.innerText = "Total Expense History"; filtered = appData.transactions.filter(t => t.type === 'expense'); } 
    else { title.innerText = "Complete Ledger"; filtered = appData.transactions; }

    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">No transactions found.</p>`;
    } else {
        filtered.slice().reverse().forEach(tx => {
            const isInc = tx.type === 'income';
            const color = isInc ? 'var(--success)' : 'var(--danger)';
            const sign = isInc ? '+' : '-';
            container.innerHTML += `
                <div class="list-item" style="padding: 14px 18px; margin-bottom: 8px;">
                    <div class="list-info"><h4 style="font-size: 0.95rem;">${tx.title.replace('Job Desk: ','').replace('Print Desk: ','')}</h4><p style="font-size: 0.7rem;">${tx.date}</p></div>
                    <div class="list-value"><h3 style="color: ${color}; font-size: 1.15rem;">${sign}₹${tx.amount}</h3></div>
                </div>`;
        });
    }
    document.getElementById('modal-history').classList.add('active');
}
function closeHistoryModal() { document.getElementById('modal-history').classList.remove('active'); }

function checkDuesSilently() {
    let count = 0; 
    
    if (appState.role === 'student') {
        const actualPaid = getDynamicPaidFee(appState.currentUser);
        if((appState.currentUser.totalFee - actualPaid) > 0) count++;
    } else {
        appData.students.forEach(st => { 
            if((st.totalFee - getDynamicPaidFee(st)) > 0) count++; 
        });
    }
    
    const dot = document.getElementById('notif-dot');
    if(count > 0) dot.classList.remove('hidden-initially'); else dot.classList.add('hidden-initially');
}

function openNotificationModal() {
    const listEl = document.getElementById('notif-list-details'); 
    listEl.innerHTML = '';
    let found = false;
    
    if (appState.role === 'student') {
        // Students only see their OWN dues
        const actualPaid = getDynamicPaidFee(appState.currentUser);
        const dues = appState.currentUser.totalFee - actualPaid;
        if(dues > 0) {
            found = true;
            listEl.innerHTML += `
                <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                    <p style="font-weight: 800; font-size: 0.9rem; color: var(--danger);">Pending Tuition Fee</p>
                    <p style="font-size: 0.75rem; color: var(--text-main); margin-top: 4px;">You have an outstanding balance. Please clear it at the front desk.</p>
                    <p style="font-weight: 900; font-size: 1.5rem; color: var(--danger); margin-top: 8px;">₹${dues}</p>
                </div>`;
        }
    } else {
        // Admins see ALL students dues
        appData.students.forEach(st => {
            const actualPaid = getDynamicPaidFee(st);
            const dues = st.totalFee - actualPaid;
            if(dues > 0) {
                found = true;
                listEl.innerHTML += `
                    <div class="flex justify-between items-center py-4 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition" onclick="openStudentDetailModal('${st.id}')">
                        <div><p style="font-weight: 800; font-size: 0.9rem; color: var(--text-heading);">${st.name}</p><p style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${st.phone}</p></div>
                        <div class="text-right"><span style="font-size: 0.6rem; color: var(--danger); font-weight: 800; text-transform: uppercase;">Due</span><p style="font-weight: 900; font-size: 1.1rem; color: var(--danger);">₹${dues}</p></div>
                    </div>`;
            }
        });
    }

    if(!found) listEl.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 24px 0; font-weight: 700;">No pending dues detected.</p>`;
    
    document.getElementById('modal-notifications').classList.add('active');
}
function closeNotificationModal() { document.getElementById('modal-notifications').classList.remove('active'); }

function openSettingsModal() { 
    if(appState.actualRole === 'admin' || appState.actualRole === 'staff') { document.getElementById('btn-setup-pin').classList.remove('hidden-initially'); }
    document.getElementById('modal-settings').classList.add('active'); 
}
function closeSettingsModal() { document.getElementById('modal-settings').classList.remove('active'); }

async function promptSetPin() {
    closeSettingsModal();
    const pin = prompt("Enter a new 4-Digit PIN for quick access:");
    if(!pin || !/^\d{4}$/.test(pin)) return alert("PIN must be exactly 4 numbers.");
    
    const masterPass = prompt("Enter Master Admin Password to authorize this security change:");
    if(!masterPass) return;

    showLoader();
    try {
        const res = await fetch(GAS_URL, { method: 'POST', headers: {"Content-Type": "text/plain"}, body: JSON.stringify({action: 'setPin', role: appState.actualRole, pin: pin, auth: masterPass}) });
        const result = await res.json();
        hideLoader();
        if(result.success) { localStorage.setItem("ei_usePin", "true"); alert("PIN saved successfully!"); } else { alert(result.error); }
    } catch(e) { hideLoader(); alert("Network error. Could not save PIN."); }
}

function clearSavedLogin() {
    localStorage.removeItem("ei_role"); localStorage.removeItem("ei_usePin"); localStorage.removeItem("ei_auth");
    window.location.reload(); 
}

function openStudentDetailModal(studentId) {
    if (appState.role === 'student') return; 
    
    const st = appData.students.find(s => s.id === studentId);
    if (!st) return;

    const actualPaid = getDynamicPaidFee(st);
    const dues = st.totalFee - actualPaid;
    
    const avatarEl = document.getElementById('detail-avatar');
    if (st.image) { avatarEl.innerHTML = `<img src="${st.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`; avatarEl.style.padding = "0"; } 
    else { avatarEl.innerHTML = st.name.charAt(0).toUpperCase(); avatarEl.style.padding = ""; }

    document.getElementById('detail-name').innerText = st.name;
    document.getElementById('detail-id').innerText = `ID: ${st.id}`;
    document.getElementById('detail-phone').innerText = st.phone;
    document.getElementById('detail-date').innerText = st.date;
    document.getElementById('detail-course').innerText = st.course;
    document.getElementById('detail-total').innerText = `₹${st.totalFee}`;
    document.getElementById('detail-paid').innerText = `₹${actualPaid}`;
    document.getElementById('detail-due').innerText = `₹${dues}`;

    const historyContainer = document.getElementById('detail-history-list');
    historyContainer.innerHTML = '';
    
    const stuTx = appData.transactions.filter(tx => tx.type === 'income' && !tx.title.includes('Job Desk:') && !tx.title.includes('Print Desk:') && (tx.title.includes(`[${st.id}]`) || tx.title.includes(st.name)));
    
    if (stuTx.length === 0) {
        if (st.paidFee > 0) historyContainer.innerHTML = `<div class="list-item" style="padding: 10px 16px; margin-bottom: 6px;"><div class="list-info"><h4 style="font-size:0.8rem;">Initial Advance</h4><p style="font-size:0.65rem;">${st.date}</p></div><div class="list-value"><h3 style="color: var(--success); font-size: 1rem;">+₹${st.paidFee}</h3></div></div>`;
        else historyContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 10px;">No payments recorded.</p>`;
    } else {
        stuTx.slice().reverse().forEach(tx => {
            historyContainer.innerHTML += `<div class="list-item" style="padding: 10px 16px; margin-bottom: 6px;"><div class="list-info"><h4 style="font-size:0.8rem;">Fee Payment</h4><p style="font-size:0.65rem;">${tx.date}</p></div><div class="list-value"><h3 style="color: var(--success); font-size: 1rem;">+₹${tx.amount}</h3></div></div>`;
        });
    }

    closeNotificationModal();
    setTimeout(() => { document.getElementById('modal-student-detail').classList.add('active'); }, 100);
}
function closeStudentDetailModal() { document.getElementById('modal-student-detail').classList.remove('active'); }

// ==========================================================================
// 8. FILE UPLOADS & BROADCASTS
// ==========================================================================
document.getElementById('upload-material-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if(appState.actualRole !== 'admin') return alert("Action Denied: Only Admins can upload materials.");
    
    const title = document.getElementById('mat-title').value;
    const course = document.getElementById('mat-course').value;
    const fileInput = document.getElementById('mat-file');
    
    if(!fileInput.files[0]) return alert("Please select a file to upload.");
    
    showLoader();
    try {
        const base64Data = await fileToBase64(fileInput.files[0]);
        appData.materials.unshift({ 
            id: 'MAT' + Date.now(), title: title, course: course, 
            filename: fileInput.files[0].name, file: base64Data, date: new Date().toLocaleDateString('en-IN') 
        });
        
        if(await syncDatabase("Upload Material")) {
            alert("Study Material Published!");
            this.reset(); document.getElementById('mat-file-name').innerText = "Choose File...";
        }
    } catch(err) { hideLoader(); alert("Error processing file. Try a smaller file."); }
});

document.getElementById('upload-cert-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if(appState.actualRole !== 'admin') return alert("Action Denied: Only Admins can issue certificates.");
    
    const studentId = document.getElementById('cert-student').value;
    const fileInput = document.getElementById('cert-file');
    
    if(!studentId || !fileInput.files[0]) return alert("Select student and file.");
    
    showLoader();
    try {
        const base64Data = await fileToBase64(fileInput.files[0]);
        appData.certificates.unshift({ 
            id: 'CRT' + Date.now(), studentId: studentId, 
            filename: fileInput.files[0].name, file: base64Data, date: new Date().toLocaleDateString('en-IN') 
        });
        
        if(await syncDatabase("Issue Certificate")) {
            alert("Certificate Issued Successfully!");
            this.reset(); document.getElementById('cert-file-name').innerText = "Choose File...";
        }
    } catch(err) { hideLoader(); alert("Error processing file. Try a smaller file."); }
});

async function sendBroadcast() {
    if(appState.actualRole !== 'admin' && appState.actualRole !== 'staff') return alert("Action Denied.");
    
    const title = document.getElementById('bc-title').value; 
    const msg = document.getElementById('bc-msg').value;
    const fileInput = document.getElementById('bc-media');
    
    if(!title || !msg) return alert("Please enter both a title and message.");
    
    showLoader();
    try {
        let mediaBase64 = null;
        let mediaType = null;
        
        if (fileInput.files[0]) {
            mediaBase64 = await fileToBase64(fileInput.files[0]);
            mediaType = fileInput.files[0].type;
        }

        appData.notices.unshift({ 
            title: title, message: msg, date: new Date().toLocaleDateString('en-IN'), 
            media: mediaBase64, mediaType: mediaType 
        });
        
        if(await syncDatabase("Broadcast Notice")) {
            alert("Notice broadcasted to all students!"); 
            document.getElementById('bc-title').value = ''; 
            document.getElementById('bc-msg').value = '';
            fileInput.value = '';
            document.getElementById('bc-media-name').innerText = 'Attach Photo/Video (Optional)';
        }
    } catch (error) { hideLoader(); alert("Failed to attach media. File might be too large."); }
}

// ==========================================================================
// 9. STANDARD FORM SUBMISSIONS
// ==========================================================================
function recalcStats() {
    appData.stats.income = 0; appData.stats.expense = 0;
    appData.transactions.forEach(tx => {
        if(tx.type === 'income') appData.stats.income += parseFloat(tx.amount);
        if(tx.type === 'expense') appData.stats.expense += parseFloat(tx.amount);
    });
    appData.stats.balance = appData.stats.income - appData.stats.expense;
    updateDashboardFinancials();
}

document.getElementById('admission-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    if(appState.actualRole !== 'admin') return alert("Action Denied.");
    
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const course = document.getElementById('reg-course').value;
    const totalFee = parseFloat(document.getElementById('reg-fee').value);
    const advancePaid = parseFloat(document.getElementById('reg-paid').value);
    const dateStr = document.getElementById('reg-date').value;
    
    const stId = 'STU' + Math.floor(Math.random() * 90000 + 10000);
    appData.students.unshift({ id: stId, name: name, course: course, totalFee: totalFee, paidFee: advancePaid, phone: phone, date: dateStr });
    
    if (advancePaid > 0) {
        appData.transactions.push({ id: 'TXN'+Math.floor(Math.random()*90000+10000), type: "income", title: `Admission - ${name} [${stId}]`, amount: advancePaid, date: dateStr });
    }
    
    recalcStats(); populatePreviewLists(); 
    
    if(await syncDatabase("Register Student")) {
        const year = dateStr.substring(0,4);
        const firstName = name.split(' ')[0];
        alert(`Success!\nStudent Password Auto-Generated: EI${firstName}${year}`);
        this.reset(); document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];
        switchTab('students');
    }
});

['job', 'print', 'expense'].forEach(type => {
    const form = document.getElementById(`${type}-form`);
    if(form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            if(appState.actualRole !== 'admin') return alert("Action Denied.");
            let title = "", desc = "", amount = 0, txType = "income";
            if (type === 'job') { title = `Job Desk: ${document.getElementById('job-name').value}`; desc = document.getElementById('job-post').value; amount = parseFloat(document.getElementById('job-amount').value); }
            if (type === 'print') { title = `Print Desk: ${document.getElementById('print-service').value}`; amount = parseFloat(document.getElementById('print-amount').value); }
            if (type === 'expense') { title = document.getElementById('exp-category').value; amount = parseFloat(document.getElementById('exp-amount').value); txType = "expense"; }

            appData.transactions.push({ id: 'TXN'+Date.now(), type: txType, title: title, description: desc, amount: amount, date: new Date().toISOString().split('T')[0] });
            recalcStats();
            if(await syncDatabase(`Save ${type} Entry`)) { this.reset(); renderList(type); }
        });
    }
});

// ==========================================================================
// 10. RENDERERS (Updates specific lists)
// ==========================================================================
function updateDashboardFinancials() {
    document.getElementById('dash-balance').innerText = `₹${appData.stats.balance.toLocaleString('en-IN')}`;
    document.getElementById('dash-income').innerText = `₹${appData.stats.income.toLocaleString('en-IN')}`;
    document.getElementById('dash-expense').innerText = `₹${appData.stats.expense.toLocaleString('en-IN')}`;
}

function renderStudents() {
    const query = (document.getElementById('student-search').value || '').toLowerCase();
    const listEl = document.getElementById('student-list'); listEl.innerHTML = '';
    
    const filtered = appData.students.filter(s => s.name.toLowerCase().includes(query) || s.phone.includes(query));
    if (filtered.length === 0) return listEl.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">No students found.</p>';
    
    filtered.forEach(st => {
        const actualPaid = getDynamicPaidFee(st);
        const dues = st.totalFee - actualPaid;
        const dueColor = dues > 0 ? 'var(--danger)' : 'var(--success)';
        const avatarContent = st.image ? `<img src="${st.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 14px;">` : st.name.charAt(0).toUpperCase();

        listEl.innerHTML += `
            <div class="list-item" onclick="openStudentDetailModal('${st.id}')">
                <div style="display: flex; align-items: center;">
                    <div class="list-avatar" style="${st.image ? 'padding: 0; overflow: hidden;' : ''}">${avatarContent}</div>
                    <div class="list-info"><h4>${st.name}</h4><p>${st.phone} • ${st.course}</p></div>
                </div>
                <div class="list-value"><span>Due</span><h3 style="color: ${dueColor}">₹${dues}</h3></div>
            </div>`;
    });
}

function renderList(type) {
    const listEl = document.getElementById(`${type}-list`); listEl.innerHTML = '';
    let f = []; 
    if(type==='job') f=appData.transactions.filter(t=>t.title.includes('Job Desk')); 
    if(type==='print') f=appData.transactions.filter(t=>t.title.includes('Print Desk')); 
    if(type==='expense') f=appData.transactions.filter(t=>t.type==='expense');
    
    if(f.length===0) return listEl.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">No records.</p>`;
    
    f.slice().reverse().slice(0, 15).forEach(tx => {
        const isInc = tx.type === 'income';
        listEl.innerHTML += `
            <div class="list-item" style="cursor: default; pointer-events: none;">
                <div class="list-info"><h4>${tx.title.replace('Job Desk: ','').replace('Print Desk: ','')}</h4><p>${tx.date}</p></div>
                <div class="list-value"><h3 style="color: ${isInc ? 'var(--success)' : 'var(--danger)'}">${isInc ? '+' : '-'}₹${tx.amount}</h3></div>
            </div>`;
    });
}

function renderStudentDashboard() {
    const st = appState.currentUser;
    if(!st) return;

    // Profile Details
    document.getElementById('stu-name').innerText = st.name; 
    document.getElementById('stu-course').innerText = st.course;
    document.getElementById('stu-date').innerText = st.date;
    const avatarEl = document.getElementById('stu-avatar');
    if (st.image) { avatarEl.innerHTML = `<img src="${st.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`; avatarEl.style.padding = "0"; } 
    else { avatarEl.innerHTML = st.name.charAt(0).toUpperCase(); avatarEl.style.padding = ""; }
    
    // Dues
    const actualPaid = getDynamicPaidFee(st);
    const dues = st.totalFee - actualPaid; 
    document.getElementById('stu-due-amount').innerText = `₹${dues}`; 
    document.getElementById('stu-due-card').style.background = dues > 0 ? 'var(--danger-bg)' : 'var(--success-bg)';
    document.getElementById('stu-due-amount').style.color = dues > 0 ? 'var(--danger)' : 'var(--success)';

    // Populating isolated sub-views correctly mapping to IDs in HTML
    
    // 1. My Certificates
    const certCtn = document.getElementById('stu-certs-list');
    const myCerts = (appData.certificates || []).filter(c => c.studentId === st.id);
    if(myCerts.length > 0) {
        certCtn.innerHTML = myCerts.map(c => `
            <div class="list-item" style="padding: 16px;">
                <div class="flex items-center"><i class="fa-solid fa-award text-2xl text-emerald-500 mr-4"></i><div><h4 style="font-weight: 800; font-size: 0.9rem;">Course Certificate</h4><p style="font-size: 0.7rem; color: var(--text-muted);">${c.date}</p></div></div>
                <a href="${c.file}" download="${c.filename}" class="btn-primary" style="width: auto; padding: 10px 16px; font-size: 0.8rem; background: var(--success);"><i class="fa-solid fa-download"></i></a>
            </div>`).join('');
    } else { certCtn.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; font-weight: 700;">No certificates issued yet.</p>'; }

    // 2. Study Materials
    const matCtn = document.getElementById('stu-materials-list');
    const myMats = (appData.materials || []).filter(m => m.course.toLowerCase() === 'all' || m.course.toLowerCase() === st.course.toLowerCase());
    if(myMats.length > 0) {
        matCtn.innerHTML = myMats.map(m => `
            <div class="list-item" style="padding: 16px;">
                <div class="flex items-center"><i class="fa-solid fa-file-pdf text-2xl text-indigo-500 mr-4"></i><div style="max-width: 180px;"><h4 style="font-weight: 800; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</h4><p style="font-size: 0.7rem; color: var(--text-muted);">${m.date}</p></div></div>
                <a href="${m.file}" download="${m.filename}" class="btn-primary" style="width: auto; padding: 10px 16px; font-size: 0.8rem;"><i class="fa-solid fa-download"></i></a>
            </div>`).join('');
    } else { matCtn.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.8rem; font-weight: 700;">No materials available.</p>'; }

    // 3. Notice Board
    const noticesEl = document.getElementById('stu-notices-list'); 
    noticesEl.innerHTML = '';
    if(appData.notices && appData.notices.length > 0) {
        appData.notices.forEach(n => {
            let mediaHtml = '';
            if (n.media) {
                if (n.mediaType && n.mediaType.startsWith('video/')) {
                    mediaHtml = `<video src="${n.media}" controls style="width: 100%; border-radius: 12px; margin-top: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"></video>`;
                } else {
                    mediaHtml = `<img src="${n.media}" style="width: 100%; border-radius: 12px; margin-top: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`;
                }
            }
            noticesEl.innerHTML += `
                <div class="premium-card p-4">
                    <h4 style="font-size: 0.95rem; font-weight: 900; color: var(--primary);">${n.title}</h4>
                    <p style="font-size: 0.8rem; font-weight: 600; color: var(--text-main); margin-top: 4px;">${n.message}</p>
                    ${mediaHtml}
                    <p style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); margin-top: 8px; text-transform: uppercase;">${n.date}</p>
                </div>`;
        });
    } else { noticesEl.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; font-weight: 700;">No notices from the Institute.</p>'; }
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
    
    analyticsChartInstance = new Chart(document.getElementById('analyticsChart').getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: labels.length ? labels : ['No Data'], 
            datasets: [
                { label: 'Income', data: labels.map(l=>incMap[l]||0), backgroundColor: '#10b981', borderRadius: 6 }, 
                { label: 'Expense', data: labels.map(l=>expMap[l]||0), backgroundColor: '#f43f5e', borderRadius: 6 }
            ] 
        }, 
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, border: {dash: [4, 4]} } }, plugins: { legend: { labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' } } } } } 
    });
}
