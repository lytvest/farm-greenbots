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
    const hasRain = segment.some(p => p.rain === 1);

    result.push({
      time: segment[segment.length - 1].time,
      temp: Math.round(avgTemp * 10) / 10,
      wind: Math.round(avgWind),
      rain: hasRain ? 1 : 0
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
        { label: 'Дождь',            data: [], type: 'bar', backgroundColor: 'rgba(52,152,219,0.6)', yAxisID: 'y2' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y:  { position: 'left', title: { display: true, text: '°C' } },
        y1: { position: 'right', title: { display: true, text: 'м/с' }, grid: { drawOnChartArea: false } },
        y2: { position: 'right', max: 1.2, ticks: { stepSize: 1 } }
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
  weatherChart.data.datasets[2].data = displayHistory.map(h => h.rain);
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
        { label: 'Дождь',            data: history.map(h => h.rain), type: 'bar', backgroundColor: 'rgba(52,152,219,0.7)', yAxisID: 'y2' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y:  { position: 'left', title: { display: true, text: '°C' } },
        y1: { position: 'right', title: { display: true, text: 'м/с' }, grid: { drawOnChartArea: false } },
        y2: { position: 'right', max: 1.2, ticks: { stepSize: 1 } }
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
}

function renderAll() {
  // Теплица — округление до 1 знака после запятой
  document.getElementById('gh-temp').textContent = state.greenhouse.temp.toFixed(1);
  document.getElementById('gh-hum').textContent = state.greenhouse.hum.toFixed(1);
  document.getElementById('gh-soil-temp').textContent = state.greenhouse.soil_temp.toFixed(1);
  document.getElementById('gh-soil-hum').textContent = state.greenhouse.soil_hum.toFixed(1);
  document.getElementById('gh-light-level').textContent = state.greenhouse.light_level.toFixed(1);
  document.getElementById('gh-press').textContent = state.greenhouse.press.toFixed(1);

  const winStatus = document.getElementById('gh-window-status');
  winStatus.textContent = state.greenhouse.window ? 'Открыто' : 'Закрыто';
  winStatus.className = `badge badge-state ${state.greenhouse.window ? 'bg-success' : 'bg-secondary'}`;
  document.getElementById('gh-window-btn').textContent = state.greenhouse.window ? 'Закрыть окно' : 'Открыть окно';

  const waterStatus = document.getElementById('gh-water-status');
  waterStatus.textContent = state.greenhouse.watering ? 'Включён' : 'Выключен';
  waterStatus.className = `badge badge-state ${state.greenhouse.watering ? 'bg-success' : 'bg-secondary'}`;
  document.getElementById('gh-water-btn').textContent = state.greenhouse.watering ? 'Выключить полив' : 'Включить полив';

  // НОВЫЙ БЛОК: статус вентиляции
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

  // Погода — округление
  document.getElementById('w-temp').textContent = state.weather.temp.toFixed(1);
  document.getElementById('w-wind').textContent = state.weather.wind.toFixed(1);
  document.getElementById('w-rain').textContent = state.weather.rain ? 'Идёт' : 'Нет';
  document.getElementById('w-rain').className = state.weather.rain ? 'badge bg-danger' : 'badge bg-success';

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
          <div class="mb-3">
            <strong>Помпа:</strong>
            <span class="badge badge-state ${p.pump ? 'bg-success' : 'bg-secondary'}">${p.pump ? 'Включена' : 'Выключена'}</span>
          </div>
          <button onclick="togglePen(${p.id}, 'pump')" class="btn btn-outline-info w-100">
            ${p.pump ? 'Выключить помпу' : 'Включить помпу'}
          </button>
          <p class="mt-3 mb-0">Уровень воды: <strong>${p.water}%</strong></p>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('pens').innerHTML = pensHtml;

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
  const enabled = document.getElementById(`sc-${name === 'storm' ? 'storm' : 'wrong'}`).checked;
  await fetch(`/api/scenario/${name}/${enabled}`, { method: 'POST' });
}

setInterval(loadState, 3000);
loadState();