import { ref as dbRef, get as getRTData } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { checkAuthState, signOutUser, rtdb } from "./auth.js";

let userData = null;

async function showDashboard() {
    const navbar = document.getElementById('navbar');
    navbar.innerHTML = `
        <div onclick="goToPage('dashboard')">
            <span class="material-icons">home</span> Dashboard
        </div>
        <div onclick="goToPage('statistics')">
            <span class="material-icons">bar_chart</span> Statistics
        </div>
        <div onclick="goToPage('monitor')">
            <span class="material-icons">track_changes</span> Monitor
        </div>
        <div class="selected">
            <span class="material-icons">history</span> Changelog
        </div>
        <div id="logoutBtn">
            <span class="material-icons">logout</span> Logout
        </div>
    `;

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', async () => {
        await signOutUser();
        window.location.href = '/';
    });

    const dashboardContent = document.getElementById('dashboardContent');
    dashboardContent.innerHTML = `
        <div class="section">
            <div class="section-header">
                <h3>Available Softwares (Windows)</h3>
                <input type="text" id="searchInputWIN" placeholder="Search...">
            </div>
            <div class="windows-software-list">
                ${await getAvailableSoftwares()}
            </div>
        </div>
        <div class="section">
            <div class="section-header">
                <h3>Available Packages (WSL/Linux)</h3>
                <input type="text" id="searchInputWSL" placeholder="Search...">
            </div>
            <div class="wsl-software-list">
                ${await getAvailablePackages()}
            </div>
        </div>
    `;

    // WINDOWS SEARCH
    const searchInputWIN = document.getElementById('searchInputWIN');
    searchInputWIN.addEventListener('input', function () {
        const filter = this.value.toLowerCase();
        const details = document.querySelector('.windows-software-list details');
        const items = details.querySelectorAll('li');

        let anyVisible = false;
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const isMatch = text.includes(filter);
            item.style.display = isMatch ? '' : 'none';
            if (isMatch) anyVisible = true;
        });

        // Expand the details and show message if needed
        details.open = true;

        const noMatchMsgId = 'noMatchWin';
        let noMatch = document.getElementById(noMatchMsgId);
        if (!anyVisible) {
            if (!noMatch) {
                noMatch = document.createElement('p');
                noMatch.id = noMatchMsgId;
                noMatch.textContent = 'No results found.';
                noMatch.style.color = 'gray';
                details.appendChild(noMatch);
            }
        } else if (noMatch) {
            noMatch.remove();
        }
    });

    // WSL SEARCH
    const searchInputWSL = document.getElementById('searchInputWSL');
    searchInputWSL.addEventListener('input', function () {
        const filter = this.value.toLowerCase();
        const details = document.querySelector('.wsl-software-list details');
        const items = details.querySelectorAll('li');

        let anyVisible = false;
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const isMatch = text.includes(filter);
            item.style.display = isMatch ? '' : 'none';
            if (isMatch) anyVisible = true;
        });

        details.open = true;

        const noMatchMsgId = 'noMatchWsl';
        let noMatch = document.getElementById(noMatchMsgId);
        if (!anyVisible) {
            if (!noMatch) {
                noMatch = document.createElement('p');
                noMatch.id = noMatchMsgId;
                noMatch.textContent = 'No results found.';
                noMatch.style.color = 'gray';
                details.appendChild(noMatch);
            }
        } else if (noMatch) {
            noMatch.remove();
        }
    });

}

async function getAvailableSoftwares() {
    const snapshot = await getRTData(dbRef(rtdb, 'windows_softwares'));
    const data = snapshot.val();

    if (!data) return '<p>No Windows software found.</p>';

    let html = '<details><ul>';
    Object.values(data).forEach(item => {
        let formattedDateShort = '';
        if (item.install_date) {
            const formattedDate = item.install_date ? `${item.install_date.slice(0, 4)}-${item.install_date.slice(4, 6)}-${item.install_date.slice(6)}` : '';
            const date = new Date(formattedDate);
            formattedDateShort = date.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
        }
        html += `
            <li>
                ${item.name}
                <span style="color:gray"> — (${formattedDateShort || 'Unknown date'})</span>
            </li>
        `;
    });
    html += '</ul></details>';
    return html;
}

async function getAvailablePackages() {
    const snapshot = await getRTData(dbRef(rtdb, 'wsl_softwares'));
    const data = snapshot.val();

    if (!data) return '<p>No WSL packages found.</p>';

    let html = '<details><ul>';
    Object.values(data).forEach(item => {
        let formattedDateShort = '';
        if (item.install_datetime) {
            const date = new Date(item.install_datetime);
            formattedDateShort = date.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
        }
        html += `
            <li>
                ${item.name}
                <span style="color:gray"> — ${item.version || 'unknown'} [${item.action === 'install' ? 'installed' : 'upgraded'}] (${formattedDateShort || 'Unknown date'})</span>
            </li>
        `;
    });
    html += '</ul></details>';
    return html;
}

window.goToPage = async function(page) {
    window.location.href = `./${page}`;
}

addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuthState();
    if (user) {
        userData = user;
        await showDashboard();
    } else {
        window.location.href = '/';
    }
});