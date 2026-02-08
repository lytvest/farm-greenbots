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

  // Окно
  const winStatus = document.getElementById('gh-window-status');
  winStatus.textContent = state.greenhouse.window ? 'Открыто' : 'Закрыто';
  winStatus.className = `badge badge-state ${state.greenhouse.window ? 'bg-success' : 'bg-secondary'}`;
  document.getElementById('gh-window-btn').textContent = state.greenhouse.window ? 'Закрыть окно' : 'Открыть окно';

  // Полив
  const waterStatus = document.getElementById('gh-water-status');
  waterStatus.textContent = state.greenhouse.watering ? 'Включён' : 'Выключен';
  waterStatus.className = `badge badge-state ${state.greenhouse.watering ? 'bg-success' : 'bg-secondary'}`;
  document.getElementById('gh-water-btn').textContent = state.greenhouse.watering ? 'Выключить полив' : 'Включить полив';

  // Свет
  const lightStatus = document.getElementById('gh-light-status');
  lightStatus.textContent = state.greenhouse.light ? 'Включён' : 'Выключен';
  lightStatus.className = `badge badge-state ${state.greenhouse.light ? 'bg-success' : 'bg-secondary'}`;
  document.getElementById('gh-light-btn').textContent = state.greenhouse.light ? 'Выключить свет' : 'Включить свет';

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