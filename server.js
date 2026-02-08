const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(bodyParser.json());

let state = {
  greenhouse: { temp: 24, hum: 65, window: false, watering: false, light: false },
  weather: { temp: 16, wind: 8, rain: false },
  pens: [
    { id: 1, door: false, water: 68, pump: false },
    { id: 2, door: false, water: 45, pump: false }
  ],
  conveyor: { on: false, count: 13, wrong: 0, lastRfid: 'VEG-001' },
  tractor: { position: 'warehouse' },
  scenarios: { storm: true, wrongVeg: true },
  notifications: []
};

let cooldowns = { storm: 0, wrongVeg: 0 };
let notificationId = 1;

// Проверка сценариев каждую секунду
setInterval(() => {
  const now = Date.now();

  // Сценарий 1: сильный ветер + дождь
  if (state.scenarios.storm && now > cooldowns.storm) {
    if (state.weather.wind > 25 && state.weather.rain) {
      state.pens.forEach(p => p.door = true);
      state.notifications.push({
        id: notificationId++,
        time: new Date().toLocaleTimeString('ru-RU'),
        msg: 'Сильный ветер и дождь! Двери загонов автоматически открыты.'
      });
      cooldowns.storm = now + 60000;
    }
  }

  // Сценарий 2: неправильная RFID
  if (state.scenarios.wrongVeg && now > cooldowns.wrongVeg) {
    if (Math.random() < 0.08) {
      state.conveyor.wrong++;
      state.conveyor.lastRfid = 'ERR-' + Math.floor(Math.random()*999);
      state.tractor.position = 'conveyor';
      state.notifications.push({
        id: notificationId++,
        time: new Date().toLocaleTimeString('ru-RU'),
        msg: `Неправильная метка RFID! Трактор отправлен к конвейеру.`
      });
      cooldowns.wrongVeg = now + 60000;
    }
  }

  // Оставляем только последние 20 уведомлений
  if (state.notifications.length > 20) state.notifications.shift();

  // Симуляция погоды
  if (Math.random() < 0.03) {
    state.weather.wind = Math.floor(Math.random() * 40);
    state.weather.rain = Math.random() < 0.4;
  }
}, 1000);

// API
app.get('/api/state', (req, res) => res.json(state));

app.post('/api/greenhouse/:param/:value', (req, res) => {
  state.greenhouse[req.params.param] = req.params.value === 'true';
  res.json({ ok: true });
});

app.post('/api/pen/:id/:param/:value', (req, res) => {
  const pen = state.pens.find(p => p.id === parseInt(req.params.id));
  if (pen) pen[req.params.param] = req.params.value === 'true';
  res.json({ ok: true });
});

app.post('/api/conveyor/:action', (req, res) => {
  state.conveyor.on = req.params.action === 'on';
  res.json({ ok: true });
});

app.post('/api/tractor/goto/:place', (req, res) => {
  state.tractor.position = req.params.place;
  res.json({ ok: true });
});

app.post('/api/scenario/:name/:enabled', (req, res) => {
  state.scenarios[req.params.name] = req.params.enabled === 'true';
  res.json({ ok: true });
});

app.delete('/api/notification/:id', (req, res) => {
  const id = parseInt(req.params.id);
  state.notifications = state.notifications.filter(n => n.id !== id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));