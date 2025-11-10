const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

app.use(express.static('public'));

let game = new Chess();
let players = {
    white: null,
    black: null
};

io.on('connection', (socket) => {
    console.log(`Новое подключение: ${socket.id}`);

    // --- Назначение ролей ---
    if (players.white === null) {
        players.white = socket.id;
        socket.emit('init', { color: 'white' });
        console.log(`Игрок ${socket.id} назначен белым.`);
    } else if (players.black === null) {
        players.black = socket.id;
        socket.emit('init', { color: 'black' });
        console.log(`Игрок ${socket.id} назначен черным.`);
    } else {
        socket.emit('init', { color: 'spectator' });
        console.log(`Игрок ${socket.id} назначен наблюдателем.`);
    }

    // Отправляем текущее состояние доски новому подключению
    socket.emit('boardstate', { fen: game.fen() });

    // Если оба игрока на месте, начинаем игру
    if (players.white && players.black) {
        io.emit('gamestart', { fen: game.fen() });
        console.log("Оба игрока на месте. Игра началась!");
    }

    // --- Обработка ходов ---
    socket.on('move', (move) => {
        const playerColor = players.white === socket.id ? 'w' : (players.black === socket.id ? 'b' : null);
        if (playerColor !== game.turn()) {
            return; // Не ход этого игрока
        }

        try {
            const result = game.move(move);
            if (result) {
                io.emit('move', { fen: game.fen(), move: result }); // Отправляем и ход для истории
                if (game.game_over()) {
                    let message = "Ничья";
                    if (game.in_checkmate()) {
                        message = `Мат! Победили ${game.turn() === 'w' ? 'черные' : 'белые'}.`;
                    }
                    io.emit('gameover', { message: message });
                }
            } else {
                socket.emit('invalidmove', { message: 'Недопустимый ход' });
            }
        } catch (err) {
            console.log("Ошибка при обработке хода:", err.message);
        }
    });

    // --- Смена цвета (до начала игры) ---
    socket.on('swapcolors', () => {
        if (players.white === socket.id && players.black === null) {
            players.white = null;
            players.black = socket.id;
            socket.emit('init', { color: 'black' });
            console.log(`Игрок ${socket.id} поменял цвет на черный.`);
        }
    });

    // --- Перезапуск игры ---
    socket.on('restartgame', () => {
        game = new Chess();
        // Сбрасываем игру, но оставляем игроков на своих местах
        io.emit('gamestart', { fen: game.fen() });
        console.log("Игра перезапущена по запросу одного из игроков.");
    });

    // --- УЛУЧШЕННАЯ ЛОГИКА ОТКЛЮЧЕНИЯ ---
    socket.on('disconnect', () => {
        console.log(`Игрок отключился: ${socket.id}`);
        let disconnectedPlayerColor = null;

        if (players.white === socket.id) {
            players.white = null;
            disconnectedPlayerColor = 'Белый';
            console.log("Слот белых освобожден.");
        } else if (players.black === socket.id) {
            players.black = null;
            disconnectedPlayerColor = 'Черный';
            console.log("Слот черных освобожден.");
        }

        if (disconnectedPlayerColor) {
            // Если отключился один из игроков, сбрасываем игру и сообщаем оставшемуся
            game = new Chess();
            io.emit('opponent_disconnected', { 
                message: `Соперник (${disconnectedPlayerColor}) отключился. Игра сброшена. Ожидание нового игрока.` 
            });
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
