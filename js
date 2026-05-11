const GAS_URL = "https://script.google.com/macros/s/AKfycbxFsBuyiWOdTMMGeOgTXhvSmAfUK_uMbdwVO945ejPvnsEOQtX9ZtMCh9RQtBWzHSVj/exec";

document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault(); // Prevent standard page reload

    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const msg = document.getElementById('login-message');

    // UI Feedback
    btn.innerText = "Authenticating...";
    btn.disabled = true;
    msg.innerText = "";
    msg.style.color = "var(--text-main)";

    // Prepare payload. Using action="login" to help your GAS backend route the request
    const payload = {
        action: "login",
        username: user,
        password: pass
    };

    // Fetch call to Google Apps Script
    fetch(GAS_URL, {
        method: "POST",
        // Using text/plain is a common trick to bypass strict CORS preflight checks in GAS
        headers: { "Content-Type": "text/plain;charset=utf-8" }, 
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === "success") {
            msg.style.color = "green";
            msg.innerText = "Login Successful!";
            
            // Switch to main screen after a brief delay
            setTimeout(() => {
                document.getElementById('screen-login').classList.remove('active');
                document.getElementById('screen-main').classList.active = true;
                // Note: classList.active doesn't work this way, fixing below:
                document.getElementById('screen-main').classList.add('active');
            }, 800);
        } else {
            // Handle error from backend
            msg.style.color = "red";
            msg.innerText = data.message || "Invalid credentials.";
            btn.innerText = "Log In";
            btn.disabled = false;
        }
    })
    .catch(error => {
        console.error("Error:", error);
        msg.style.color = "red";
        msg.innerText = "Connection error. Please try again.";
        btn.innerText = "Log In";
        btn.disabled = false;
    });
});

// Placeholder function for bottom navigation
function switchTab(tabName) {
    console.log("Switching to tab: " + tabName);
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Add active class to clicked item (you would expand this to hide/show specific content divs)
    event.currentTarget.classList.add('active');
}
