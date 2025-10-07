// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { Chess } = require('chess.js');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const game = new Chess();
let players = {}; // { 'w': ws, 'b': ws }

function broadcastGameState() {
    const gameState = {
        type: 'board_state',
        fen: game.fen(),
        turn: game.turn() // Будем также отправлять, чей сейчас ход
    };
    const message = JSON.stringify(gameState);

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
    console.log('Разослал новое состояние доски (FEN):', game.fen());
}

wss.on('connection', function connection(ws) {
    let playerColor = null;

    if (!players.w) {
        playerColor = 'w';
        players.w = ws;
        ws.playerColor = 'w'; // Сохраняем цвет прямо на объекте сокета
    } else if (!players.b) {
        playerColor = 'b';
        players.b = ws;
        ws.playerColor = 'b';
    } else {
        // Логика для наблюдателей
        ws.playerColor = 'spectator';
    }

    console.log(`Новый клиент подключен. Назначен цвет: ${playerColor}`);

    ws.send(JSON.stringify({
        type: 'player_color',
        color: playerColor
    }));

    ws.send(JSON.stringify({
        type: 'board_state',
        fen: game.fen(),
        turn: game.turn()
    }));

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message);
            console.log(`Получено от (${ws.playerColor}):`, data);

            switch (data.type) {
                case 'move':
                    // ИСПРАВЛЕНИЕ: Проверка перенесена сюда!
                    if (players[game.turn()] !== ws) {
                        console.log(`Попытка хода не в свою очередь от ${ws.playerColor}`);
                        return; // Игнорируем только ход, а не все сообщения
                    }
                    const move = game.move(data.move);
                    if (move) {
                        broadcastGameState();
                    } else {
                        console.log('Нелегальный ход от клиента:', data.move);
                    }
                    break;

                case 'reset_game':
                    console.log(`Получен запрос на сброс игры от ${ws.playerColor}`);
                    game.reset();
                    broadcastGameState();
                    break;

                case 'undo_move':
                    console.log(`Получен запрос на отмену хода от ${ws.playerColor}`);
                    game.undo();
                    broadcastGameState();
                    break;
            }

        } catch (e) {
            console.error('Ошибка при обработке сообщения:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Клиент (${ws.playerColor}) отключился.`);
        if (ws.playerColor && players[ws.playerColor]) {
            delete players[ws.playerColor];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
