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
    lightMode: 'off',
    ventilation: false      
  },
  weather: { 
    temp: 16, 
    wind: 8, 
    rain_amount: 0,      // мм
    wind_dir: 180,       // градусы
    humidity: 65,        // %
    pressure: 1013,      // гПа
    uv: 3,               // индекс
    light: 750           // лк
  },
  weatherHistory: [],
  pens: [
    { id: 1, door: false, water: 68, pump: false },
    { id: 2, door: false, water: 45, pump: false }
  ],
  conveyor: { on: false, count: 13, wrong: 0, lastRfid: 'VEG-001' },
  tractor: { position: 'warehouse' },
  scenarios: { storm: true, wrongVeg: true },
  notifications: [],
  simulation: { enabled: false }  
};

let cooldowns = { storm: 0, wrongVeg: 0 };
let notificationId = 1;

// === СИМУЛЯЦИЯ ПОГОДЫ (работает только если включена) ===
setInterval(() => {
  if (!state.simulation.enabled) return; // если симуляция выключена – ничего не делаем

  const now = Date.now();

  if (Math.random() < 0.15) {
    // Температура
    state.weather.temp += (Math.random() * 2 - 1) * 0.8;
    state.weather.temp = Math.round(Math.max(-5, Math.min(35, state.weather.temp)) * 10) / 10;

    // Ветер
    state.weather.wind = Math.round(Math.max(0, state.weather.wind + (Math.random() * 6 - 3)) * 10) / 10;
    if (Math.random() < 0.25) state.weather.wind = Math.floor(Math.random() * 35) + 5;

    // Направление ветра
    state.weather.wind_dir = (state.weather.wind_dir + (Math.random() * 40 - 20) + 360) % 360;
    state.weather.wind_dir = Math.round(state.weather.wind_dir * 10) / 10;

    // Осадки
    if (state.weather.wind > 18 || Math.random() < 0.35) {
      state.weather.rain_amount = parseFloat((Math.random() * 5).toFixed(2));
    } else {
      state.weather.rain_amount = 0;
    }

    // Влажность
    let baseHum = state.weather.rain_amount > 0 ? 70 : 50;
    state.weather.humidity = Math.round((baseHum + (Math.random() * 20 - 10)) * 10) / 10;
    state.weather.humidity = Math.max(20, Math.min(98, state.weather.humidity));

    // Давление
    state.weather.pressure += (Math.random() * 6 - 3);
    state.weather.pressure = Math.round(Math.max(960, Math.min(1060, state.weather.pressure)) * 10) / 10;

    // УФ-индекс
    if (state.weather.rain_amount > 0 || state.weather.humidity > 85) {
      state.weather.uv = parseFloat((Math.random() * 2).toFixed(1));
    } else {
      state.weather.uv = parseFloat((Math.random() * 8 + 1).toFixed(1));
    }

    // Освещённость
    state.weather.light = Math.round(Math.random() * 1000);
  }

  // Добавление записи в историю (только при симуляции)
  if (Math.random() < 0.12 || state.weatherHistory.length === 0) {
    state.weatherHistory.push({
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      temp: state.weather.temp,
      wind: state.weather.wind,
      rain_amount: state.weather.rain_amount,
      wind_dir: state.weather.wind_dir,
      humidity: state.weather.humidity,
      pressure: state.weather.pressure,
      uv: state.weather.uv,
      light: state.weather.light
    });

    if (state.weatherHistory.length > 180) {
      state.weatherHistory.shift();
    }
  }

  // Сценарий "шторм"
  if (state.scenarios.storm && now > cooldowns.storm) {
    if (state.weather.wind > 25 && state.weather.rain_amount > 0) {
      state.pens.forEach(p => p.door = true);
      state.notifications.push({
        id: notificationId++,
        time: new Date().toLocaleTimeString('ru-RU'),
        msg: 'Сильный ветер и дождь! Двери загонов автоматически открыты.'
      });
      cooldowns.storm = now + 60000;
    }
  }

  // Сценарий "неправильная RFID"
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
app.get('/api/weather/history', (req, res) => res.json(state.weatherHistory));

// Эндпоинт для приёма данных от реальной метеостанции (Arduino)
app.post('/api/weather/update', (req, res) => {
  const { temp, wind, rain_amount, wind_dir, humidity, pressure, uv, light } = req.body;
  if (temp !== undefined) state.weather.temp = parseFloat(temp);
  if (wind !== undefined) state.weather.wind = parseFloat(wind);
  if (rain_amount !== undefined) state.weather.rain_amount = parseFloat(rain_amount);
  if (wind_dir !== undefined) state.weather.wind_dir = parseFloat(wind_dir);
  if (humidity !== undefined) state.weather.humidity = parseFloat(humidity);
  if (pressure !== undefined) state.weather.pressure = parseFloat(pressure);
  if (uv !== undefined) state.weather.uv = parseFloat(uv);
  if (light !== undefined) state.weather.light = parseFloat(light);

  // Добавляем запись в историю (реальные данные)
  state.weatherHistory.push({
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    temp: state.weather.temp,
    wind: state.weather.wind,
    rain_amount: state.weather.rain_amount,
    wind_dir: state.weather.wind_dir,
    humidity: state.weather.humidity,
    pressure: state.weather.pressure,
    uv: state.weather.uv,
    light: state.weather.light
  });

  if (state.weatherHistory.length > 180) state.weatherHistory.shift();

  res.json({ ok: true, message: "Данные от метеостанции приняты" });
});

// Эндпоинт для управления симуляцией
app.post('/api/simulation/:enabled', (req, res) => {
  const enabled = req.params.enabled === 'true';
  state.simulation.enabled = enabled;
  res.json({ ok: true, enabled: state.simulation.enabled });
});

// endpoint для данных от Arduino (теплица)
app.post('/json/data', (req, res) => {
  const { soil_temp, soil_hum, light, air_temp, air_hum, air_press } = req.body;

  if (soil_temp !== undefined) state.greenhouse.soil_temp = parseFloat(soil_temp);
  if (soil_hum !== undefined) state.greenhouse.soil_hum = parseFloat(soil_hum);
  if (light !== undefined) state.greenhouse.light_level = parseFloat(light);
  if (air_temp !== undefined) state.greenhouse.temp = parseFloat(air_temp);
  if (air_hum !== undefined) state.greenhouse.hum = parseFloat(air_hum);
  if (air_press !== undefined) state.greenhouse.press = parseFloat(air_press);

  res.json({
    pump: state.greenhouse.watering,
    lamp: state.greenhouse.lightMode,       
    window: state.greenhouse.window,
    ventilation: state.greenhouse.ventilation
  });
});

app.get('/api/state', (req, res) => {
  res.json(state)
});

// остальные эндпоинты (без изменений)
app.post('/api/greenhouse/light/:color', (req, res) => {
  const color = req.params.color;
  if (['off', 'red', 'blue', 'green'].includes(color)) {
    state.greenhouse.lightMode = color;
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Недопустимый цвет' });
  }
});

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