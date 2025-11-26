const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const wifi = require('node-wifi');
// ---- WIFI MODÜLÜ ----
wifi.init({ iface: null }); // choose interface automatically

// ---- SERIAL PORT SETTINGS ----
const ESP_PORT = "COM3";   
const ESP_BAUD = 115200;

const port = new SerialPort({ path: ESP_PORT, baudRate: ESP_BAUD });
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

// ---- EXPRESS + SOCKET.IO ----
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const authService = require('./src/services/authService');
// ---- MIDDLEWARE ----
app.use(cors());
app.use(express.json());
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// We'll register static serving after protected routes so we can protect index.html

// ---- VERİ SAKLAMA ----
let detectedAttacks = [];
let networkDevices = [];
let lastAttack = null;

// ---- SERİ PORT VERİ OKUMA ----
parser.on("data", (lineRaw) => {
    const line = lineRaw.trim();
    console.log("[ESP]", line);

    if (!line.startsWith("EVENT;")) return;

    const parts = line.split(";");

    if (parts.length === 4) {
        const timestamp = Number(parts[1]);
        const macAddress = parts[2];
        const rssi = Number(parts[3]);

        const severity = Math.abs(rssi) < 60 ? 3 :
                         Math.abs(rssi) < 75 ? 2 : 1;

        const attack = {
            id: timestamp,
            timestamp,
            macAddress,
            attackType: "Deauth",
            signalStrength: rssi,
            severity
        };

        detectedAttacks.unshift(attack);
        if (detectedAttacks.length > 200) detectedAttacks.pop();

        lastAttack = attack;

        io.emit("newAttack", attack);
        io.emit("attackUpdate", detectedAttacks);

        io.emit("securityStatus", {
            threatLevel: severity === 3 ? "High" :
                         severity === 2 ? "Medium" : "Low",
            lastAttack: attack
        });
    }
});

// ---- PORT DURUM LOG ----
port.on("open", () => console.log("✅ Serial Port Açıldı:", ESP_PORT));
port.on("error", (err) => console.log("❌ Seri Port Hatası:", err.message));

// ---- ROUTES ----
// Redirect root to login page so first open shows login
app.get("/", (req, res) => {
    res.redirect('/login');
});

// Serve login page explicitly
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    try {
        const token = await authService.login(username, password);
        // Set token as cookie for server-side protected routes and also return it to client
        res.cookie('token', token, { httpOnly: false });
        res.json({ success: true, token });
    } catch (err) {
        res.status(401).json({ success: false, error: err.message || 'Invalid credentials' });
    }
});

// Middleware to protect pages (checks cookie or Authorization header)
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader && authHeader.split(' ')[1];
    const token = tokenFromHeader || req.cookies?.token;
    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = authService.verifyToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        return res.redirect('/login');
    }
}

// Protect the dashboard page so it cannot be opened without a valid token
app.get('/index.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global guard: protect any HTML page (except /login) from being served without auth
app.use((req, res, next) => {
    try {
        if (req.method === 'GET' && req.path.endsWith('.html') && req.path !== '/login' && req.path !== '/login.html') {
            const authHeader = req.headers.authorization;
            const tokenFromHeader = authHeader && authHeader.split(' ')[1];
            const token = tokenFromHeader || req.cookies?.token;
            if (!token) return res.redirect('/login');
            // verify token
            authService.verifyToken(token);
        }
    } catch (err) {
        return res.redirect('/login');
    }
    next();
});

// ---- NETWORK INTERFACES ENDPOINT ----
app.get("/api/interfaces", (req, res) => {
    // Örnek arayüzler: Dahili WiFi ve COM3
    const interfaces = [
        { name: "wlan0", description: "Internal WiFi Adapter" },
        { name: "COM3", description: "ESP8266 Serial Port" }
    ];
    res.json(interfaces);
});

app.get("/api/networks", (req, res) => {
    res.json(networkDevices);
});

app.get("/api/attacks", (req, res) => {
    res.json(detectedAttacks);
});

// ---- SOCKET.IO CLIENT BAĞLANTISI ----
io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);

    socket.emit("networkUpdate", networkDevices);
    socket.emit("attackUpdate", detectedAttacks);

    socket.emit("securityStatus", {
        threatLevel: lastAttack ?
            (lastAttack.severity === 3 ? "High" :
             lastAttack.severity === 2 ? "Medium" : "Low") :
            "Low",
        lastAttack
    });

    // Monitoring başlatma
    socket.on('startMonitoring', async ({ interface }) => {
        if (interface === 'wlan0') {
            wifi.init({ iface: 'wlan0' });
            try {
                const networks = await wifi.scan();
                networkDevices = networks.map(n => ({
                    ssid: n.ssid,
                    bssid: n.bssid,
                    signalStrength: n.signal_level,
                    channel: n.channel,
                    security: n.security,
                    distance: Math.floor(Math.random() * 50) + 5 // Demo amaçlı
                }));
                socket.emit('monitoringStatus', { isMonitoring: true, interface });
                io.emit('networkUpdate', networkDevices);
            } catch (err) {
                console.error('WiFi scan error:', err);
                socket.emit('monitoringResult', { success: false, message: 'WiFi scan failed' });
            }
        } else if (interface === 'COM3') {
            // Seri port ile saldırı dinleme
            socket.emit('monitoringStatus', { isMonitoring: true, interface });
        }
    });

    // Monitoring durdurma
    socket.on('stopMonitoring', () => {
        networkDevices = [];
        socket.emit('monitoringStatus', { isMonitoring: false, interface: null });
        io.emit('networkUpdate', networkDevices);
    });

    socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
    });
});

// ---- SERVER BAŞLAT ----
const PORT = process.env.PORT || 3000;
// Serve static files (after protected routes)
app.use(express.static(path.join(__dirname, 'public')));
server.listen(PORT, () => {
    console.log(`🚀 Server Running: http://localhost:${PORT}`);
});
