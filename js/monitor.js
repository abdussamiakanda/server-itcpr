import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { checkAuthState, signOutUser, db } from "./auth.js";

let userData = null;
let wslServerUsers = {};

async function showDashboard() {
    await getWSLServersUsers();

    const navbar = document.getElementById('navbar');
    navbar.innerHTML = `
        <div onclick="goToPage('dashboard')">
            <span class="material-icons">home</span>
            Dashboard
        </div>
        <div onclick="goToPage('statistics')">
            <span class="material-icons">bar_chart</span>
            Statistics
        </div>
        <div class="selected">
            <span class="material-icons">track_changes</span>
            Monitor
        </div>
        <div id="logoutBtn">
            <span class="material-icons">logout</span>
            Logout
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
                <h3>WSL Commands Log</h3>
            </div>
            <div class="server-wsl-commands-list">
                ${await getServerWSLCommands()}
            </div>
        </div>
    `;
}

async function getWSLServersUsers() {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    const ipToUserMap = {};

    usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        const userName = userData.name;
        const ipList = userData.ip ? userData.ip.split(";") : [];

        ipList.forEach(ip => {
            const trimmedIp = ip.trim();
            if (trimmedIp) {
                ipToUserMap[trimmedIp] = userName;
            }
        });
    });

    wslServerUsers = ipToUserMap;
}

window.goToPage = async function(page) {
    window.location.href = `./${page}`;
}

async function getServerWSLCommands() {
    try {
        const logText = await fetchWSLCommands();
        const logData = parseLogData(logText).slice(0, 100);

        const users = [...new Set(parseLogData(logText).map(log => log.ip))];
        const commands = [...new Set(parseLogData(logText).map(log => log.commandId))];

        const filtersHTML = `
            <div class="wsl-filters">
                <div class="filter-group">
                    <label for="userFilter">Filter by User:</label>
                    <select id="userFilter" onchange="refreshTable()">
                        <option value="">All Users</option>
                        ${users.map(user => `<option value="${user}">${wslServerUsers[user]}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="commandFilter">Filter by Command ID:</label>
                    <select id="commandFilter" onchange="refreshTable()">
                        <option value="">All Commands</option>
                        ${commands.map(cmd => `<option value="${cmd}">${cmd}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group" onchange="refreshTable()">
                    <label for="dateFilter">Filter by Date:</label>
                    <input type="date" id="dateFilter">
                </div>
            </div>
        `;

        const tableHTML = await wslTableHTML(logData);

        return filtersHTML + tableHTML ;
    } catch (error) {
        console.error("Error fetching WSL command logs:", error);
        return "<p class='error-message'>Error loading data.</p>";
    }
}

async function fetchWSLCommands() {
    let response = await fetch("https://api.itcpr.org/wsl/download");
    if (!response.ok) throw new Error("Failed to fetch log file");

    return await response.text();
}

function parseLogData(logText) {
    return logText.trim().split("\n")
        .map(line => {
            const parts = line.match(/([\d\.]+) -\s+(\d+)\s+([\d-]+ [\d:]+)\s+(.*)/);
            if (!parts) return null;

            return {
                ip: parts[1],
                commandId: parts[2],
                timestamp: parts[3],
                command: parts[4],
                dateTime: luxon.DateTime.fromFormat(parts[3], "yyyy-MM-dd HH:mm:ss")
            };
        })
        .filter(item => item !== null)
        .sort((a, b) => b.dateTime - a.dateTime);
}

async function wslTableHTML(logData) {
    if (logData.length === 0) {
        return `<p>No WSL command logs available.</p>`;
    }
    return `
            <table id="logTable" class="wsl-log-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Command ID</th>
                        <th>Timestamp</th>
                        <th>Command</th>
                    </tr>
                </thead>
                <tbody>
                    ${logData.map(log => `
                        <tr ${log.command.includes('sudo') ? 'class="sudo-command"' : ''}>
                            <td>${wslServerUsers[log.ip]}</td>
                            <td>${log.commandId}</td>
                            <td>${convertWSLCommandTime(log.timestamp)}</td>
                            <td>${log.command}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
}

function convertWSLCommandTime(timestamp) {
    return luxon.DateTime.fromFormat(timestamp, "yyyy-MM-dd HH:mm:ss", { zone: "America/Chicago" })
        .setZone(luxon.DateTime.local().zoneName)
        .toFormat("hh:mm a, dd LLL yyyy");
}

window.refreshTable = async function() {
    const userFilter = document.getElementById('userFilter').value;
    const commandFilter = document.getElementById('commandFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;

    const logText = await fetchWSLCommands();
    const logData = parseLogData(logText);

    let filteredData = logData;

    if (userFilter) {
        filteredData = filteredData.filter(log => log.ip === userFilter);
    }
    if (commandFilter) {
        filteredData = filteredData.filter(log => log.commandId === commandFilter);
    }
    if (dateFilter) {
        filteredData = filteredData.filter(log => log.timestamp.startsWith(dateFilter));
    }

    const tbody = document.querySelector("#logTable tbody");
    tbody.innerHTML = filteredData.map(log => `
        <tr ${log.command.includes('sudo') ? 'class="sudo-command"' : ''}>
            <td>${wslServerUsers[log.ip]}</td>
            <td>${log.commandId}</td>
            <td>${convertWSLCommandTime(log.timestamp)}</td>
            <td>${log.command}</td>
        </tr>
    `).join('');
}

function convertToLocalTime(input, gmtOffset='GMT-6') {
    const inputWithOffset = `${input} ${gmtOffset}`;
    const date = new Date(inputWithOffset);

    const timeString = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    const dateString = date.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });

    return `${timeString}, ${dateString}`;
}

function formatDate(date) {
    try {
        if (!date) return '';
        
        let meetingDateTime;
        meetingDateTime = new Date(date);
        
        if (isNaN(meetingDateTime.getTime())) {
            meetingDateTime = new Date(date + 'T00:00:00Z');
            
            if (isNaN(meetingDateTime.getTime())) {
                throw new Error('Invalid date format');
            }
        }
        
        const formatter = new Intl.DateTimeFormat('default', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC'
        });

        return formatter.format(meetingDateTime);
    } catch (error) {
        console.error('Error formatting meeting date:', error);
        return typeof date === 'string' ? date : 'Invalid Date';
    }
}

addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuthState();
    if (user) {
        userData = user;
        console.log('User data:', userData);
        await showDashboard();
    } else {
        await signOutUser();
        window.location.href = '/';
    }
});