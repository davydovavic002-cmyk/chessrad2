
// Используем $(function() { ... }); чтобы код выполнялся только после полной загрузки страницы
$(function() {
    // --- ИНИЦИАЛИЗАЦИЯ ---

    // Находим HTML-элементы один раз и сохраняем в переменные для производительности
    const statusEl = $('#status');
    const pgnEl = $('#pgn');
    const mainTitle = $('#maintitle');

    // Переменные для хранения состояния игры
    let board = null;               // Объект доски Chessboard.js
    const game = new Chess();       // Объект логики игры chess.js
    let playerColor = null;         // Цвет игрока ('w' или 'b')

    // --- НАСТРОЙКА WEBSOCKET ---

    const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const socket = new WebSocket(wsProtocol + window.location.hostname + ':3000');

    console.log('Попытка подключения к WebSocket серверу...');

    // --- ОБРАБОТЧИКИ СОБЫТИЙ WEBSOCKET ---

    socket.onopen = function() {
        console.log('Соединение с WebSocket установлено.');
        statusEl.html('Ожидание назначения цвета от сервера...');
    };

    socket.onmessage = function(event) {
        // Сервер может прислать как JSON-объект, так и просто FEN-строку
        // FEN-строка приходит при первом подключении, чтобы показать текущую позицию
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            // Если парсинг не удался, значит, это FEN-строка
            game.load(event.data);
            board.position(game.fen());
            updateStatus();
            return;
        }

        console.log('Получено сообщение от сервера:', data);

        // Обрабатываем сообщения в зависимости от их типа
        switch (data.type) {
            case 'playercolor':
                playerColor = data.color;
                mainTitle.html(`Вы играете за ${playerColor === 'w' ? 'Белых' : 'Черных'}`);
                if (playerColor === 'spectator') {
                    mainTitle.html('Режим зрителя');
                } else {
                    board.orientation(playerColor === 'w' ? 'white' : 'black');
                }
                updateStatus();
                break;

            case 'gamereset':
                game.reset();
                board.start();
                updateStatus();
                break;

            case 'boardclear':
                game.clear();
                board.clear();
                updateStatus();
                break;

            // ----- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ! ЭТОГО БЛОКА НЕ БЫЛО -----
            case 'move_undone':
                game.undo(); // Отменяем ход в нашем локальном объекте игры
                board.position(game.fen()); // Обновляем позицию на доске
                updateStatus(); // Обновляем статус
                break;
            // ---------------------------------------------------

            // Если тип не указан, считаем, что это объект хода
            default:
                if (data.from && data.to) {
                    game.move(data); // Применяем ход, полученный от сервера
                    board.position(game.fen());
                    updateStatus();
                }
                break;
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

    // --- ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ДОСКОЙ ---

    // Вызывается перед тем, как игрок начнет перетаскивать фигуру
    function onDragStart(source, piece) {
        // Запретить ход, если:
        // 1. Игра окончена
        // 2. Это не очередь этого игрока
        if (game.game_over() || 
            (game.turn() === 'w' && playerColor !== 'w') ||
            (game.turn() === 'b' && playerColor !== 'b')) {
            return false;
        }
    }

    // Вызывается, когда игрок бросает фигуру на клетку
    function onDrop(source, target) {
        // Пытаемся сделать ход в локальном объекте игры
        const move = game.move({
            from: source,
            to: target,
            promotion: 'q' // Всегда превращаем в ферзя для простоты
        });

        // Если ход нелегальный, отменяем его визуально
        if (move === null) return 'snapback';

        // Если ход легальный, отправляем его на сервер
        socket.send(JSON.stringify(move));
    }

    // Вызывается после анимации хода для синхронизации
    function onSnapEnd() {
        board.position(game.fen());
    }

    // Обновляет всю текстовую информацию на странице
    function updateStatus() {
        let status = '';
        const moveColor = game.turn() === 'w' ? 'Белых' : 'Черных';

        if (game.in_checkmate()) {
            status = `Игра окончена, ${moveColor} получили мат.`;
        } else if (game.in_draw()) {
            status = 'Игра окончена, ничья.';
        } else {
            status = `Ход ${moveColor}`;
            if (game.in_check()) {
                status += `, ${moveColor} под шахом.`;
            }
        }

        statusEl.html(status);
        pgnEl.html(game.pgn());
    }

    // --- КОНФИГУРАЦИЯ И ЗАПУСК ---

    const config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd
    };
    board = Chessboard('myBoard', config); // Инициализируем доску
    updateStatus();

    // --- ОБРАБОТЧИКИ НАЖАТИЯ КНОПОК ---

    $('#startBtn').on('click', function() {
        socket.send(JSON.stringify({ type: 'reset_game' }));
    });

    $('#undoBtn').on('click', function() {
        console.log("Отправляем запрос на отмену хода на сервер...");
        socket.send(JSON.stringify({ type: 'undo_move' }));
    });

    $('#flipOrientationBtn').on('click', board.flip);

    // Обработчик для кнопки "Очистить доску" с правильным ID
    $('#clearBoardBtn').on('click', function() {
        socket.send(JSON.stringify({ type: 'clear_board' }));
    });
});
