const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer'); // Ensure multer is installed and required
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const JWT_SECRET = 'your_jwt_secret'; // Replace with your own secret

// Multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Specify the directory where uploaded files should be stored
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use the original file name
    }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect('mongodb://localhost/chat', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.log('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).send('Username already taken');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.status(201).send('User registered');
    } catch (err) {
        res.status(500).send('Internal server error');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).send('Invalid credentials');
    }
});

app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    const target = req.body.target;

    if (file) {
        const fileUrl = `/uploads/${file.filename}`;
        res.json({ success: true, url: fileUrl, originalFileName: file.originalname });
    } else {
        res.status(400).send('File upload failed');
    }
});

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'login') {
            jwt.verify(data.token, JWT_SECRET, (err, decoded) => {
                if (err) {
                    ws.send(JSON.stringify({ type: 'login', success: false }));
                } else {
                    ws.username = decoded.username;
                    ws.send(JSON.stringify({ type: 'login', success: true }));
                }
            });
        } else if (data.type === 'message') {
            const targetUser = Array.from(wss.clients).find(client => client.username === data.target);
            if (targetUser) {
                targetUser.send(JSON.stringify({ type: 'message', from: ws.username, content: data.content }));
            }
        } else if (data.type === 'file') {
            const targetUser = Array.from(wss.clients).find(client => client.username === data.target);
            if (targetUser) {
                targetUser.send(JSON.stringify({
                    type: 'file',
                    from: ws.username,
                    originalFileName: data.originalFileName,
                    url: data.url
                }));
            }
        }
    });
});

server.listen(8080, () => {
    console.log('Server is listening on port 8080');
});
