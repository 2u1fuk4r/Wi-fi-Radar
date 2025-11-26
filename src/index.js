const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --------------------------------------------------
// ESP8266 SERIAL PORT
// --------------------------------------------------
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const ESP_PORT = "COM3";      // 👉 BURAYI KENDİ PORTUNA GÖRE DEĞİŞTİR
const ESP_BAUD = 115200;

let espPort = null;
let espParser = null;
let isMonitoring = false;
let currentInterface = null;

// Dashboard data
let attackLog = [];
let networkDevices = [];

// --------------------------------------------------
// Distance estimation
// --------------------------------------------------
function estimateDistance(rssi) {
    const txPower = -40;
    const n = 2.0;
    const meters = Math.pow(10, (txPower - rssi) / (10 * n));
    return Number(meters.toFixed(1));
}

// --------------------------------------------------
// Handle incoming serial lines
// --------------------------------------------------
function handleESPLine(lineRaw) {
    const line = lineRaw.trim();
    if (!line) return;

    console.log('[ESP]', line);

    if (line.startsWith("EVENT;")) {
        const parts = line.split(";");
        if (parts.length >= 4) {
            const mac = parts[2];
            const rssi = parseInt(parts[3], 10) || 0;
            const now = Date.now();

            const attack = {
                attackType: "Deauth",
                macAddress: mac,
                timestamp: now,
                signalStrength: rssi,
                distance: estimateDistance(rssi),
                severity: 2
            };

            attackLog.unshift(attack);
            if (attackLog.length > 100) attackLog.pop();

            let dev = networkDevices.find(d => d.bssid === mac);
            if (!dev) {
                dev = {
                    ssid: "Unknown",
                    bssid: mac,
                    signalStrength: rssi,
                    distance: attack.distance,
                    channel: 0,
                    security: "Unknown",
                    angle: Math.random() * 360
                };
                networkDevices.push(dev);
            } else {
                dev.signalStrength = rssi;
                dev.distance = attack.distance;
            }

            io.emit("newAttack", attack);
            io.emit("attackUpdate", attackLog);
            io.emit("networkUpdate", networkDevices);
        }
    }
}

// --------------------------------------------------
// Monitoring Controls
// --------------------------------------------------
function startESPMonitoring() {
    if (isMonitoring) return;

    espPort = new SerialPort({ path: ESP_PORT, baudRate: ESP_BAUD });
    espParser = espPort.pipe(new ReadlineParser({ delimiter: "\n" }));

    espParser.on("data", handleESPLine);
    espPort.on("error", err => console.error("Serial error:", err));

    isMonitoring = true;
    currentInterface = "esp8266";

    io.emit("monitoringStatus", { isMonitoring, interface: currentInterface });
    console.log("Monitoring started");
}

function stopESPMonitoring() {
    if (!isMonitoring) return;

    if (espParser) espParser.removeAllListeners("data");
    if (espPort) espPort.close();

    espParser = null;
    espPort = null;
    isMonitoring = false;
    currentInterface = null;

    io.emit("monitoringStatus", { isMonitoring, interface: currentInterface });
    console.log("Monitoring stopped");
}

// --------------------------------------------------
// INTERFACE LIST FOR FRONTEND DROPDOWN
// --------------------------------------------------
app.get('/api/interfaces', (req, res) => {
    res.json([
        { name: 'esp8266', description: `WiFi Radar via Serial (${ESP_PORT})` }
    ]);
});

// --------------------------------------------------
// SOCKET.IO EVENTS
// --------------------------------------------------
io.on('connection', socket => {
    console.log("Client connected:", socket.id);

    socket.emit("monitoringStatus", { isMonitoring, interface: currentInterface });
    socket.emit("networkUpdate", networkDevices);
    socket.emit("attackUpdate", attackLog);

    socket.on("startMonitoring", startESPMonitoring);
    socket.on("stopMonitoring", stopESPMonitoring);

    socket.on("disconnect", () =>
        console.log("Client disconnected:", socket.id)
    );
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
    console.log(`✅ WiFi Radar server running at http://localhost:${PORT}`)
);
