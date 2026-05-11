const GAS_URL = "YOUR_GAS_WEB_APP_URL"; // Update this!

let appState = {
    role: null, // 'admin', 'staff', or 'student'
    currentUser: null,
    sessionPassword: ""
};

let appData = { students: [], transactions: [], stats: { income: 0, expense: 0, balance: 0 }, notices: [] };

// Generate Student Password: 'EI' + Year + First Name + BirthYear
function generateStudentPassword(firstName, birthYear) {
    const currentYear = new Date().getFullYear();
    const cleanName = firstName.split(' ')[0].toUpperCase();
    return `EI${currentYear}${cleanName}${birthYear}`;
}

// Check for hourly dues (In-App Notification)
function checkDues() {
    if(appState.role === 'student') return;
    
    let dueCount = 0;
    appData.students.forEach(st => {
        if((st.totalFee - st.paidFee) > 0) dueCount++;
    });

    if(dueCount > 0) {
        document.querySelector('.notification-icon').classList.add('has-alert');
        alert(`Attention: You have ${dueCount} students with pending dues.`);
    } else {
        alert("All clear! No students have pending dues.");
    }
}

// Hourly check trigger (Works while app is open)
setInterval(checkDues, 3600000); 

// ----- Login Logic -----
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const userid = document.getElementById('userid').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    document.getElementById('login-error').style.display = 'none';
    showLoader("Authenticating...");

    // 1. Send Login Request to Backend
    try {
        // You will pass both ID and Pass to the backend to verify role
        const response = await fetch(`${GAS_URL}?action=login&id=${encodeURIComponent(userid)}&pass=${encodeURIComponent(pass)}`);
        const result = await response.json();
        
        if (result.error) {
            hideLoader();
            document.getElementById('login-error').innerText = result.error;
            document.getElementById('login-error').style.display = 'block';
        } else {
            // Success! Set Role
            appState.role = result.role; // the backend tells us their role
            appState.sessionPassword = pass;
            appData = result.data;
            appState.currentUser = result.userProfile; // specific student info if applicable
            
            routeUser();
            hideLoader();
        }
    } catch (error) {
        hideLoader();
        document.getElementById('login-error').innerText = "Network error. Check connection.";
        document.getElementById('login-error').style.display = 'block';
    }
});

// Routing based on Role
function routeUser() {
    if (appState.role === 'admin') {
        document.getElementById('welcome-text').innerText = "Admin Dashboard";
        document.getElementById('broadcast-panel').style.display = 'block';
        enableAdminControls(true);
        switchTab('dashboard');
    } 
    else if (appState.role === 'staff') {
        document.getElementById('welcome-text').innerText = "Staff View";
        document.getElementById('broadcast-panel').style.display = 'none'; // Staff can't broadcast
        enableAdminControls(false); // Disable saving/deleting
        switchTab('dashboard');
    } 
    else if (appState.role === 'student') {
        renderStudentDashboard();
        switchTab('student-dash');
    }
}

function enableAdminControls(isEnabled) {
    const btn = document.getElementById('btn-admission');
    if(btn) btn.style.display = isEnabled ? 'flex' : 'none';
}

// Render the isolated student view
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
        dueEl.style.color = 'var(--danger)';
        dueCard.style.borderLeftColor = 'var(--danger)';
    } else {
        dueEl.style.color = 'var(--success)';
        dueCard.style.borderLeftColor = 'var(--success)';
        dueEl.innerText = "Cleared";
    }

    // Render Notices sent by Admin
    const noticesEl = document.getElementById('stu-notices');
    noticesEl.innerHTML = '';
    if(appData.notices && appData.notices.length > 0) {
        appData.notices.forEach(n => {
            noticesEl.innerHTML += `
                <div style="border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <h4 style="font-size:14px; color:var(--primary);">${n.title}</h4>
                    <p style="font-size:12px; color:var(--text-main); margin-top:4px;">${n.message}</p>
                    <p style="font-size:10px; color:var(--text-muted); margin-top:4px;">${n.date}</p>
                </div>
            `;
        });
    } else {
        noticesEl.innerHTML = '<p style="color:var(--text-muted); font-size:12px; text-align:center;">No new notices.</p>';
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${tabId}`).classList.add('active');
}

function logout() {
    appState = { role: null, currentUser: null, sessionPassword: "" };
    document.getElementById('password').value = "";
    document.getElementById('userid').value = "";
    switchTab('login');
}

function showLoader(text="Loading") { document.getElementById('loader').style.display='flex'; document.getElementById('loader-text').innerText=text;}
function hideLoader() { document.getElementById('loader').style.display='none'; }
