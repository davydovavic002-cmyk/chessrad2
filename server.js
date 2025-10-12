const WebSocket = require('ws');
const { Chess } = require('chess.js'); // <-- ВАЖНО: Добавляем библиотеку chess.js
const wss = new WebSocket.Server({ port: 3000 });

const clients = new Map();
const games = new Map();
let waitingPlayer = null;

console.log('--- ШАХМАТНЫЙ СЕРВЕР ЗАПУЩЕН ---');
console.log('Ожидание подключений на порту 3000...');

// Вспомогательная функция для отправки сообщений
function sendMessage(ws, type, data) {
    ws.send(JSON.stringify({ type, ...data }));
}

// Функция для старта/рестарта игры
function startGame(gameId) {
    const game = games.get(gameId);
    if (!game || game.players.length !== 2) {
        return;
    }

    console.log(`[ИГРА ${gameId}] Запуск/перезапуск игры для двух игроков.`);

    game.players.forEach(playerData => {
        const playerWs = clients.get(playerData.clientId);
        if (playerWs) {
            sendMessage(playerWs, 'game_start', { // Используем ваш тип сообщения game_start
                message: `Игра началась! Вы играете ${playerData.color === 'white' ? 'белыми' : 'черными'}`,
                color: playerData.color
            });
        }
    });
}

wss.on('connection', (ws) => {
    const clientId = Date.now() + Math.random().toString(36).substr(2, 9);
    clients.set(clientId, ws);
    console.log(`[СОЕДИНЕНИЕ] Новый клиент подключен. ID: ${clientId}`);

    if (!waitingPlayer) {
        waitingPlayer = { ws, clientId };
        console.log(`[ИГРА] Клиент ${clientId} ожидает соперника.`);
        sendMessage(ws, 'info', { message: 'Вы подключены. Ожидаем второго игрока...' });
    } else {
        console.log(`[ИГРА] Найден соперник для ${waitingPlayer.clientId}. Создаем игру...`);

        // Создаем игроков с назначенными цветами
        const player1 = { clientId: waitingPlayer.clientId, color: 'white' };
        const player2 = { clientId, color: 'black' };

        waitingPlayer = null;

        const gameId = `game_${player1.clientId}_${player2.clientId}`;
        const newGame = {
            id: gameId,
            players: [player1, player2],
            chess: new Chess(), // Создаем экземпляр игры на сервере
        };
        games.set(gameId, newGame);

        // Привязываем ID игры к WebSocket соединениям
        clients.get(player1.clientId).gameId = gameId;
        clients.get(player2.clientId).gameId = gameId;

        console.log(`[ИГРА] Игра ${gameId} создана!`);
        startGame(gameId); // Запускаем игру через новую функцию
    }

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            console.error('[ОШИБКА] Получено невалидное JSON сообщение:', message);
            return;
        }

        console.log(`[СООБЩЕНИЕ] Получено от ${clientId}:`, data);
        const gameId = ws.gameId;
        if (!gameId || !games.has(gameId)) {
            console.log(`[ПРЕДУПРЕЖДЕНИЕ] Сообщение от клиента ${clientId}, который не состоит в игре.`);
            return;
        }

        const game = games.get(gameId);

        // Используем switch для обработки разных типов сообщений
        switch (data.type) {
            case 'move': {
                // Старая логика: просто пересылаем ход оппоненту
                const opponent = game.players.find(p => p.clientId !== clientId);
                if (opponent && clients.has(opponent.clientId)) {
                    const opponentWs = clients.get(opponent.clientId);
                    opponentWs.send(message.toString());
                    console.log(`[ИГРА ${gameId}] Ход от ${clientId} переслан оппоненту ${opponent.clientId}`);
                }
                break;
            }

            case 'swap_colors': {
                // НОВАЯ ЛОГИКА: меняем цвета
                // Проверяем, что в игре 2 игрока и ходов еще не было
                if (game.players.length === 2 && game.chess.history().length === 0) {
                    console.log(`[ИГРА ${gameId}] Получен запрос на смену цвета.`);

                    // Меняем цвета местами
                    const tempColor = game.players[0].color;
                    game.players[0].color = game.players[1].color;
                    game.players[1].color = tempColor;

                    // Перезапускаем игру с новыми цветами для обоих игроков
                    startGame(gameId);
                }
                break;
            }

            default:
                console.log(`[ПРЕДУПРЕЖДЕНИЕ] Получен неизвестный тип сообщения: ${data.type}`);
                break;
        }
    });

    ws.on('close', () => {
        console.log(`[СОЕДИНЕНИЕ] Клиент ${clientId} отключился.`);

        if (waitingPlayer && waitingPlayer.clientId === clientId) {
            waitingPlayer = null;
            console.log('[ИГРА] Ожидающий игрок отключился. Очередь пуста.');
        }

        const gameId = ws.gameId;
        if (gameId && games.has(gameId)) {
            const game = games.get(gameId);
            const opponent = game.players.find(p => p.clientId !== clientId);

            if (opponent && clients.has(opponent.clientId)) {
                const opponentWs = clients.get(opponent.clientId);
                sendMessage(opponentWs, 'opponent_disconnected', { message: 'Ваш соперник отключился. Игра окончена.' });
                console.log(`[ИГРА ${gameId}] Уведомили игрока ${opponent.clientId} об отключении соперника.`);
            }
            games.delete(gameId);
            console.log(`[ИГРА ${gameId}] Игра удалена.`);
        }

        clients.delete(clientId);
    });

    ws.on('error', (error) => {
        console.error(`[ОШИБКА] Произошла ошибка у клиента ${clientId}:`, error);
    });
});
