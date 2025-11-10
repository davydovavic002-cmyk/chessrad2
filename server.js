// ==========================================================
// 1. ИНИЦИАЛИЗАЦИЯ
// ==========================================================
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { Chess } = require('chess.js');

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server);

// Глобальные переменные для состояния игры
let players = {};
let playerSockets = [];
let currentGame = null;

// ==========================================================
// 2. ЛОГИКА ОБРАБОТКИ СОЕДИНЕНИЙ
// ==========================================================
io.on('connection', (socket) => {
    try {
        console.log(`[СОЕДИНЕНИЕ] Клиент ${socket.id} подключился`);

        // Назначение игрока или наблюдателя
        if (playerSockets.length < 2) {
            const color = (playerSockets.length === 0) ? 'white' : 'black';
            players[socket.id] = { color: color };
            playerSockets.push(socket);

            console.log(`[ИГРА] Клиент ${socket.id} назначен цветом ${color}`);

            socket.emit('init', {
                color: color,
                gameStarted: playerSockets.length === 2
            });

            if (playerSockets.length === 2) {
                console.log('[ИГРА] Два игрока подключены. Начинаем игру.');
                currentGame = new Chess();
                io.emit('gamestart', { fen: currentGame.fen() });
            }

        } else {
            console.log(`[СОЕДИНЕНИЕ] Клиент ${socket.id} подключился как наблюдатель`);
            socket.emit('init', {
                color: 'spectator',
                gameStarted: currentGame !== null
            });

            if (currentGame) {
                socket.emit('boardstate', { fen: currentGame.fen() });
            }
        }

        // Обработка хода
        socket.on('move', (moveData) => {
            if (!currentGame) return;
            const player = players[socket.id];
            if (!player) return;

            if (player.color[0] === currentGame.turn()) {
                const moveResult = currentGame.move(moveData);

                if (moveResult) {
                    console.log(`[ИГРА] Принят ход от ${player.color}: ${moveResult.san}`);
                    io.emit('move', { fen: currentGame.fen() });

                    if (currentGame.isGameOver()) {
                        let msg = 'Игра окончена.';
                        if (currentGame.isCheckmate()) {
                            const winner = currentGame.turn() === 'w' ? 'черные' : 'белые';
                            msg = `Мат! Победили ${winner}.`;
                        } else if (currentGame.isDraw()) {
                            msg = 'Ничья.';
                        }
                        io.emit('gameover', { message: msg });
                    }
                } else {
                    socket.emit('invalidmove', { message: 'Неверный ход' });
                }
            }
        });

        // Обработка перезапуска
        socket.on('restartgame', () => {
            if (playerSockets.length === 2) {
                console.log('[ИГРА] Получен запрос на перезапуск. Начинаем заново.');
                currentGame = new Chess();
                io.emit('gamestart', { fen: currentGame.fen() });
            }
        });

        // Обработка отключения
        socket.on('disconnect', () => {
            console.log(`[СОЕДИНЕНИЕ] Клиент ${socket.id} отключился`);

            if (players[socket.id]) {
                const playerColor = players[socket.id].color;
                delete players[socket.id];
                playerSockets = playerSockets.filter(s => s.id !== socket.id);

                // Если игра была в процессе, сбрасываем ее
                if (currentGame) {
                    currentGame = null;
                    console.log(`[ИГРА] Игрок (${playerColor}) отключился. Игра сброшена.`);
                    io.emit('opponent_disconnected', { message: 'Соперник отключился. Игра окончена.' });
                }
            }
        });

    } catch (error) {
        console.error(`!!! КРИТИЧЕСКАЯ ОШИБКА в обработчике сокета ${socket.id}:`, error);
    }
});

// ==========================================================
// 3. ЗАПУСК СЕРВЕРА
// ==========================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[СЕРВЕР] Сервер запущен и слушает порт ${PORT}`);
});
