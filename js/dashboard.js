import { doc, getDoc, collection, getDocs, query, orderBy, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { checkAuthState, signOutUser, db } from "./auth.js";
import { sendEmail, getEmailTemplate } from './email.js';
import { authenticateZeroTierMember, deauthenticateZeroTierMember } from "./zerotier.js";

window.copyResilioToClip = copyResilioToClip;
window.loadServerAccessModal = loadServerAccessModal;
window.submitServerAccess = submitServerAccess;
window.approveRequestModal = approveRequestModal;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.revokeAccess = revokeAccess;
window.editAccessModal = editAccessModal;
window.updateAccess = updateAccess;

let userData = null;
let wslServerUsers = {};
let isServerOnline = false;

async function showDashboard() {
    const navbar = document.getElementById('navbar');
    navbar.innerHTML = `
        <div class="selected">
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

    await getWSLServersUsers();

    const dashboardContent = document.getElementById('dashboardContent');
    dashboardContent.innerHTML = `
        <div class="overview-container" id="overviewContainer"></div>

        <!-- Active Connections -->
        <div class="section">
            <div class="section-header">
                <h3>Server Access</h3>
                ${ userData.serverCode ? `` : `
                    <button class="btn btn-outline" onclick="loadServerAccessModal()">
                        Request Access
                    </button>
                `}
            </div>
            <div class="server-access">
                ${ userData.serverCode ? `
                    You have access to the server with the following credentials:
                    <ul>
                        <li><b>Access Code:</b> ${userData.serverCode}</li>
                        <li><b>IP Address:</b> ${userData.ip.replaceAll(';',', ')}</li>
                        <li><b>SSH Folder Name:</b> /mnt/c/Users/info/Research/${userData.ssh_folder}</li>
                    </ul>
                    ` : `
                    You do not have access to the server. Please request access here.
                `}
            </div>
        </div>

        <!-- Active Connections -->
        <div class="section">
            <div class="section-header">
                <h3>Active Connections</h3>
            </div>
            <div class="server-users-list" id="server-users-list"></div>
        </div>

        <!-- Resilio Sync -->
        ${userData.type === 'admin' || userData.resilio ? `
            <div class="section">
                <div class="section-header">
                    <h3>Resilio Sync</h3>
                    ${ userData.type === 'admin' ? `
                        <button class="btn btn-outline" onclick="addResilioModal()">
                            Add Resilio Sync User
                        </button>
                    ` : ''}
                </div>
                <p>
                    Access your files and sync to your personal computer from the server using the Resilio Sync app. <br>
                    Follow Part 3 of this guide to set up Resilio Sync on your device: <a class="server_guide" target="_blank" href="https://portal.itcpr.org/guide?id=LMZN67tXj7MzmAqjFbiP">Remote Server User Guide</a>
                </p>
                <br>
                <div class="resilio-users-list">
                    ${await showResilioUsers()}
                </div>
            </div>
        ` : ''}

        <!-- Pending Connections -->
        ${userData.type === 'admin' ? `
        <div class="section">
            <div class="section-header">
                <h3>Connections Requests</h3>
            </div>
            <div class="server-request-list">
                ${await getServerRequests()}
            </div>
        </div>
        ` : ''}
        <br>
    `;

    await fetchServerData();

    setInterval(fetchServerData, 20000);
}

async function fetchServerData() {
    try {
        console.log('Fetching server data...');
        const response = await fetch('https://api.itcpr.org/server/stats');
        
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const serverData = await response.json();
        const days = Math.floor(serverData.uptime.hours / 24);
        const hours = serverData.uptime.hours % 24;

        const overviewContainer = document.getElementById('overviewContainer');
        let parsedTime = null;
        if (luxon.DateTime.local().zoneName !== 'America/Chicago') {
            parsedTime = luxon.DateTime.fromFormat(serverData.last_updated, "hh:mm a; LLLL dd, yyyy", { zone: "America/Chicago", locale: "en-US" }).setZone(luxon.DateTime.local().zoneName);
        } else {
            parsedTime = luxon.DateTime.fromFormat(serverData.last_updated, "hh:mm a; LLLL dd, yyyy", { zone: "America/Chicago", locale: "en-US" });
        }
        const now = luxon.DateTime.local();

        const diffInMinutes = now.diff(parsedTime, "minutes").toObject().minutes;

        console.log(serverData.last_updated);

        if (diffInMinutes > 2 && userData.zerotierId) {
            isServerOnline = false;
            overviewContainer.innerHTML = `
                <div class="stat-card-full">
                    <p class="description">
                        The server is currently powered off.
                        Contact us to power it on.
                    </p>
                </div>
            `;
        } else if (diffInMinutes > 2 && !userData.zerotierId) {
            isServerOnline = false;
            overviewContainer.innerHTML = `
                <div class="stat-card-full">
                    <p class="description">
                        The server is currently powered off.
                    </p>
                </div>
            `;
        } else {
            isServerOnline = true;
            overviewContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">dns</span>
                    <span class="stat-title">Server Memory</span>
                </div>
                <div class="stat-value">${serverData.memory.percent_used}</div>
                <div class="stat-info">Used: ${serverData.memory.used} / ${serverData.memory.total}</div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">save</span>
                    <span class="stat-title">Server Storage</span>
                </div>
                <div class="stat-value">${serverData.disk.percent_used}</div>
                <div class="stat-info">Used: ${serverData.disk.used} / ${serverData.disk.total}</div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="material-icons stat-icon">device_thermostat</span>
                    <span class="stat-title">Server Temperature</span>
                </div>
                <div class="stat-value">${serverData.cpu_temperature}&#176; C</div>
                <div class="stat-info">Uptime: ${days} days, ${hours} hours</div>
            </div>
            `;
        }

        await getServerUsers(serverData.active_connections);
    } catch (error) {
        console.error('Error loading server content:', error);
        elements.contentArea.innerHTML = `<p class="error-message">Error loading server details.</p>`;
    }
}

window.goToPage = async function(page) {
    window.location.href = `./${page}`;
}

export async function loadServerAccessModal() {
    if (userData.ip) {
        alert('You already have access to the server.');
    } else if (!userData.ip && userData.zerotierId) {
        alert('Your access is pending approval.');
    } else {
        const modalContent = `
        <div class="modal-content">
                <div class="modal-header">
                    <h3>Request Server Access</h3>
                    <button class="btn-close" onclick="closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <p>
                            Access to the server is limited to authorized users only.
                            Please familiarize yourself with how to use the server and its resources.
                            Join the ITCPR ZeroTier network after downloading the ZeroTier
                            Client app and using your ZeroTier ID.
                        </p>
                    </div>
                    <div class="form-group">
                        <label for="zerotierId">ZeroTier Address</label>
                        <input type="text" id="zerotierId" class="form-control" required>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="submitServerAccess()">Request Access</button>
                </div>
            </div>
        `;
        showModal(modalContent);
    }
}

async function submitServerAccess() {
    const zerotierId = document.getElementById('zerotierId').value;
    if (!zerotierId) {
        alert('Please enter your ZeroTier ID.');
        return;
    }

    const userRef = doc(db, 'users', userData.uid);
    await updateDoc(userRef, {
        zerotierId: zerotierId,
    });
    await sendEmail(userData.email, 'Server Access Request', getEmailTemplate(userData.name, `
        <p>Your request for server access has been received. Please wait for approval.</p>
        <p>You will receive an email when your access is approved and an IP address is assigned.</p>
        <p>Your ZeroTier ID: <b>${zerotierId}</b></p>
    `));
    await sendEmail('abdussamiakanda@gmail.com', 'Server Access Request', getEmailTemplate('Md Abdus Sami Akanda', `
        <p>${userData.name} has requested server access.</p>
        <p>ZeroTier ID: <b>${zerotierId}</b></p>
        <p>Please review and approve or reject the request.</p>
    `));
    closeModal();
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

async function getServerUsers(activeConnections) {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const users = usersSnapshot.docs.map(doc => doc.data());

    let connectedUsers = '';

    const activeIps = new Set(Object.keys(activeConnections));

    for (const user of users) {
        if (user.ip) {
            const userIps = user.ip.split(';');
            const isConnected = userIps.some(ip => activeIps.has(ip));

            if (isConnected && isServerOnline) {
                const connectedIp = userIps.find(ip => activeIps.has(ip));
                const conn = activeConnections[connectedIp];
                connectedUsers +=`
                    <tr>
                        <td>${user.name}</td>
                        <td>${convertToLocalTime(conn.connected_at)}</td>
                        <td>${conn.port === 22 ? 'SSH' : 'Remote Desktop'}</td>
                    </tr>
                `;
            }
        }
    }

    document.getElementById('server-users-list').innerHTML = `
        <table class="server-users-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Last Connected</th>
                    <th>Connection Type</th>
                </tr>
            </thead>
            <tbody>
                ${connectedUsers ? connectedUsers : '<tr><td colspan="4" style="text-align:center;">No active connections found.</td></tr>'}
            </tbody>
        </table>
    `;
}

async function showResilioUsers() {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('name', 'asc'));
    const userSnap = await getDocs(q);

    let userOptions = '';
    userSnap.docs.forEach(doc => {
        const user = doc.data();
        if (user.resilio && userData.type === 'admin') {
            userOptions += `
                <div class="resilio-user-card">
                    <div class="name">${user.name}</div>
                    <div class="link">${user.resilio}</div>
                    <div class="spacer"></div>
                    <div class="delete" onclick="removeResilio('${doc.id}')"><span class="material-icons">delete</span> </div>
                    <div class="copy" onclick="copyResilioToClip('${user.resilio}')"><span class="material-icons">content_copy</span> </div>
                </div>
            `;
        } else if (user.resilio && userData.uid === doc.id) {
            userOptions += `
                <div class="resilio-user-card">
                    <div class="name">${user.name}</div>
                    <div class="link">${user.resilio}</div>
                    <div class="spacer"></div>
                    <div class="copy"><span class="material-icons">content_copy</span> </div>
                </div>
            `;
        }
    });
    return userOptions;
}

window.removeResilio = async function(uid) {
    if (!confirm('Are you sure you want to remove this Resilio Sync link?')) {
        return;
    }
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        resilio: deleteField(),
    });
    await showDashboard();
}

window.addResilioModal = async function () {
    const usersRef = collection(db, 'users');
    const userSnap = await getDocs(usersRef);

    let userOptions = '';
    userSnap.docs.forEach(doc => {
        const user = doc.data();
        if (!user.resilio) {
            userOptions += `
                <option value="${doc.id}">
                    ${user.name} (${user.group.charAt(0).toUpperCase() + user.group.slice(1)})
                </option>
            `;
        }
    });

    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add Resilio Sync User</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="userId">Select User</label>
                    <select id="userId" class="form-control">
                        <option value="">Select a user...</option>
                        ${userOptions}
                    </select>
                </div>
                <div class="form-group" id="collaborator-input">
                    <label for="resilioLink">Resilio Sync URL</label>
                    <input type="text" id="resilioLink" class="form-control" placeholder="Enter Resilio Sync URL...">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="submitResilioLink()">Add Link</button>
            </div>
        </div>
    `;

    showModal(modalContent);
}

window.submitResilioLink = function () {
    const userId = document.getElementById('userId').value;
    const resilioLink = document.getElementById('resilioLink').value;

    if (!userId || !resilioLink) {
        alert('Please fill in all fields.');
        return;
    }

    const userRef = doc(db, 'users', userId);
    updateDoc(userRef, {
        resilio: resilioLink,
    }).then(() => {
        closeModal();
        showDashboard();
    }).catch(error => {
        console.error('Error adding Resilio Sync link:', error);
        alert('Error adding Resilio Sync link. Please try again later.');
    });
}

function copyResilioToClip(link) {
    navigator.clipboard.writeText(link).then(() => {
        alert('Resilio Sync link copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
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

async function getNewUserCodes() {
    const usersRef = collection(db, 'users');
    const userSnap = await getDocs(usersRef);
    const users = userSnap.docs.map(doc => doc.data());

    const usedIPs = new Set();
    const usedCodes = new Set();

    for (const user of users) {
        if (user.ip) {
            const baseIP = user.ip.split(';')[0];
            usedIPs.add(baseIP);
        }
        if (user.serverCode) {
            usedCodes.add(user.serverCode);
        }
    }

    const subnetPrefix = '10.144.172.';
    let nextAvailable = 10;
    let newUserCode;

    while (nextAvailable < 255) {
        const candidateIP = subnetPrefix + nextAvailable;
        if (!usedIPs.has(candidateIP)) {
            var newUserIP = candidateIP;
            break;
        }
        nextAvailable++;
    }

    do {
        newUserCode = Math.floor(1000 + Math.random() * 9000).toString();
    } while (usedCodes.has(newUserCode));
    return {newUserIP, newUserCode};
}

async function approveRequestModal(uid) {
    const { newUserIP, newUserCode } = await getNewUserCodes();

    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Approve Server Access Request</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="ip">IP Address</label>
                    <input type="text" id="ip" class="form-control" value="${newUserIP}" required>
                </div>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="server_code">Access Code</label>
                    <input type="text" id="server_code" class="form-control" value="${newUserCode}" required>
                </div>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="ssh_folder">SSH Folder Name</label>
                    <input type="text" id="ssh_folder" class="form-control" required>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="approveRequest('${uid}')">Approve</button>
            </div>
        </div>
    `;
    showModal(modalContent);
}

async function approveRequest(uid) {
    const ip = document.getElementById('ip').value;
    const serverCode = document.getElementById('server_code').value;
    const ssh_folder = document.getElementById('ssh_folder').value;
    if (!ip || !serverCode || !ssh_folder) {
        alert('Please fill in all fields.');
        return;
    }
    document.getElementById(`approve-${uid}`).innerHTML = 'Loading...';
    const userRef = doc(db, 'users', uid);
    const user = await getDoc(userRef);
    await updateDoc(userRef, {
        ip: ip,
        serverCode: serverCode,
        ssh_folder: ssh_folder,
    });
    await showDashboard();
    await sendEmail(user.data().email, 'Server Access Request', getEmailTemplate(user.data().name, `
        <p>Your request for server access has been approved.</p>
        <p>
            <b>Your Credentials:</b>
            <ul>
                <li>IP Address: ${ip} </li>
                <li>Access Code: ${serverCode}</li>
                <li>SSH Folder Name: ${ssh_folder}</li>
            </ul>
        </p>
        <p>Please refer to the Guides section for detailed instructions on using the server. Access will be available within five minutes.</p>
    `));
    await authenticateZeroTierMember(user.data().zerotierId, ip, ssh_folder);
    await updateAccessCodeJson();
    closeModal();
}

async function rejectRequest(uid) {
    document.getElementById(`approve-${uid}`).innerHTML = 'Loading...';
    const userRef = doc(db, 'users', uid);
    const user = await getDoc(userRef);

    try {
        await sendEmail(user.data().email, 'Server Access Request', getEmailTemplate(user.data().name, `
            <p>Your request for server access has been deleted.</p>
            <p>Please contact the admin for more information.</p>
        `));
    } catch (error) {
        console.error(`Failed to send rejection email to ${user.data().email}:`, error);
    }

    try {
        await updateDoc(userRef, {
            zerotierId: deleteField()
        });
    } catch (error) {
        console.error(`Failed to delete documents for UID ${uid}:`, error);
    }
    await showDashboard();
}

async function revokeAccess(uid) {
    document.getElementById(`revoke-${uid}`).innerHTML = 'Loading...';
    const userRef = doc(db, 'users', uid);
    const user = await getDoc(userRef);
    await updateDoc(userRef, {
        ip: deleteField(),
        serverCode: deleteField(),
    });
    await sendEmail(user.data().email, 'Server Access Revoked', getEmailTemplate(user.data().name, `
        <p>Your server access has been revoked.</p>
        <p>Please contact the admin for more information.</p>
    `));
    await showDashboard();
    await deauthenticateZeroTierMember(user.data().zerotierId);
    await updateAccessCodeJson();
}

async function updateAccessCodeJson() {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    const accessCodes = {};

    usersSnapshot.docs.forEach(doc => {
        const serverUserData = doc.data();
        const userName = serverUserData.name;
        const ip = serverUserData.ip;
        const ssh_folder = serverUserData.ssh_folder;
        
        if (serverUserData.serverCode && ip) {
            accessCodes[serverUserData.serverCode] = {
                name: userName,
                ip: ip,
                ssh_folder: ssh_folder
            };
        }
    });

    const jsonString = JSON.stringify(accessCodes, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const formData = new FormData();
    formData.append('file', blob, 'access_codes.json');

    try {
        const response = await fetch('https://api.itcpr.org/server/access', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();
        if (response.ok) {
            console.log("Access codes uploaded successfully:", result.message);
        } else {
            console.error("Upload failed:", result.error);
        }
    } catch (error) {
        console.error("Upload error:", error);
    }
}

async function editAccessModal(uid) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const usrData = userSnap.data();

    const modalContent = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Approve Server Access Request</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="ip">IP Address</label>
                    <input type="text" id="ip" class="form-control" value="${usrData.ip}" required>
                </div>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="server_code">Access Code</label>
                    <input type="text" id="server_code" class="form-control" value="${usrData.serverCode}" required>
                </div>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="ssh_folder">SSH Folder Name</label>
                    <input type="text" id="ssh_folder" class="form-control" value="${usrData.ssh_folder}" required>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="updateAccess('${uid}')">Update</button>
            </div>
        </div>
    `;
    showModal(modalContent);
}

async function updateAccess(uid) {
    const ip = document.getElementById('ip').value;
    const serverCode = document.getElementById('server_code').value;
    const ssh_folder = document.getElementById('ssh_folder').value;
    if (!ip || !serverCode || !ssh_folder) {
        alert('Please fill in all fields.');
        return;
    }
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        ip: ip,
        serverCode: serverCode,
        ssh_folder: ssh_folder,
    });
    await showDashboard();
    await updateAccessCodeJson();
    closeModal();
}

async function getServerRequests() {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('name', 'asc'));
    const usersSnapshot = await getDocs(q);
    const users = usersSnapshot.docs.map(doc => doc.data());

    let requestsHtml = '';

    for (const user of users) {
        if (user.zerotierId && !user.ip) {
            requestsHtml += `
                <div class="server-user-card">
                    <div class="server-user-header">
                        <p>
                            ${user.name}<br>
                            <span class="text-medium">ZeroTier ID: ${user.zerotierId}</span>
                        </p>
                    </div>
                    <div class="server-user-actions" id="approve-${user.uid}">
                        <button class="btn btn-success btn-sm" onclick="approveRequestModal('${user.uid}')"><span class="material-icons">check</span> Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectRequest('${user.uid}')"><span class="material-icons">close</span> Delete</button>
                    </div>
                </div>
            `;
        } else if (user.ip && user.zerotierId) {
            requestsHtml += `
                <div class="server-user-card">
                    <div class="server-user-header">
                        <p>
                            ${user.name}<br>
                            <span class="text-medium">ZeroTier ID: ${user.zerotierId}</span>
                        </p>
                    </div>
                    <div class="server-user-actions" id="revoke-${user.uid}">
                        <button class="btn btn-success btn-sm" onclick="editAccessModal('${user.uid}')"><span class="material-icons">edit</span> Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="revokeAccess('${user.uid}')"><span class="material-icons">close</span> Revoke</button>
                    </div>
                </div>
            `;
        }
    }

    return requestsHtml;
}

// window.sendWakeCommand = async function () {
//     console.log('Sending wake command...');
//     try {
//         const response = await fetch('https://api.itcpr.org/server/wake', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({ username: userData.name })
//         });

//         if (!response.ok) {
//             const errorText = await response.text();
//             throw new Error(`Server responded with ${response.status}: ${errorText}`);
//         }

//         const result = await response.text();
//         console.log(result);
//         const overviewContainer = document.getElementById('overviewContainer');
//         overviewContainer.innerHTML = `
//             <div class="stat-card-full">
//                 <p class="description">
//                     Server wake command sent successfully.
//                     Use the button below to remotely power off the server via ESP32-based Wake-on-LAN.
//                     This works only if the ESP32 device is online and connected to the server network. So, it may work most of the time.
//                 </p>
//             </div>
//         `;
//         return result;
//     } catch (error) {
//         console.error('Error sending wake command:', error);
//         return null;
//     }
// }

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
        await showDashboard();
    } else {
        await signOutUser();
        window.location.href = '/';
    }
});