document.addEventListener('DOMContentLoaded', function() {
    // --- Получаем элементы со страницы ---
    const statusEl = document.getElementById('status');
    const pgnEl = document.getElementById('pgn');
    const boardEl = document.getElementById('myBoard');
    const restartBtn = document.getElementById('restartBtn');
    const swapColorsBtn = document.getElementById('swapColorsBtn'); // НОВОЕ: Нашли кнопку смены цвета
    const preGameControls = document.getElementById('preGameControls');
    const inGameControls = document.getElementById('inGameControls');

    // --- Инициализация игры и сокета ---
    let board = null;
    const game = new Chess();
    let myColor = 'white'; // По умолчанию
    let playerIsSpectator = true;

    const socket = io();

    // --- Обработчики событий от сервера ---

    socket.on('connect', () => {
        console.log('Socket.IO соединение установлено. ID:', socket.id);
    });

    socket.on('init', (data) => {
        myColor = data.color;
        playerIsSpectator = (myColor === 'spectator');

        // НОВОЕ: Логируем в консоль для отладки
        console.log(`Сервер присвоил вам цвет: ${myColor}`);

        // ИСПРАВЛЕНО: Правильно устанавливаем ориентацию доски
        board.orientation(myColor === 'black' ? 'black' : 'white');

        if (playerIsSpectator) {
            statusEl.textContent = 'Вы наблюдатель.';
        } else {
            statusEl.textContent = `Вы играете за ${myColor === 'white' ? 'белых' : 'черных'}. Ожидание соперника...`;
        }
    });

    socket.on('gamestart', (data) => {
        console.log("Игра началась! FEN:", data.fen);
        game.load(data.fen);
        board.position(data.fen);
        updateStatus();

        // НОВОЕ: Прячем пред-игровые кнопки и показываем игровые
        preGameControls.style.display = 'none';
        inGameControls.style.display = 'block';
    });

    socket.on('move', (data) => {
        game.load(data.fen);
        board.position(data.fen);
        updateStatus();
    });

    socket.on('gameover', (data) => {
        statusEl.innerHTML = `<b>Игра окончена:</b> ${data.message}`;
        inGameControls.style.display = 'none'; // Прячем кнопку рестарта
    });

    // --- Функции логики доски (Chessboard.js) ---

    function onDragStart(source, piece) {
        if (game.game_over() === true ||
            playerIsSpectator ||
            game.turn() !== myColor[0]) { // Проверяем, что сейчас ход нашего цвета ('w' или 'b')
            return false;
        }
        // Запрещаем ходить чужими фигурами
        if (piece.search(new RegExp(`^${myColor[0]}`)) === -1) {
            return false;
        }
    }

    function onDrop(source, target) {
        let move = game.move({
            from: source,
            to: target,
            promotion: 'q'
        });

        if (move === null) return 'snapback';

        socket.emit('move', { from: source, to: target, promotion: 'q' });
    }

    function onSnapEnd() {
        board.position(game.fen());
    }

    function updateStatus() {
        let status = '';
        const moveColor = game.turn() === 'w' ? 'Белые' : 'Черные';

        if (game.game_over()) {
             if (game.in_checkmate()) {
                status = `Игра окончена, мат. Победили ${moveColor === 'Белые' ? 'черные' : 'белые'}.`;
            } else if (game.in_draw()) {
                status = 'Игра окончена, ничья.';
            }
        } else {
            status = `Ход ${moveColor}.`;
            if (!playerIsSpectator && game.turn() === myColor[0]) {
                status += ' <b>(Ваш ход)</b>';
            }
            if (game.in_check()) {
                 status += `, ${moveColor} под шахом`;
            }
        }

        statusEl.innerHTML = status; // Используем innerHTML для жирного шрифта
        pgnEl.innerHTML = game.pgn({ max_width: 5, newline_char: '<br />' });
    }

    // --- Обработчики нажатий на кнопки ---

    // НОВОЕ: Добавили логику для кнопки смены цвета
    swapColorsBtn.addEventListener('click', () => {
        console.log('Нажата кнопка смены цвета. Отправляем запрос на сервер.');
        socket.emit('swapcolors');
    });

    restartBtn.addEventListener('click', () => {
        if (!playerIsSpectator) {
            socket.emit('restartgame');
        }
    });

    // --- Конфигурация и создание доски ---

    const config = {
        draggable: true,
        position: 'start',
        orientation: 'white', // ИСПРАВЛЕНО: По умолчанию всегда белые внизу
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('myBoard', config);

    statusEl.textContent = 'Подключение к серверу...';
});
