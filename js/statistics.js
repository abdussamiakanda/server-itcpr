import { where, collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { checkAuthState, signOutUser, db } from "./auth.js";

let userData = null;

async function showStatistics() {
    const navbar = document.getElementById('navbar');
    navbar.innerHTML = `
        <div onclick="goToPage('dashboard')">
            <span class="material-icons">home</span> Dashboard
        </div>
        <div class="selected">
            <span class="material-icons">bar_chart</span> Statistics
        </div>
        <div onclick="goToPage('monitor')">
            <span class="material-icons">track_changes</span> Monitor
        </div>
        <div onclick="goToPage('changelog')">
            <span class="material-icons">history</span> Changelog
        </div>
        <div id="logoutBtn">
            <span class="material-icons">logout</span> Logout
        </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await signOutUser();
        window.location.href = '/';
    });

    await loadStatistics();
}

async function loadStatistics() {
    try {
        const sessionLog = await downloadJson("connection_sessions.json");
        const accessData = await downloadJson("access_codes.json");
        const users = await fetchUsersFromFirestore();

        const { stats, rows, usageByHour, usageByDay } = generateStats(sessionLog, accessData);

        const dashboardContent = document.getElementById('dashboardContent');
        dashboardContent.innerHTML = ``;

        renderSummary(stats, accessData, users);
        plotCharts(stats, users);
        plotTimeline(rows);
        plotUsageByDay(usageByDay);
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('dashboardContent').innerHTML = "<p class='error-message'>Error loading statistics.</p>";
    }
}

async function fetchUsersFromFirestore() {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("serverStorage", ">", 0));
    const snapshot = await getDocs(q);
    const users = {};
    snapshot.forEach(doc => {
        users[doc.id] = doc.data();
    });
    return users;
}

async function downloadJson(filename) {
    const response = await fetch("https://api.itcpr.org/server/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
    });

    if (!response.ok) throw new Error(`Failed to download ${filename}`);
    return await response.json();
}

function generateStats(sessionLog, accessData) {
    const stats = {};
    const rows = [];
    const usageByHour = Array(24).fill(0);
    const usageByDay = {};

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

        stats[key].sessions++;
        stats[key].total_minutes += duration;
        stats[key].ips.add(ip);
        stats[key].durations.push(duration);

        rows.push({ user: key, ip, t_in, t_out, duration });

        usageByHour[t_in.hour]++;
        const day = t_in.toFormat("cccc");
        usageByDay[day] = (usageByDay[day] || 0) + 1;
    }

    return { stats, rows, usageByHour, usageByDay };
}

// Match IP to user profile
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

function renderSummary(stats, accessData, users) {
    const container = document.getElementById('dashboardContent');
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = `
        <div class="section-header">
            <h3>Usage Summary</h3>
        </div>
        <div id="statisticsSummary" class="statistics-summary"></div>
    `;
    container.appendChild(section);

    const summary = section.querySelector('#statisticsSummary');
    summary.innerHTML = Object.entries(stats).map(([user, data]) => {
        const totalMinutes = Math.floor(data.total_minutes);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const firestoreUser = Object.values(users).find(u => u.name === user);
        const storage = ((firestoreUser?.serverStorage || 0) / 1024).toFixed(2);

        return `
            <div class="user-summary">
                <h4>${user}</h4>
                <p>Total Sessions: ${data.sessions}</p>
                <p>Total Time: ${hours}h ${minutes}m</p>
                <p>IPs Used: ${[...data.ips].join(", ")}</p>
                <p>Storage: ${storage} GB</p>
            </div>
        `;
    }).join('');
}

function plotCharts(stats, users) {
    const usersList = Object.keys(stats);
    const sessionCounts = usersList.map(u => stats[u].sessions);
    const totalHours = usersList.map(u => (stats[u].total_minutes / 60).toFixed(2));
    const storageSizes = usersList.map(u => {
        const firestoreUser = Object.values(users).find(user => user.name === u);
        return ((firestoreUser?.serverStorage || 0) / 1024).toFixed(2);
    });

    const container = document.getElementById('dashboardContent');

    const makeBarSection = (title, values, unit) => {
        const section = document.createElement('div');
        section.className = 'section';
        section.innerHTML = `<div class="section-header"><h3>${title}</h3></div>`;
        usersList.forEach((user, i) => {
            const bar = document.createElement('div');
            bar.className = 'bar-row';
            bar.innerHTML = `
                <div class="bar-label">${user}</div>
                <div class="bar-track">
                    <div class="bar-fill animate-bar" style="width: ${(values[i] / Math.max(...values)) * 100}%" title="${values[i]} ${unit}"></div>
                    <span class="bar-value">${values[i]}</span>
                </div>`;
            section.appendChild(bar);
        });
        container.appendChild(section);
    };

    makeBarSection("Sessions per User", sessionCounts, "sessions");
    makeBarSection("Total Connected Time (Hours)", totalHours, "hours");
    makeBarSection("Storage Used (GB)", storageSizes, "GB");
}

function plotTimeline(rows) {
    const users = [...new Set(rows.map(r => r.user))];
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'timeline-wrapper';

    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = `
        <div class="section-header">
            <h3>User Session Timeline</h3>
            <div class="timeline-filters">
                <select id="timeRangeFilter" onchange="updateTimeline()">
                    <option value="day">Last 24 Hours</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="all" selected>All Time</option>
                </select>
            </div>
        </div>
    `;
    section.appendChild(timelineWrapper);
    document.getElementById('dashboardContent').appendChild(section);

    function renderTimeline(filteredRows) {
        timelineWrapper.innerHTML = '';
        const minTime = Math.min(...filteredRows.map(r => r.t_in.toMillis()));
        const maxTime = Math.max(...filteredRows.map(r => r.t_out.toMillis()));
        const totalSpan = maxTime - minTime;

        users.forEach(user => {
            const row = document.createElement('div');
            row.className = 'timeline-row';

            const label = document.createElement('div');
            label.className = 'timeline-label';
            label.textContent = user;
            row.appendChild(label);

            const track = document.createElement('div');
            track.className = 'timeline-track';

            filteredRows.filter(r => r.user === user).forEach(session => {
                const start = session.t_in.toMillis();
                const end = session.t_out.toMillis();
                const leftPercent = ((start - minTime) / totalSpan) * 100;
                const widthPercent = ((end - start) / totalSpan) * 100;

                const bar = document.createElement('div');
                bar.className = 'timeline-bar animate-bar';
                bar.style.left = `${leftPercent}%`;
                bar.style.width = `${widthPercent}%`;
                bar.title = `${session.t_in.toFormat('dd MMM yyyy, hh:mm a')} - ${session.t_out.toFormat('dd MMM yyyy, hh:mm a')}`;
                track.appendChild(bar);
            });

            row.appendChild(track);
            timelineWrapper.appendChild(row);
        });
    }

    // Initial render with all data
    renderTimeline(rows);

    // Add the updateTimeline function to the window object
    window.updateTimeline = function() {
        const filter = document.getElementById('timeRangeFilter').value;
        const now = luxon.DateTime.now();
        let filteredRows;

        switch(filter) {
            case 'day':
                const dayAgo = now.minus({ days: 1 });
                filteredRows = rows.filter(r => r.t_in >= dayAgo);
                break;
            case 'week':
                const weekAgo = now.minus({ weeks: 1 });
                filteredRows = rows.filter(r => r.t_in >= weekAgo);
                break;
            case 'month':
                const monthAgo = now.minus({ months: 1 });
                filteredRows = rows.filter(r => r.t_in >= monthAgo);
                break;
            default:
                filteredRows = rows;
        }

        renderTimeline(filteredRows);
    };
}

function plotUsageByDay(usageByDay) {
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = `<div class="section-header"><h3>Most Active Days</h3></div>`;

    const ordered = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    ordered.forEach(day => {
        const count = usageByDay[day] || 0;
        const bar = document.createElement('div');
        bar.className = 'bar-row';
        bar.innerHTML = `
            <div class="bar-label">${day}</div>
            <div class="bar-track">
                <div class="bar-fill animate-bar" style="width: ${(count / Math.max(...Object.values(usageByDay))) * 100}%" title="${count} sessions"></div>
                <span class="bar-value">${count}</span>
            </div>`;
        section.appendChild(bar);
    });

    document.getElementById('dashboardContent').appendChild(section);
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