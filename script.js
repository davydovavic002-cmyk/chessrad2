// --- Инициализация ---
// Этот код выполняется, как только страница загружается

// Находим HTML-элементы, с которыми будем работать
const statusEl = $('#status');
const fenEl = $('#fen');
const pgnEl = $('#pgn');

// Переменные для хранения состояния игры
let board = null;            // Объект доски Chessboard.js
const game = new Chess();    // Объект логики игры Chess.js
let playerColor = null;      // Цвет игрока ('w' или 'b')

// --- Настройка WebSocket ---

// Определяем протокол для WebSocket (ws:// для http, wss:// для https)
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
// Собираем полный адрес сервера, используя текущий хост
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

    // 1. Проверяем, назначение ли это цвета игроку
    if (data.type === 'player_color') {
        playerColor = data.color;

        if (playerColor === 'spectator') {
            console.log('Вы зритель.');
            statusEl.html('Режим зрителя. Игра уже идет.');
        } else {
            console.log(`Вы играете за ${playerColor === 'w' ? 'белых' : 'черных'}.`);

            // ИСПРАВЛЕНО: Используем правильный метод .orientation()
            board.orientation(playerColor === 'w' ? 'white' : 'black');

            // Убираем экран ожидания и показываем доску
            // Убедитесь, что у вас есть элементы с такими id в index.html
            $('#waiting-screen').hide();
            $('#game-container').show();
        }

        updateStatus(); // Обновляем статус (чей ход и т.д.)
    } 
    // 2. Проверяем, является ли сообщение ходом другого игрока
    else if (data.from && data.to) {
        // Применяем ход, полученный от сервера
        game.move(data);
        // Обновляем позицию на доске, чтобы увидеть ход соперника
        board.position(game.fen());
        updateStatus();
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

// Функция вызывается, когда игрок начинает перетаскивать фигуру
function onDragStart(source, piece) {
    // Не разрешать двигать фигуры, если:
    // 1. Игра окончена
    if (game.game_over()) return false;
    // 2. Не назначен цвет (зритель)
    if (playerColor === null || playerColor === 'spectator') return false;
    // 3. Сейчас не ход этого игрока
    if (game.turn() !== playerColor) return false;
    // 4. Фигура не принадлежит игроку
    if (piece.search(new RegExp(`^${playerColor}`)) === -1) return false;
}

// Функция вызывается, когда игрок бросает фигуру на доску
function onDrop(source, target) {
    // Создаем объект хода
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: всегда превращаем в ферзя для простоты
    });

    // Если ход нелегальный, отменяем его
    if (move === null) return 'snapback';

    // Если ход легальный, отправляем его на сервер
    console.log('Отправка хода на сервер:', move);
    socket.send(JSON.stringify(move));

    updateStatus();
}

// Функция вызывается после анимации хода для синхронизации
function onSnapEnd() {
    board.position(game.fen());
}

// --- Вспомогательная функция ---

// Обновляет текстовый статус под доской
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

// Настройки для объекта Chessboard
const config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
};

// Создаем доску. Важно делать это после определения всех функций
board = Chessboard('myBoard', config);

// Изначально показываем экран ожидания
$('#game-container').hide();
$('#waiting-screen').show();

// Обновляем статус в самом начале
updateStatus();
