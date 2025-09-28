const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '.')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let players = {}; // Объект для хранения игроков: { 'w': ws, 'b': ws }

// Функция для рассылки сообщений всем подключенным клиентам
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', function connection(ws) {
    let playerColor = null;

    if (!players['w']) {
        playerColor = 'w';
        players['w'] = ws;
    } else if (!players['b']) {
        playerColor = 'b';
        players['b'] = ws;
    } else {
        playerColor = 'spectator';
    }

    console.log(`Новый клиент подключен. Назначен цвет: ${playerColor}`);
    ws.send(JSON.stringify({ type: 'player_color', color: playerColor }));

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);

            // Обрабатываем команды управления игрой
            if (data.type === 'reset_game') {
                console.log('Получен запрос на сброс игры. Рассылка всем.');
                broadcast(JSON.stringify({ type: 'game_reset' }));
            } 
            else if (data.type === 'clear_board') {
                console.log('Получен запрос на очистку доски. Рассылка всем.');
                broadcast(JSON.stringify({ type: 'board_clear' }));
            }
            // Если это не команда, а ход
            else if (data.from && data.to) {
                console.log('Получен ход: %s', message);
                // Пересылаем ход только другому игроку
                wss.clients.forEach(function each(client) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message.toString());
                    }
                });
            }

        } catch (e) {
            console.error('Ошибка при обработке сообщения:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Клиент (${playerColor}) отключился.`);
        // Удаляем игрока из списка при отключении
        if (playerColor && players[playerColor]) {
            delete players[playerColor];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
