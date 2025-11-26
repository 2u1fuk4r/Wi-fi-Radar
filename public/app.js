// If not authenticated, redirect to login
if (!localStorage.getItem('token')) {
    window.location.href = '/login';
}

// Connect to Socket.io server
const socket = io();

// Global variables
let networkDevices = [];
let attackLog = [];
let attackChart;
let threatLevel = 'Low';
let isMonitoring = false;
let currentInterface = null;
let recentEvents = [];

// DOM Elements
const clockElement = document.getElementById('clock');
const statusIndicator = document.getElementById('status-indicator');
const statusText = statusIndicator.querySelector('.status-text');
const radarDevicesElement = document.getElementById('radar-devices');
const attackLogElement = document.getElementById('attack-log');
const networkListElement = document.getElementById('network-list');
const networksCountElement = document.getElementById('networks-count');
const attacksCountElement = document.getElementById('attacks-count');
const lastAttackElement = document.getElementById('last-attack');
const threatLevelElement = document.getElementById('threat-level');
const attackBadgeElement = document.getElementById('attack-badge');
const networkBadgeElement = document.getElementById('network-badge');
let recentEventsElement = null;
const eventsBadgeElement = () => document.getElementById('events-badge');

// Initialize the application
function initApp() {
    updateClock();
    setInterval(updateClock, 1000);
    initCharts();
    loadInterfaces();
    // Recent events element reference
    recentEventsElement = document.getElementById('recent-events');
    
    // Socket.io event listeners
    socket.on('networkUpdate', handleNetworkUpdate);
    socket.on('attackUpdate', handleAttackUpdate);
    socket.on('newAttack', handleNewAttack);
    socket.on('monitoringStatus', handleMonitoringStatus);
    socket.on('monitoringResult', handleMonitoringResult);
    
    // Button event listeners
    document.getElementById('startMonitorBtn').addEventListener('click', startMonitoring);
    document.getElementById('stopMonitorBtn').addEventListener('click', stopMonitoring);
}

// Update the clock
function updateClock() {
    const now = new Date();
    clockElement.textContent = now.toLocaleTimeString() + ' | ' + now.toLocaleDateString();
}

// Initialize Chart.js charts
function initCharts() {
    const ctx = document.getElementById('attackChart').getContext('2d');
    
    attackChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Deauth', 'KRACK', 'Evil Twin', 'Beacon Flood', 'Jamming'],
            datasets: [{
                label: 'Attack Types',
                data: [0, 0, 0, 0, 0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(255, 159, 64, 0.5)',
                    'rgba(255, 205, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)'
                ],
                borderColor: [
                    'rgb(255, 99, 132)',
                    'rgb(255, 159, 64)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(153, 102, 255)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// Load available network interfaces
function loadInterfaces() {
    fetch('/api/interfaces')
        .then(response => response.json())
        .then(interfaces => {
            const interfaceSelect = document.getElementById('interfaceSelect');
            interfaceSelect.innerHTML = '';
            
            interfaces.forEach(iface => {
                const option = document.createElement('option');
                option.value = iface.name;
                option.textContent = `${iface.name} - ${iface.description}`;
                interfaceSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error loading interfaces:', error);
            showToast('Error loading network interfaces', 'error');
        });
}

// Start monitoring
function startMonitoring() {
    const interfaceSelect = document.getElementById('interfaceSelect');
    const selectedInterface = interfaceSelect.value;
    
    if (!selectedInterface) {
        showToast('Please select a network interface', 'warning');
        return;
    }
    
    // Update UI to show we're starting
    statusIndicator.className = 'status-indicator scanning';
    statusText.textContent = 'Starting Monitor Mode...';
    
    // Send request to server
    socket.emit('startMonitoring', { interface: selectedInterface });
}

// Stop monitoring
function stopMonitoring() {
    // Update UI to show we're stopping
    statusIndicator.className = 'status-indicator scanning';
    statusText.textContent = 'Stopping Monitor Mode...';
    
    // Send request to server
    socket.emit('stopMonitoring');
}

// Handle monitoring status update
function handleMonitoringStatus(data) {
    isMonitoring = data.isMonitoring;
    currentInterface = data.interface;
    
    // Update UI
    const startBtn = document.getElementById('startMonitorBtn');
    const stopBtn = document.getElementById('stopMonitorBtn');
    const interfaceSelect = document.getElementById('interfaceSelect');
    const monitorStatus = document.getElementById('monitorStatus');
    
    if (isMonitoring) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        interfaceSelect.disabled = true;
        monitorStatus.textContent = `Active on ${currentInterface}`;
        monitorStatus.className = 'badge bg-success';
        statusIndicator.className = 'status-indicator scanning';
        statusText.textContent = 'Active';
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        interfaceSelect.disabled = false;
        monitorStatus.textContent = 'Not Monitoring';
        monitorStatus.className = 'badge bg-secondary';
        statusIndicator.className = 'status-indicator idle';
        statusText.textContent = 'Idle';
    }
}

// Handle monitoring result
function handleMonitoringResult(result) {
    showToast(result.message, result.success ? 'success' : 'error');
}

// Handle network updates from the server
function handleNetworkUpdate(networks) {
    networkDevices = networks;
    updateNetworkList();
    updateRadarDisplay();
    updateSecurityStatus();
    // Add a lightweight recent event
    addRecentEvent('Network', `Detected ${networks.length} network(s)`);
}

// Handle attack log updates from the server
function handleAttackUpdate(attacks) {
    attackLog = attacks;
    updateAttackLog();
    updateAttackChart();
    updateSecurityStatus();
}

// Handle new attack notification
function handleNewAttack(attack) {
    // Only show alert if we're monitoring
    if (!isMonitoring) return;
    
    // Update status indicator
    statusIndicator.className = 'status-indicator alert';
    statusText.textContent = 'Attack Detected!';
    
    // Play alert sound (repeat 3 times quickly)
    let beepCount = 0;
    function beep() {
        playAlertSound();
        beepCount++;
        if (beepCount < 3) setTimeout(beep, 200);
    }
    beep();

    
    // Reset status after 5 seconds
    setTimeout(() => {
        if (isMonitoring) {
            statusIndicator.className = 'status-indicator scanning';
            statusText.textContent = 'Monitoring';
        } else {
            statusIndicator.className = 'status-indicator idle';
            statusText.textContent = 'Idle';
        }
    }, 5000);
    
    // Show toast notification
    showToast(`${attack.attackType} attack detected from ${attack.macAddress}!`, 'danger');
    addRecentEvent('Attack', `${attack.attackType} from ${attack.macAddress}`);
}

// Add an event to the recent events list
function addRecentEvent(type, message) {
    const evt = {
        type,
        message,
        timestamp: new Date().toISOString()
    };
    recentEvents.unshift(evt);
    if (recentEvents.length > 20) recentEvents.pop();
    updateRecentEvents();
}

// Render recent events
function updateRecentEvents() {
    if (!recentEventsElement) return;

    if (recentEvents.length === 0) {
        recentEventsElement.innerHTML = `<div class="text-center text-secondary p-4">No events yet</div>`;
        const badge = eventsBadgeElement(); if (badge) badge.textContent = 0;
        return;
    }

    recentEventsElement.innerHTML = '';
    recentEvents.forEach(evt => {
        const timeAgo = moment(evt.timestamp).fromNow();
        const item = document.createElement('div');
        item.className = 'event-item';

        const left = document.createElement('div');
        left.className = 'event-left';
        const title = document.createElement('div');
        title.className = 'event-type';
        title.textContent = evt.message;
        const time = document.createElement('div');
        time.className = 'event-time';
        time.textContent = timeAgo;
        left.appendChild(title);
        left.appendChild(time);

        const right = document.createElement('div');
        const badge = document.createElement('span');
        if (evt.type === 'Attack') {
            badge.className = 'badge badge-event-attack';
            badge.textContent = 'Attack';
        } else {
            badge.className = 'badge badge-event-network';
            badge.textContent = evt.type;
        }
        right.appendChild(badge);

        item.appendChild(left);
        item.appendChild(right);

        recentEventsElement.appendChild(item);
    });

    const badgeEl = eventsBadgeElement(); if (badgeEl) badgeEl.textContent = recentEvents.length;
}

// Play alert sound
function playAlertSound() {
    // Create audio element
    const audio = new Audio('https://www.soundjay.com/buttons/sounds/beep-08b.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Audio play failed:', e));
}

// Show toast notification
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
    bsToast.show();
    
    // Remove toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// --- Time helpers: normalize timestamps (seconds vs ms) and format safely ---
function parseTimestamp(ts) {
    if (ts === null || ts === undefined) return null;
    const n = Number(ts);
    if (isNaN(n)) return null;
    // If value is very small (likely device uptime in seconds), treat as uptime: subtract from now
    // Use thresholds: < 1e9 (approx < 2001) -> uptime seconds; < 1e12 -> epoch seconds -> *1000
    const now = Date.now();
    if (n < 1e9) {
        // likely uptime seconds
        return now - (n * 1000);
    }
    // if looks like seconds (10 digits) convert to ms
    return n < 1e12 ? n * 1000 : n;
}

function formatRelativeTime(ts) {
    const ms = parseTimestamp(ts);
    if (!ms) return 'Unknown';
    const d = new Date(ms);
    if (isNaN(d.getTime())) return 'Unknown';
    return moment(ms).fromNow();
}

// Update the network list display
function updateNetworkList() {
    if (networkDevices.length === 0) {
        networkListElement.innerHTML = `
            <div class="text-center text-secondary p-4">
                No networks detected yet
            </div>
        `;
        return;
    }
    
    networkListElement.innerHTML = '';
    networkDevices.forEach(device => {
        const signalStrength = Math.abs(device.signalStrength);
        const signalBars = Math.min(5, Math.max(1, Math.ceil((100 - signalStrength) / 20)));
        
        let signalHtml = '';
        for (let i = 1; i <= 5; i++) {
            signalHtml += `<span class="signal-bar ${i <= signalBars ? '' : 'empty'}"></span>`;
        }
        
        const networkItem = document.createElement('div');
        networkItem.className = 'network-item';
        networkItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="network-ssid">${device.ssid || 'Unknown Network'}</div>
                    <div class="network-mac">${device.bssid}</div>
                </div>
                <div class="text-end">
                    <div class="signal-strength">${signalHtml}</div>
                    <div class="text-secondary small">${device.distance}m</div>
                </div>
            </div>
            <div class="d-flex justify-content-between mt-1 text-secondary small">
                <div>Channel: ${device.channel}</div>
                <div>Security: ${device.security}</div>
            </div>
        `;
        
        networkListElement.appendChild(networkItem);
    });
    
    // Update network count badge
    networkBadgeElement.textContent = networkDevices.length;
    networksCountElement.textContent = networkDevices.length;
}

// Update the attack log display
function updateAttackLog() {
    if (attackLog.length === 0) {
        attackLogElement.innerHTML = `
            <div class="text-center text-secondary p-4">
                No attacks detected yet
            </div>
        `;
        return;
    }
    
    attackLogElement.innerHTML = '';
    attackLog.forEach((attack, index) => {
        const attackTime = formatRelativeTime(attack.timestamp);
        
        const attackItem = document.createElement('div');
        attackItem.className = 'attack-item';
        if (index === 0) attackItem.classList.add('new');
        
        attackItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="attack-type severity-${attack.severity}">${attack.attackType}</div>
                <div class="attack-time">${attackTime}</div>
            </div>
            <div class="attack-mac">${attack.macAddress}</div>
            <div class="d-flex justify-content-between mt-1 text-secondary small">
                <div>Distance: ${attack.distance}m</div>
                <div>Signal: ${attack.signalStrength} dBm</div>
            </div>
        `;
        
        attackLogElement.appendChild(attackItem);
    });
    
    // Update attack count badge
    attackBadgeElement.textContent = attackLog.length;
    attacksCountElement.textContent = attackLog.length;
    
    if (attackLog.length > 0) {
        lastAttackElement.textContent = formatRelativeTime(attackLog[0].timestamp);
    } else {
        lastAttackElement.textContent = 'None';
    }
}

// Update the radar display
function updateRadarDisplay() {
    radarDevicesElement.innerHTML = '';
    
    // Add network devices to radar
    networkDevices.forEach(device => {
        const hasAttack = attackLog.some(attack => attack.macAddress === device.bssid);
        const distance = Math.min(device.distance, 100);
        const radius = (distance / 100) * 200;
        if (!device.angle) device.angle = Math.random() * 360;
        const angleRad = device.angle * (Math.PI / 180);
        const x = 200 + radius * Math.cos(angleRad);
        const y = 200 + radius * Math.sin(angleRad);
        const deviceElement = document.createElement('div');
        deviceElement.className = `radar-device ${hasAttack ? 'attack' : 'normal'}`;
        deviceElement.style.left = `${x}px`;
        deviceElement.style.top = `${y}px`;
        // Ağ ismini gösteren label ekle
        const label = document.createElement('div');
        label.className = 'radar-label';
        label.textContent = device.ssid || 'Unknown';
        deviceElement.appendChild(label);
        // Tooltip
        deviceElement.setAttribute('data-bs-toggle', 'tooltip');
        deviceElement.setAttribute('data-bs-placement', 'top');
        deviceElement.setAttribute('title', `${device.ssid || 'Unknown'} (${device.distance}m)`);
        radarDevicesElement.appendChild(deviceElement);
    });
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Update the attack chart
function updateAttackChart() {
    // Count attack types
    const attackCounts = {
        'Deauth': 0,
        'KRACK': 0,
        'Evil Twin': 0,
        'Beacon Flood': 0,
        'Jamming': 0
    };
    
    attackLog.forEach(attack => {
        if (attackCounts[attack.attackType] !== undefined) {
            attackCounts[attack.attackType]++;
        }
    });
    
    // Update chart data
    attackChart.data.datasets[0].data = [
        attackCounts['Deauth'],
        attackCounts['KRACK'],
        attackCounts['Evil Twin'],
        attackCounts['Beacon Flood'],
        attackCounts['Jamming']
    ];
    
    attackChart.update();
}

// Update security status
function updateSecurityStatus() {
    // Calculate threat level based on attack count and recency
    let newThreatLevel = 'Low';
    
    if (attackLog.length > 0) {
        const recentAttacks = attackLog.filter(attack => {
            const ms = parseTimestamp(attack.timestamp);
            if (!ms) return false;
            const attackTime = new Date(ms);
            const now = new Date();
            const diffMinutes = (now - attackTime) / (1000 * 60);
            return diffMinutes < 5; // Attacks in the last 5 minutes
        });
        
        if (recentAttacks.length >= 5) {
            newThreatLevel = 'High';
        } else if (recentAttacks.length >= 2) {
            newThreatLevel = 'Medium';
        } else if (recentAttacks.length >= 1) {
            newThreatLevel = 'Low';
        }
    }
    
    // Update threat level display
    if (newThreatLevel !== threatLevel) {
        threatLevel = newThreatLevel;
        threatLevelElement.textContent = threatLevel;
        
        // Update badge color
        threatLevelElement.className = 'badge';
        if (threatLevel === 'Low') {
            threatLevelElement.classList.add('bg-success');
        } else if (threatLevel === 'Medium') {
            threatLevelElement.classList.add('bg-warning');
        } else {
            threatLevelElement.classList.add('bg-danger');
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);