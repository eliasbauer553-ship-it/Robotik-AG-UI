(function () {
    'use strict';
    const vscode = acquireVsCodeApi();
    const $ = (s) => document.querySelector(s);
    const logEl = $('#log');
    let state = null;

    const STEP_LABELS = ['Umgebung bereit', 'Hub suchen', 'Verbunden', 'Programm übertragen', 'Programm läuft', 'Fertig'];

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function bars(n) {
        return '<span class="bars b' + n + '" title="Signalstärke"><i></i><i></i><i></i><i></i></span>';
    }

    function render() {
        if (!state) { return; }
        const busy = state.run.status === 'busy';

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

    window.addEventListener('message', (e) => {
        const m = e.data;
        if (m.type === 'state') { state = m.state; render(); }
        else if (m.type === 'log') { addLog(m.entry); }
        else if (m.type === 'logReset') { logEl.textContent = ''; (m.entries || []).forEach(addLog); }
    });

    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) { return; }
        const d = el.dataset;
        vscode.postMessage({ type: d.act, name: d.name, address: d.address, value: d.value, index: d.index === undefined ? undefined : Number(d.index) });
    });
    document.addEventListener('change', (e) => {
        const el = e.target.closest('[data-setting]');
        if (el) { vscode.postMessage({ type: 'setting', key: el.dataset.setting, value: el.checked }); }
    });

    vscode.postMessage({ type: 'ready' });
})();
