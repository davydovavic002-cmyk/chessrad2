// Импортируем необходимые модули
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Создаем приложение Express
const app = express();

// Определяем порт. Render предоставит свой порт через process.env.PORT
const PORT = process.env.PORT || 3000;

// Это важная строка! Она говорит серверу отдавать файлы из текущей папки.
// Так браузер сможет загрузить ваш index.html, script.js, style.css и библиотеки.
app.use(express.static(path.join(__dirname)));

// Создаем HTTP сервер на основе Express приложения
const server = http.createServer(app);

// Создаем WebSocket сервер, привязанный к нашему HTTP серверу
const wss = new WebSocket.Server({ server });

// Используем Set для хранения уникальных подключений (клиентов)
const clients = new Set();

// Эта функция будет выполняться каждый раз, когда новый пользователь подключается
wss.on('connection', (ws) => {
    console.log('Новый клиент подключился');
    clients.add(ws);

    // --- НАЧАЛО НОВОЙ ЛОГИКИ ---
    // Определяем, какой по счету этот игрок, и назначаем ему цвет

    let color;
    if (clients.size === 1) {
        // Первый подключившийся игрок всегда будет белым
        color = 'w';
    } else if (clients.size === 2) {
        // Второй игрок будет черным
        color = 'b';
    } else {
        // Все остальные будут зрителями (пока без особой логики)
        color = 'spectator';
    }

    // Создаем специальное сообщение для отправки новому клиенту
    const colorMessage = {
        type: 'player_color',
        color: color
    };

    // Отправляем сообщение ТОЛЬКО что подключившемуся клиенту
    ws.send(JSON.stringify(colorMessage));
    console.log(`Клиенту назначен цвет: ${color}`);
    // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

    // Обработка сообщений от клиента (когда он делает ход)
    ws.on('message', (message) => {
        console.log(`Получено сообщение от клиента: ${message}`);

        // Рассылаем это сообщение всем ОСТАЛЬНЫМ клиентам
        for (let client of clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        }
    });

    // Обработка закрытия соединения
    ws.on('close', () => {
        console.log('Клиент отключился');
        clients.delete(ws);
    });

    // Обработка ошибок
    ws.on('error', (error) => {
        console.error('Ошибка WebSocket:', error);
    });
});

// Запускаем сервер на прослушивание порта
server.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
