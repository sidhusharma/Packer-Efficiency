const state = {
  packers: [],
  selectedPacker: null,
};

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function renderPackers() {
  const list = document.getElementById('packer-list');
  const select = document.getElementById('event-packer');
  list.innerHTML = '<h3>Configured packers</h3>';
  const ul = document.createElement('ul');
  state.packers.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = `${p.name} — ${p.spout_count} spouts @ ${p.rpm} rpm`;
    ul.appendChild(li);
  });
  list.appendChild(ul);

  select.innerHTML = '';
  state.packers.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
  if (state.packers.length && !state.selectedPacker) {
    state.selectedPacker = state.packers[0].id;
  }
  select.value = state.selectedPacker;
}

function renderEvents(events) {
  const wrap = document.getElementById('event-table');
  if (!events.length) {
    wrap.innerHTML = '<p class="muted">No events logged yet.</p>';
    return;
  }
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Time</th><th>Spout</th><th>Type</th></tr></thead>';
  const body = document.createElement('tbody');
  events.forEach((ev) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${new Date(ev.created_at).toLocaleTimeString()}</td>` +
      `<td>${ev.spout_number}</td><td>${ev.event_type}</td>`;
    body.appendChild(row);
  });
  table.appendChild(body);
  wrap.innerHTML = '';
  wrap.appendChild(table);
}

function renderEfficiency(metrics) {
  const container = document.getElementById('efficiency-output');
  container.innerHTML = '';
  const items = [
    { label: 'Events', value: metrics.total_events },
    { label: 'Empty', value: metrics.empty_nozzles, cls: 'warn' },
    { label: 'Undropped', value: metrics.undropped_bags, cls: 'danger' },
    { label: 'Availability %', value: metrics.efficiency_score },
    { label: 'Bags/min', value: metrics.throughput_bags_per_minute.toFixed(1) },
  ];
  items.forEach(({ label, value, cls }) => {
    const metric = document.createElement('div');
    metric.className = `metric ${cls || ''}`;
    metric.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    container.appendChild(metric);
  });
}

async function refreshDashboard() {
  if (!state.selectedPacker) return;
  const [events, efficiency] = await Promise.all([
    fetchJSON(`/api/events?packer_id=${state.selectedPacker}`),
    fetchJSON(`/api/efficiency?packer_id=${state.selectedPacker}`),
  ]);
  renderEvents(events);
  renderEfficiency(efficiency);
}

async function refreshPackers() {
  state.packers = await fetchJSON('/api/packers');
  renderPackers();
  await refreshDashboard();
}

async function pollFrame() {
  try {
    const payload = await fetchJSON('/api/live-frame');
    document.getElementById('live-image').src = payload.frame;
    document.getElementById('detection-meta').textContent = JSON.stringify(payload.detections, null, 2);
  } catch (err) {
    console.error('frame error', err);
  } finally {
    setTimeout(pollFrame, 2500);
  }
}

async function init() {
  document.getElementById('packer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('packer-name').value,
      spout_count: Number(document.getElementById('spout-count').value),
      rpm: Number(document.getElementById('rpm').value),
    };
    await fetchJSON('/api/packers', { method: 'POST', body: JSON.stringify(payload) });
    await refreshPackers();
    e.target.reset();
  });

  document.getElementById('seed-btn').addEventListener('click', async () => {
    await fetchJSON('/api/demo-seed', { method: 'POST' });
    await refreshPackers();
  });

  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      packer_id: Number(document.getElementById('event-packer').value),
      spout_number: Number(document.getElementById('event-spout').value),
      event_type: document.getElementById('event-type').value,
    };
    await fetchJSON('/api/events', { method: 'POST', body: JSON.stringify(payload) });
    state.selectedPacker = payload.packer_id;
    await refreshDashboard();
    e.target.reset();
  });

  await refreshPackers();
  pollFrame();
  setInterval(refreshDashboard, 5000);
}

document.addEventListener('DOMContentLoaded', init);
