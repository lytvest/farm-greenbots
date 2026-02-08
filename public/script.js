let state = {};

async function loadState() {
  const res = await fetch('/api/state');
  state = await res.json();
  renderAll();
}

function renderAll() {
  // Теплица
  document.getElementById('gh-temp').textContent = state.greenhouse.temp;
  document.getElementById('gh-hum').textContent = state.greenhouse.hum;
  updateButton('gh-window-btn', state.greenhouse.window, 'Открыто', 'Закрыто');
  updateButton('gh-water-btn', state.greenhouse.watering, 'Вкл', 'Выкл');
  updateButton('gh-light-btn', state.greenhouse.light, 'Вкл', 'Выкл');

  // Погода
  document.getElementById('w-temp').textContent = state.weather.temp;
  document.getElementById('w-wind').textContent = state.weather.wind;
  const rainEl = document.getElementById('w-rain');
  rainEl.textContent = state.weather.rain ? 'Идёт' : 'Нет';
  rainEl.className = state.weather.rain ? 'badge bg-danger' : 'badge bg-success';

  // Загоны
  const pensHtml = state.pens.map(p => `
    <div class="col-md-6">
      <div class="card">
        <div class="card-body">
          <h6>Загон ${p.id}</h6>
          <p>Дверь: <span class="status-dot ${p.door ? 'bg-success' : 'bg-secondary'}"></span> ${p.door ? 'Открыта' : 'Закрыта'}</p>
          <p>Вода: ${p.water}%</p>
          <button onclick="togglePen(${p.id}, 'door')" class="btn btn-sm btn-outline-primary">${p.door ? 'Закрыть' : 'Открыть'} дверь</button>
          <button onclick="togglePen(${p.id}, 'pump')" class="btn btn-sm btn-outline-info">${p.pump ? 'Выкл' : 'Вкл'} помпу</button>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('pens').innerHTML = pensHtml;

  // Конвейер
  document.getElementById('conv-status').textContent = state.conveyor.on ? 'Работает' : 'Выкл';
  document.getElementById('conv-status').className = state.conveyor.on ? 'badge bg-success' : 'badge bg-secondary';
  document.getElementById('conv-count').textContent = state.conveyor.count;
  document.getElementById('conv-wrong').textContent = state.conveyor.wrong;
  document.getElementById('conv-btn').textContent = state.conveyor.on ? 'Выключить' : 'Включить';
  document.getElementById('conv-btn').className = state.conveyor.on ? 'btn btn-danger' : 'btn btn-success';

  // Трактор
  const posMap = { warehouse: 'Склад', greenhouse: 'Теплица', pens: 'Загоны', conveyor: 'Конвейер' };
  document.getElementById('tractor-pos').textContent = posMap[state.tractor.position] || state.tractor.position;

  // Уведомления (новые — сверху)
  const notifContainer = document.getElementById('notifications');
  notifContainer.innerHTML = state.notifications.slice(-8).reverse().map(n => `
    <div class="alert alert-info" role="alert">
      <strong>${n.time}</strong> — ${n.msg}
      <button type="button" class="btn-close" onclick="removeNotification(${n.id})" aria-label="Close"></button>
    </div>
  `).join('');
}

function updateButton(id, value, onText, offText) {
  const btn = document.getElementById(id);
  btn.textContent = `${btn.textContent.split(':')[0]}: ${value ? onText : offText}`;
}

async function removeNotification(id) {
  await fetch(`/api/notification/${id}`, { method: 'DELETE' });
  loadState();                     // сразу обновляем список
}

async function toggleGH(param) { /* без изменений */ 
  const newVal = !state.greenhouse[param];
  await fetch(`/api/greenhouse/${param}/${newVal}`, { method: 'POST' });
  loadState();
}

async function togglePen(id, param) { /* без изменений */ 
  const pen = state.pens.find(p => p.id === id);
  const newVal = !pen[param];
  await fetch(`/api/pen/${id}/${param}/${newVal}`, { method: 'POST' });
  loadState();
}

async function toggleConveyor() { /* без изменений */ 
  const action = state.conveyor.on ? 'off' : 'on';
  await fetch(`/api/conveyor/${action}`, { method: 'POST' });
  loadState();
}

async function sendTractor(place) { /* без изменений */ 
  await fetch(`/api/tractor/goto/${place}`, { method: 'POST' });
  loadState();
}

async function toggleScenario(name) { /* без изменений */ 
  const enabled = document.getElementById(`sc-${name === 'storm' ? 'storm' : 'wrong'}`).checked;
  await fetch(`/api/scenario/${name}/${enabled}`, { method: 'POST' });
}

setInterval(loadState, 3000);
loadState();