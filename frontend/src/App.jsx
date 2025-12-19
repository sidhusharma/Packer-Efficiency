import { useEffect, useMemo, useState } from 'react';

const EVENT_OPTIONS = [
  { value: 'empty_nozzle', label: 'Empty nozzle (bag missing)' },
  { value: 'undropped_bag', label: 'Bag not dropped (second round)' },
  { value: 'normal_drop', label: 'Normal drop' }
];

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${apiBase}${path}`;

async function fetchJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  if (response.status === 204) return null;
  return response.json();
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );
}

function Section({ title, children, actions }) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{title}</h2>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export default function App() {
  const [packers, setPackers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [liveFrame, setLiveFrame] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedPacker = useMemo(
    () => packers.find((p) => p.id === selectedId) || null,
    [packers, selectedId]
  );

  useEffect(() => {
    refreshPackers();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    refreshMetrics(selectedId);
    refreshEvents(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => {
      refreshMetrics(selectedId, true);
      refreshLiveFrame();
    }, 5000);
    refreshLiveFrame();
    return () => clearInterval(interval);
  }, [selectedId]);

  async function refreshPackers() {
    try {
      const data = await fetchJson('/api/packers');
      setPackers(data);
      if (data.length && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function refreshMetrics(packerId, silent = false) {
    try {
      const data = await fetchJson(`/api/efficiency?packer_id=${packerId}`);
      setMetrics(data);
      if (!silent) setMessage('');
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function refreshEvents(packerId) {
    try {
      const data = await fetchJson(`/api/events?packer_id=${packerId}`);
      setEvents(data);
      setMessage('');
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function refreshLiveFrame() {
    try {
      const data = await fetchJson('/api/live-frame');
      setLiveFrame(data);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleCreatePacker(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {
      name: form.get('name'),
      spout_count: Number(form.get('spout_count')),
      rpm: Number(form.get('rpm'))
    };
    setBusy(true);
    try {
      await fetchJson('/api/packers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage('Packer created');
      event.target.reset();
      await refreshPackers();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateEvent(event) {
    event.preventDefault();
    if (!selectedPacker) {
      setMessage('Please select a packer first');
      return;
    }
    const form = new FormData(event.target);
    const payload = {
      packer_id: selectedPacker.id,
      spout_number: Number(form.get('spout_number')),
      event_type: form.get('event_type')
    };
    setBusy(true);
    try {
      await fetchJson('/api/events', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage('Event recorded');
      event.target.reset();
      await Promise.all([refreshEvents(selectedPacker.id), refreshMetrics(selectedPacker.id, true)]);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSeed() {
    setBusy(true);
    try {
      const seed = await fetchJson('/api/demo-seed', { method: 'POST' });
      setMessage(seed.message);
      await refreshPackers();
      setSelectedId(seed.packer_id);
      await refreshEvents(seed.packer_id);
      await refreshMetrics(seed.packer_id);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  const efficiencyCards = metrics
    ? [
        { title: 'Efficiency', value: `${metrics.efficiency_score.toFixed(1)}%`, subtitle: metrics.description },
        { title: 'Availability', value: `${(metrics.availability_ratio * 100).toFixed(1)}%`, subtitle: 'Based on empty nozzles' },
        { title: 'Throughput', value: `${metrics.throughput_bags_per_minute.toFixed(2)} bags/min`, subtitle: 'Estimated rate' },
        { title: 'Events', value: metrics.total_events, subtitle: `${metrics.normal_drops} normal · ${metrics.empty_nozzles} empty · ${metrics.undropped_bags} undropped` }
      ]
    : [];

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Cement bag roto packer monitoring</p>
          <h1>Packer efficiency dashboard</h1>
          <p className="lede">
            Track empty nozzles, undropped bags, and real-time throughput for 8- or 16-spout packers. Powered by FastAPI and
            a YOLOv8-ready detector endpoint.
          </p>
          <div className="hero-actions">
            <button className="ghost" onClick={handleSeed} disabled={busy}>
              Load demo data
            </button>
          </div>
        </div>
        <div className="hero-meta">
          <label htmlFor="packer-select">Active packer</label>
          <select
            id="packer-select"
            value={selectedId || ''}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          >
            <option value="" disabled>
              Choose a packer
            </option>
            {packers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.spout_count} spouts @ {p.rpm} RPM
              </option>
            ))}
          </select>
          <small className="hint">Live metrics refresh every 5 seconds.</small>
        </div>
      </header>

      {message && <div className="flash">{message}</div>}

      <div className="grid stats">
        {efficiencyCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="grid two-columns">
        <div className="stack">
          <Section title="Packer master" actions={<button className="ghost" onClick={refreshPackers}>Refresh</button>}>
            <form className="form" onSubmit={handleCreatePacker}>
              <div className="form-grid">
                <label>
                  Name
                  <input name="name" placeholder="Line 1 - 8 spouts" required />
                </label>
                <label>
                  Spouts
                  <input name="spout_count" type="number" min="1" placeholder="8" required />
                </label>
                <label>
                  RPM
                  <input name="rpm" type="number" step="0.1" min="0.1" placeholder="5" required />
                </label>
              </div>
              <button type="submit" disabled={busy}>
                Add packer
              </button>
            </form>
            <ul className="list">
              {packers.map((p) => (
                <li key={p.id} className={p.id === selectedId ? 'active' : ''}>
                  <div>
                    <strong>{p.name}</strong>
                    <small>{p.spout_count} spouts · {p.rpm} RPM</small>
                  </div>
                  <button className="ghost" onClick={() => setSelectedId(p.id)}>
                    View
                  </button>
                </li>
              ))}
              {packers.length === 0 && <li>No packers yet. Load demo data to get started.</li>}
            </ul>
          </Section>

          <Section title="Log nozzle event">
            <form className="form" onSubmit={handleCreateEvent}>
              <div className="form-grid">
                <label>
                  Spout number
                  <input name="spout_number" type="number" min="1" max={selectedPacker?.spout_count || 16} required />
                </label>
                <label>
                  Event type
                  <select name="event_type" required defaultValue="empty_nozzle">
                    {EVENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit" disabled={busy || !selectedPacker}>
                Record event
              </button>
            </form>
          </Section>
        </div>

        <div className="stack">
          <Section title="Live camera feed">
            {liveFrame ? (
              <div className="live">
                <img src={liveFrame.frame} alt="Live frame" />
                <div className="live-meta">{liveFrame.detections?.boxes?.length || 0} detections (mocked)</div>
              </div>
            ) : (
              <p className="muted">Waiting for live frame...</p>
            )}
          </Section>

          <Section title="Event history" actions={<button className="ghost" onClick={() => selectedId && refreshEvents(selectedId)}>Refresh</button>}>
            <div className="table">
              <div className="table-head">
                <span>Timestamp</span>
                <span>Spout</span>
                <span>Event</span>
              </div>
              <div className="table-body">
                {events.map((evt) => (
                  <div key={evt.id} className="table-row">
                    <span>{new Date(evt.created_at).toLocaleString()}</span>
                    <span>#{evt.spout_number}</span>
                    <span className={`badge badge-${evt.event_type}`}>
                      {EVENT_OPTIONS.find((e) => e.value === evt.event_type)?.label || evt.event_type}
                    </span>
                  </div>
                ))}
                {events.length === 0 && <div className="muted">No events recorded yet.</div>}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
