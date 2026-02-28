const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(bodyParser.json());

let state = {
  greenhouse: { 
    temp: 24, 
    hum: 65, 
    press: 1013, 
    soil_temp: 20, 
    soil_hum: 50, 
    light_level: 1000, 
    window: false, 
    watering: false, 
    lightMode: 'off'      
  },
  weather: { temp: 16, wind: 8, rain: false },
  weatherHistory: [],                    // ← Новая история погоды
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

// === УЛУЧШЕННАЯ СИМУЛЯЦИЯ ПОГОДЫ ===
setInterval(() => {
  const now = Date.now();

  // Симуляция погоды (более плавная и реалистичная)
  if (Math.random() < 0.15) {
    // Температура меняется медленно
    state.weather.temp += (Math.random() * 2 - 1) * 0.8;
    state.weather.temp = Math.round(Math.max(-5, Math.min(35, state.weather.temp)));

    // Ветер с порывами
    state.weather.wind = Math.round(Math.max(0, state.weather.wind + (Math.random() * 6 - 3)));
    if (Math.random() < 0.25) state.weather.wind = Math.floor(Math.random() * 35) + 5;

    // Дождь чаще при сильном ветре
    if (state.weather.wind > 18) {
      state.weather.rain = Math.random() < 0.75;
    } else {
      state.weather.rain = Math.random() < 0.35;
    }
  }

  // Сохраняем историю каждые ~8 секунд (чтобы график был плавным)
  if (Math.random() < 0.12 || state.weatherHistory.length === 0) {
    state.weatherHistory.push({
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      temp: state.weather.temp,
      wind: state.weather.wind,
      rain: state.weather.rain ? 1 : 0
    });

    // Оставляем только последние 180 точек (~2-3 часа)
    if (state.weatherHistory.length > 180) {
      state.weatherHistory.shift();
    }
  }


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

  if (state.notifications.length > 20) state.notifications.shift();

}, 1000);

// === API ===
// История погоды
app.get('/api/weather/history', (req, res) => res.json(state.weatherHistory));

// Новый endpoint — Arduino будет сюда отправлять реальные данные!
app.post('/api/weather/update', (req, res) => {
  const { temp, wind, rain } = req.body;
  if (temp !== undefined) state.weather.temp = parseFloat(temp);
  if (wind !== undefined) state.weather.wind = parseFloat(wind);
  if (rain !== undefined) state.weather.rain = Boolean(rain);

  // Сразу сохраняем в историю
  state.weatherHistory.push({
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    temp: state.weather.temp,
    wind: state.weather.wind,
    rain: state.weather.rain ? 1 : 0
  });

  if (state.weatherHistory.length > 180) state.weatherHistory.shift();

  res.json({ ok: true, message: "Данные от метеостанции приняты" });
});

// Новый endpoint для данных от Arduino (теплица)
app.post('/json/data', (req, res) => {
  const { soil_temp, soil_hum, light, air_temp, air_hum, air_press } = req.body;

  // Обновляем сенсорные данные теплицы (игнорируем pump и lamp из запроса, так как сервер управляет желаемым состоянием)
  if (soil_temp !== undefined) state.greenhouse.soil_temp = parseFloat(soil_temp);
  if (soil_hum !== undefined) state.greenhouse.soil_hum = parseFloat(soil_hum);
  if (light !== undefined) state.greenhouse.light_level = parseFloat(light);
  if (air_temp !== undefined) state.greenhouse.temp = parseFloat(air_temp);
  if (air_hum !== undefined) state.greenhouse.hum = parseFloat(air_hum);
  if (air_press !== undefined) state.greenhouse.press = parseFloat(air_press);

  // Возвращаем желаемые состояния для насоса (watering) и лампы (light)
  res.json({
    pump: state.greenhouse.watering,
    lamp: state.greenhouse.lightMode
  });
});

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

// Новый endpoint для управления лампой
app.post('/api/greenhouse/light/:color', (req, res) => {
  const color = req.params.color;
  if (['off', 'red', 'blue', 'green'].includes(color)) {
    state.greenhouse.lightMode = color;
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Недопустимый цвет' });
  }
});

app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));