// Set year
document.getElementById('year').textContent = new Date().getFullYear();

// Fetch server stats
fetch('https://api.itcpr.org/server/stats')
    .then(res => res.json())
    .then(data => {
        document.getElementById('lastUpdated').textContent = data.last_updated;
        document.getElementById('memory').textContent = `${data.memory.percent_used}% used (${data.memory.used} / ${data.memory.total})`;
        document.getElementById('disk').textContent = `${data.disk.percent_used}% used (${data.disk.used} / ${data.disk.total})`;
        document.getElementById('temp').textContent = `${data.cpu_temperature} °C`;
        const days = Math.floor(data.uptime.hours / 24);
        const hours = data.uptime.hours % 24;
        document.getElementById('uptime').textContent = `${days} days, ${hours} hours`;
    })
    .catch(err => {
        console.error('Failed to load server stats:', err);
        document.getElementById('lastUpdated').textContent = 'Unavailable';
        document.getElementById('memory').textContent = 'Unavailable';
        document.getElementById('disk').textContent = 'Unavailable';
        document.getElementById('temp').textContent = 'Unavailable';
        document.getElementById('uptime').textContent = 'Unavailable';
    });
