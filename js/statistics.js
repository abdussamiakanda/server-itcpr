// statistics.js
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

// Load statistics data and render all sections
async function loadStatistics() {
    try {
        const sessionLog = await downloadJson("connection_sessions.json");
        const accessData = await downloadJson("access_codes.json");

        const { stats, rows, usageByHour, usageByDay } = generateStats(sessionLog, accessData);

        const dashboardContent = document.getElementById('dashboardContent');
        dashboardContent.innerHTML = ``;

        renderSummary(stats);
        plotCharts(stats);
        plotTimeline(rows);
        plotUsageByDay(usageByDay);
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('dashboardContent').innerHTML = "<p class='error-message'>Error loading statistics.</p>";
    }
}

// Download JSON file
async function downloadJson(filename) {
    const response = await fetch("https://api.itcpr.org/server/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
    });

    if (!response.ok) throw new Error(`Failed to download ${filename}`);
    return await response.json();
}

// Parse logs into stats and row data
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

// Render user summary cards
function renderSummary(stats) {
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

// Render sessions and hours bar charts in HTML
function plotCharts(stats) {
    const users = Object.keys(stats);
    const sessionCounts = users.map(u => stats[u].sessions);
    const totalHours = users.map(u => (stats[u].total_minutes / 60).toFixed(2));

    const container = document.getElementById('dashboardContent');
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = `<div class="section-header"><h3>Sessions per User</h3></div>`;
    container.appendChild(section);

    users.forEach((user, i) => {
        const bar = document.createElement('div');
        bar.className = 'bar-row';
        bar.innerHTML = `
            <div class="bar-label">${user}</div>
            <div class="bar-track">
                <div class="bar-fill animate-bar" style="width: ${sessionCounts[i] * 10}px" title="${sessionCounts[i]} sessions">
                    <span class="bar-value">${sessionCounts[i]}</span>
                </div>
            </div>`;
        section.appendChild(bar);
    });

    const hoursSection = document.createElement('div');
    hoursSection.className = 'section';
    hoursSection.innerHTML = `<div class="section-header"><h3>Total Connected Time (Hours)</h3></div>`;
    container.appendChild(hoursSection);

    users.forEach((user, i) => {
        const bar = document.createElement('div');
        bar.className = 'bar-row';
        bar.innerHTML = `
            <div class="bar-label">${user}</div>
            <div class="bar-track">
                <div class="bar-fill animate-bar" style="width: ${totalHours[i] * 10}px" title="${totalHours[i]} hours">
                    <span class="bar-value">${totalHours[i]}</span>
                </div>
            </div>`;
        hoursSection.appendChild(bar);
    });
}

// Render timeline chart as HTML rows
function plotTimeline(rows) {
    const users = [...new Set(rows.map(r => r.user))];
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'timeline-wrapper';

    const minTime = Math.min(...rows.map(r => r.t_in.toMillis()));
    const maxTime = Math.max(...rows.map(r => r.t_out.toMillis()));
    const totalSpan = maxTime - minTime;

    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = `<div class="section-header"><h3>User Session Timeline</h3></div>`;
    section.appendChild(timelineWrapper);
    document.getElementById('dashboardContent').appendChild(section);

    users.forEach(user => {
        const row = document.createElement('div');
        row.className = 'timeline-row';

        const label = document.createElement('div');
        label.className = 'timeline-label';
        label.textContent = user;
        row.appendChild(label);

        const track = document.createElement('div');
        track.className = 'timeline-track';

        rows.filter(r => r.user === user).forEach(session => {
            const start = session.t_in.toMillis();
            const end = session.t_out.toMillis();
            const leftPercent = ((start - minTime) / totalSpan) * 100;
            const widthPercent = ((end - start) / totalSpan) * 100;

            const bar = document.createElement('div');
            bar.className = 'timeline-bar animate-bar';
            bar.style.left = `${leftPercent}%`;
            bar.style.width = `${widthPercent}%`;
            bar.title = `${session.t_in.toFormat('hh:mm a')} - ${session.t_out.toFormat('hh:mm a')}`;
            track.appendChild(bar);
        });

        row.appendChild(track);
        timelineWrapper.appendChild(row);
    });
}

// Most active day of the week
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
                <div class="bar-fill animate-bar" style="width: ${count * 10}px" title="${count} sessions">
                    <span class="bar-value">${count}</span>
                </div>
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