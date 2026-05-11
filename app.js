// Ensure this URL matches your deployed Google Apps Script Web App URL exactly
const GAS_URL = "https://script.google.com/macros/s/AKfycbxFsBuyiWOdTMMGeOgTXhvSmAfUK_uMbdwVO945ejPvnsEOQtX9ZtMCh9RQtBWzHSVj/exec";

// Global Application State
let appData = {
    students: [],
    transactions: [],
    stats: { income: 0, expense: 0, balance: 0 }
};
let sessionPassword = "";

// Set default date to today for the admission form on load
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];
});

// ----- UI Helpers -----
function showLoader(text = "Loading...") {
    document.getElementById('loader-text').innerText = text;
    document.getElementById('loader').style.display = 'flex';
}

function hideLoader() { 
    document.getElementById('loader').style.display = 'none'; 
}

function switchTab(tabId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Deselect all bottom nav items
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    
    // Show selected screen
    document.getElementById(`screen-${tabId}`).classList.add('active');
    
    // Highlight bottom nav correctly
    if(tabId === 'dashboard') document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(tabId === 'students') {
        document.querySelectorAll('.nav-item')[1].classList.add('active');
        renderStudents(); // Refresh list when tab is opened
    }
}

function logout() {
    sessionPassword = "";
    appData = { students: [], transactions: [], stats: { income: 0, expense: 0, balance: 0 } };
    document.getElementById('password').value = "";
    switchTab('login');
}


// ----- Database Operations -----

// 1. Login (GETs data securely)
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const pass = document.getElementById('password').value.trim();
    document.getElementById('login-error').style.display = 'none';
    showLoader("Authenticating...");

    try {
        const response = await fetch(GAS_URL + "?pass=" + encodeURIComponent(pass));
        const data = await response.json();
        
        if (data.error) {
            hideLoader();
            document.getElementById('login-error').innerText = "Access Denied: " + data.error;
            document.getElementById('login-error').style.display = 'block';
        } else {
            sessionPassword = pass;
            appData = data;
            
            updateDashboardUI();
            hideLoader();
            switchTab('dashboard');
        }
    } catch (error) {
        hideLoader();
        document.getElementById('login-error').innerText = "Network error. Check connection.";
        document.getElementById('login-error').style.display = 'block';
    }
});

// 2. The Core Save Function (POSTs data securely)
async function syncDatabaseToCloud() {
    showLoader("Syncing to Cloud...");
    
    // Your doPost expects { password: "...", data: { entire database object } }
    const payload = {
        password: sessionPassword,
        data: appData
    };

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.error) {
            alert("Sync Error: " + result.error);
        } else {
            console.log("Database Synced Successfully");
        }
    } catch (error) {
        alert("Network error during sync. Data saved locally, but cloud sync failed.");
    }
    hideLoader();
}

function recalculateStats() {
    appData.stats.income = 0;
    appData.stats.expense = 0;
    appData.transactions.forEach(tx => {
        if(tx.type === 'income') appData.stats.income += parseFloat(tx.amount);
        if(tx.type === 'expense') appData.stats.expense += parseFloat(tx.amount);
    });
    appData.stats.balance = appData.stats.income - appData.stats.expense;
    updateDashboardUI();
}

function updateDashboardUI() {
    document.getElementById('dash-income').innerText = "₹" + appData.stats.income.toLocaleString('en-IN');
    document.getElementById('dash-expense').innerText = "₹" + appData.stats.expense.toLocaleString('en-IN');
    document.getElementById('dash-balance').innerText = "₹" + appData.stats.balance.toLocaleString('en-IN');
}


// ----- Form Submissions -----

// Handle New Admission
document.getElementById('admission-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const course = document.getElementById('reg-course').value;
    const totalFee = parseFloat(document.getElementById('reg-fee').value);
    const advancePaid = parseFloat(document.getElementById('reg-paid').value);
    const dateStr = document.getElementById('reg-date').value;
    
    const stId = 'STU' + Math.floor(Math.random() * 90000 + 10000);
    const txId = 'TXN' + Math.floor(Math.random() * 90000 + 10000);

    // 1. Update local Students array
    appData.students.unshift({
        id: stId,
        name: name,
        course: course,
        totalFee: totalFee,
        paidFee: advancePaid,
        phone: phone,
        date: dateStr,
        feeType: "Monthly",
        gender: "Not Specified"
    });

    // 2. Update local Transactions array
    if (advancePaid > 0) {
        appData.transactions.push({
            id: txId,
            type: "income",
            title: `Admission Fee - ${name} [${stId}]`,
            amount: advancePaid,
            date: dateStr,
            description: "Initial Advance"
        });
        
        // Keep transactions sorted by date
        appData.transactions.sort((a,b) => new Date(b.date) - new Date(a.date));
    }

    // 3. Recalculate stats and Sync
    recalculateStats();
    await syncDatabaseToCloud();

    // 4. Clean up UI
    alert("Student Registered Successfully!");
    document.getElementById('admission-form').reset();
    document.getElementById('reg-date').value = new Date().toISOString().split('T')[0];
    switchTab('students');
});

// ----- Render Views -----

function renderStudents() {
    const listEl = document.getElementById('student-list');
    listEl.innerHTML = '';
    
    if (appData.students.length === 0) {
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No students registered yet.</div>';
        return;
    }

    appData.students.forEach(st => {
        const dues = st.totalFee - st.paidFee;
        const dueColor = dues > 0 ? 'var(--danger)' : 'var(--success)';
        
        listEl.innerHTML += `
            <div class="student-item">
                <div style="display: flex; align-items: center;">
                    <div class="student-avatar">${st.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <p style="font-weight: bold; font-size: 14px; color: var(--text-main);">${st.name}</p>
                        <p style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">${st.id} • ${st.course}</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 10px; color: var(--text-muted); font-weight: bold; text-transform: uppercase;">Due</p>
                    <p style="font-weight: 900; color: ${dueColor};">₹${dues}</p>
                </div>
            </div>
        `;
    });
}
