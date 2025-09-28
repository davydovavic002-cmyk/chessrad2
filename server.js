const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// 1. Создаем HTTP-сервер, который будет отдавать наши файлы
const server = http.createServer((req, res) => {
    // Определяем путь к файлу
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html'; // Главная страница
    }

    // Определяем тип контента
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Читаем и отдаем файл
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 2. Создаем WebSocket-сервер и "привязываем" его к нашему HTTP-серверу
//    Вот эта строчка - самая важная! { server }
const wss = new WebSocket.Server({ server });

const clients = new Set();

// 3. Настраиваем логику WebSocket-сервера
wss.on('connection', (ws) => {
    console.log('Новый клиент подключился');
    clients.add(ws);

    ws.on('message', (message) => {
        console.log(`Получено сообщение: ${message}`);
        // Рассылаем сообщение всем подключенным клиентам
        for (let client of clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        }
    });

    ws.on('close', () => {
        console.log('Клиент отключился');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('Ошибка WebSocket:', error);
    });
});

// 4. Запускаем HTTP-сервер (который теперь "тащит" за собой и WebSocket-сервер)
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    // Эта строка теперь будет видна в логах Render
    console.log(`Server is running on port ${PORT}`);
});
