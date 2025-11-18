const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let game = new Chess();
let players = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.emit('boardstate', { fen: game.fen(), pgn: game.pgn() });

    socket.on('joingame', (data) => {
        const color = data.color;
        const isColorTaken = Object.values(players).some(p => p.color === color);

        if (isColorTaken) {
            console.log(`Color ${color} is already taken.`);
            return;
        }

        players[socket.id] = { color: color };
        console.log(`User ${socket.id} joined as ${color}`);

        socket.emit('playerJoined', { color: color });

        const whitePlayer = Object.values(players).find(p => p.color === 'white');
        const blackPlayer = Object.values(players).find(p => p.color === 'black');

        if (whitePlayer && blackPlayer) {
            console.log('Both players are here. Starting game.');
            io.emit('gamestart', { fen: game.fen(), pgn: game.pgn() });
        }
    });

    socket.on('move', (data) => {
        const player = players[socket.id];
        if (!player || player.color[0] !== game.turn()) {
            socket.emit('invalidmove', { fen: game.fen() });
            return;
        }

        const move = game.move(data.move);
        if (move === null) {
            socket.emit('invalidmove', { fen: game.fen() });
            return;
        }

        console.log('Move made:', data.move, 'New FEN:', game.fen());
        io.emit('move', { fen: game.fen(), pgn: game.pgn() });
    });

    socket.on('swapcolors', () => {
        const player = players[socket.id];
        if (player) {
            const newColor = player.color === 'white' ? 'black' : 'white';
            const otherPlayerId = Object.keys(players).find(id => id !== socket.id);

            if (!otherPlayerId) {
                player.color = newColor;
                socket.emit('colorswapped', { color: newColor });
            } else {
                const otherPlayer = players[otherPlayerId];
                if (otherPlayer) {
                    const tempColor = player.color;
                    player.color = otherPlayer.color;
                    otherPlayer.color = tempColor;

                    socket.emit('colorswapped', { color: player.color });
                    io.to(otherPlayerId).emit('colorswapped', { color: otherPlayer.color });
                }
            }
        }
    });

    socket.on('restartgame', () => {
        game = new Chess();
        console.log('Game restarted by a user.');
        players = {};
        io.emit('reload');
    });

    socket.on('gameover', (data) => {
        io.emit('gameover', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const player = players[socket.id];
        if (player) {
            delete players[socket.id];
            socket.broadcast.emit('opponent_disconnected', {
                message: `Противник (${player.color}) отключился.`
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
