// ==============================================================
// Инициализация переменных и объектов
// ==============================================================

// Подключение к серверу WebSocket (Socket.IO)
const socket = io();

// Объект chess.js для управления игрой
const game = new Chess();

// jQuery-объекты для элементов DOM, основанные на вашем новом HTML
const statusEl = $('#status');
const restartButton = $('#restartButton');
const swapButton = $('#swapButton');
const joinWhiteBtn = $('#joinWhite');
const joinBlackBtn = $('#joinBlack');
const playerRoleEl = $('#player-role');
const pgnEl = $('#pgn'); // Элемент для отображения PGN

// Контейнеры для кнопок
const joinControls = $('#join-controls');
const gameControls = $('#game-controls');

// Объект chessboard.js (инициализируется позже)
let board;

// Вспомогательная переменная для отслеживания состояния окончания игры
let gameIsOver = false;

// Переменная для хранения цвета игрока ('white' или 'black')
let playerColor = null;

// ==============================================================
// Обработчики событий WebSocket
// ==============================================================

socket.on('gamestart', function(data) {
    game.load(data.fen);
    board.position(data.fen);
    updatePgnData(data.pgn);
    statusEl.text('Игра началась. Ход белых');
    gameIsOver = false; // Сбрасываем флаг окончания игры

    // Показываем игровые кнопки и скрываем кнопки присоединения
    joinControls.hide();
    gameControls.show();

    // Разблокируем кнопки
    swapButton.prop('disabled', false);
    restartButton.prop('disabled', false);
});

socket.on('boardstate', function(data) {
    game.load(data.fen);
    board.position(data.fen);
    updatePgnData(data.pgn);
});

socket.on('move', function(data) {
    game.load(data.fen);
    board.position(game.fen());
    updatePgnData(data.pgn);

    const turn = game.turn() === 'w' ? 'Белых' : 'Черных';
    statusEl.text('Ход ' + turn);

    // Блокируем кнопку смены цвета после первого хода
    swapButton.prop('disabled', true);
});

socket.on('invalidmove', function(data) {
    board.position(data.fen);
    game.load(data.fen);
    statusEl.text('Недопустимый ход! Попробуйте снова.');
});

socket.on('colorswapped', function(data) {
    playerColor = data.color;
    board.orientation(playerColor);
    playerRoleEl.text('Вы играете за ' + (playerColor === 'white' ? 'белых' : 'черных'));
});

socket.on('playerJoined', function(data) {
    playerColor = data.color;
    board.orientation(playerColor);
    playerRoleEl.text('Вы играете за ' + (playerColor === 'white' ? 'белых' : 'черных'));

    // Скрываем кнопки присоединения, так как игрок уже в игре
    joinControls.hide();
    gameControls.show();
});

socket.on('gameover', function(data) {
    statusEl.text(data.message);
    restartButton.prop('disabled', false);
    gameIsOver = true;
});

socket.on('opponent_disconnected', function(data) {
    statusEl.text(data.message);
    gameIsOver = true;
});

// ==============================================================
// Обработчики событий кнопок
// ==============================================================

joinWhiteBtn.on('click', function() {
    socket.emit('joingame', { color: 'white' });
});

joinBlackBtn.on('click', function() {
    socket.emit('joingame', { color: 'black' });
});

swapButton.on('click', function() {
    socket.emit('swapcolors');
});

restartButton.on('click', function() {
    socket.emit('restartgame');
});

// ==============================================================
// Обработчики событий доски (chessboard.js)
// ==============================================================

const onDragStart = function(source, piece) {
    if (gameIsOver ||
        game.in_checkmate() ||
        game.in_stalemate() ||
        game.in_draw() ||
        game.in_threefold_repetition() ||
        game.insufficient_material()) {
        return false;
    }

    // Разрешаем ход, только если это ход текущего игрока
    const turn = game.turn();
    if ((turn === 'w' && piece.search(/^b/) !== -1) ||
        (turn === 'b' && piece.search(/^w/) !== -1) ||
        (playerColor === 'white' && turn === 'b') ||
        (playerColor === 'black' && turn === 'w')) {
        return false;
    }

    return true;
};

const onDrop = function(source, target) {
    // Делаем ход в локальном объекте игры
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Автоматически превращаем пешку в ферзя
    });

    // Если ход невалидный, возвращаем фигуру назад
    if (move === null) {
        return 'snapback';
    }

    // Если ход валидный, отправляем его на сервер
    socket.emit('move', { move: move, fen: game.fen(), pgn: game.pgn() });
};

const onMoveEnd = function() {
    updatePgnData(game.pgn());
    checkGameOver(); // Проверяем состояние игры после каждого хода
};

// ==============================================================
// Инициализация chessboard.js
// ==============================================================

const boardConfig = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onMoveEnd: onMoveEnd
};

function setupBoard() {
    board = Chessboard('board', boardConfig);
    // При загрузке страницы показываем только кнопки присоединения
    gameControls.hide();
    joinControls.show();
}

// ==============================================================
// Вспомогательные функции
// ==============================================================

function updatePgnData(pgn) {
    pgnEl.text(pgn);
}

function checkGameOver() {
    if (game.in_checkmate()) {
        const winner = game.turn() === 'w' ? 'Черные' : 'Белые';
        statusEl.text(`Шах и мат! ${winner} победили!`);
        gameIsOver = true;
        socket.emit('gameover', { message: `Шах и мат! ${winner} победили!` });
    } else if (game.in_stalemate()) {
        statusEl.text('Пат!');
        gameIsOver = true;
        socket.emit('gameover', { message: 'Пат!' });
    } else if (game.in_draw()) {
        statusEl.text('Ничья!');
        gameIsOver = true;
        socket.emit('gameover', { message: 'Ничья!' });
    } else if (game.in_threefold_repetition()) {
        statusEl.text('Ничья (тройное повторение)!');
        gameIsOver = true;
        socket.emit('gameover', { message: 'Ничья (тройное повторение)!' });
    } else if (game.insufficient_material()) {
        statusEl.text('Ничья (недостаточно фигур для мата)!');
        gameIsOver = true;
        socket.emit('gameover', { message: 'Ничья (недостаточно фигур для мата)!' });
    }
}

// ==============================================================
// Инициализация приложения
// ==============================================================

$(document).ready(function() {
    setupBoard();
});
