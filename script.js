// script.js - ОБНОВЛЕННАЯ ВЕРСИЯ

$(document).ready(function() {
    let board = null;
    const game = new Chess();
    const statusEl = $('#status');
    const pgnEl = $('#pgn');
    let playerColor = null; // 'w' для белых, 'b' для черных

    // --- WebSocket-соединение ---
    console.log("Попытка подключения к WebSocket серверу...");
    statusEl.html('Подключение к серверу...');
    const socket = new WebSocket('https://chessrad.onrender.com');

    socket.onopen = function() {
        console.log('Соединение с WebSocket установлено!');
        statusEl.html('Ожидание назначения цвета...');
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('Получено сообщение от сервера:', data);

        // Проверяем тип сообщения
        if (data.type === 'player_color') {
            playerColor = data.color;
            console.log(`Вы играете за ${playerColor === 'w' ? 'белых' : 'черных'}.`);
            board.setOrientation(playerColor === 'w' ? 'white' : 'black');
            updateStatus();
        } else if (data.from && data.to) {
            // Если это ход, применяем его
            game.move(data);
            board.position(game.fen());
            updateStatus();
        }
    };

    socket.onerror = function(error) {
        console.error('Ошибка WebSocket:', error);
        statusEl.html('Ошибка соединения с сервером.');
    };

    socket.onclose = function() {
        console.log('Соединение с WebSocket закрыто.');
        statusEl.html('Соединение потеряно. Обновите страницу.');
    };

    // --- Игровые функции ---
    function onDragStart(source, piece) {
        if (game.game_over() || !playerColor) return false;

        // Разрешаем ходить только своим цветом
        if ((game.turn() === 'w' && playerColor !== 'w') ||
            (game.turn() === 'b' && playerColor !== 'b')) {
            return false;
        }

        // Проверяем, что фигура нужного цвета
        if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
    }

    function onDrop(source, target) {
        const move = game.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';

        // Отправляем ход на сервер
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(move));
        }
        updateStatus();
    }

    function onSnapEnd() {
        board.position(game.fen());
    }

    function updateStatus() {
        let status = '';
        const moveColor = game.turn() === 'w' ? 'Белых' : 'Черных';

        if (!playerColor) {
             status = 'Ожидание подключения...';
        } else if (game.in_checkmate()) {
            status = `Игра окончена, ${moveColor} получили мат.`;
        } else if (game.in_draw()) {
            status = 'Игра окончена, ничья.';
        } else {
            status = `Ход ${moveColor}.`;
            if ((game.turn() === 'w' && playerColor === 'w') || (game.turn() === 'b' && playerColor === 'b')) {
                status += " (Ваш ход)";
            }
            if (game.in_check()) {
                status += `, ${moveColor} под шахом.`;
            }
        }
        statusEl.html(status);
        pgnEl.html(game.pgn());
    }

    function initGame() {
        const config = {
            draggable: true,
            position: 'start',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd
        };
        board = Chessboard('myBoard', config);
        updateStatus();
    }

    initGame();

    // Обработчики кнопок
    $('#startBtn').on('click', function() {
        // Логика рестарта в сетевой игре сложнее, пока просто сбрасываем локально
        game.reset();
        if (board) board.start();
        updateStatus();
    });

    $('#flipBtn').on('click', function() {
        if (board) board.flip();
    });
});
