// script.js (modified)
let state = {};

let weatherChart = null;
let fullWeatherChart = null;

function downsample(history, maxPoints = 20) {
  if (history.length <= maxPoints) return history;

  const step = Math.floor(history.length / maxPoints);
  const result = [];

  for (let i = 0; i < maxPoints; i++) {
    const start = i * step;
    const end = Math.min(start + step, history.length);
    const segment = history.slice(start, end);

    const avgTemp = segment.reduce((sum, p) => sum + p.temp, 0) / segment.length;
    const avgWind = segment.reduce((sum, p) => sum + p.wind, 0) / segment.length;
    const avgRain = segment.reduce((sum, p) => sum + p.rain_amount, 0) / segment.length;

    result.push({
      time: segment[segment.length - 1].time,
      temp: Math.round(avgTemp * 10) / 10,
      wind: Math.round(avgWind),
      rain_amount: Math.round(avgRain * 100) / 100
    });
  }
  return result;
}

function initWeatherChart() {
  const ctx = document.getElementById('weatherChart').getContext('2d');
  weatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Температура (°C)', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', tension: 0.4, borderWidth: 3, yAxisID: 'y' },
        { label: 'Ветер (м/с)',      data: [], borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', tension: 0.4, borderWidth: 3, yAxisID: 'y1' },
        { label: 'Осадки (мм)',      data: [], type: 'bar', backgroundColor: 'rgba(52,152,219,0.6)', yAxisID: 'y2' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y:  { position: 'left', title: { display: true, text: '°C' } },
        y1: { position: 'right', title: { display: true, text: 'м/с' }, grid: { drawOnChartArea: false } },
        y2: { position: 'right', max: 10, ticks: { stepSize: 2 }, title: { display: true, text: 'мм' } }
      },
      plugins: { legend: { position: 'top' } }
    }
  });
}

function updateWeatherChart() {
  const history = state.weatherHistory || [];
  const displayHistory = downsample(history, 20);

  weatherChart.data.labels = displayHistory.map(h => h.time);
  weatherChart.data.datasets[0].data = displayHistory.map(h => h.temp);
  weatherChart.data.datasets[1].data = displayHistory.map(h => h.wind);
  weatherChart.data.datasets[2].data = displayHistory.map(h => h.rain_amount);
  weatherChart.update();
}

function createFullScreenChart() {
  if (fullWeatherChart) fullWeatherChart.destroy();

  const ctx = document.getElementById('fullWeatherChart').getContext('2d');
  const history = state.weatherHistory || [];

  fullWeatherChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: history.map(h => h.time),
      datasets: [
        { label: 'Температура (°C)', data: history.map(h => h.temp), borderColor: '#e74c3c', tension: 0.2, borderWidth: 3, yAxisID: 'y' },
        { label: 'Ветер (м/с)',      data: history.map(h => h.wind), borderColor: '#3498db', tension: 0.2, borderWidth: 3, yAxisID: 'y1' },
        { label: 'Осадки (мм)',      data: history.map(h => h.rain_amount), type: 'bar', backgroundColor: 'rgba(52,152,219,0.7)', yAxisID: 'y2' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y:  { position: 'left', title: { display: true, text: '°C' } },
        y1: { position: 'right', title: { display: true, text: 'м/с' }, grid: { drawOnChartArea: false } },
        y2: { position: 'right', max: 10, ticks: { stepSize: 2 }, title: { display: true, text: 'мм' } }
      },
      plugins: { legend: { position: 'top' } }
    }
  });
}

function toggleFullScreenChart() {
  const modal = new bootstrap.Modal(document.getElementById('fullScreenChartModal'));
  modal.show();
}

document.getElementById('fullScreenChartModal').addEventListener('shown.bs.modal', () => {
  createFullScreenChart();
});

document.getElementById('fullScreenChartModal').addEventListener('hidden.bs.modal', () => {
  if (fullWeatherChart) {
    fullWeatherChart.destroy();
    fullWeatherChart = null;
  }
});

window.addEventListener('load', () => {
  initWeatherChart();
  updateWeatherChart();
});

async function loadState() {
  const res = await fetch('/api/state');
  state = await res.json();
  renderAll();
  if (weatherChart) updateWeatherChart();
  // Синхронизируем переключатели
  const simSwitch = document.getElementById('simulation-switch');
  if (simSwitch) simSwitch.checked = state.simulation.enabled;

  const scStorm = document.getElementById('sc-storm');
  if (scStorm) scStorm.checked = state.scenarios.storm;

  const scWrong = document.getElementById('sc-wrong');
  if (scWrong) scWrong.checked = state.scenarios.wrongVeg;

  const scWaterPump = document.getElementById('sc-water-pump');
  if (scWaterPump) scWaterPump.checked = state.scenarios.autoWaterPump;
}

function renderAll() {
  const now = Date.now();

  // Теплица
  document.getElementById('gh-temp').textContent = state.greenhouse.temp.toFixed(1);
  document.getElementById('gh-hum').textContent = state.greenhouse.hum.toFixed(1);
  document.getElementById('gh-soil-temp').textContent = state.greenhouse.soil_temp.toFixed(1);
  document.getElementById('gh-soil-hum').textContent = state.greenhouse.soil_hum.toFixed(1);
  document.getElementById('gh-light-level').textContent = state.greenhouse.light_level.toFixed(1);
  document.getElementById('gh-press').textContent = state.greenhouse.press.toFixed(1);

  const ghLast = state.lastUpdates.greenhouse;
  const ghTimeElem = document.getElementById('gh-last-update');
  const ghStatusElem = document.getElementById('gh-status');
  if (ghLast) {
    const date = new Date(ghLast);
    ghTimeElem.textContent = date.toLocaleTimeString('ru-RU');
    const isOnline = now - ghLast < 10000;
    ghStatusElem.textContent = isOnline ? 'Online' : 'Offline';
    ghStatusElem.className = `badge ${isOnline ? 'bg-success' : 'bg-danger'}`;
  } else {
    ghTimeElem.textContent = '-';
    ghStatusElem.textContent = 'Offline';
    ghStatusElem.className = 'badge bg-danger';
  }

  const winStatus = document.getElementById('gh-window-status');
  winStatus.textContent = state.greenhouse.window ? 'Открыто' : 'Закрыто';
  winStatus.className = `badge badge-state ${state.greenhouse.window ? 'bg-success' : 'bg-secondary'}`;
  document.getElementById('gh-window-btn').textContent = state.greenhouse.window ? 'Закрыть окно' : 'Открыть окно';

  const waterStatus = document.getElementById('gh-water-status');
  waterStatus.textContent = state.greenhouse.watering ? 'Включён' : 'Выключен';
  waterStatus.className = `badge badge-state ${state.greenhouse.watering ? 'bg-success' : 'bg-secondary'}`;
  document.getElementById('gh-water-btn').textContent = state.greenhouse.watering ? 'Выключить полив' : 'Включить полив';

  const ventStatus = document.getElementById('gh-ventilation-status');
  ventStatus.textContent = state.greenhouse.ventilation ? 'Включена' : 'Выключена';
  ventStatus.className = `badge badge-state ${state.greenhouse.ventilation ? 'bg-success' : 'bg-secondary'}`;
  document.getElementById('gh-ventilation-btn').textContent = state.greenhouse.ventilation ? 'Выключить вентиляцию' : 'Включить вентиляцию';

  const lightStatus = document.getElementById('gh-light-status');
  const lightMode = state.greenhouse.lightMode;
  let statusText, statusClass;
  switch (lightMode) {
    case 'red':   statusText = 'Красный'; statusClass = 'bg-danger'; break;
    case 'blue':  statusText = 'Синий';   statusClass = 'bg-primary'; break;
    case 'green': statusText = 'Зелёный'; statusClass = 'bg-success'; break;
    default:      statusText = 'Выключен'; statusClass = 'bg-secondary';
  }
  lightStatus.textContent = statusText;
  lightStatus.className = `badge badge-state ${statusClass}`;

  // Погода
  document.getElementById('w-temp').textContent = state.weather.temp.toFixed(1);
  document.getElementById('w-wind').textContent = state.weather.wind.toFixed(1);
  document.getElementById('w-rain-amount').textContent = state.weather.rain_amount.toFixed(2);
  document.getElementById('w-wind-dir').textContent = state.weather.wind_dir.toFixed(0);
  document.getElementById('w-humidity').textContent = state.weather.humidity.toFixed(1);
  document.getElementById('w-pressure').textContent = state.weather.pressure.toFixed(1);
  document.getElementById('w-uv').textContent = state.weather.uv.toFixed(1);
  document.getElementById('w-light').textContent = state.weather.light.toFixed(0);

  const wLast = state.lastUpdates.weather;
  const wTimeElem = document.getElementById('w-last-update');
  const wStatusElem = document.getElementById('w-status');
  if (wLast) {
    const date = new Date(wLast);
    wTimeElem.textContent = date.toLocaleTimeString('ru-RU');
    const isOnline = now - wLast < 10000;
    wStatusElem.textContent = isOnline ? 'Online' : 'Offline';
    wStatusElem.className = `badge ${isOnline ? 'bg-success' : 'bg-danger'}`;
  } else {
    wTimeElem.textContent = '-';
    wStatusElem.textContent = 'Offline';
    wStatusElem.className = 'badge bg-danger';
  }

  // Загоны
  const pensHtml = state.pens.map(p => `
    <div class="col-md-6">
      <div class="card h-100">
        <div class="card-header bg-secondary text-white">Загон ${p.id}</div>
        <div class="card-body">
          <div class="mb-3">
            <strong>Дверь:</strong>
            <span class="badge badge-state ${p.door ? 'bg-success' : 'bg-secondary'}">${p.door ? 'Открыта' : 'Закрыта'}</span>
          </div>
          <button onclick="togglePen(${p.id}, 'door')" class="btn btn-outline-primary w-100 mb-3">
            ${p.door ? 'Закрыть дверь' : 'Открыть дверь'}
          </button>
          <p>Статус платы: <strong id="pen-door-last-${p.id}">-</strong> <span id="pen-door-status-${p.id}" class="badge bg-secondary">Offline</span></p>
          <div class="mb-3">
            <strong>Помпа:</strong>
            <span class="badge badge-state ${p.pump ? 'bg-success' : 'bg-secondary'}">${p.pump ? 'Включена' : 'Выключена'}</span>
          </div>
          <button onclick="togglePen(${p.id}, 'pump')" class="btn btn-outline-info w-100 mb-3">
            ${p.pump ? 'Выключить помпу' : 'Включить помпу'}
          </button>
          <p>Статус платы: <strong id="pen-pump-last-${p.id}">-</strong> <span id="pen-pump-status-${p.id}" class="badge bg-secondary">Offline</span></p>
          <p class="mt-2 mb-0">
            <strong>Вода:</strong> 
            <span class="badge ${p.waterPresent ? 'bg-success' : 'bg-danger'}">${p.waterPresent ? 'Есть' : 'Нет'}</span>
          </p>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('pens').innerHTML = pensHtml;

  state.pens.forEach(p => {
    const penUpdate = state.lastUpdates.pens.find(up => up.id === p.id);
    // Door
    const doorLastElem = document.getElementById(`pen-door-last-${p.id}`);
    const doorStatusElem = document.getElementById(`pen-door-status-${p.id}`);
    if (penUpdate && penUpdate.door) {
      const date = new Date(penUpdate.door);
      doorLastElem.textContent = date.toLocaleTimeString('ru-RU');
      const isOnline = now - penUpdate.door < 10000;
      doorStatusElem.textContent = isOnline ? 'Online' : 'Offline';
      doorStatusElem.className = `badge ${isOnline ? 'bg-success' : 'bg-danger'}`;
    } else {
      doorLastElem.textContent = '-';
      doorStatusElem.textContent = 'Offline';
      doorStatusElem.className = 'badge bg-danger';
    }

    // Pump
    const pumpLastElem = document.getElementById(`pen-pump-last-${p.id}`);
    const pumpStatusElem = document.getElementById(`pen-pump-status-${p.id}`);
    if (penUpdate && penUpdate.pump) {
      const date = new Date(penUpdate.pump);
      pumpLastElem.textContent = date.toLocaleTimeString('ru-RU');
      const isOnline = now - penUpdate.pump < 10000;
      pumpStatusElem.textContent = isOnline ? 'Online' : 'Offline';
      pumpStatusElem.className = `badge ${isOnline ? 'bg-success' : 'bg-danger'}`;
    } else {
      pumpLastElem.textContent = '-';
      pumpStatusElem.textContent = 'Offline';
      pumpStatusElem.className = 'badge bg-danger';
    }
  });

  // Конвейер
  const convStatus = document.getElementById('conv-status');
  convStatus.textContent = state.conveyor.on ? 'Работает' : 'Выключен';
  convStatus.className = `badge badge-state ${state.conveyor.on ? 'bg-success' : 'bg-secondary'}`;

  document.getElementById('conv-count').textContent = state.conveyor.count;
  document.getElementById('conv-wrong').textContent = state.conveyor.wrong;

  document.getElementById('conv-btn').textContent = state.conveyor.on ? 'Выключить конвейер' : 'Включить конвейер';
  document.getElementById('conv-btn').className = state.conveyor.on ? 'btn btn-danger w-100' : 'btn btn-success w-100';

  // Трактор
  const posMap = { warehouse: 'Склад', greenhouse: 'Теплица', pens: 'Загоны', conveyor: 'Конвейер' };
  document.getElementById('tractor-pos').textContent = posMap[state.tractor.position] || state.tractor.position;

  // Уведомления
  const notifContainer = document.getElementById('notifications');
  const notifs = state.notifications.slice(-20).reverse();
  notifContainer.innerHTML = notifs.map(n => `
    <div class="list-group-item d-flex justify-content-between align-items-start">
      <div>
        <div class="fw-bold text-primary">${n.time}</div>
        <div>${n.msg}</div>
      </div>
      <button onclick="removeNotification(${n.id})" class="btn-close mt-1 ms-2"></button>
    </div>
  `).join('');
  document.getElementById('notif-count').textContent = state.notifications.length;
}

async function removeNotification(id) {
  await fetch(`/api/notification/${id}`, { method: 'DELETE' });
  loadState();
}

async function toggleGH(param) {
  const newVal = !state.greenhouse[param];
  await fetch(`/api/greenhouse/${param}/${newVal}`, { method: 'POST' });
  loadState();
}

async function togglePen(id, param) {
  const pen = state.pens.find(p => p.id === id);
  const newVal = !pen[param];
  await fetch(`/api/pen/${id}/${param}/${newVal}`, { method: 'POST' });
  loadState();
}

async function toggleConveyor() {
  const action = state.conveyor.on ? 'off' : 'on';
  await fetch(`/api/conveyor/${action}`, { method: 'POST' });
  loadState();
}

async function setLightColor(color) {
  await fetch(`/api/greenhouse/light/${color}`, { method: 'POST' });
  loadState();
}

async function sendTractor(place) {
  await fetch(`/api/tractor/goto/${place}`, { method: 'POST' });
  loadState();
}

async function toggleScenario(name) {
  const enabled = document.getElementById(
    name === 'storm' ? 'sc-storm' : 
    name === 'wrongVeg' ? 'sc-wrong' : 
    'sc-water-pump'
  ).checked;
  await fetch(`/api/scenario/${name}/${enabled}`, { method: 'POST' });
}

async function toggleSimulation() {
  const enabled = document.getElementById('simulation-switch').checked;
  await fetch(`/api/simulation/${enabled}`, { method: 'POST' });
  loadState();
}

setInterval(loadState, 1000);
loadState();