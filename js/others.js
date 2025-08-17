import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { checkAuthState, signOutUser, db } from "./auth.js";
import { sendEmail, getEmailTemplate } from './email.js';
import { authenticateZeroTierMember, deauthenticateZeroTierMember } from "./zerotier.js";

let userData = null;

async function showDashboard() {
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
        <div onclick="goToPage('monitor')">
            <span class="material-icons">track_changes</span>
            Monitor
        </div>
        <div onclick="goToPage('changelog')">
            <span class="material-icons">history</span>
            Changelog
        </div>
        <div class="selected">
            <span class="material-icons">expand_circle_down</span>
            Others
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

    const serverRef = collection(db, 'servers');
    const serverSnapshot = await getDocs(serverRef);
    const serverData = serverSnapshot.docs.map(doc => { return { id: doc.id, ...doc.data() } });

    const dashboardContent = document.getElementById('dashboardContent');
    dashboardContent.innerHTML = `
        <div class="section">
            <div class="section-header">
                <h3>Beta Server Info</h3>
            </div>
            <div class="overview-container" id="overviewContainerBeta"></div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <h3>Gamma Server Info</h3>
            </div>
            <div class="overview-container" id="overviewContainerGamma"></div>
        </div>

        <div class="section">
            <div class="section-header">
                <h3>Access Information</h3>
            </div>
            <div class="section-content">
                <p>
                    These are external servers that are maintained by ITCPR for technical support
                    and administration. Access is granted exclusively to authorized direct students,
                    who may also use ITCPR's primary server when required.
                </p>
            </div>
            ${userData.lab ? `
                <br>
                <div class="server-access">
                    You have access to these servers with the following credentials:
                    <div class="server-credentials">
                        ${
                            serverData.map(server => userData.lab.includes(server.lab) ? `
                            <ul>
                                <li><b>Server/PC:</b> ${server.pc}</li>
                                <li><b>Network:</b> ${server.network}</li>
                                <li><b>Username:</b> ${server.username}</li>
                                <li><b>Password:</b> ${server.password}</li>
                                <li><b>Owner:</b> ${server.owner}</li>
                            </ul>
                            ` : '').join('')
                        }
                    </div>
                    <div class="note">
                        <small>**Note: Please keep your credentials secure and do not share them with anyone.</small>
                        <br>
                        <small>**Network: This is the zerotier network ID.</small>
                    </div>
                    <div class="server-guide">
                        If you're joining the server for the first time, after you join the zerotier network,
                        contact us to get authorization. After that, you can access the server using the provided credentials.
                    </div>
                </div>
            ` : ''}
        </div>

        <br>
    `;

    await fetchServerData();

    setInterval(fetchServerData, 20000);
}

async function fetchServerData() {
    try {
        console.log('Fetching server data...');
        const responseBeta = await fetch('https://api.itcpr.org/server/stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file: 'server_stats_beta.json'
            })
        });
        const responseGamma = await fetch('https://api.itcpr.org/server/stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file: 'server_stats_beta.json'
            })
        });
        if (!responseBeta.ok || !responseGamma.ok) {
            throw new Error('Network response was not ok');
        }

        const serverDataBeta = await responseBeta.json();
        const daysBeta = Math.floor(serverDataBeta.uptime.hours / 24);
        const hoursBeta = serverDataBeta.uptime.hours % 24;

        const serverDataGamma = await responseGamma.json();
        const daysGamma = Math.floor(serverDataGamma.uptime.hours / 24);
        const hoursGamma = serverDataGamma.uptime.hours % 24;

        const overviewContainerBeta = document.getElementById('overviewContainerBeta');
        const overviewContainerGamma = document.getElementById('overviewContainerGamma');

        let parsedTimeBeta = null;
        let parsedTimeGamma = null;

        if (luxon.DateTime.local().zoneName !== 'Asia/Dhaka') {
            parsedTimeBeta = luxon.DateTime.fromFormat(serverDataBeta.last_updated, "hh:mm a; LLLL dd, yyyy", { zone: "Asia/Dhaka", locale: "en-US" }).setZone(luxon.DateTime.local().zoneName);
            parsedTimeGamma = luxon.DateTime.fromFormat(serverDataGamma.last_updated, "hh:mm a; LLLL dd, yyyy", { zone: "Asia/Dhaka", locale: "en-US" }).setZone(luxon.DateTime.local().zoneName);
        } else {
            parsedTimeBeta = luxon.DateTime.fromFormat(serverDataBeta.last_updated, "hh:mm a; LLLL dd, yyyy", { zone: "Asia/Dhaka", locale: "en-US" });
            parsedTimeGamma = luxon.DateTime.fromFormat(serverDataGamma.last_updated, "hh:mm a; LLLL dd, yyyy", { zone: "Asia/Dhaka", locale: "en-US" });
        }
        const now = luxon.DateTime.local();
        const diffInMinutesBeta = now.diff(parsedTimeBeta, "minutes").toObject().minutes;
        const diffInMinutesGamma = now.diff(parsedTimeGamma, "minutes").toObject().minutes;

        if (diffInMinutesBeta > 2) {
            overviewContainerBeta.innerHTML = `
                <div class="stat-card-full">
                    <p class="description">
                        The server is currently powered off.
                        Contact us to power it on.
                    </p>
                </div>
            `;
        } else {
            overviewContainerBeta.innerHTML = `
            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">dns</span>
                    <span class="stat-title">Server Memory</span>
                </div>
                <div class="stat-value">${serverDataBeta.memory.percent_used}</div>
                <div class="stat-info">Used: ${serverDataBeta.memory.used} / ${serverDataBeta.memory.total}</div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">save</span>
                    <span class="stat-title">Server Storage</span>
                </div>
                <div class="stat-value">${serverDataBeta.disk.percent_used}</div>
                <div class="stat-info">Used: ${serverDataBeta.disk.used} / ${serverDataBeta.disk.total}</div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">device_thermostat</span>
                    <span class="stat-title">Server Temperature</span>
                </div>
                <div class="stat-value">${serverDataBeta.cpu_temperature}&#176; C</div>
                <div class="stat-info">Uptime: ${daysBeta} days, ${hoursBeta} hours</div>
            </div>
            `;
        }

        if (diffInMinutesGamma > 2) {
            overviewContainerGamma.innerHTML = `
                <div class="stat-card-full">
                    <p class="description">
                        The server is currently powered off.
                        Contact us to power it on.
                    </p>
                </div>
            `;
        } else {
            overviewContainerGamma.innerHTML = `
            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">dns</span>
                    <span class="stat-title">Server Memory</span>
                </div>
                <div class="stat-value">${serverDataGamma.memory.percent_used}</div>
                <div class="stat-info">Used: ${serverDataGamma.memory.used} / ${serverDataGamma.memory.total}</div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">save</span>
                    <span class="stat-title">Server Storage</span>
                </div>
                <div class="stat-value">${serverDataGamma.disk.percent_used}</div>
                <div class="stat-info">Used: ${serverDataGamma.disk.used} / ${serverDataGamma.disk.total}</div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">device_thermostat</span>
                    <span class="stat-title">Server Temperature</span>
                </div>
                <div class="stat-value">${serverDataGamma.cpu_temperature}&#176; C</div>
                <div class="stat-info">Uptime: ${daysGamma} days, ${hoursGamma} hours</div>
            </div>
            `;
        }
    } catch (error) {
        console.error('Error loading server content:', error);
        elements.contentArea.innerHTML = `<p class="error-message">Error loading server details.</p>`;
    }
}

window.goToPage = async function(page) {
    window.location.href = `./${page}`;
}


export function showModal(content, tab='default') {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'managementModal';
    modal.innerHTML = content;
    if (tab === 'full') {
        modal.style.maxWidth = '90%';
    } else if (tab === 'small') {
        modal.style.maxWidth = '50%';
    }
    document.body.appendChild(modal);
    
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    
    setTimeout(() => {
        modal.classList.add('show');
        backdrop.classList.add('show');
    }, 10);
}

window.closeModal = function () {
    const modal = document.getElementById('managementModal');
    const backdrop = document.querySelector('.modal-backdrop');
    
    if (modal && backdrop) {
        modal.classList.remove('show');
        backdrop.classList.remove('show');
        
        setTimeout(() => {
            modal.remove();
            backdrop.remove();
        }, 300);
    }
}

addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuthState();
    if (user) {
        userData = user;
        await showDashboard();
    } else {
        await signOutUser();
        window.location.href = '/';
    }
});