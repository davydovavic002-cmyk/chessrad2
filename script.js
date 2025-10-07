// ================== Глобальные переменные ==================
let ws = null;
let board = null;
let messageElement = null;
let game = new Chess();
let playerColor = null; // Наш цвет ('w' или 'b')

// ================== Логика WebSocket ==================
function connectWebSocket() {
    const serverIp = '147.45.147.30'; 
    ws = new WebSocket(`ws://${serverIp}:3000`);

    ws.onopen = function() {
        console.log("Соединение с WebSocket установлено");
        updateStatus("Соединение установлено. Ожидание второго игрока...");
    };

    ws.onmessage = function(event) {
        console.log("Получено сообщение от сервера:", event.data);
        const data = JSON.parse(event.data);

        if (data.type === 'player_color') {
            playerColor = data.color;
            if (playerColor === 'b') {
                board.orientation('black');
            }
            // Статус обновится после получения состояния доски
        } 
        else if (data.type === 'board_state') {
            game.load(data.fen);
            board.position(data.fen);
            updateGameStatus(); // Обновляем статус после каждого хода
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
    if (!playerColor) return; // Не обновляем статус, если цвет еще не назначен

    let statusText = 'Вы играете за ' + (playerColor === 'w' ? 'Белых' : 'Черных');
    const turn = game.turn() === 'w' ? 'Белых' : 'Черных';
    statusText += '. Сейчас ход: ' + turn;

    if (game.in_checkmate()) {
        statusText += '. Шах и мат!';
    } else if (game.in_check()) {
        statusText += '. Шах!';
    }

    updateStatus(statusText);
}

// ================== Логика шахматной доски (Chessboard.js) ==================

function onDragStart(source, piece) {
    if (playerColor === null || game.game_over()) {
        return false;
    }
    if (game.turn() !== playerColor) {
        return false;
    }
    if (piece.search(new RegExp(`^${playerColor}`)) === -1) {
        return false;
    }
}

function onDrop(source, target) {
    const move = {
        from: source,
        to: target,
        promotion: 'q'
    };

    if (game.move(move) === null) {
        return 'snapback';
    }
    game.undo(); 

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'move',
            move: move
        }));
    }
}

// ================== Инициализация при загрузке страницы ==================
document.addEventListener('DOMContentLoaded', function() {
    // Находим элементы
    messageElement = document.getElementById('message');
    const startBtn = document.getElementById('startBtn');
    const undoBtn = document.getElementById('undoBtn');
    const flipBtn = document.getElementById('flipOrientationBtn');

    updateStatus("Подключение к серверу...");

    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
    };

    board = Chessboard('myBoard', config);

    // ИСПРАВЛЕНИЕ: Убрали форму и вызываем подключение напрямую
    connectWebSocket();

    // Обработчики кнопок остаются
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'reset_game' }));
            }
        });
    }
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'undo_move' }));
            }
        });
    }
    if (flipBtn) {
        flipBtn.addEventListener('click', board.flip);
    }
});
