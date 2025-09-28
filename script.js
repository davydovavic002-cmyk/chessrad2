// --- Инициализация ---
const statusEl = $('#status');
const fenEl = $('#fen');
const pgnEl = $('#pgn');

let board = null;
const game = new Chess();
let playerColor = null;

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

    // Используем switch для удобной обработки разных типов сообщений
    switch (data.type) {
        // 1. Сервер назначил нам цвет
        case 'player_color':
            playerColor = data.color;
            if (playerColor === 'spectator') {
                console.log('Вы зритель.');
                statusEl.html('Режим зрителя. Игра уже идет.');
            } else {
                console.log(`Вы играете за ${playerColor === 'w' ? 'белых' : 'черных'}.`);
                board.orientation(playerColor === 'w' ? 'white' : 'black');
                $('#waiting-screen').hide();
                $('#game-container').show();
            }
            updateStatus();
            break;

        // 2. Сервер прислал ход другого игрока (у этого сообщения нет 'type')
        case undefined: 
            if (data.from && data.to) {
                game.move(data);
                board.position(game.fen());
                updateStatus();
            }
            break;

        // НОВОЕ: 3. Сервер прислал команду на сброс игры
        case 'game_reset':
            game.reset();
            board.start();
            updateStatus();
            console.log('Игра сброшена по команде сервера.');
            statusEl.html('Новая игра! Ход белых.');
            break;

        // НОВОЕ: 4. Сервер прислал команду на очистку доски
        case 'board_clear':
            game.clear();
            board.clear();
            updateStatus();
            console.log('Доска очищена по команде сервера.');
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

// --- Логика шахматной доски (Chessboard.js) ---

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

    // Отправляем ход на сервер
    socket.send(JSON.stringify(move));
    updateStatus();
}

function onSnapEnd() {
    board.position(game.fen());
}

// --- Вспомогательная функция ---

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

// --- Конфигурация и создание доски ---

const config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};
board = Chessboard('myBoard', config);

// --- ИЗМЕНЕНО: ОБРАБОТЧИКИ НАЖАТИЙ НА КНОПКИ ---

// Нажатие на кнопку "Start Position" теперь отправляет команду на сервер
$('#startBtn').on('click', function () {
    console.log('Отправка запроса на сброс игры...');
    socket.send(JSON.stringify({ type: 'reset_game' }));
});

// Кнопка "Flip" остается локальной, т.к. это личное предпочтение
$('#flipOrientationBtn').on('click', board.flip);

// Нажатие на кнопку "Clear Board" теперь отправляет команду на сервер
$('#clearBtn').on('click', function () {
    console.log('Отправка запроса на очистку доски...');
    socket.send(JSON.stringify({ type: 'clear_board' }));
});

// Изначально показываем экран ожидания
$('#game-container').hide();
$('#waiting-screen').show();

updateStatus();
