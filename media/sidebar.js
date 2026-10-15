(function () {
    'use strict';
    const vscode = acquireVsCodeApi();
    const $ = (s) => document.querySelector(s);
    const logEl = $('#log');
    let state = null;
    let renderedTasks = '';
    const series = {};
    const MAX_POINTS = 150;
    const COLORS = ['#4fc1ff', '#f2994a', '#6fcf97', '#bb6bd9', '#f2c94c', '#eb5757'];
    let chartQueued = false;

    const STEP_LABELS = ['Umgebung bereit', 'Hub suchen', 'Verbunden', 'Programm übertragen', 'Programm läuft', 'Fertig'];

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function bars(n) {
        return '<span class="bars b' + n + '" title="Signalstärke"><i></i><i></i><i></i><i></i></span>';
    }

    function render() {
        if (!state) { return; }
        const busy = !!state.busy;

        // Umgebung
        const pill = $('#envPill');
        const env = state.env;
        pill.className = 'pill ' + (env.status === 'ok' ? 'ok' : env.status === 'missing' ? 'bad' : env.status === 'installing' ? 'busy' : '');
        pill.textContent = env.status === 'ok' ? 'bereit · pybricksdev ' + (env.version || '')
            : env.status === 'installing' ? 'installiere…'
            : env.status === 'missing' ? 'Einrichtung nötig' : 'wird geprüft…';

        // Datei + Hub
        const fn = $('#fileName');
        fn.textContent = state.activeFile ? state.activeFile.name : 'Keine .py-Datei aktiv';
        fn.title = state.activeFile ? state.activeFile.path : '';
        fn.className = 'value' + (state.activeFile ? '' : ' muted');
        const hn = $('#hubName');
        hn.textContent = state.selectedHub ? state.selectedHub : 'Automatisch (erster Hub in Reichweite)';
        hn.className = 'value' + (state.selectedHub ? '' : ' muted');

        // Buttons
        $('#btnRun').disabled = busy;
        $('#btnUpload').disabled = busy;
        $('#btnStop').disabled = !busy;
        $('#btnRun').textContent = busy ? '⏳ Läuft…' : '▶ Hochladen & starten';
        $('#btnScan').disabled = state.scanning || busy;
        $('#btnScan').textContent = state.scanning ? '⏳ Suche läuft…' : '🔍 Suchen';

        // Schritte
        const stepsEl = $('#steps');
        if (state.run.status === 'idle') {
            stepsEl.innerHTML = '';
        } else {
            const items = [];
            for (let i = 0; i < STEP_LABELS.length; i++) {
                if (i === 4 && state.run.mode !== 'run') { continue; }
                let cls = '';
                let sym = '';
                const cur = state.run.step;
                if (state.run.status === 'error' && i === cur) { cls = 'fail'; sym = '✗'; }
                else if (i < cur || (state.run.status === 'done' && i <= cur)) { cls = 'done'; sym = '✓'; }
                else if (i === cur && state.run.status === 'busy') { cls = 'active'; sym = '●'; }
                else if (state.run.status === 'stopped' && i === cur) { cls = 'fail'; sym = '■'; }
                items.push('<li class="' + cls + '"><span class="dot">' + sym + '</span>' + esc(STEP_LABELS[i]) + '</li>');
            }
            stepsEl.innerHTML = items.join('');
        }

        // Hinweis
        const hint = $('#hint');
        if (state.hint) {
            hint.classList.remove('hidden');
            hint.innerHTML = '<b>' + esc(state.hint.title) + '</b>' + esc(state.hint.text) +
                (state.hint.steps && state.hint.steps.length ? '<ul>' + state.hint.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul>' : '') +
                (state.hint.action ? '<button class="secondary" data-act="' + esc(state.hint.action.type) + '">' + esc(state.hint.action.label) + '</button>' : '');
        } else {
            hint.classList.add('hidden');
            hint.innerHTML = '';
        }

        // Hubs
        const hubs = $('#hubs');
        const rows = [];
        rows.push('<div class="hub' + (state.selectedHub ? '' : ' selected') + '"><div class="main"><b>Automatisch</b><small>nimmt den ersten Pybricks-Hub in Reichweite</small></div>' +
            '<div class="acts">' + (state.selectedHub ? '<button class="mini" data-act="selectHub" data-name="">Wählen</button>' : '<span class="tag">aktiv</span>') + '</div></div>');
        for (const h of state.hubs) {
            const t = h.test;
            const testBadge = t ? (t.busy ? '<span>testet…</span>' : t.ok ? '<span class="ok-text">✓ Verbindung ok</span>' : '<span class="bad-text">✗ nicht erreichbar</span>') : '';
            rows.push('<div class="hub' + (h.selected ? ' selected' : '') + '"><div class="main"><b title="' + esc(h.name) + '">' + esc(h.name) + '</b><small>' +
                (h.inRange ? bars(h.bars) + '<span>in Reichweite</span>' : (state.scanned ? '<span>nicht in Reichweite</span>' : '<span>gespeichert</span>')) +
                (h.saved ? '' : '<span class="tag">neu</span>') + testBadge + '</small></div>' +
                '<div class="acts">' +
                (h.selected ? '<span class="tag">aktiv</span>' : '<button class="mini" data-act="selectHub" data-name="' + esc(h.name) + '" data-address="' + esc(h.address || '') + '">Wählen</button>') +
                '<button class="mini" data-act="testHub" data-name="' + esc(h.name) + '" data-address="' + esc(h.address || '') + '" title="Kurz verbinden und wieder trennen">Testen</button>' +
                (h.saved ? '<button class="mini" data-act="forgetHub" data-name="' + esc(h.name) + '" title="Aus der Liste löschen">✕</button>' : '') +
                '</div></div>');
        }
        if (!state.hubs.length) {
            rows.push('<div class="empty">Noch kein Hub bekannt. Hub einschalten und „Suchen“ drücken.</div>');
        }
        hubs.innerHTML = rows.join('');

        // Verlauf
        const hist = $('#history');
        if (!state.history.length) {
            hist.innerHTML = '<div class="empty">Noch keine Uploads.</div>';
        } else {
            hist.innerHTML = state.history.map((h) => {
                const icon = h.status === 'done' ? '✓' : h.status === 'stopped' ? '■' : '✗';
                const cls = h.status === 'done' ? 'ok-text' : h.status === 'stopped' ? '' : 'bad-text';
                const time = new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const secs = Math.max(1, Math.round(h.ms / 1000));
                return '<div class="item"><span class="' + cls + '">' + icon + '</span><span class="name" title="' + esc(h.path) + '">' + esc(h.file) + '</span><small>' + time + ' · ' + secs + ' s</small>' +
                    '<button class="mini" data-act="rerun" data-index="' + h.index + '" title="Erneut hochladen">↻</button></div>';
            }).join('');
        }

        // Klassenmodus
        const multi = $('#multi');
        const mi = state.multi.items;
        if (!mi.length) {
            multi.classList.add('hidden');
            multi.innerHTML = '';
        } else {
            multi.classList.remove('hidden');
            const label = (i) => i.status === 'done' ? 'fertig' : i.status === 'error' ? 'Fehler' : i.status === 'stopped' ? 'gestoppt' : i.status === 'wait' ? 'wartet' :
                (['Umgebung', 'sucht Hub', 'verbunden', 'überträgt', 'läuft', 'fertig'][i.step] || '');
            const sym = (i) => i.status === 'done' ? '<span class="ok-text">✓</span>' : i.status === 'error' ? '<span class="bad-text">✗</span>' : i.status === 'stopped' ? '■' : i.status === 'busy' ? '⏳' : '·';
            const done = mi.filter((i) => i.status === 'done').length;
            multi.innerHTML = '<div class="mhead">Klassenmodus · ' + done + '/' + mi.length + ' fertig</div>' +
                mi.map((i) => '<div class="mrow">' + sym(i) + '<span class="name" title="' + esc(i.name) + '">' + esc(i.name) + '</span><small>' + esc(label(i)) + '</small></div>').join('');
        }

        // Aufgabenkarten (offene Karten bleiben offen)
        const tasksJson = JSON.stringify(state.tasks);
        if (tasksJson !== renderedTasks) {
            renderedTasks = tasksJson;
            const open = new Set(Array.from(document.querySelectorAll('#tasks details[open]')).map((d) => d.dataset.id));
            $('#tasks').innerHTML = state.tasks.map((t) => '<details class="task" data-id="' + esc(t.id) + '"' + (open.has(t.id) ? ' open' : '') + '><summary>' + esc(t.title) + ' <span class="tag">' + esc(t.level) + '</span></summary>' +
                '<p>' + esc(t.goal) + '</p>' +
                (t.hints.length ? '<ul>' + t.hints.map((h) => '<li>' + esc(h) + '</li>').join('') + '</ul>' : '') +
                (t.hasStarter ? '<button class="secondary" data-act="taskStarter" data-name="' + esc(t.id) + '">Startdatei anlegen</button>' : '') + '</details>').join('') || '<div class="empty">Keine Aufgaben.</div>';
        }

        // Einstellungen
        document.querySelectorAll('[data-setting]').forEach((el) => {
            el.checked = !!state.settings[el.dataset.setting];
        });
    }

    function addLog(entry) {
        const nearBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 24;
        const d = document.createElement('div');
        d.className = entry.kind === 'hub' ? 'prog' : entry.kind;
        d.textContent = entry.text;
        logEl.appendChild(d);
        while (logEl.childElementCount > 400) { logEl.removeChild(logEl.firstChild); }
        if (nearBottom) { logEl.scrollTop = logEl.scrollHeight; }
    }

    function addValues(values) {
        for (const k of Object.keys(values)) {
            if (!series[k] && Object.keys(series).length >= COLORS.length) { continue; }
            const arr = series[k] || (series[k] = []);
            arr.push(values[k]);
            if (arr.length > MAX_POINTS) { arr.shift(); }
        }
        if (!chartQueued) { chartQueued = true; requestAnimationFrame(() => { chartQueued = false; drawChart(); }); }
    }

    function resetValues() {
        Object.keys(series).forEach((k) => delete series[k]);
        drawChart();
    }

    function drawChart() {
        const canvas = $('#chart');
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth || 280;
        const h = 140;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);
        const fg = getComputedStyle(document.body).color || '#ccc';
        const names = Object.keys(series);
        $('#legend').innerHTML = names.map((n, i) => '<span><i class="c' + i + '"></i>' + esc(n) + ': <b>' + esc(Math.round(series[n][series[n].length - 1] * 100) / 100) + '</b></span>').join('');
        if (!names.length) {
            ctx.fillStyle = fg; ctx.globalAlpha = 0.5; ctx.font = '12px sans-serif';
            ctx.fillText('Noch keine Messwerte.', 10, 22);
            return;
        }
        let min = Infinity, max = -Infinity;
        names.forEach((n) => series[n].forEach((v) => { if (v < min) { min = v; } if (v > max) { max = v; } }));
        if (min === max) { min -= 1; max += 1; }
        const padL = 34, padR = 6, padT = 8, padB = 8;
        ctx.strokeStyle = fg; ctx.fillStyle = fg; ctx.font = '10px sans-serif';
        ctx.globalAlpha = 0.2;
        for (let g = 0; g <= 2; g++) {
            const y = padT + ((h - padT - padB) * g) / 2;
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        }
        ctx.globalAlpha = 0.7;
        ctx.fillText(String(Math.round(max * 10) / 10), 2, padT + 4);
        ctx.fillText(String(Math.round(min * 10) / 10), 2, h - padB);
        ctx.globalAlpha = 1;
        names.forEach((n, i) => {
            const arr = series[n];
            ctx.strokeStyle = COLORS[i]; ctx.lineWidth = 1.6; ctx.beginPath();
            arr.forEach((v, idx) => {
                const x = padL + ((w - padL - padR) * idx) / Math.max(1, MAX_POINTS - 1);
                const y = padT + (h - padT - padB) * (1 - (v - min) / (max - min));
                if (idx === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
            });
            ctx.stroke();
        });
    }

    window.addEventListener('message', (e) => {
        const m = e.data;
        if (m.type === 'state') { state = m.state; render(); }
        else if (m.type === 'log') { addLog(m.entry); }
        else if (m.type === 'values') { addValues(m.values); }
        else if (m.type === 'valuesReset') { resetValues(); }
        else if (m.type === 'logReset') { logEl.textContent = ''; (m.entries || []).forEach(addLog); }
    });

    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) { return; }
        if (el.dataset.act === 'clearValues') { resetValues(); return; }
        const d = el.dataset;
        vscode.postMessage({ type: d.act, name: d.name, address: d.address, value: d.value, index: d.index === undefined ? undefined : Number(d.index) });
    });
    document.addEventListener('change', (e) => {
        const el = e.target.closest('[data-setting]');
        if (el) { vscode.postMessage({ type: 'setting', key: el.dataset.setting, value: el.checked }); }
    });

    drawChart();
    vscode.postMessage({ type: 'ready' });
})();
