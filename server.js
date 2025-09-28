const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '.')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {}; // Объект для хранения игроков и их цветов

wss.on('connection', function connection(ws) {
    let clientId = null;
    let color = null;

    // Назначаем цвет новому игроку
    if (!players['w']) {
        color = 'w';
        players['w'] = ws;
        clientId = 'w';
    } else if (!players['b']) {
        color = 'b';
        players['b'] = ws;
        clientId = 'b';
    } else {
        color = 'spectator'; // Если уже есть 2 игрока
    }

    console.log(`Новый клиент подключен. Назначен цвет: ${color}`);
    ws.send(JSON.stringify({ type: 'player_color', color: color }));

    // ИЗМЕНЕНО: Улучшенная обработка сообщений
    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);

            // Определяем тип сообщения от клиента
            // 1. Это запрос на сброс игры
            if (data.type === 'reset_game') {
                console.log('Получен запрос на сброс игры. Рассылка всем.');
                // Рассылаем команду на сброс всем клиентам
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'game_reset' }));
                    }
                });
            } 
            // 2. Это запрос на очистку доски
            else if (data.type === 'clear_board') {
                console.log('Получен запрос на очистку доски. Рассылка всем.');
                 // Рассылаем команду на очистку всем клиентам
                 wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'board_clear' }));
                    }
                });
            }
            // 3. Если у сообщения нет типа, значит это ход
            else if (data.from && data.to) {
                console.log('Получен ход: %s', message);
                // Пересылаем ход другому игроку
                wss.clients.forEach(function each(client) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message.toString());
                    }
                });
            }

        } catch (e) {
            console.error('Ошибка при обработке сообщения от клиента:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Клиент ${clientId} (${color}) отключился.`);
        // Удаляем игрока из списка при отключении
        if (clientId) {
            delete players[clientId];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
