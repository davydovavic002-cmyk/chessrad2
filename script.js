// --- Инициализация ---
// Находим HTML-элементы в начале для удобства
const statusEl = $('#status');
const fenEl = $('#fen');
const pgnEl = $('#pgn');

// Переменные для хранения состояния игры
let board = null;            // Пока что доска не создана
const game = new Chess();    // Логика игры
let playerColor = null;      // Цвет игрока ('w' или 'b')

// --- Настройка WebSocket ---
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${wsProtocol}//${window.location.host}`);
console.log('Попытка подключения к WebSocket серверу...');

// --- Обработчики событий WebSocket ---

socket.onopen = function () {
    console.log('Соединение с WebSocket установлено.');
    statusEl.html('Ожидание назначения цвета от сервера...');
};

socket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    console.log('Получено сообщение от сервера:', data);

    switch (data.type) {
        case 'player_color':
            playerColor = data.color;
            if (playerColor === 'spectator') {
                statusEl.html('Режим зрителя. Игра уже идет.');
            } else {
                board.orientation(playerColor === 'w' ? 'white' : 'black');
                $('#waiting-screen').hide();
                $('#game-container').show();
            }
            updateStatus();
            break;

        case 'game_reset':
            game.reset();
            board.start();
            statusEl.html('Новая игра! Ход белых.');
            updateStatus();
            break;

        case 'board_clear':
            game.clear();
            board.clear();
            updateStatus();
            break;

        // Если тип не указан, считаем, что это ход
        default: 
            if (data.from && data.to) {
                game.move(data);
                board.position(game.fen());
                updateStatus();
            }
            break;
    }
};

socket.onerror = function (error) {
    console.error('Ошибка WebSocket:', error);
    statusEl.html('Ошибка соединения с сервером.');
};

socket.onclose = function () {
    console.log('Соединение с WebSocket закрыто.');
    statusEl.html('Соединение потеряно. Обновите страницу.');
};

// --- Функции для управления доской (Chessboard.js) ---

function onDragStart(source, piece) {
    if (game.game_over() || playerColor === null || playerColor === 'spectator' || game.turn() !== playerColor || piece.search(new RegExp(`^${playerColor}`)) === -1) {
        return false;
    }
}

function onDrop(source, target) {
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    if (move === null) return 'snapback';
    socket.send(JSON.stringify(move));
    updateStatus();
}

function onSnapEnd() {
    board.position(game.fen());
}

function updateStatus() {
    let status = '';
    const moveColor = game.turn() === 'w' ? 'Белых' : 'Черных';
    if (game.in_checkmate()) {
        status = `Игра окончена, ${moveColor} получили мат.`;
    } else if (game.in_draw()) {
        status = 'Игра окончена, ничья.';
    } else {
        status = `Ход ${moveColor}.`;
        if (game.in_check()) {
            status += ` ${moveColor} под шахом.`;
        }
    }
    statusEl.html(status);
    fenEl.html(game.fen());
    pgnEl.html(game.pgn());
}

// --- Конфигурация, создание доски и запуск ---

// Сначала создаем конфигурацию для доски
const config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};

// Теперь создаем саму доску.
board = Chessboard('myBoard', config);

// Код для кнопок теперь находится здесь, ПОСЛЕ создания доски
$('#startBtn').on('click', function () {
    socket.send(JSON.stringify({ type: 'reset_game' }));
});

$('#flipOrientationBtn').on('click', function() {
    // Эта кнопка локальная, переворачивает доску только для вас
    board.flip();
});

$('#clearBtn').on('click', function () {
    socket.send(JSON.stringify({ type: 'clear_board' }));
});

// Первоначальная настройка интерфейса
$('#game-container').hide();
$('#waiting-screen').show();
updateStatus();

