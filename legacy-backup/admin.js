const loginModal = document.getElementById('login-modal');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const playersTable = document.getElementById('players-table');
const gameStateText = document.getElementById('game-state-text');
const countdownText = document.getElementById('countdown-text');
const playerCount = document.getElementById('player-count');
const startDelay = document.getElementById('start-delay');
const startGameBtn = document.getElementById('start-game-btn');
const stopGameBtn = document.getElementById('stop-game-btn');
const resetAllBtn = document.getElementById('reset-all-btn');
const roundSummary = document.getElementById('round-summary');

let refreshTimer = null;

async function api(path, options = {}) {
    const response = await fetch(path, {
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return response.json();
}

function setLoginVisible(visible) {
    loginModal.classList.toggle('hidden', !visible);
    if (visible) {
        passwordInput.focus();
    }
}

function renderPlayers(players) {
    playersTable.innerHTML = '';
    playerCount.innerText = String(players.length);

    if (!players.length) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="3">No players yet</td>`;
        playersTable.appendChild(row);
        return;
    }

    for (const player of players) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(player.name)}</td>
            <td>${Number(player.score).toLocaleString()}</td>
            <td>
                <div class="actions">
                    <button class="mini reset" data-action="reset" data-name="${escapeAttr(player.name)}">Reset Point</button>
                    <button class="mini delete" data-action="delete" data-name="${escapeAttr(player.name)}">Delete</button>
                </div>
            </td>
        `;
        playersTable.appendChild(row);
    }
}

function renderGameState(state) {
    if (state.countdown_until && Date.now() < Number(state.countdown_until)) {
        const remain = Math.max(0, Math.ceil((Number(state.countdown_until) - Date.now()) / 1000));
        gameStateText.innerText = 'Countdown';
        countdownText.innerText = `${remain}s`;
        return;
    }

    if (state.running) {
        gameStateText.innerText = 'Running';
        countdownText.innerText = 'Live';
        return;
    }

    if (state.last_round_summary) {
        gameStateText.innerText = 'Stopped';
        countdownText.innerText = 'Round closed';
        return;
    }

    gameStateText.innerText = 'Idle';
    countdownText.innerText = '--';
}

async function refreshAll() {
    try {
        const state = await api('/api/game-state');
        renderGameState(state);
        renderRoundSummary(state.last_round_summary);

        const players = await api('/api/admin/players');
        renderPlayers(players.players || []);
        setLoginVisible(false);
    } catch (error) {
        if (error.status === 401) {
            setLoginVisible(true);
        } else {
            console.error(error);
        }
    }
}

async function login() {
    try {
        await api('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ password: passwordInput.value })
        });
        loginError.classList.add('hidden');
        await refreshAll();
    } catch (error) {
        loginError.classList.remove('hidden');
    }
}

async function startGame() {
    await api('/api/admin/start', {
        method: 'POST',
        body: JSON.stringify({ delay_seconds: Number(startDelay.value) || 5 })
    });
    await refreshAll();
}


async function stopGame() {
    await api('/api/admin/stop', {
        method: 'POST',
        body: JSON.stringify({})
    });
    await refreshAll();
}

async function resetAllPoints() {
    await api('/api/admin/reset-all', {
        method: 'POST',
        body: JSON.stringify({})
    });
    await refreshAll();
}

async function handleTableAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const username = button.dataset.name;
    const endpoint = action === 'reset' ? '/api/admin/player/reset' : '/api/admin/player/delete';

    await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username })
    });
    await refreshAll();
}


function renderRoundSummary(summary) {
    if (!roundSummary) return;

    if (!summary || !Array.isArray(summary.players) || !summary.players.length) {
        roundSummary.className = 'summary-list empty-state';
        roundSummary.innerHTML = 'No round summary yet.';
        return;
    }

    const topPlayers = summary.top3 && summary.top3.length ? summary.top3 : summary.players.slice(0, 3);
    roundSummary.className = 'summary-list';
    roundSummary.innerHTML = `
        <div class="summary-stats">
            <div><span>Total Players</span><strong>${summary.total_players || summary.players.length}</strong></div>
            <div><span>Total Points</span><strong>${Number(summary.total_points || 0).toLocaleString()}</strong></div>
        </div>
        <div class="summary-podium">
            ${topPlayers.map((player, index) => `
                <div class="summary-item summary-rank-${index + 1}">
                    <span>${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} ${escapeHtml(player.name)}</span>
                    <strong>${Number(player.score).toLocaleString()}</strong>
                </div>
            `).join('')}
        </div>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
    return escapeHtml(value).replaceAll('`', '&#96;');
}

loginBtn.addEventListener('click', login);
passwordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        login();
    }
});
startGameBtn.addEventListener('click', startGame);
if (stopGameBtn) {
    stopGameBtn.addEventListener('click', stopGame);
}
resetAllBtn.addEventListener('click', resetAllPoints);
playersTable.addEventListener('click', handleTableAction);

refreshAll();
refreshTimer = setInterval(refreshAll, 1000);
