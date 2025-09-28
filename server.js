const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Эта строка говорит серверу, что все статические файлы (css, js, картинки)
// находятся в той же папке, где запущен сам сервер.
app.use(express.static(path.join(__dirname)));

// Когда пользователь заходит на главную страницу сайта ('/'),
// мы отправляем ему файл index.html.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
