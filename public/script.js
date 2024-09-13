let token = '';
let ws;

async function register() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        alert('User registered successfully');
    } else {
        alert('Registration failed');
    }
}

async function login() {
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;

    const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        const data = await response.json();
        token = data.token;
        connectToWebSocket();
    } else {
        alert('Login failed');
    }
}

function connectToWebSocket() {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'login', token }));
    };

    ws.onmessage = (event) => {
        const parsedMessage = JSON.parse(event.data);

        if (parsedMessage.type === 'login') {
            if (parsedMessage.success) {
                document.getElementById('auth-container').style.display = 'none';
                document.getElementById('chat-container').style.display = 'block';
            }
        } else if (parsedMessage.type === 'message') {
            const chatBox = document.getElementById('chat-box');
            const message = document.createElement('div');
            message.textContent = `${parsedMessage.from}: ${parsedMessage.content}`;
            chatBox.appendChild(message);
            chatBox.scrollTop = chatBox.scrollHeight;
        } else if (parsedMessage.type === 'file') {
            const chatBox = document.getElementById('chat-box');
            const message = document.createElement('div');
            const link = document.createElement('a');
            link.href = parsedMessage.url;
            link.textContent = `${parsedMessage.from} sent a file: ${parsedMessage.originalFileName}`;
            link.target = '_blank';
            message.appendChild(link);
            chatBox.appendChild(message);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    };
}

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const targetUsername = document.getElementById('target-username');
    const message = messageInput.value;
    const target = targetUsername.value;

    if (message && target) {
        ws.send(JSON.stringify({ type: 'message', target, content: message }));
        messageInput.value = '';
    }
}

function sendFile() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    const targetUsername = document.getElementById('target-username').value;

    if (file && targetUsername) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('target', targetUsername);

        fetch('/upload', {
            method: 'POST',
            body: formData
        }).then(response => response.json())
          .then(data => {
              if (data.success) {
                  ws.send(JSON.stringify({
                      type: 'file',
                      target: targetUsername,
                      originalFileName: file.name,
                      url: data.url
                  }));
              } else {
                  alert('File upload failed');
              }
          });
    }
}
