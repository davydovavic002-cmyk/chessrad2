// ================== Глобальные переменные ==================
let ws = null;
let board = null;
let messageElement = null;
let game = new Chess();
let playerColor = null; // Наш цвет ('w' или 'b')

// ================== Логика WebSocket ==================
function connectWebSocket() {
    // ВАЖНО: Убедитесь, что IP-адрес и порт верные.
    // Если вы запускаете на своем компьютере, можно использовать 'localhost'
    const serverIp = window.location.hostname || '147.45.147.30'; 
    ws = new WebSocket(`ws://${serverIp}:3000`);

    ws.onopen = function() {
        console.log("Соединение с WebSocket установлено");
        updateStatus("Соединение установлено. Ожидание второго игрока...");
    };

    ws.onmessage = function(event) {
        console.log("Получено сообщение от сервера:", event.data);
        const data = JSON.parse(event.data);

        switch (data.type) {
            case 'player_color':
                playerColor = data.color;
                if (playerColor === 'b') {
                    board.orientation('black');
                }
                updateGameStatus();
                break;

            case 'board_state':
                game.load(data.fen);
                board.position(data.fen);
                updateGameStatus();
                break;
        }
    };

    ws.onclose = function() {
        console.log("Соединение с WebSocket закрыто");
        updateStatus("Соединение потеряно. Обновите страницу.");
    };

    ws.onerror = function(error) {
        console.error("Ошибка WebSocket:", error);
        updateStatus("Ошибка соединения. Проверьте консоль.");
    };
}

// ================== Вспомогательные функции для UX ==================

function updateStatus(text) {
    if (messageElement) {
        messageElement.textContent = text;
    }
}

function updateGameStatus() {
    if (!playerColor || !game.fen()) {
        return;
    }

    let statusText = 'Вы играете за ' + (playerColor === 'w' ? 'Белых' : 'Черных');
    const turn = game.turn() === 'w' ? 'Белых' : 'Черных';

    if (game.game_over()) {
        statusText = 'Игра окончена.';
        if (game.in_checkmate()) {
            statusText += ` Мат! ${turn === 'Белых' ? 'Черные' : 'Белые'} победили.`;
        } else if (game.in_draw()) {
            statusText += ' Ничья.';
        }
    } else {
        statusText += '. Сейчас ход: ' + turn;
        if (game.in_check()) {
            statusText += '. Шах!';
        }
    }

    updateStatus(statusText);
}

// ================== Логика шахматной доски (Chessboard.js) ==================

function onDragStart(source, piece) {
    if (playerColor === null || game.game_over() || game.turn() !== playerColor || piece.charAt(0) !== playerColor) {
        return false;
    }
    return true; 
}

function onDrop(source, target) {
    const moveData = {
        from: source,
        to: target,
        promotion: 'q'
    };
    const moveResult = game.move(moveData);
    if (moveResult === null) return 'snapback';
    game.undo(); 

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'move', move: moveData }));
    }
}

// ================== Инициализация при загрузке страницы ==================
document.addEventListener('DOMContentLoaded', function() {
    messageElement = document.getElementById('message');

    updateStatus("Подключение к серверу...");

    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
    };

    board = Chessboard('myBoard', config);

    connectWebSocket();

    // =============== ВОТ ЭТОТ БЛОК ВСЕ РЕШАЕТ ===============
    // Ищем кнопки в HTML по их ID
    const startBtn = document.getElementById('startBtn');
    const undoBtn = document.getElementById('undoBtn');
    const flipBtn = document.getElementById('flipOrientationBtn');

    // Назначаем действия на клики
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            console.log("Нажата кнопка 'Новая игра'"); // Для отладки
            if (ws && ws.readyState === WebSocket.OPEN) {
                // Отправляем команду на сервер
                ws.send(JSON.stringify({ type: 'reset_game' }));
            }
        });
    }
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            console.log("Нажата кнопка 'Отменить ход'"); // Для отладки
            if (ws && ws.readyState === WebSocket.OPEN) {
                // Отправляем команду на сервер
                ws.send(JSON.stringify({ type: 'undo_move' }));
            }
        });
    }
    if (flipOrientationBtn) {
        flipOrientationBtn.addEventListener('click', board.flip);
    }
    // ==========================================================
});
