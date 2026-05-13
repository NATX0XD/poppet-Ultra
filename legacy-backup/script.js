let count = parseInt(localStorage.getItem('popcat_count')) || 0;
const counterDisplay = document.getElementById('counter');
const cpsDisplay = document.getElementById('cps-display');
const catImg = document.getElementById('cat-img');
const appBody = document.getElementById('app-body');
const message = document.getElementById('message');
const gameStateOverlay = document.getElementById('game-state-overlay');
const gameStateLabel = document.getElementById('game-state-label');
const countdownValue = document.getElementById('countdown-value');
const sceneFog = document.getElementById('scene-fog');
const superElitVideo = document.getElementById('super-elit-video');
const chillSound = new Audio('assent/sound/chillSound.mp3');
const catupSound = new Audio('assent/sound/catup.mp3');
const elitSound = new Audio('assent/sound/elitSound.mp3');
const MAX_POP_POOL = 24;
const popClickSounds = Array.from({ length: 12 }, () => new Audio('assent/sound/pop.mp3'));
const DISPLAY_CPS_MAX = 16;

// Leaderboard Elements
const nameModal = document.getElementById('name-modal');
const usernameInput = document.getElementById('username-input');
const startBtn = document.getElementById('start-btn');
const leaderboardList = document.getElementById('leaderboard-list');
const userRankDisplay = document.getElementById('user-rank');
const userScoreDisplay = document.getElementById('user-score');
const userRankDetails = document.getElementById('user-rank-details');
const startGameBtn = document.getElementById('start-game-btn');
const stopGameBtn = document.getElementById('stop-game-btn');
const resetAllBtn = document.getElementById('reset-all-btn');
const playersTable = document.getElementById('players-table');
const SKIN_COUNT = 36;
const DEFAULT_CAT_CLOSED = 'assent/popcat Costume/p.png';
const DEFAULT_CAT_OPEN = 'assent/popcat Costume/op.png';
const SKIN_STORAGE_KEY = 'popcat_selected_skin';
const skinDrawerToggle = document.getElementById('skin-drawer-toggle');
const skinDrawer = document.getElementById('skin-drawer');
const skinDrawerBackdrop = document.getElementById('skin-drawer-backdrop');
const skinDrawerClose = document.getElementById('skin-drawer-close');
const skinGrid = document.getElementById('skin-grid');
const NONE_EFFECT_OVERRIDES = {
    15: 'cat-pup-none-effect15.png',
    28: 'cat-pup-none-effect4-28.png',
    34: 'cat-pup-none-effect34.png',
};
let selectedSkinId = normalizeSkinId(localStorage.getItem(SKIN_STORAGE_KEY));
let autoEffectSince = null;
let interactionStarted = count > 0;
let lastCps = 0;
let currentCatSrc = '';
let catMouthOpen = false;
let skinDrawerOpen = false;

function normalizeSkinId(value) {
    if (value === 'default') {
        return 'default';
    }

    const index = Number(value);
    if (Number.isInteger(index) && index >= 1 && index <= SKIN_COUNT) {
        return String(index);
    }

    return 'default';
}

function getSkinPreviewSrc(index) {
    return `assent/popcat Costume/cat-pup/cat-pup-${index}.png`;
}

function getSkinNoneEffectSrc(index) {
    const fileName = NONE_EFFECT_OVERRIDES[index] || `cat-pup-none-effect-${index}.png`;
    return `assent/popcat Costume/cat-pop-none-effect/${fileName}`;
}

function getSkinEffectSrc(index) {
    return `assent/popcat Costume/cat-pop-effect/cat-pup-effect-${index}.png`;
}

function buildSkinOptions() {
    if (!skinGrid) return;

    const fragment = document.createDocumentFragment();
    for (let index = 1; index <= SKIN_COUNT; index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'skin-card';
        button.dataset.skinId = String(index);
        button.innerHTML = `
            <img src="${encodeURI(getSkinPreviewSrc(index))}" alt="Skin ${index}" loading="lazy">
            <span>Skin ${index}</span>
            <small>#${index}</small>
        `;
        button.addEventListener('click', () => {
            setSelectedSkin(String(index));
            closeSkinDrawer();
        });
        fragment.appendChild(button);
    }

    skinGrid.innerHTML = '';
    skinGrid.appendChild(fragment);
    syncSkinSelection();
}

function syncSkinSelection() {
    if (!skinDrawer) return;

    const cards = skinDrawer.querySelectorAll('[data-skin-id]');
    cards.forEach((card) => {
        card.classList.toggle('active', card.dataset.skinId === selectedSkinId);
    });
}

function setSkinDrawerOpen(open) {
    skinDrawerOpen = open;
    document.body.classList.toggle('skin-drawer-open', open);

    if (skinDrawerToggle) {
        skinDrawerToggle.setAttribute('aria-expanded', String(open));
    }
    if (skinDrawer) {
        skinDrawer.classList.toggle('hidden', !open);
        skinDrawer.classList.toggle('open', open);
        skinDrawer.setAttribute('aria-hidden', String(!open));
    }
    if (skinDrawerBackdrop) {
        skinDrawerBackdrop.classList.toggle('hidden', !open);
        skinDrawerBackdrop.setAttribute('aria-hidden', String(!open));
    }
}

function openSkinDrawer() {
    setSkinDrawerOpen(true);
}

function closeSkinDrawer() {
    setSkinDrawerOpen(false);
}

function setSelectedSkin(nextSkinId) {
    const normalized = normalizeSkinId(nextSkinId);
    selectedSkinId = normalized;
    localStorage.setItem(SKIN_STORAGE_KEY, normalized);
    catMouthOpen = false;
    syncSkinSelection();
    refreshCatSprite(lastCps, Date.now());
}

function getCurrentCps(now = Date.now()) {
    clickTimes = clickTimes.filter((t) => now - t < 1000);
    return clickTimes.length;
}

function getSkinRenderState(cps, now = Date.now()) {
    if (selectedSkinId === 'default') {
        return catMouthOpen ? 'open' : 'closed';
    }

    if (cps > 8) {
        if (autoEffectSince === null) {
            autoEffectSince = now;
        }
        if (now - autoEffectSince >= 3000) {
            return 'effect';
        }
        return 'none';
    }

    autoEffectSince = null;
    return 'none';
}

function getCatSpriteSrc(cps, now = Date.now()) {
    const state = getSkinRenderState(cps, now);

    if (selectedSkinId === 'default') {
        return state === 'open' ? DEFAULT_CAT_OPEN : DEFAULT_CAT_CLOSED;
    }

    const index = Number(selectedSkinId) || 1;
    if (state === 'effect') {
        return getSkinEffectSrc(index);
    }

    return getSkinNoneEffectSrc(index);
}

function refreshCatSprite(cps = lastCps, now = Date.now()) {
    if (!catImg) return;

    const src = encodeURI(getCatSpriteSrc(cps, now));
    if (currentCatSrc !== src) {
        currentCatSrc = src;
        catImg.src = src;
    }
}

const BACKGROUND_CLASSES = [
    'bg-home',
    'bg-forest',
    'bg-flying-cats',
    'bg-cyberpunk',
    'bg-ocean',
    'bg-temple',
    'bg-ruins',
    'bg-space',
    'bg-matrix',
    'bg-candy-chaos',
    'bg-super-elit',
    'disco-mode'
];
const SOUND_TARGET_VOLUME = 0.85;
const SOUND_FADE_MS = 700;

[chillSound, catupSound, elitSound, superElitVideo].forEach((sound) => {
    sound.loop = true;
    sound.preload = 'auto';
    sound.volume = 0;
});
superElitVideo.playsInline = true;
superElitVideo.preload = 'auto';
popClickSounds.forEach((sound) => {
    sound.preload = 'auto';
    sound.volume = 1;
    sound.load();
});

// Handle Username
if (!username) {
    nameModal.classList.remove('hidden');
}

startBtn.addEventListener('click', () => {
    const val = usernameInput.value.trim();
    if (val) {
        username = val;
        localStorage.setItem('popcat_username', username);
        nameModal.classList.add('hidden');
        refreshPlayableState();
        syncScore();
        window.setTimeout(() => openSkinDrawer(), 150);
    }
});

function refreshPlayableState() {
    isGameActive = !!username && gameRunning;
}


function getSoundForCps(cps) {
    if (cps < 3) return null;
    if (cps < 6) return chillSound;
    if (cps < 9) return catupSound;
    if (cps < 18) return elitSound;
    return superElitVideo;
}

function getSceneForCps(cps) {
    if (cps < 3) return 'bg-home';
    if (cps < 6) return 'bg-forest';
    if (cps < 9) return 'bg-flying-cats';
    if (cps < 13) return 'bg-matrix';
    if (cps < 18) return 'bg-candy-chaos';
    return 'bg-super-elit';
}

function getTransitionEffectForScene(sceneClass) {
    if (sceneClass === 'bg-matrix') return 'matrix';
    if (sceneClass === 'bg-super-elit') return 'super';
    if (sceneClass === 'bg-flying-cats') return 'rainbow';
    if (sceneClass === 'bg-candy-chaos') return 'glitch';
    return 'fog';
}

function renderSceneTransition(effect) {
    if (!sceneFog) return;

    sceneFog.dataset.effect = effect;
    sceneFog.innerHTML = '';

    if (effect === 'matrix') {
        const grid = document.createElement('div');
        grid.className = 'scene-transition-grid';
        const cols = 14;
        const rows = 8;
        const total = cols * rows;
        for (let i = 0; i < total; i += 1) {
            const tile = document.createElement('span');
            tile.className = 'scene-transition-tile';
            tile.style.setProperty('--delay', `${i * 14}ms`);
            grid.appendChild(tile);
        }
        sceneFog.appendChild(grid);
        return;
    }

    const glow = document.createElement('div');
    glow.className = `scene-transition-glow scene-transition-${effect}`;
    sceneFog.appendChild(glow);
}

function showSceneTransition(effect) {
    if (!sceneFog) return;

    clearTimeout(sceneTransitionTimer);
    sceneFog.classList.remove('hidden');
    sceneFog.classList.add('scene-transition-active');
    renderSceneTransition(effect);
}

function hideSceneTransition() {
    if (!sceneFog) return;

    sceneFog.classList.remove('scene-transition-active');
    clearTimeout(sceneTransitionTimer);
    sceneTransitionTimer = setTimeout(() => {
        sceneFog.dataset.effect = '';
        sceneFog.innerHTML = '';
        sceneFog.classList.add('hidden');
    }, 520);
}

function applySceneClass(nextSceneClass) {
    BACKGROUND_CLASSES.forEach((className) => appBody.classList.remove(className));
    appBody.classList.add(nextSceneClass);
    currentSceneClass = nextSceneClass;
}

function setSceneClass(nextSceneClass) {
    if (currentSceneClass === nextSceneClass) return;

    const effect = getTransitionEffectForScene(nextSceneClass);
    const token = ++sceneTransitionToken;

    showSceneTransition(effect);

    if (effect === 'matrix') {
        setTimeout(() => {
            if (sceneTransitionToken !== token) return;
            applySceneClass(nextSceneClass);
        }, 210);
        setTimeout(() => {
            if (sceneTransitionToken !== token) return;
            hideSceneTransition();
        }, 860);
        return;
    }

    applySceneClass(nextSceneClass);

    setTimeout(() => {
        if (sceneTransitionToken !== token) return;
        hideSceneTransition();
    }, effect === 'super' ? 720 : 600);
}

function startFromMiddle(sound) {
    const token = (sound._startToken || 0) + 1;
    sound._startToken = token;

    const playFromMiddle = () => {
        if (sound._startToken !== token) return;

        try {
            if (Number.isFinite(sound.duration) && sound.duration > 0) {
                sound.currentTime = sound.duration / 2;
            }
        } catch (error) {
            console.warn('Unable to seek sound to middle:', error);
        }

        sound.play().catch((error) => console.log('Media play failed:', error));
    };

    if (sound.readyState >= 1 && Number.isFinite(sound.duration) && sound.duration > 0) {
        playFromMiddle();
        return;
    }

    sound.addEventListener('loadedmetadata', playFromMiddle, { once: true });
    sound.load();
}

function fadeSound(sound, targetVolume, duration = SOUND_FADE_MS) {
    if (!sound) return;

    const token = (sound._fadeToken || 0) + 1;
    sound._fadeToken = token;

    const startVolume = sound.volume;
    const startTime = performance.now();

    if (targetVolume > 0 && sound.paused) {
        sound.play().catch((error) => console.log('Media play failed:', error));
    }

    if (Math.abs(startVolume - targetVolume) < 0.01) {
        sound.volume = targetVolume;
        if (targetVolume === 0) {
            sound.pause();
        }
        return;
    }

    const tick = (now) => {
        if (sound._fadeToken !== token) return;

        const progress = Math.min(1, (now - startTime) / duration);
        sound.volume = startVolume + (targetVolume - startVolume) * progress;

        if (progress < 1) {
            requestAnimationFrame(tick);
            return;
        }

        sound.volume = targetVolume;
        if (targetVolume === 0) {
            sound.pause();
        }
    };

    requestAnimationFrame(tick);
}

function playClickPopSound() {
    const context = ensureClickAudioContext();
    if (context && clickAudioBuffer) {
        try {
            const source = context.createBufferSource();
            source.buffer = clickAudioBuffer;
            source.connect(context.destination);
            source.start(0);
            return;
        } catch (error) {
            console.log('Click audio buffer play failed:', error);
        }
    }

    try {
        const sound = acquirePopClickSound();
        sound.currentTime = 0;
        sound.play().catch((error) => console.log('Click sound play failed:', error));
    } catch (error) {
        console.log('Click sound play failed:', error);
    }
}

function ensureClickAudioContext() {
    if (!clickAudioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        clickAudioContext = new AudioCtx();
    }

    if (clickAudioContext.state === 'suspended') {
        clickAudioContext.resume().catch(() => {});
    }

    return clickAudioContext;
}

async function loadClickAudioBuffer() {
    if (clickAudioBuffer || clickAudioLoading) return clickAudioLoading;

    const context = ensureClickAudioContext();
    if (!context) return null;

    clickAudioLoading = fetch('assent/sound/pop.mp3')
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
        .then((buffer) => {
            clickAudioBuffer = buffer;
            return buffer;
        })
        .catch((error) => {
            console.warn('Failed to load click audio buffer:', error);
            return null;
        });

    return clickAudioLoading;
}

function acquirePopClickSound() {
    for (let i = 0; i < popClickSounds.length; i += 1) {
        const index = (popSoundIndex + i) % popClickSounds.length;
        const sound = popClickSounds[index];
        if (sound.paused || sound.ended) {
            popSoundIndex = (index + 1) % popClickSounds.length;
            return sound;
        }
    }

    if (popClickSounds.length < MAX_POP_POOL) {
        const sound = new Audio('assent/sound/pop.mp3');
        sound.preload = 'auto';
        sound.volume = 1;
        sound.load();
        popClickSounds.push(sound);
        popSoundIndex = 0;
        return sound;
    }

    const sound = popClickSounds[popSoundIndex];
    popSoundIndex = (popSoundIndex + 1) % popClickSounds.length;
    return sound;
}

function setActiveSound(nextSound) {
    if (nextSound === activeMedia) {
        if (nextSound) {
            fadeSound(nextSound, SOUND_TARGET_VOLUME, 250);
        }
        return;
    }

    if (activeMedia) {
        fadeSound(activeMedia, 0);
    }

    activeMedia = nextSound;

    if (!nextSound) return;

    nextSound.volume = 0;
    startFromMiddle(nextSound);
    fadeSound(nextSound, SOUND_TARGET_VOLUME, 350);
}

function setSuperElitVideoVisible(visible) {
    if (!superElitVideo) return;

    if (visible) {
        superElitVideo.classList.remove('hidden');
        superElitVideo.classList.add('scene-video-visible');
    } else {
        superElitVideo.classList.remove('scene-video-visible');
        setTimeout(() => {
            if (!superElitVideo.classList.contains('scene-video-visible')) {
                superElitVideo.classList.add('hidden');
            }
        }, 500);
    }
}

function setVideoSceneActive(active) {
    if (!superElitVideo) return;

    if (!active) {
        setSuperElitVideoVisible(false);
        return;
    }

    setSuperElitVideoVisible(true);
}

function renderGameState(state) {
    gameRunning = !!state.running;
    refreshPlayableState();

    const countdownUntil = state.countdown_until ? Number(state.countdown_until) : null;
    if (countdownUntil && Date.now() < countdownUntil) {
        const seconds = Math.max(0, Math.ceil((countdownUntil - Date.now()) / 1000));
        gameStateOverlay.classList.remove('hidden');
        gameStateLabel.innerText = 'Game starts in';
        countdownValue.innerText = String(seconds);
    } else if (gameRunning) {
        gameStateOverlay.classList.add('hidden');
    } else {
        gameStateOverlay.classList.remove('hidden');
        gameStateLabel.innerText = 'Waiting for admin...';
        countdownValue.innerText = '...';
    }

    if (!username) {
        nameModal.classList.remove('hidden');
    }
}

async function fetchGameState() {
    try {
        const response = await fetch('/api/game-state');
        const state = await response.json();
        renderGameState(state);
    } catch (e) {
        console.error('Fetch game state failed:', e);
    }
}

// Sync Score with Backend
async function syncScore() {
    if (!username || !isGameActive) return;
    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, score: count })
        });
        const result = await response.json();
        if (result.rank) {
            userRankDisplay.innerText = `Your Rank: ${result.rank}`;
        }
        if (userScoreDisplay) {
            userScoreDisplay.innerText = `Your Score: ${count.toLocaleString()}`;
        }
    } catch (e) {
        console.error("Sync failed:", e);
    }
}

// Fetch Leaderboard
async function fetchLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();
        const topPlayers = Array.isArray(data) ? data.slice(0, 3) : [];

        leaderboardList.innerHTML = '';
        if (!topPlayers.length) {
            const empty = document.createElement('div');
            empty.className = 'leaderboard-item leaderboard-empty';
            empty.innerHTML = '<span>No players yet</span><span>--</span>';
            leaderboardList.appendChild(empty);
            return;
        }

        topPlayers.forEach((player, index) => {
            const rankLabel = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            const item = document.createElement('div');
            item.className = `leaderboard-item leaderboard-rank-${index + 1}`;
            item.innerHTML = `<span>${rankLabel} ${escapeHtml(player.name)}</span> <span>${Number(player.score).toLocaleString()}</span>`;
            leaderboardList.appendChild(item);
        });
    } catch (e) {
        console.error("Fetch leaderboard failed:", e);
    }
}

// Update leaderboard every 3 seconds
setInterval(fetchLeaderboard, 3000);
fetchLeaderboard(); // Initial fetch

// Poll game state so every screen shows the same countdown/start state
setInterval(fetchGameState, 1000);
fetchGameState();

// Sync score every 5 seconds (heartbeat)
setInterval(syncScore, 5000);

// Fallback images in case local ones fail
catImg.onerror = function() {
    if (catImg.dataset.fallbackStage === '1') {
        catImg.src = DEFAULT_CAT_CLOSED;
        return;
    }
    catImg.dataset.fallbackStage = '1';
    currentCatSrc = '';
    catImg.src = DEFAULT_CAT_CLOSED;
};

counterDisplay.innerText = count;
if (userScoreDisplay) {
    userScoreDisplay.innerText = `Your Score: ${count.toLocaleString()}`;
}

// Chill Guy Quotes
const speechBubble = document.getElementById('speech-bubble');
const speechBubbleLeft = document.getElementById('speech-bubble-left');
const chillGuyContainer = document.getElementById('chill-guy-container');
const chillGuyContainerLeft = document.getElementById('chill-guy-container-left');
const quotes = [
    "ใจเย็นเพื่อน... เมาส์จะพังแล้ว",
    "คีย์บอร์ดสู้ชีวิตมากนะวันนี้",
    "กดขนาดนี้ นิ้วยังอยู่ดีมั้ย?",
    "เบาได้เบา... แมวเริ่มปวดหัวแล้ว",
    "นี่คนหรือเครื่องจักรนิ้วเนี่ย?",
    "พักกินน้ำบ้างก็ได้นะ เพื่อน",
    "สู้ๆ นะ อีกนิดจะทะลุจอแล้ว",
    "เมาส์บอกว่า: 'กูเจ็บ...'",
    "คีย์บอร์ดถามว่า: 'เมื่อไหร่จะพอ?'",
    "กดเก่งขนาดนี้ สนใจไปแข่งโอลิมปิกมั้ย?",
    "พังคือพังนะเพื่อน ไม่ใช่ซ่อมฟรี",
    "นิ้วนายทำด้วยเหล็กเหรอ?"
];

function updateChillGuy(cps) {
    if (cps > 5) {
        // Show chill guy if not visible
        if (chillGuyContainer.classList.contains('chill-hidden')) {
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            speechBubble.innerText = randomQuote;
            chillGuyContainer.classList.remove('chill-hidden');
            chillGuyContainer.classList.add('chill-visible');
        }
    } else {
        chillGuyContainer.classList.remove('chill-visible');
        chillGuyContainer.classList.add('chill-hidden');
    }

    if (cps > 12) {
        appBody.classList.add('chill-chaos');
        appBody.style.setProperty('--chill-hue', `${Math.floor((Date.now() / 14) % 360)}deg`);
        if (chillGuyContainerLeft.classList.contains('chill-hidden')) {
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
            speechBubbleLeft.innerText = randomQuote;
            chillGuyContainerLeft.classList.remove('chill-hidden');
            chillGuyContainerLeft.classList.add('chill-visible');
        }
    } else {
        chillGuyContainerLeft.classList.remove('chill-visible');
        chillGuyContainerLeft.classList.add('chill-hidden');
        appBody.classList.remove('chill-chaos');
        appBody.style.removeProperty('--chill-hue');
    }
}

// Update quote periodically if visible
setInterval(() => {
    if (chillGuyContainer.classList.contains('chill-visible')) {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        speechBubble.style.opacity = 0;
        setTimeout(() => {
            speechBubble.innerText = randomQuote;
            speechBubble.style.opacity = 1;
        }, 500);
    }
    if (chillGuyContainerLeft.classList.contains('chill-visible')) {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        speechBubbleLeft.style.opacity = 0;
        setTimeout(() => {
            speechBubbleLeft.innerText = randomQuote;
            speechBubbleLeft.style.opacity = 1;
        }, 500);
    }
}, 5000);

// Search functionality
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchQueryText = document.getElementById('search-query');

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            searchQueryText.innerText = query;
            searchResults.classList.remove('hidden');
            
            // Close search after 3 seconds or on click
            setTimeout(() => {
                searchResults.classList.add('hidden');
            }, 3000);
        }
    }
});

searchResults.addEventListener('click', () => {
    searchResults.classList.add('hidden');
});

const catContainer = document.querySelector('.cat-container');
let chaosMode = false;

function shouldIgnorePopTarget(target) {
    if (!target?.closest) return false;

    return Boolean(
        target.closest(
            'button, input, textarea, select, label, details, summary, a, #skin-drawer, #skin-drawer-backdrop, #name-modal, #game-state-overlay, #leaderboard-panel, #search-container'
        )
    );
}

function pop(e) {
    // Prevent scoring if modal is open or name not set
    if (!isGameActive) return;

    if (e?.target && shouldIgnorePopTarget(e.target)) return;

    // In chaos mode, must click the cat image specifically
    if (chaosMode && e && e.target !== catImg) return;

    ensureClickAudioContext();
    loadClickAudioBuffer();

    count++;
    interactionStarted = true;
    catMouthOpen = true;
    counterDisplay.innerText = count;
    if (userScoreDisplay) {
        userScoreDisplay.innerText = `Your Score: ${count.toLocaleString()}`;
    }
    localStorage.setItem('popcat_count', count);

    playClickPopSound();

    // Track click time for CPS
    clickTimes.push(Date.now());
    lastCps = getCurrentCps();
    refreshCatSprite(lastCps, Date.now());

    // Instant reposition in chaos mode for more difficulty
    if (chaosMode) moveCatRandomly();
}

function moveCatRandomly() {
    const margin = 100;
    const x = Math.random() * (window.innerWidth - margin * 2) + margin;
    const y = Math.random() * (window.innerHeight - margin * 2) + margin;
    catContainer.style.left = `${x}px`;
    catContainer.style.top = `${y}px`;
    catContainer.style.transform = `translate(-50%, -50%)`;
}

function closeMouth() {
    catMouthOpen = false;
    refreshCatSprite(lastCps, Date.now());
}

// Event Listeners
window.addEventListener('mousedown', (e) => {
    if (e.button === 0) pop(e);
});
window.addEventListener('mouseup', closeMouth);

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || skinDrawerOpen) {
        return;
    }

    if (e.target && (
        e.target.closest?.('input, textarea, select, button') ||
        e.target.isContentEditable
    )) {
        return;
    }

    // Only pop if key is not already being held down
    if (!keysPressed.has(e.key)) {
        keysPressed.add(e.key);
        pop(null);
    }
});
window.addEventListener('keyup', (e) => {
    keysPressed.delete(e.key);
    closeMouth();
});

// Mobile touch support
window.addEventListener('touchstart', (e) => {
    if (!isGameActive) return;
    if (shouldIgnorePopTarget(e.target)) return;
    e.preventDefault();
    pop(e.touches[0]);
}, { passive: false });
window.addEventListener('touchend', closeMouth);

// CPS Loop
setInterval(() => {
    const now = Date.now();
    const cps = getCurrentCps(now);
    lastCps = cps;
    cpsDisplay.innerText = `CPS: ${Math.min(cps, DISPLAY_CPS_MAX).toFixed(1)}`;
    refreshCatSprite(cps, now);
    updateEffects(cps);
}, 100);

function updateEffects(cps) {
    // Remove all themes
    catImg.classList.remove('shaking');
    message.classList.add('hidden');
    message.innerText = 'GO CRAZY!!! 🌈✨';
    appBody.style.filter = 'none';
    appBody.classList.remove('chill-chaos');
    appBody.style.removeProperty('--chill-hue');

    const sceneClass = getSceneForCps(cps);
    setSceneClass(sceneClass);
    setVideoSceneActive(sceneClass === 'bg-super-elit');

    // Reset chaos mode
    if (cps < 5) {
        chaosMode = false;
        catContainer.classList.remove('chaos-mode');
        catContainer.style.left = '';
        catContainer.style.top = '';
        catContainer.style.transform = '';
        catImg.style.width = '350px';
    }

    // Background progression based on CPS tiers
    if (sceneClass === 'bg-super-elit') {
        appBody.classList.add('disco-mode');
        catImg.classList.add('shaking');
        message.classList.remove('hidden');
        message.innerText = "SUPER ELIT MODE!!! ⚡🎥✨";

        chaosMode = true;
        catContainer.classList.add('chaos-mode');
        catImg.style.width = '640px';
        appBody.style.filter = 'hue-rotate(220deg) saturate(1.7) brightness(1.1)';
        appBody.classList.add('chill-chaos');
        appBody.style.setProperty('--chill-hue', `${Math.floor((Date.now() / 10) % 360)}deg`);
        moveCatRandomly();
    } else if (sceneClass === 'bg-candy-chaos') {
        appBody.classList.add('disco-mode');
        catImg.classList.add('shaking');
        message.classList.remove('hidden');
        message.innerText = "UNSTOPPABLE GOD MODE!!! 🔥🌈✨";
        
        chaosMode = true;
        catContainer.classList.add('chaos-mode');
        catImg.style.width = '600px';
        appBody.style.filter = 'hue-rotate(15deg) saturate(1.6) brightness(1.08)';
        appBody.classList.add('chill-chaos');
        appBody.style.setProperty('--chill-hue', `${Math.floor((Date.now() / 14) % 360)}deg`);
        moveCatRandomly();
    } else if (sceneClass === 'bg-matrix') {
        catImg.classList.add('shaking');
        message.classList.remove('hidden');
        message.innerText = "MATRIX OVERLOAD!!! 💾💚";
        
        chaosMode = true;
        catContainer.classList.add('chaos-mode');
        catImg.style.width = '500px';
        appBody.style.filter = 'hue-rotate(95deg) saturate(1.35) contrast(1.1)';
        appBody.classList.add('chill-chaos');
        appBody.style.setProperty('--chill-hue', `${Math.floor((Date.now() / 18) % 360)}deg`);
        if (Math.random() > 0.9) moveCatRandomly();
    } else if (sceneClass === 'bg-flying-cats') {
        catImg.classList.add('shaking');
        message.classList.remove('hidden');
        message.innerText = "CATUP RUSH!!! 🌈🐈‍⬛🚀";
        
        appBody.style.filter = 'saturate(1.18) contrast(1.05) brightness(1.02)';
        catImg.style.width = '420px';
    } else if (sceneClass === 'bg-forest') {
        catImg.classList.add('shaking');
        appBody.style.filter = 'contrast(1.08) brightness(0.98)';
    }
    
    // Funny Milestone messages
    if (count > 0 && count % 1000 === 0) {
        showTemporaryMessage("LEGENDARY! 1000+ POP!");
    }

    // Update Chill Guy visibility based on CPS
    updateChillGuy(cps);
    lastCps = cps;
    refreshCatSprite(cps, Date.now());

    setActiveSound(getSoundForCps(cps));
}

function showTemporaryMessage(text) {
    message.innerText = text;
    message.classList.remove('hidden');
    setTimeout(() => {
        if (clickTimes.length < 10) message.classList.add('hidden');
    }, 2000);
}

if (startGameBtn) {
    startGameBtn.addEventListener('click', startGame);
}
if (stopGameBtn) {
    stopGameBtn.addEventListener('click', stopGame);
}
if (resetAllBtn) {
    resetAllBtn.addEventListener('click', resetAllPoints);
}
if (playersTable) {
    playersTable.addEventListener('click', handleTableAction);
}

buildSkinOptions();
refreshCatSprite(lastCps, Date.now());

if (skinDrawerToggle) {
    skinDrawerToggle.addEventListener('click', () => {
        if (skinDrawerOpen) {
            closeSkinDrawer();
        } else {
            openSkinDrawer();
        }
    });
}
if (skinDrawerClose) {
    skinDrawerClose.addEventListener('click', closeSkinDrawer);
}
if (skinDrawerBackdrop) {
    skinDrawerBackdrop.addEventListener('click', closeSkinDrawer);
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeSkinDrawer();
    }
});

updateEffects(0);
refreshPlayableState();
