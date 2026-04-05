/* ── Road path definitions (SVG bezier strings) ── */
const ROADS = {
  'A-J1':  'M 66 52 C 88 90, 122 128, 152 158',
  'A-J2':  'M 66 52 C 160 56, 258 88, 320 148',
  'B-J1':  'M 452 52 C 358 56, 258 88, 194 148',
  'B-J2':  'M 452 52 C 430 90, 396 128, 364 158',
  'C-J3':  'M 66 408 C 88 374, 122 336, 152 306',
  'C-J4':  'M 66 408 C 160 404, 256 374, 318 312',
  'D-J3':  'M 452 408 C 358 404, 256 374, 188 312',
  'D-J4':  'M 452 408 C 430 374, 396 336, 364 306',
  'E-J1':  'M 34 230 C 72 214, 118 182, 150 168',
  'E-J3':  'M 34 230 C 72 248, 118 274, 150 288',
  'F-J2':  'M 484 230 C 446 214, 400 182, 368 168',
  'F-J4':  'M 484 230 C 446 248, 400 274, 368 288',
  'G-J1':  'M 258 30 C 238 72, 196 120, 174 148',
  'G-J2':  'M 258 30 C 278 72, 322 120, 342 148',
  'H-J3':  'M 258 430 C 238 392, 196 342, 174 314',
  'H-J4':  'M 258 430 C 278 392, 322 342, 342 314',
  'J1-J2': 'M 188 160 C 220 142, 290 142, 328 160',
  'J3-J4': 'M 186 300 C 220 318, 292 318, 326 300',
  'J1-J3': 'M 162 182 C 146 215, 146 262, 162 282',
  'J2-J4': 'M 353 182 C 368 215, 368 262, 353 282',
  'J1-J4': 'M 185 178 C 238 218, 278 248, 330 282',
  'J2-J3': 'M 330 178 C 278 218, 238 248, 185 282',
};

/* ── Graph adjacency ── */
const GRAPH = {
  A:  ['J1', 'J2'],
  B:  ['J1', 'J2'],
  C:  ['J3', 'J4'],
  D:  ['J3', 'J4'],
  E:  ['J1', 'J3'],
  F:  ['J2', 'J4'],
  G:  ['J1', 'J2'],
  H:  ['J3', 'J4'],
  J1: ['A', 'B', 'E', 'G', 'J2', 'J3', 'J4'],
  J2: ['A', 'B', 'F', 'G', 'J1', 'J3', 'J4'],
  J3: ['C', 'D', 'E', 'H', 'J1', 'J2', 'J4'],
  J4: ['C', 'D', 'F', 'H', 'J1', 'J2', 'J3'],
};

/* ── API base URL — change this if you deploy elsewhere ── */
const API_URL = 'http://127.0.0.1:5000';

/* ── Fetch all junction weights from Python model ── */
async function fetchWeightsFromModel(hour, date) {
  const res = await fetch(
    `${API_URL}/predict/all?hour=${hour}&date=${date}`
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.weights;  // { J1: 18, J2: 34, J3: 11, J4: 27 }
}

function congestionLevel(vehicles) {
  if (vehicles <= 12) return 'low';
  if (vehicles <= 24) return 'medium';
  return 'high';
}

/* ── Dijkstra — weights passed in directly from API response ── */
function dijkstra(start, end, weights) {

  const dist = {}, prev = {}, visited = new Set();
  for (const n of Object.keys(GRAPH)) dist[n] = Infinity;
  dist[start] = 0;

  const queue = new Set(Object.keys(GRAPH));

  while (queue.size) {
    // pick min dist unvisited node
    let u = null;
    for (const n of queue) {
      if (u === null || dist[n] < dist[u]) u = n;
    }
    if (u === end || dist[u] === Infinity) break;
    queue.delete(u);
    visited.add(u);

    for (const v of (GRAPH[u] || [])) {
      if (visited.has(v)) continue;
      const edgeCost = 1 + (weights[u] || 0) + (weights[v] || 0);
      const alt = dist[u] + edgeCost;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
      }
    }
  }

  if (dist[end] === Infinity) return null;
  const path = [];
  let cur = end;
  while (cur) { path.unshift(cur); cur = prev[cur]; }
  return { path, cost: dist[end], weights };
}

/* ── Road path helpers ── */
function reverseD(d) {
  const m = d.match(/-?[\d.]+/g).map(Number);
  if (d.includes('C') && m.length === 8) {
    return `M ${m[6]} ${m[7]} C ${m[4]} ${m[5]}, ${m[2]} ${m[3]}, ${m[0]} ${m[1]}`;
  }
  return d;
}

function getRoadD(a, b) {
  const fwd = ROADS[`${a}-${b}`];
  if (fwd) return fwd;
  const rev = ROADS[`${b}-${a}`];
  if (rev) return reverseD(rev);
  return null;
}

/* ── Animate path on SVG ── */
function animatePath(route) {
  const layer = document.getElementById('pathLayer');
  layer.innerHTML = '';

  for (let i = 0; i < route.length - 1; i++) {
    const d = getRoadD(route[i], route[i + 1]);
    if (!d) continue;

    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', '#f0a020');
    p.setAttribute('stroke-width', '6');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('opacity', '0.92');

    const len = 400;
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    p.style.transition = `stroke-dashoffset 0.5s ease ${i * 0.44}s`;
    layer.appendChild(p);

    setTimeout(() => { p.style.strokeDashoffset = 0; }, 30 + i * 440);
  }
}

/* ── Highlight junctions on map ── */
function highlightJunctions(route, weights) {
  ['J1','J2','J3','J4'].forEach(id => {
    const el = document.getElementById(`j${id}`);
    if (!el) return;
    const c = el.querySelector('circle');
    c.style.fill = '#1a1a1a';
    c.style.stroke = '#444';
    c.style.strokeWidth = '1.5';
  });

  route.filter(n => n.startsWith('J')).forEach(id => {
    const el = document.getElementById(`j${id}`);
    if (!el) return;
    const c = el.querySelector('circle');
    const level = congestionLevel(weights[id] || 0);
    if (level === 'low')    { c.style.fill = '#0d2b16'; c.style.stroke = '#35c87a'; }
    if (level === 'medium') { c.style.fill = '#2b1e00'; c.style.stroke = '#f0a020'; }
    if (level === 'high')   { c.style.fill = '#2b0a0a'; c.style.stroke = '#e84040'; }
    c.style.strokeWidth = '2';
  });
}

/* ── Highlight selected entry points ── */
function setPointSelected(pt, selected) {
  document.querySelectorAll(`.enode`).forEach(el => {
    if (el.dataset.pt === pt) {
      el.classList.toggle('selected', selected);
    }
  });
}

function clearAllSelected() {
  document.querySelectorAll('.enode').forEach(el => el.classList.remove('selected'));
}

/* ── Clear map ── */
function clearMap() {
  document.getElementById('pathLayer').innerHTML = '';
  ['J1','J2','J3','J4'].forEach(id => {
    const el = document.getElementById(`j${id}`);
    if (!el) return;
    const c = el.querySelector('circle');
    c.style.fill = '#1a1a1a';
    c.style.stroke = '#444';
    c.style.strokeWidth = '1.5';
  });
  clearAllSelected();
}

/* ── Show result card ── */
function showResult(path, cost, weights) {
  const card = document.getElementById('resultCard');
  const pathEl = document.getElementById('resultPath');
  const metaEl = document.getElementById('resultMeta');
  const jEl = document.getElementById('resultJunctions');

  const junctions = path.filter(n => n.startsWith('J'));

  pathEl.textContent = path.join('  →  ');

  metaEl.innerHTML = `
    Passes through <strong>${junctions.length}</strong> junction${junctions.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
    Total traffic cost: <strong>${cost}</strong>
  `;

  jEl.innerHTML = junctions.map(j => {
    const v = weights[j] || 0;
    const lvl = congestionLevel(v);
    return `<span class="j-badge ${lvl}">${j}: ${v} veh/hr</span>`;
  }).join('');

  card.classList.add('visible');
}

function hideResult() {
  document.getElementById('resultCard').classList.remove('visible');
}

/* ── Wire up entry point clicks on map ── */
document.querySelectorAll('.enode').forEach(el => {
  el.addEventListener('click', () => {
    const pt = el.dataset.pt;
    const startSel = document.getElementById('startPoint');
    const endSel = document.getElementById('endPoint');
    if (!startSel.value) {
      startSel.value = pt;
    } else if (!endSel.value && startSel.value !== pt) {
      endSel.value = pt;
    }
    syncSelectionsToMap();
  });
});

function syncSelectionsToMap() {
  clearAllSelected();
  const s = document.getElementById('startPoint').value;
  const e = document.getElementById('endPoint').value;
  if (s) setPointSelected(s, true);
  if (e) setPointSelected(e, true);
}

document.getElementById('startPoint').addEventListener('change', syncSelectionsToMap);
document.getElementById('endPoint').addEventListener('change', syncSelectionsToMap);

/* ── Swap button ── */
document.getElementById('swapBtn').addEventListener('click', () => {
  const s = document.getElementById('startPoint');
  const e = document.getElementById('endPoint');
  [s.value, e.value] = [e.value, s.value];
  syncSelectionsToMap();
  clearMap();
  hideResult();
});

/* ── Form submit ── */
document.getElementById('routeForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const start   = document.getElementById('startPoint').value;
  const end     = document.getElementById('endPoint').value;
  const dateVal = document.getElementById('travelDate').value;
  const hour    = parseInt(document.getElementById('travelHour').value);

  if (!start || !end || !dateVal || isNaN(hour)) return;

  if (start === end) {
    alert('Start and destination must be different points.');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.classList.add('loading');
  btn.disabled = true;
  clearMap();
  hideResult();

  try {
    const weights = await fetchWeightsFromModel(hour, dateVal);
    const result  = dijkstra(start, end, weights);

    if (!result) {
      alert('No route found between these points.');
      return;
    }

    animatePath(result.path);
    highlightJunctions(result.path, result.weights);
    showResult(result.path, result.cost, result.weights);
    syncSelectionsToMap();

  } catch (err) {
    alert('Could not reach the model server.\nMake sure server.py is running.\n\n' + err.message);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

/* ── Clear result ── */
document.getElementById('clearBtn').addEventListener('click', () => {
  clearMap();
  hideResult();
  document.getElementById('startPoint').value = '';
  document.getElementById('endPoint').value = '';
  document.getElementById('travelDate').value = '';
  document.getElementById('travelHour').value = '';
});