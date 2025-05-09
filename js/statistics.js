import { checkAuthState, signOutUser, db } from "./auth.js";

let userData = null;

async function showStatistics() {
    const navbar = document.getElementById('navbar');
    navbar.innerHTML = `
        <div onclick="goToPage('dashboard')">
            <span class="material-icons">home</span>
            Dashboard
        </div>
        <div class="selected">
            <span class="material-icons">bar_chart</span>
            Statistics
        </div>
        <div onclick="goToPage('monitor')">
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

    await loadStatistics();
}

async function loadStatistics() {
    try {
        const sessionLog = await downloadJson("connection_sessions.json");
        const accessData = await downloadJson("access_codes.json");

        const { stats, rows } = generateStats(sessionLog, accessData);

        const dashboardContent = document.getElementById('dashboardContent');
        dashboardContent.innerHTML = `
            <div class="section">
                <div class="section-header">
                    <h3>Server Usage Statistics</h3>
                </div>
                <div id="statisticsSummary" class="statistics-summary"></div>
                <canvas id="sessionsChart" height="300"></canvas>
                <canvas id="hoursChart" height="300" style="margin-top:2rem;"></canvas>
            </div>
        `;

        renderSummary(stats);
        plotCharts(stats);
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('dashboardContent').innerHTML = "<p class='error-message'>Error loading statistics.</p>";
    }
}

async function downloadJson(filename) {
    const response = await fetch("https://api.itcpr.org/server/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
    });

    if (!response.ok) {
        throw new Error(`Failed to download ${filename}`);
    }

    return await response.json();
}

function generateStats(sessionLog, accessData) {
    const stats = {};
    const rows = [];

    for (const entry of sessionLog) {
        const ip = entry.ip;
        const user = matchIpToUser(ip, accessData);
        if (!user) continue;

        const key = `${user.name}`;
        const t_in = luxon.DateTime.fromFormat(entry.in, "yyyy-MM-dd HH:mm:ss");
        const t_out = entry.out ? luxon.DateTime.fromFormat(entry.out, "yyyy-MM-dd HH:mm:ss") : luxon.DateTime.now();
        const duration = t_out.diff(t_in, "minutes").minutes;

        if (!stats[key]) {
            stats[key] = {
                sessions: 0,
                total_minutes: 0,
                ips: new Set(),
                durations: []
            };
        }

        stats[key].sessions += 1;
        stats[key].total_minutes += duration;
        stats[key].ips.add(ip);
        stats[key].durations.push(duration);

        rows.push({
            user: key,
            ip,
            t_in,
            t_out,
            duration
        });
    }

    return { stats, rows };
}

function matchIpToUser(ip, accessData) {
    for (const [userId, info] of Object.entries(accessData)) {
        const knownIps = info.ip ? info.ip.split(";") : [];
        if (knownIps.includes(ip)) {
            return {
                id: userId,
                name: info.name || `User ${userId}`,
                ssh_folder: info.ssh_folder || "Unknown"
            };
        }
    }
    return null;
}

function renderSummary(stats) {
    const summary = document.getElementById('statisticsSummary');
    summary.innerHTML = Object.entries(stats).map(([user, data]) => {
        const totalMinutes = Math.floor(data.total_minutes);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        return `
            <div class="user-summary">
                <h4>${user}</h4>
                <p>Total Sessions: ${data.sessions}</p>
                <p>Total Time: ${hours}h ${minutes}m</p>
                <p>IPs Used: ${[...data.ips].join(", ")}</p>
            </div>
        `;
    }).join('');
}

function plotCharts(stats) {
    const users = Object.keys(stats);
    const sessionCounts = users.map(u => stats[u].sessions);
    const totalHours = users.map(u => (stats[u].total_minutes / 60).toFixed(2));

    const ctx1 = document.getElementById('sessionsChart').getContext('2d');
    new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: users,
            datasets: [{
                label: 'Sessions',
                data: sessionCounts,
                backgroundColor: '#00c4cc'
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: { beginAtZero: true },
                y: { ticks: { color: '#ddd' } }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Sessions per User',
                    color: '#00c4cc',
                    font: { size: 18 }
                }
            }
        }
    });

    const ctx2 = document.getElementById('hoursChart').getContext('2d');
    new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: users,
            datasets: [{
                label: 'Total Connected Time (Hours)',
                data: totalHours,
                backgroundColor: '#00c4cc'
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: { beginAtZero: true },
                y: { ticks: { color: '#ddd' } }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Total Connected Time per User',
                    color: '#00c4cc',
                    font: { size: 18 }
                }
            }
        }
    });
}

window.goToPage = function(page) {
    window.location.href = `./${page}`;
};

addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuthState();
    if (user) {
        userData = user;
        await showStatistics();
    } else {
        window.location.href = '/';
    }
});
