// --- Конфигурация и глобальные переменные ---
const boardElement = document.getElementById('myBoard');
const statusElement = document.getElementById('status');
const swapColorsBtn = document.getElementById('swapColorsBtn'); // <-- ДОБАВЬТЕ ЭТУ СТРОКУ

const ws = new WebSocket('ws://' + window.location.host + '/ws/');

let board = null;
let game = new Chess();
let myColor = null; // 'white' или 'black'
let isMyTurn = false;

console.log("✅ Скрипт загружен. Начинаем подключение к WebSocket...");

// --- Функции для работы с доской ---

function onDragStart(source, piece, position, orientation) {
    // Не разрешать двигать фигуры, если игра окончена
    if (game.game_over()) return false;

    // Не разрешать двигать фигуры, если не наш ход
    if (!isMyTurn) { 
        console.warn('🚫 Попытка хода не в свою очередь.');
        return false;
    }

    // Разрешать двигать только свои фигуры
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    // Попытка сделать ход
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: всегда превращаем в ферзя для простоты
    });

    // Если ход нелегальный, вернуть фигуру назад
    if (move === null) return 'snapback';

    // Если ход легальный, отправить его на сервер
    console.log(">>> ОТПРАВКА ХОДА НА СЕРВЕР:", move);
    ws.send(JSON.stringify({
        type: 'move',
        move: move
    }));

    isMyTurn = false; // Сразу после нашего хода передаем очередь
    updateStatus();
}

function onSnapEnd() {
    board.position(game.fen());
}

// --- Функции обновления состояния ---

function updateStatus() {
    let status = '';
    const moveColor = game.turn() === 'w' ? 'Белых' : 'Черных';

    if (game.in_checkmate()) {
        status = `Игра окончена, ${moveColor} получили мат.`;
    } else if (game.in_draw()) {
        status = 'Игра окончена, ничья.';
    } else {
        status = isMyTurn ? '✅ Ваш ход' : '⏳ Ход соперника...';
        if (game.in_check()) {
            status += `, ${moveColor} под шахом.`;
        }
    }
    statusElement.innerHTML = status;
}

// --- Обработка сообщений от WebSocket-сервера ---

ws.onopen = function() {
    console.log("WebSocket соединение успешно открыто!");
    statusElement.innerHTML = 'Ожидание второго игрока...';
};

ws.onmessage = function(event) {
    // САМАЯ ВАЖНАЯ ЧАСТЬ: ЛОГИРУЕМ ВСЕ, ЧТО ПРИХОДИТ
    console.log("<<< ПОЛУЧЕНО СООБЩЕНИЕ ОТ СЕРВЕРА:", event.data);

    try {
        const data = JSON.parse(event.data);
        console.log("--- Сообщение распарсено:", data);

        switch (data.type) {
            case 'game_start':
                console.log("--- Обрабатываем 'game_start' ---");
                myColor = data.color;
                isMyTurn = (myColor === 'white');
                swapColorsBtn.style.display = 'none';

                const config = {
                    draggable: true,
                    position: 'start',
                    onDragStart: onDragStart,
                    onDrop: onDrop,
                    onSnapEnd: onSnapEnd,
                    orientation: myColor
                };
                board = Chessboard(boardElement, config);

                console.log(`Цвет установлен: ${myColor}. Очередь хода: ${isMyTurn}`);
                updateStatus();
                break;

            case 'move': // <--- ИЗМЕНИТЬ ЗДЕСЬ
        console.log("--- Обрабатываем ход соперника ('move') ---"); // Можно поменять и лог для ясности
        game.move(data.move);
        board.position(game.fen());
        isMyTurn = true; // Теперь наш ход
        console.log("Ход соперника применен. Теперь наша очередь.");
        updateStatus();
        break;

            case 'opponent_disconnected':
                console.log("--- Обрабатываем 'opponent_disconnected' ---");
                isMyTurn = false;
                statusElement.innerHTML = '❌ Соперник отключился. Обновите страницу для поиска новой игры.';
                break;

            case 'info':  console.log('Обрабатываем инфо-сообщение:', data.message);
        statusElement.innerHTML = data.message;
        break;


            default:
                console.warn("Получен неизвестный тип сообщения:", data.type);
                break;
        }

    } catch (error) {
        console.error("❗️ Ошибка при обработке сообщения от сервера:", error);
    }
};

ws.onclose = function() {
    console.log("WebSocket соединение закрыто.");
    statusElement.innerHTML = 'Соединение с сервером потеряно. Пожалуйста, обновите страницу.';
};

ws.onerror = function(error) {
    console.error("❗️ Ошибка WebSocket:", error);
};

swapColorsBtn.addEventListener('click', () => {
    console.log('Нажата кнопка "Поменять цвет". Отправка запроса на сервер...');
    ws.send(JSON.stringify({ type: 'swap_colors' }));
});
