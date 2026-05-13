'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

const SKIN_COUNT = 36;
const DEFAULT_CAT_CLOSED = '/assent/popcat Costume/p.png';
const DEFAULT_CAT_OPEN = '/assent/popcat Costume/op.png';
const SKIN_STORAGE_KEY = 'popcat_selected_skin';
const DISPLAY_CPS_MAX = 40;
const SOUND_TARGET_VOLUME = 0.85;
const MAX_POP_POOL = 24;
const LEADERBOARD_POLL_MS = 1000;
const GAME_STATE_POLL_MS = 1000;
const SCORE_SYNC_POLL_MS = 750;
const CLOCK_TICK_MS = 200;

const NONE_EFFECT_OVERRIDES: Record<number, string> = {
  15: 'cat-pup-none-effect15.png',
  28: 'cat-pup-none-effect4-28.png',
  34: 'cat-pup-none-effect34.png',
};

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
  'bg-nova-elit',
  'disco-mode'
];

const QUOTES = [
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

export default function PopcatGame() {
  const [username, setUsername] = useState<string>('');
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  const [count, setCount] = useState(0);
  const [cps, setCps] = useState(0);
  const [lastCps, setLastCps] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);

  const [skinDrawerOpen, setSkinDrawerOpen] = useState(false);
  const [selectedSkinId, setSelectedSkinId] = useState<string>('default');
  const [isMouthOpen, setIsMouthOpen] = useState(false);
  const [autoEffectSince, setAutoEffectSince] = useState<number | null>(null);

  const [gameState, setGameState] = useState<any>({
    phase: 'casual',
    countdown_until: null,
    last_round_summary: null,
  });
  const [hidePodium, setHidePodium] = useState(true);

  const [currentSceneClass, setCurrentSceneClass] = useState('bg-home');
  const [sceneEffect, setSceneEffect] = useState('');
  const [isTransitionActive, setIsTransitionActive] = useState(false);
  const [chaosMode, setChaosMode] = useState(false);
  const [catPosition, setCatPosition] = useState<{ left?: string; top?: string; transform?: string }>({});
  const [catWidth, setCatWidth] = useState('400px');
  const [isShaking, setIsShaking] = useState(false);
  const [message, setMessage] = useState('');
  const [messageVisible, setMessageVisible] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());

  const [showChillGuy, setShowChillGuy] = useState(false);
  const [showChillGuyLeft, setShowChillGuyLeft] = useState(false);
  const [speechQuote, setSpeechQuote] = useState('');
  const [speechQuoteLeft, setSpeechQuoteLeft] = useState('');
  const [chillHue, setChillHue] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const clickTimesRef = useRef<number[]>([]);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const sceneTransitionTokenRef = useRef(0);
  const clickAudioContextRef = useRef<AudioContext | null>(null);
  const clickAudioBufferRef = useRef<AudioBuffer | null>(null);
  const clickAudioLoadingRef = useRef<Promise<AudioBuffer | null> | null>(null);
  const popClickSoundsRef = useRef<HTMLAudioElement[]>([]);
  const popSoundIndexRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const pendingSyncScoreRef = useRef<number | null>(null);

  const chillSoundRef = useRef<HTMLAudioElement | null>(null);
  const catupSoundRef = useRef<HTMLAudioElement | null>(null);
  const elitSoundRef = useRef<HTMLAudioElement | null>(null);
  const superElitVideoRef = useRef<HTMLVideoElement | null>(null);
  const novaElitVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeMediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);

  // --- Initialization on Mount ---
  useEffect(() => {
    // Always prompt for nickname on reload to prevent cached admin-deletion bugs
    setIsNameModalOpen(true);
    setCount(0);

    const storedSkin = localStorage.getItem(SKIN_STORAGE_KEY);
    if (storedSkin) {
      setSelectedSkinId(normalizeSkinId(storedSkin));
    }

    // Preload heavy background assets asynchronously to prevent black screen flash on tier switch
    const backgroundAssets = [
      '/assent/generated/backgrounds/09-matrix-cat.png',
      '/assent/generated/backgrounds/07-candy-land-chaos.png',
      '/assent/generated/backgrounds/02-mystical-forest.png',
      '/assent/generated/backgrounds/10-flying-cats-rainbow-cats.png'
    ];
    backgroundAssets.forEach(src => {
      const img = new Image();
      img.src = src;
    });

    // Accidental Reload/Close Prevention
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only intercept if the user has successfully registered and entered their nickname
      if (usernameRef.current) {
        e.preventDefault();
        e.returnValue = 'คำเตือน: ข้อมูลเซสชันและคะแนนสะสมปัจจุบันของคุณจะสูญหายทันทีหากทำการรีเฟรชหรือปิดหน้านี้! คุณแน่ใจหรือไม่ว่าต้องการไปจากหน้านี้?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Anti-Cheat Protection for Console/F12
    const preventDevTools = (e: Event) => {
      if (e.type === 'contextmenu') {
        e.preventDefault();
        console.log("%c💡 อุ๊ปส์! พยายามจะคลิกขวาส่องโค้ดเหรอจ๊ะ? ของฟรีห้ามก็อปปี้จ้า!", "color: yellow; font-size: 18px; font-weight: bold; background: black; padding: 5px; border-radius: 5px;");
        return;
      }
      const kb = e as KeyboardEvent;
      if (
        kb.key === 'F12' ||
        (kb.ctrlKey && kb.shiftKey && (kb.key === 'I' || kb.key === 'i' || kb.key === 'J' || kb.key === 'j' || kb.key === 'C' || kb.key === 'c')) ||
        (kb.metaKey && kb.altKey && (kb.key === 'I' || kb.key === 'i' || kb.key === 'J' || kb.key === 'j'))
      ) {
        e.preventDefault();
        console.clear();
        console.log("%c🛑🛑🛑 หยุดเดี๋ยวนี้นักเลงคีย์บอร์ด! 🛑🛑🛑", "color: red; font-size: 36px; font-weight: bold; text-shadow: 3px 3px black;");
        console.log("%cถ้าแอบพิมพ์โค้ดแฮกคะแนนระวังระบบคลาวด์ยึดคะแนนเป็น 0 นะจ๊ะเตือนแล้วนะ! 😉", "color: white; font-size: 16px; font-weight: bold; background: #e11d48; padding: 8px; border-radius: 8px;");
      }
    };
    window.addEventListener('contextmenu', preventDevTools);
    window.addEventListener('keydown', preventDevTools, true);

    // Initial Console warning
    console.clear();
    console.log("%c👋 ยินดีต้อนรับสู่อาณาจักรนักพัฒนาฝึกหัด!", "color: cyan; font-size: 24px; font-weight: bold;");
    console.log("%c⚠️ คำเตือน: อย่าริอาจพยายามใช้ script โกงล่ะ! \nระบบ AI ของเราเฝ้าติดตาม CPS มนุษย์ต่างดาวอยู่นะคะ สแปมปุ๊บ คะแนนปลิวเป็น 0 ทันตานะเออ! 😼", "color: #fb7185; font-size: 14px; font-weight: bold;");

    // Setup Audio instances on Client side
    chillSoundRef.current = new Audio('/assent/sound/chillSound.mp3');
    catupSoundRef.current = new Audio('/assent/sound/catup.mp3');
    elitSoundRef.current = new Audio('/assent/sound/elitSound.mp3');
    [chillSoundRef.current, catupSoundRef.current, elitSoundRef.current].forEach(a => {
      if (a) {
        a.loop = true;
        a.preload = 'auto';
        a.volume = 0;
      }
    });

    // Initialize pop pool
    const pool: HTMLAudioElement[] = [];
    for (let i = 0; i < 12; i++) {
      const a = new Audio('/assent/sound/pop.mp3');
      a.preload = 'auto';
      a.volume = 1;
      a.load();
      pool.push(a);
    }
    popClickSoundsRef.current = pool;

    // Preload Web Audio Buffer on boot to prevent lag
    setTimeout(() => {
      loadClickAudioBuffer();
    }, 100);

    // Initial Fetching
    fetchLeaderboard();
    fetchGameState();

    // Intervals
    const leaderboardInterval = setInterval(fetchLeaderboard, LEADERBOARD_POLL_MS);
    const gameStateInterval = setInterval(fetchGameState, GAME_STATE_POLL_MS);
    const syncInterval = setInterval(() => {
      if (usernameRef.current) syncScore(countRef.current);
    }, SCORE_SYNC_POLL_MS);
    const clockInterval = setInterval(() => {
      setClockNow(Date.now());
    }, CLOCK_TICK_MS);

    // CPS Loop
    const cpsInterval = setInterval(() => {
      const now = Date.now();
      clickTimesRef.current = clickTimesRef.current.filter(t => now - t < 1000);
      const currentCps = clickTimesRef.current.length;
      setCps(currentCps);
      setLastCps(currentCps);
    }, 100);

    // Keyboard listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSkinDrawerOpen(false);
        return;
      }
      if (!e.isTrusted) {
        setCount(0);
        console.clear();
        console.log("%c🤖 EXPOSED 🤖\n%cตรวจพบการแกล้งกดด้วยบอทจำลองคีย์บอร์ด! ห้ามแฮกจ้าโดนล้างแต้ม 0 ทันตานะ!", "color: red; font-size: 28px; font-weight: bold;", "color: white; font-size: 14px;");
        alert("🚨 บอทจำลองปุ่มกดล้มเหลว! โดนเซตคะแนนเหลือ 0 คะแนนทันทีจ้าบอทน้อย 🤖❌");
        return;
      }
      if (
        e.target &&
        ((e.target as HTMLElement).closest('input, textarea, select, button') ||
          (e.target as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (!keysPressedRef.current.has(e.key)) {
        keysPressedRef.current.add(e.key);
        handlePop();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.key);
      setIsMouthOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mouse/Touch cleanup
    const onMouseUp = () => setIsMouthOpen(false);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onMouseUp);

    return () => {
      clearInterval(leaderboardInterval);
      clearInterval(gameStateInterval);
      clearInterval(syncInterval);
      clearInterval(clockInterval);
      clearInterval(cpsInterval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchend', onMouseUp);
      window.removeEventListener('contextmenu', preventDevTools);
      window.removeEventListener('keydown', preventDevTools, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Stop all media
      [chillSoundRef.current, catupSoundRef.current, elitSoundRef.current].forEach(s => {
        if (s) {
          s.pause();
          s.src = '';
        }
      });
    };
  }, []);

  // --- Watchers ---
  // Handle CPS and Effects changes
  useEffect(() => {
    updateEffects(cps);
  }, [cps]);

  // Ref sync for count and username to use in intervals
  const countRef = useRef(count);
  useEffect(() => {
    countRef.current = count;
  }, [count]);

  const usernameRef = useRef(username);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const hidePodiumRef = useRef(hidePodium);
  useEffect(() => {
    hidePodiumRef.current = hidePodium;
  }, [hidePodium]);

  const selectedSkinIdRef = useRef(selectedSkinId);
  useEffect(() => {
    selectedSkinIdRef.current = selectedSkinId;
  }, [selectedSkinId]);

  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const curr = gameState.phase;

    if (curr === 'starting') {
      setCount(0);
      setLeaderboard([]);
      setUserRank(null);
      setHidePodium(true); // Hide old podium when new round starts
    }

    if (curr === 'summary') {
      setCount(0);
      setLeaderboard([]);
      setUserRank(null);
    }

    // Only show podium if we just transitioned to summary (not on fresh load)
    if (curr === 'summary' && prev === 'ending') {
      setHidePodium(false);
    }

    prevPhaseRef.current = curr;
  }, [gameState.phase]);

  // Setup quote intervals
  useEffect(() => {
    const interval = setInterval(() => {
      if (showChillGuy) {
        setSpeechQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      }
      if (showChillGuyLeft) {
        setSpeechQuoteLeft(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [showChillGuy, showChillGuyLeft]);

  // --- Helpers ---
  const normalizeSkinId = (value: string | null) => {
    if (value === 'default') return 'default';
    const index = Number(value);
    if (Number.isInteger(index) && index >= 1 && index <= SKIN_COUNT) {
      return String(index);
    }
    return 'default';
  };

  const getSkinPreviewSrc = (index: number) => `/assent/popcat Costume/cat-pup/cat-pup-${index}.png`;

  const getSkinNoneEffectSrc = (index: number) => {
    const fileName = NONE_EFFECT_OVERRIDES[index] || `cat-pup-none-effect-${index}.png`;
    return `/assent/popcat Costume/cat-pop-none-effect/${fileName}`;
  };

  const getSkinEffectSrc = (index: number) => `/assent/popcat Costume/cat-pop-effect/cat-pup-effect-${index}.png`;

  const fetchGameState = async () => {
    try {
      const response = await fetch('/api/game-state');
      const state = await response.json();
      const nextState = {
        phase: state.phase || 'casual',
        countdown_until: state.countdown_until ? Number(state.countdown_until) : null,
        last_round_summary: state.last_round_summary || null,
      };
      setGameState((prev: typeof gameState) => (
        prev.phase === nextState.phase &&
        prev.countdown_until === nextState.countdown_until &&
        JSON.stringify(prev.last_round_summary) === JSON.stringify(nextState.last_round_summary)
      ) ? prev : nextState);
    } catch (e) {
      console.error('Fetch game state failed:', e);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard');
      const data = await response.json();
      const nextLeaderboard = Array.isArray(data) ? data.slice(0, 3) : [];
      setLeaderboard((prev: typeof leaderboard) => JSON.stringify(prev) === JSON.stringify(nextLeaderboard) ? prev : nextLeaderboard);
    } catch (e) {
      console.error('Fetch leaderboard failed:', e);
    }
  };

  const syncScore = async (val: number) => {
    if (!usernameRef.current) return;
    if (gameStateRef.current.phase !== 'casual' && gameStateRef.current.phase !== 'competitive') return;
    if (syncInFlightRef.current) {
      pendingSyncScoreRef.current = val;
      return;
    }

    syncInFlightRef.current = true;
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: usernameRef.current, 
          score: val,
          skinId: selectedSkinIdRef.current 
        })
      });
      const result = await response.json();
      if (result.wipe_local) {
        setCount(0);
        setUsername('');
        setIsNameModalOpen(true);
        // Clear all local state remnants to ensure full log out
        localStorage.removeItem('popcat_username');
        localStorage.removeItem('popcat_count');
        
        console.clear();
        alert(result.message || '⚠️ ตรวจพบการกระทำที่ผิดปกติ หรือ ชื่อตัวละครถูกลบ!');
        return;
      }
      if (result.rank) {
        setUserRank(result.rank);
      }
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      syncInFlightRef.current = false;
      const pending = pendingSyncScoreRef.current;
      if (pending !== null && pending !== val) {
        pendingSyncScoreRef.current = null;
        void syncScore(pending);
      } else {
        pendingSyncScoreRef.current = null;
      }
    }
  };

  // Audio helpers
  const ensureClickAudioContext = () => {
    if (!clickAudioContextRef.current) {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioCtx) {
        clickAudioContextRef.current = new AudioCtx();
      }
    }
    if (clickAudioContextRef.current && clickAudioContextRef.current.state === 'suspended') {
      clickAudioContextRef.current.resume().catch(() => {});
    }
    return clickAudioContextRef.current;
  };

  const loadClickAudioBuffer = async (): Promise<AudioBuffer | null> => {
    if (clickAudioBufferRef.current) return clickAudioBufferRef.current;
    if (clickAudioLoadingRef.current) return clickAudioLoadingRef.current;

    const ctx = ensureClickAudioContext();
    if (!ctx) return null;

    clickAudioLoadingRef.current = (async () => {
      try {
        const resp = await fetch('/assent/sound/pop.mp3');
        if (!resp.ok) throw new Error(`Audio fetch status ${resp.status}`);
        const arrBuf = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrBuf);
        clickAudioBufferRef.current = decoded;
        return decoded;
      } catch (e) {
        console.warn('Failed to load audio buffer:', e);
        clickAudioLoadingRef.current = null; // Clear to allow retry
        return null;
      }
    })();

    return clickAudioLoadingRef.current;
  };

  const acquirePopClickSound = () => {
    const pool = popClickSoundsRef.current;
    for (let i = 0; i < pool.length; i++) {
      const idx = (popSoundIndexRef.current + i) % pool.length;
      const snd = pool[idx];
      if (snd.paused || snd.ended) {
        popSoundIndexRef.current = (idx + 1) % pool.length;
        return snd;
      }
    }
    if (pool.length < MAX_POP_POOL) {
      const snd = new Audio('/assent/sound/pop.mp3');
      snd.preload = 'auto';
      snd.volume = 1;
      snd.load();
      pool.push(snd);
      popSoundIndexRef.current = 0;
      return snd;
    }
    const fallback = pool[popSoundIndexRef.current];
    popSoundIndexRef.current = (popSoundIndexRef.current + 1) % pool.length;
    return fallback;
  };

  const playClickPopSound = () => {
    const ctx = ensureClickAudioContext();
    if (ctx && ctx.state === 'running' && clickAudioBufferRef.current) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = clickAudioBufferRef.current;
        
        // GainNode creates an amplifier to boost pop volume!
        const gainNode = ctx.createGain();
        gainNode.gain.value = 3.0; // BOOST POP AUDIO to 300% loudness
        
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        return;
      } catch (e) {
        console.log('Buffer play failed', e);
      }
    }
    try {
      const snd = acquirePopClickSound();
      snd.preload = 'auto';
      snd.currentTime = 0;
      const playPromise = snd.play();
      if (playPromise) {
        playPromise.catch(() => {
          try {
            const fallback = new Audio('/assent/sound/pop.mp3');
            fallback.preload = 'auto';
            fallback.volume = 1;
            fallback.play().catch(() => {});
          } catch (e) {
            console.log('Sound fallback failed', e);
          }
        });
      }
    } catch (e) {
      console.log('Sound play failed', e);
    }
  };

  const fadeSound = (sound: HTMLAudioElement | HTMLVideoElement | null, targetVolume: number, duration = 700) => {
    if (!sound) return;
    const startVol = sound.volume;
    const startTime = performance.now();
    const token = ((sound as any)._fadeToken || 0) + 1;
    (sound as any)._fadeToken = token;

    if (targetVolume > 0 && sound.paused) {
      (sound as any).play?.().catch(() => {});
    }

    const tick = (now: number) => {
      if ((sound as any)._fadeToken !== token) return;
      try {
        const progress = Math.min(1, (now - startTime) / duration);
        const rawVol = startVol + (targetVolume - startVol) * progress;
        sound.volume = Math.max(0, Math.min(1, isNaN(rawVol) ? targetVolume : rawVol));

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          sound.volume = Math.max(0, Math.min(1, targetVolume));
          if (targetVolume === 0) sound.pause();
        }
      } catch (e) {
        // Element removed or invalid state — stop animating
      }
    };
    requestAnimationFrame(tick);
  };

  const startFromMiddle = (sound: HTMLAudioElement | HTMLVideoElement) => {
    try {
      if (Number.isFinite(sound.duration) && sound.duration > 0) {
        if (sound.id === 'nova-elit-video') {
          // novaElit.mp4 starts exactly at Second 3!
          sound.currentTime = 3;
        } else if (sound.id === 'super-elit-video') {
          // superElit.mp4 starts at Part 3 of 5 (40% offset)
          sound.currentTime = (sound.duration / 5) * 2;
        } else {
          // Normal music starts at Part 2 of 5 (20% offset)
          sound.currentTime = sound.duration / 5;
        }
      }
    } catch (e) {}
    (sound as any).play?.().catch(() => {});
  };

  const setActiveSound = (nextSound: HTMLAudioElement | HTMLVideoElement | null) => {
    if (nextSound === activeMediaRef.current) {
      if (nextSound) fadeSound(nextSound, SOUND_TARGET_VOLUME, 250);
      return;
    }
    if (activeMediaRef.current) {
      fadeSound(activeMediaRef.current, 0);
    }
    activeMediaRef.current = nextSound;
    if (!nextSound) return;
    nextSound.volume = 0;
    startFromMiddle(nextSound);
    fadeSound(nextSound, SOUND_TARGET_VOLUME, 350);
  };

  // Scene Transition Logic
  const getTransitionEffectForScene = (scene: string) => {
    if (scene === 'bg-matrix') return 'matrix';
    if (scene === 'bg-super-elit' || scene === 'bg-nova-elit') return 'super';
    if (scene === 'bg-flying-cats') return 'rainbow';
    if (scene === 'bg-candy-chaos') return 'glitch';
    return 'fog';
  };

  const applySceneClass = (scene: string) => {
    setCurrentSceneClass(scene);
  };

  const triggerSceneChange = (nextScene: string) => {
    if (currentSceneClass === nextScene) return;
    const effect = getTransitionEffectForScene(nextScene);
    const token = ++sceneTransitionTokenRef.current;

    setSceneEffect(effect);
    setIsTransitionActive(true);

    if (effect === 'matrix') {
      setTimeout(() => {
        if (sceneTransitionTokenRef.current !== token) return;
        applySceneClass(nextScene);
      }, 210);
      setTimeout(() => {
        if (sceneTransitionTokenRef.current !== token) return;
        setIsTransitionActive(false);
      }, 860);
      return;
    }

    applySceneClass(nextScene);
    setTimeout(() => {
      if (sceneTransitionTokenRef.current !== token) return;
      setIsTransitionActive(false);
    }, effect === 'super' ? 720 : 600);
  };

  // Main Effects Processor
  const updateEffects = (currentCps: number) => {
    const now = Date.now();
    let targetScene = 'bg-home';
    let activeAudio: HTMLAudioElement | HTMLVideoElement | null = null;

    // Sounds and background thresholds
    if (currentCps < 7) {
      targetScene = 'bg-home';
      activeAudio = null;
    } else if (currentCps < 13) {
      targetScene = 'bg-forest';
      activeAudio = chillSoundRef.current;
    } else if (currentCps < 20) {
      targetScene = 'bg-flying-cats';
      activeAudio = catupSoundRef.current;
    } else if (currentCps < 27) {
      // Level 20 - 26: Candy Chaos with elitSound
      targetScene = 'bg-candy-chaos';
      activeAudio = elitSoundRef.current;
    } else if (currentCps < 33) {
      // Level 27 - 32: Super Elit with video (superElit.mp4)
      targetScene = 'bg-super-elit';
      activeAudio = superElitVideoRef.current;
    } else {
      // Level 33+: Nova Elit with video (novaElit.mp4)
      targetScene = 'bg-nova-elit';
      activeAudio = novaElitVideoRef.current;
    }

    triggerSceneChange(targetScene);
    setActiveSound(activeAudio);

    // Chill guy logic
    if (currentCps > 12) {
      if (!showChillGuy) {
        setSpeechQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
        setShowChillGuy(true);
      }
    } else {
      setShowChillGuy(false);
    }

    if (currentCps > 26) {
      setChillHue(Math.floor((now / 14) % 360));
      if (!showChillGuyLeft) {
        setSpeechQuoteLeft(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
        setShowChillGuyLeft(true);
      }
    } else {
      setShowChillGuyLeft(false);
    }

    // Gameplay modes and visual settings
    setIsShaking(false);
    setMessageVisible(false);
    setChaosMode(false);

    if (currentCps < 7) {
      setCatPosition({});
      setCatWidth('400px');
    }

    if (targetScene === 'bg-nova-elit') {
      setIsShaking(true);
      setMessage('⚡ GODLIKE NOVA MODE!!! 🌌✨👑');
      setMessageVisible(true);
      setChaosMode(true);
      setCatWidth('750px');
      setChillHue(Math.floor((now / 6) % 360));
      moveCatRandomly();
    } else if (targetScene === 'bg-super-elit') {
      setIsShaking(true);
      setMessage('SUPER ELIT MODE!!! ⚡🎥✨');
      setMessageVisible(true);
      setChaosMode(true);
      setCatWidth('700px');
      setChillHue(Math.floor((now / 10) % 360));
      moveCatRandomly();
    } else if (targetScene === 'bg-candy-chaos') {
      setIsShaking(true);
      setMessage('UNSTOPPABLE GOD MODE!!! 🔥🌈✨');
      setMessageVisible(true);
      setChaosMode(true);
      setCatWidth('650px');
      setChillHue(Math.floor((now / 14) % 360));
      moveCatRandomly();
    } else if (targetScene === 'bg-matrix') {
      setIsShaking(true);
      setMessage('MATRIX OVERLOAD!!! 💾💚');
      setMessageVisible(true);
      setChaosMode(true);
      setCatWidth('550px');
      setChillHue(Math.floor((now / 18) % 360));
      if (Math.random() > 0.9) moveCatRandomly();
    } else if (targetScene === 'bg-flying-cats') {
      setIsShaking(true);
      setMessage('CATUP RUSH!!! 🌈🐈‍⬛🚀');
      setMessageVisible(true);
      setCatWidth('470px');
    } else if (targetScene === 'bg-forest') {
      setIsShaking(true);
    }
  };

  const moveCatRandomly = () => {
    const margin = 100;
    const x = Math.random() * (window.innerWidth - margin * 2) + margin;
    const y = Math.random() * (window.innerHeight - margin * 2) + margin;
    setCatPosition({
      left: `${x}px`,
      top: `${y}px`,
      transform: 'translate(-50%, -50%)',
    });
  };

  // Render logic for image state
  const getSkinRenderState = () => {
    if (selectedSkinId === 'default') {
      return isMouthOpen ? 'open' : 'closed';
    }

    if (cps >= 13) {
      return 'effect';
    }
    return 'none';
  };

  const getCatSpriteSrc = () => {
    const renderState = getSkinRenderState();
    if (selectedSkinId === 'default') {
      return renderState === 'open' ? DEFAULT_CAT_OPEN : DEFAULT_CAT_CLOSED;
    }
    const index = Number(selectedSkinId) || 1;
    // Show closed mouth sprite when not currently active clicking
    if (!isMouthOpen) {
      return getSkinPreviewSrc(index);
    }
    if (renderState === 'effect') {
      return getSkinEffectSrc(index);
    }
    return getSkinNoneEffectSrc(index);
  };

  // Interactive events
  const handlePop = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e && e.nativeEvent && !e.nativeEvent.isTrusted) {
      setCount(0);
      console.clear();
      console.log("%c🚨 BOT DETECTED 🚨\n%cพยายามสร้างคลิกจำลองหรือเขียน script เสกคลิกรัวๆ ใน console สินะจ๊ะ? บ๊ายบายคะแนนทั้งหมดนะเจ้าเด็กดื้อ! 👋😉", "color: red; font-size: 28px; font-weight: bold; text-shadow: 2px 2px black;", "color: #fff; font-size: 16px;");
      alert("🚨 ตรวจพบโปรแกรมบอทคลิก (Bot Automated Script)! ยึดคืนทุกคะแนนเหลือ 0 จ้า 🤖❌");
      return;
    }
    if (!usernameRef.current) return;
    if (gameStateRef.current.phase !== 'casual' && gameStateRef.current.phase !== 'competitive') return;

    if (e?.target) {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, select, label, details, summary, a, aside, #name-modal, #game-state-overlay, #leaderboard-panel')) {
        return;
      }
    }

    // In chaos mode, only allow clicking the cat specifically
    if (chaosMode && e && (e.target as HTMLElement).id !== 'cat-img') {
      return;
    }

    ensureClickAudioContext();
    loadClickAudioBuffer();

    const nextCount = countRef.current + 1;
    setCount(nextCount);
    setIsMouthOpen(true);

    playClickPopSound();
    clickTimesRef.current.push(Date.now());

    if (nextCount > 0 && nextCount % 1000 === 0) {
      setMessage(`LEGENDARY! ${nextCount}+ POP!`);
      setMessageVisible(true);
      setTimeout(() => {
        if (clickTimesRef.current.length < 10) setMessageVisible(false);
      }, 2000);
    }

    if (chaosMode) moveCatRandomly();
  };

  const handleStartGameClick = async () => {
    const val = usernameInput.trim();
    if (val) {
      try {
        // Explicit API check/registration to prevent resurrect loops
        const resp = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: val })
        });
        const result = await resp.json();
        if (!result.success) {
          alert(result.message || 'การลงทะเบียนล้มเหลว');
          return;
        }
        setUsername(val);
        setIsNameModalOpen(false);
        syncScore(count);
        setTimeout(() => setSkinDrawerOpen(true), 150);
      } catch (e) {
        alert('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (query) {
      setSearchQuery(query);
      setShowSearchResults(true);
      setTimeout(() => {
        setShowSearchResults(false);
      }, 3000);
    }
  };

  // Filter applied dynamically to container/body
  const getBodyStyles = () => {
    let filter = 'none';
    if (currentSceneClass === 'bg-nova-elit') {
      filter = 'hue-rotate(270deg) saturate(1.8) brightness(1.12) contrast(1.05)';
    } else if (currentSceneClass === 'bg-super-elit') {
      filter = 'hue-rotate(220deg) saturate(1.7) brightness(1.1)';
    } else if (currentSceneClass === 'bg-candy-chaos') {
      filter = 'hue-rotate(15deg) saturate(1.6) brightness(1.08)';
    } else if (currentSceneClass === 'bg-matrix') {
      filter = 'hue-rotate(95deg) saturate(1.35) contrast(1.1)';
    } else if (currentSceneClass === 'bg-flying-cats') {
      filter = 'saturate(1.18) contrast(1.05) brightness(1.02)';
    } else if (currentSceneClass === 'bg-forest') {
      filter = 'contrast(1.08) brightness(0.98)';
    }
    return { filter };
  };

  const isStartingOverlayVisible = gameState.phase === 'starting' && gameState.countdown_until !== null && clockNow < gameState.countdown_until;
  const isEndingOverlayVisible = gameState.phase === 'ending' && gameState.countdown_until !== null && clockNow < gameState.countdown_until;
  const isSummaryVisible = gameState.phase === 'summary' && !hidePodium;

  const getCountdownDisplay = () => {
    if (gameState.countdown_until && clockNow < gameState.countdown_until) {
      return Math.max(0, Math.ceil((gameState.countdown_until - clockNow) / 1000));
    }
    return '...';
  };

  return (
    <>
      {/* Raw Style injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
            --bg-color: #b5e2ff;
        }
        
        * {
            -webkit-user-select: none;
            -moz-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
            outline: none;
        }
        
        input, textarea, button {
            -webkit-user-select: auto;
            -moz-user-select: auto;
            user-select: auto;
        }
        
        body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #b5e2ff;
            overflow: hidden;
            -webkit-user-select: none;
            -moz-user-select: none;
            user-select: none;
            touch-action: manipulation;
        }
        
        .game-root {
            width: 100vw;
            height: 100vh;
            touch-action: manipulation;
            display: flex;
            justify-content: center;
            align-items: center;
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
            transition: background-color 0.3s ease, filter 0.35s ease, transform 0.25s ease;
            background-color: var(--bg-color);
            position: relative;
            overflow: hidden;
        }

        .game-root,
        .game-root * {
            -webkit-user-select: none;
            -moz-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
        }

        .game-root ::selection {
            background: transparent;
            color: inherit;
        }

        .game-root input,
        .game-root textarea {
            -webkit-user-select: text;
            -moz-user-select: text;
            user-select: text;
            -webkit-touch-callout: default;
        }

        .game-root img {
            -webkit-user-drag: none;
            user-drag: none;
        }

        .game-root button,
        .game-root summary,
        .game-root details {
            -webkit-user-select: none;
            user-select: none;
        }

        #scene-fog {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 2;
            opacity: 0;
            overflow: hidden;
            background:
                radial-gradient(circle at 20% 30%, rgba(255,255,255,0.55), transparent 28%),
                radial-gradient(circle at 78% 22%, rgba(255,255,255,0.42), transparent 24%),
                radial-gradient(circle at 50% 78%, rgba(255,255,255,0.28), transparent 34%),
                linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02));
            filter: blur(18px);
            mix-blend-mode: screen;
            transition: opacity 0.2s ease;
        }

        #scene-fog.scene-transition-active {
            opacity: 1;
            animation: fog-drift 0.8s ease-in-out;
        }

        .scene-video {
            position: absolute;
            inset: 0;
            width: 100vw;
            height: 100vh;
            object-fit: cover;
            z-index: 1;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.45s ease;
        }

        .scene-video-visible {
            opacity: 1;
        }

        @keyframes fog-drift {
            0% { transform: translateX(-2%) scale(1.03); }
            50% { transform: translateX(2%) scale(1.06); }
            100% { transform: translateX(0) scale(1.02); }
        }

        #scene-fog[data-effect="matrix"] {
            background:
                radial-gradient(circle at center, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.88)),
                linear-gradient(180deg, rgba(8, 12, 18, 0.95), rgba(3, 4, 8, 0.98));
            filter: none;
            mix-blend-mode: normal;
        }

        #scene-fog[data-effect="super"] {
            background:
                radial-gradient(circle at 50% 40%, rgba(174, 122, 255, 0.36), transparent 34%),
                radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.18), transparent 26%),
                linear-gradient(135deg, rgba(28, 4, 56, 0.76), rgba(2, 3, 10, 0.9));
            filter: blur(10px);
            mix-blend-mode: screen;
        }

        #scene-fog[data-effect="rainbow"] {
            background:
                radial-gradient(circle at 80% 25%, rgba(255, 138, 245, 0.28), transparent 26%),
                radial-gradient(circle at 22% 72%, rgba(93, 218, 255, 0.24), transparent 24%),
                linear-gradient(120deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.02));
            filter: blur(14px);
            mix-blend-mode: screen;
        }

        #scene-fog[data-effect="glitch"] {
            background:
                linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0)),
                repeating-linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0.16) 0,
                    rgba(255, 255, 255, 0.16) 3px,
                    rgba(0, 0, 0, 0) 3px,
                    rgba(0, 0, 0, 0) 18px
                );
            filter: blur(8px);
            mix-blend-mode: screen;
        }

        .scene-transition-glow {
            position: absolute;
            inset: 0;
        }

        .scene-transition-fog {
            background:
                radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4), transparent 24%),
                radial-gradient(circle at 10% 20%, rgba(255,255,255,0.3), transparent 18%),
                radial-gradient(circle at 90% 80%, rgba(255,255,255,0.25), transparent 20%);
            animation: fog-pulse 0.7s ease both;
        }

        @keyframes fog-pulse {
            0% { transform: scale(1.1); opacity: 0; }
            40% { opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
        }

        .scene-transition-rainbow {
            background:
                linear-gradient(90deg,
                    rgba(255, 77, 109, 0.0) 0%,
                    rgba(255, 77, 109, 0.4) 15%,
                    rgba(255, 159, 28, 0.5) 28%,
                    rgba(255, 230, 109, 0.5) 43%,
                    rgba(61, 220, 151, 0.5) 58%,
                    rgba(77, 150, 255, 0.5) 73%,
                    rgba(185, 128, 255, 0.45) 88%,
                    rgba(185, 128, 255, 0.0) 100%);
            transform: translateX(100%);
            animation: rainbow-swipe 0.7s ease both;
        }

        @keyframes rainbow-swipe {
            0% { transform: translateX(100%) scaleX(0.6); opacity: 0; }
            60% { opacity: 1; }
            100% { transform: translateX(-100%) scaleX(1); opacity: 0; }
        }

        .scene-transition-glitch {
            background:
                repeating-linear-gradient(
                    0deg,
                    rgba(255, 255, 255, 0.0) 0,
                    rgba(255, 255, 255, 0.0) 10px,
                    rgba(255, 255, 255, 0.12) 10px,
                    rgba(255, 255, 255, 0.12) 14px
                );
            animation: glitch-flicker 0.55s steps(2, end) both;
        }

        @keyframes glitch-flicker {
            0% { opacity: 0; transform: translateX(0); }
            25% { opacity: 1; transform: translateX(-1%); }
            50% { opacity: 0.75; transform: translateX(1%); }
            75% { opacity: 1; transform: translateX(-0.5%); }
            100% { opacity: 0; transform: translateX(0); }
        }

        .scene-transition-grid {
            position: absolute;
            inset: 0;
            display: grid;
            grid-template-columns: repeat(14, 1fr);
            grid-template-rows: repeat(8, 1fr);
            gap: 2px;
            padding: 2px;
        }

        .scene-transition-tile {
            background: rgba(2, 4, 10, 0.95);
            transform: scale(0);
            opacity: 0;
            border-radius: 2px;
            animation: matrix-tile-fill 0.18s ease forwards;
            animation-delay: var(--delay);
            box-shadow: inset 0 0 18px rgba(0, 255, 128, 0.08);
        }

        @keyframes matrix-tile-fill {
            0% { transform: scale(0); opacity: 0; }
            60% { opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }

        .container {
            text-align: center;
            position: relative;
            z-index: 3;
        }

        #counter {
            font-size: 5rem;
            color: white;
            text-shadow: 4px 4px 0px rgba(0,0,0,0.2);
            margin: 0;
        }

        #cps-display {
            font-size: 1.5rem;
            color: #444;
            margin-bottom: 20px;
        }

        .cat-container {
            position: relative;
            cursor: pointer;
            transition: left 0.2s ease-out, top 0.2s ease-out;
            -webkit-tap-highlight-color: transparent;
            outline: none;
            user-select: none;
            -webkit-user-select: none;
        }

        #cat-img {
            height: auto;
            transition: transform 0.05s, width 0.3s;
            -webkit-user-select: none;
            -webkit-user-drag: none;
            -webkit-touch-callout: none;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        }

        #cat-img:active {
            transform: scale(0.95);
        }

        .chaos-mode {
            position: fixed !important;
            z-index: 150;
        }

        @keyframes shake {
            0% { transform: translate(1px, 1px) rotate(0deg); }
            10% { transform: translate(-1px, -2px) rotate(-1deg); }
            20% { transform: translate(-3px, 0px) rotate(1deg); }
            30% { transform: translate(3px, 2px) rotate(0deg); }
            40% { transform: translate(1px, -1px) rotate(1deg); }
            50% { transform: translate(-1px, 2px) rotate(-1deg); }
            60% { transform: translate(-3px, 1px) rotate(0deg); }
            70% { transform: translate(3px, 1px) rotate(-1deg); }
            80% { transform: translate(-1px, -1px) rotate(1deg); }
            90% { transform: translate(1px, 2px) rotate(0deg); }
            100% { transform: translate(1px, -2px) rotate(-1deg); }
        }

        .shaking {
            animation: shake 0.1s infinite;
        }

        .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            width: 300px;
            color: #333;
        }

        #username-input {
            width: 80%;
            padding: 10px;
            margin: 20px 0;
            border: 2px solid #ddd;
            border-radius: 10px;
            font-size: 1.1rem;
            outline: none;
        }

        #start-btn {
            background: #56ab2f;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 10px;
            font-size: 1.1rem;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.3s;
        }

        #start-btn:hover {
            background: #a8e063;
        }

        #leaderboard-panel {
            position: absolute;
            top: 20px;
            left: 20px;
            width: 200px;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 15px;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 100;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.3);
        }

        #leaderboard-panel h3 {
            margin-top: 0;
            font-size: 1.2rem;
            text-align: center;
            border-bottom: 1px solid rgba(255,255,255,0.3);
            padding-bottom: 10px;
        }

        #leaderboard-list {
            display: grid;
            gap: 6px;
        }

        .leaderboard-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            font-size: 0.9rem;
        }

        .leaderboard-item span:first-child {
            font-weight: bold;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 120px;
        }

        #user-rank-details {
            margin-top: 14px;
            border-top: 1px solid rgba(255,255,255,0.3);
            padding-top: 10px;
        }

        #user-rank-details summary {
            cursor: pointer;
            list-style: none;
            font-weight: 700;
            text-align: center;
            color: white;
            padding: 6px 0 10px;
            outline: none;
        }

        .rank-details-body {
            display: grid;
            gap: 6px;
        }

        #user-rank,
        #user-score {
            font-weight: bold;
            text-align: center;
        }

        .skin-drawer-toggle {
            position: absolute;
            right: 18px;
            bottom: 18px;
            z-index: 230;
            border: none;
            border-radius: 999px;
            padding: 12px 16px;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(59, 130, 246, 0.92));
            color: white;
            font-weight: 800;
            letter-spacing: 0.03em;
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.35);
            cursor: pointer;
            transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .skin-drawer-backdrop {
            position: absolute;
            inset: 0;
            z-index: 219;
            background: rgba(2, 6, 23, 0.48);
            backdrop-filter: blur(4px);
        }

        .skin-drawer {
            position: absolute;
            top: 0;
            right: 0;
            width: min(420px, 88vw);
            height: 100vh;
            z-index: 220;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.94));
            color: white;
            box-shadow: -24px 0 50px rgba(0, 0, 0, 0.35);
            border-left: 1px solid rgba(255, 255, 255, 0.12);
            padding: 20px 18px 24px;
            overflow: hidden;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-sizing: border-box;
        }

        .skin-drawer.open {
            transform: translateX(0);
        }

        .skin-drawer-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 16px;
        }

        .skin-drawer-kicker {
            margin: 0 0 6px;
            font-size: 0.76rem;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: rgba(191, 219, 254, 0.82);
        }

        .skin-drawer-header h3 {
            margin: 0 0 8px;
            font-size: 1.45rem;
        }

        .skin-drawer-header p {
            margin: 0;
            color: rgba(226, 232, 240, 0.82);
            line-height: 1.5;
            font-size: 0.95rem;
        }

        .skin-drawer-close {
            flex: 0 0 auto;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.12);
            color: white;
            font-size: 1.5rem;
            line-height: 1;
            cursor: pointer;
        }

        .skin-drawer-actions {
            height: calc(100vh - 150px);
            overflow-y: auto;
            padding-right: 4px;
            display: grid;
            gap: 12px;
        }

        .skin-card-default,
        .skin-card {
            width: 100%;
            border: 1px solid rgba(148, 163, 184, 0.22);
            background: rgba(15, 23, 42, 0.58);
            color: white;
            border-radius: 18px;
            padding: 12px;
            text-align: left;
            display: grid;
            gap: 8px;
            cursor: pointer;
            transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
            box-sizing: border-box;
        }

        .skin-card-default {
            grid-template-columns: 88px 1fr;
            align-items: center;
        }

        .skin-card-default img,
        .skin-card img {
            width: 100%;
            display: block;
            border-radius: 12px;
            background: rgba(255,255,255,0.05);
            aspect-ratio: 1 / 1;
            object-fit: cover;
        }

        .skin-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }

        .skin-grid .skin-card.active,
        .skin-card-default.active {
            border-color: rgba(96, 165, 250, 0.9);
            box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.45), 0 14px 30px rgba(37, 99, 235, 0.18);
            transform: translateY(-1px);
        }

        #search-container {
            position: absolute;
            top: 20px;
            right: 20px;
            z-index: 100;
        }

        #search-input {
            padding: 10px 15px;
            border-radius: 20px;
            border: 2px solid white;
            background: rgba(255, 255, 255, 0.3);
            color: white;
            outline: none;
            transition: all 0.3s;
            width: 200px;
        }

        #search-input:focus {
            width: 300px;
            background: rgba(255, 255, 255, 0.5);
        }

        #search-results {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 200;
        }

        #no-results-content {
            text-align: center;
            color: white;
            position: relative;
        }

        #confused-cat {
            width: 200px;
            filter: grayscale(0.5);
        }

        .question-mark {
            position: absolute;
            font-size: 3rem;
            font-weight: bold;
            color: #ffeb3b;
            animation: float-q 2s infinite ease-in-out;
        }

        .question-mark:nth-child(2) { top: -20px; left: 0; animation-delay: 0s; }
        .question-mark:nth-child(3) { top: 20px; right: -20px; animation-delay: 0.5s; }
        .question-mark:nth-child(4) { bottom: 50px; left: -30px; animation-delay: 1s; }

        @keyframes float-q {
            0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
            50% { transform: translateY(-20px) rotate(15deg); opacity: 1; }
        }

        #chill-guy-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 50;
            transition: opacity 1s ease, transform 1s ease;
            pointer-events: none;
            opacity: 0;
            transform: translateY(20px);
        }

        #chill-guy-container-left {
            position: fixed;
            bottom: 20px;
            left: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 50;
            transition: opacity 1s ease, transform 1s ease;
            pointer-events: none;
            opacity: 0;
            transform: translateY(20px);
        }

        .chill-visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }

        #game-state-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(3, 6, 14, 0.72);
            backdrop-filter: blur(10px);
            z-index: 900;
        }

        #game-state-card {
            min-width: 280px;
            padding: 28px 34px;
            border-radius: 24px;
            background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(240,247,255,0.88));
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            border: 1px solid rgba(255,255,255,0.5);
            color: #333;
        }

        #game-state-label {
            font-size: 1rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #334155;
            margin-bottom: 12px;
        }

        #countdown-value {
            font-size: 5rem;
            line-height: 1;
            font-weight: 800;
            color: #0f172a;
        }

        #chill-guy-img {
            width: 180px;
            height: auto;
            filter: drop-shadow(0 0 15px rgba(0,0,0,0.3));
        }

        #chill-guy-img-left {
            width: 180px;
            height: auto;
            filter: drop-shadow(0 0 15px rgba(0,0,0,0.3));
            transform: scaleX(-1);
        }

        #speech-bubble, #speech-bubble-left {
            position: relative;
            background: white;
            border-radius: 15px;
            padding: 12px 18px;
            margin-bottom: 15px;
            max-width: 220px;
            font-size: 0.95rem;
            color: #333;
            font-weight: bold;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            text-align: center;
        }

        #speech-bubble::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 80%;
            transform: translateX(-50%);
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 10px solid white;
        }

        #speech-bubble-left::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 20%;
            transform: translateX(-50%);
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 10px solid white;
        }

        .chill-chaos #chill-guy-img,
        .chill-chaos #chill-guy-img-left {
            filter: hue-rotate(var(--chill-hue, 0deg)) saturate(1.8) drop-shadow(0 0 15px rgba(0,0,0,0.3)) !important;
        }

        .chill-chaos #speech-bubble,
        .chill-chaos #speech-bubble-left {
            background: linear-gradient(135deg, #ffe4f0, #d8f7ff);
            color: #132238;
        }

        .chill-chaos #speech-bubble::after,
        .chill-chaos #speech-bubble-left::after {
            border-top-color: #d8f7ff;
        }

        .disco-mode {
            animation: disco 0.7s infinite linear !important;
        }

        @keyframes disco {
            0% { filter: hue-rotate(0deg) saturate(1.2) brightness(1.05); }
            25% { filter: hue-rotate(90deg) saturate(1.5) brightness(1.15); }
            50% { filter: hue-rotate(180deg) saturate(1.8) brightness(1.25); }
            75% { filter: hue-rotate(270deg) saturate(1.5) brightness(1.12); }
            100% { filter: hue-rotate(360deg) saturate(1.2) brightness(1.05); }
        }

        .bg-home {
            background-image:
                linear-gradient(rgba(22, 31, 38, 0.28), rgba(22, 31, 38, 0.28)),
                url('/assent/generated/backgrounds/01-starting-point.png');
        }

        .bg-forest {
            background-image:
                linear-gradient(rgba(10, 28, 18, 0.28), rgba(10, 28, 18, 0.28)),
                url('/assent/generated/backgrounds/02-mystical-forest.png');
        }

        .bg-flying-cats {
            background-image:
                linear-gradient(rgba(11, 8, 24, 0.28), rgba(11, 8, 24, 0.28)),
                url('/assent/generated/backgrounds/10-flying-cats-rainbow.png');
            background-blend-mode: screen;
        }

        .bg-flying-cats::after {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 1;
            pointer-events: none;
            background:
                url('/assent/generated/backgrounds/10-flying-cats-rainbow-cats.png')
                center center / contain no-repeat;
            opacity: 0.96;
            animation: cats-bob 5.5s ease-in-out infinite alternate;
        }

        @keyframes cats-bob {
            0% { transform: translate3d(0, 0, 0) scale(1); }
            100% { transform: translate3d(0, -8px, 0) scale(1.01); }
        }

        .bg-cyberpunk {
            background-image:
                linear-gradient(rgba(12, 7, 31, 0.30), rgba(12, 7, 31, 0.30)),
                url('/assent/generated/backgrounds/03-cyberpunk-city.png');
        }

        .bg-ocean {
            background-image:
                linear-gradient(rgba(4, 20, 38, 0.34), rgba(4, 20, 38, 0.34)),
                url('/assent/generated/backgrounds/04-deep-ocean.png');
        }

        .bg-temple {
            background-image:
                linear-gradient(rgba(41, 27, 3, 0.24), rgba(41, 27, 3, 0.24)),
                url('/assent/generated/backgrounds/05-god-cat-temple.png');
        }

        .bg-ruins {
            background-image:
                linear-gradient(rgba(28, 20, 10, 0.34), rgba(28, 20, 10, 0.34)),
                url('/assent/generated/backgrounds/08-ancient-ruins.png');
        }

        .bg-space {
            background-image:
                linear-gradient(rgba(6, 7, 22, 0.32), rgba(6, 7, 22, 0.32)),
                url('/assent/generated/backgrounds/06-space-wormhole.png');
        }

        .bg-matrix {
            background-image:
                linear-gradient(rgba(3, 18, 6, 0.34), rgba(3, 18, 6, 0.34)),
                url('/assent/generated/backgrounds/09-matrix-cat.png');
        }

        .bg-candy-chaos {
            background-image:
                linear-gradient(rgba(34, 11, 22, 0.30), rgba(34, 11, 22, 0.30)),
                url('/assent/generated/backgrounds/07-candy-land-chaos.png');
            background-blend-mode: multiply;
        }

        .bg-super-elit {
            background-image:
                linear-gradient(rgba(6, 4, 18, 0.45), rgba(6, 4, 18, 0.52)),
                radial-gradient(circle at top, rgba(145, 97, 255, 0.18), transparent 30%);
            background-color: #060412;
        }

        .bg-nova-elit {
            background-image:
                linear-gradient(rgba(8, 4, 22, 0.45), rgba(8, 4, 22, 0.55)),
                radial-gradient(circle at center, rgba(200, 100, 255, 0.15), transparent 40%);
            background-color: #04020c;
        }

        .bg-ruins,
        .bg-flying-cats,
        .bg-space,
        .bg-matrix,
        .bg-candy-chaos,
        .bg-super-elit,
        .bg-nova-elit {
            background-attachment: fixed;
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
        }

        #message {
            font-size: 2rem;
            font-weight: bold;
            color: white;
            text-shadow: 2px 2px 10px rgba(0,0,0,0.5);
            margin-top: 20px;
            opacity: 1;
            transition: opacity 0.5s;
        }

        .hidden {
            display: none !important;
        }
      ` }} />

      <div 
        className={`game-root ${currentSceneClass} ${cps > 26 ? 'chill-chaos' : ''}`} 
        style={{
          ...getBodyStyles(), 
          ['--chill-hue' as any]: `${chillHue}deg`
        }}
        onMouseDown={(e) => {
          if (e.button === 0) handlePop(e);
        }}
        onDragStart={(e) => {
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          // Restore interactive state check (without deprecated .running)
          if (username && !(gameState.phase === 'summary' && !hidePodium)) {
            const target = e.target as HTMLElement;
            // Prevent browser default actions (flash, zoom, bounce) unless user hits actual UI widgets
            if (!target.closest('button, input, textarea, select, a, #name-modal, #game-state-overlay, #leaderboard-panel, #search-container')) {
              e.preventDefault();
              handlePop(e);
            }
          }
        }}
      >
        <div 
          id="scene-fog" 
          className={isTransitionActive ? 'scene-transition-active' : ''}
          data-effect={sceneEffect}
          aria-hidden="true"
        >
          {sceneEffect === 'matrix' && (
            <div className="scene-transition-grid">
              {Array.from({ length: 14 * 8 }).map((_, i) => (
                <span 
                  key={i} 
                  className="scene-transition-tile" 
                  style={{ ['--delay' as any]: `${i * 14}ms` }} 
                />
              ))}
            </div>
          )}
          {sceneEffect !== 'matrix' && sceneEffect !== '' && (
            <div className={`scene-transition-glow scene-transition-${sceneEffect}`} />
          )}
        </div>

        <video 
          ref={superElitVideoRef}
          id="super-elit-video" 
          className={`scene-video ${currentSceneClass === 'bg-super-elit' ? 'scene-video-visible' : 'hidden'}`}
          src="/assent/superElit.mp4" 
          preload="auto" 
          playsInline 
          loop 
        />

        <video 
          ref={novaElitVideoRef}
          id="nova-elit-video" 
          className={`scene-video ${currentSceneClass === 'bg-nova-elit' ? 'scene-video-visible' : 'hidden'}`}
          src="/assent/novaElit.mp4" 
          preload="auto" 
          playsInline 
          loop 
        />

        {/* Name Entry Modal */}
        {isNameModalOpen && (
          <div id="name-modal" className="modal-overlay">
            <div className="modal-content">
              <h2>Enter Your Nickname</h2>
              <input 
                type="text" 
                id="username-input" 
                placeholder="Your Name..." 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartGameClick()}
              />
              <button id="start-btn" onClick={handleStartGameClick}>START POPPING!</button>
            </div>
          </div>
        )}

        {/* Leaderboard UI */}
        <div id="leaderboard-panel">
          <h3>🏆 TOP 3</h3>
          <div id="leaderboard-list">
            {leaderboard.length === 0 ? (
              <div className="leaderboard-item"><span>No players yet</span><span>--</span></div>
            ) : (
              leaderboard.map((p, idx) => (
                <div key={p.name} className="leaderboard-item">
                  <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {p.name}</span>
                  <span>{Number(p.score).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
          <details id="user-rank-details">
            <summary>ดูอันดับของฉัน</summary>
            <div className="rank-details-body">
              <div id="user-rank">Your Rank: {userRank !== null ? userRank : '--'}</div>
              <div id="user-score">Your Score: {count.toLocaleString()}</div>
            </div>
          </details>
        </div>

        {/* Skin Drawer */}
        <button 
          className="skin-drawer-toggle" 
          onClick={() => setSkinDrawerOpen(!skinDrawerOpen)}
        >
          🎭 Skin
        </button>
        {skinDrawerOpen && (
          <div 
            className="skin-drawer-backdrop" 
            onClick={() => setSkinDrawerOpen(false)}
          />
        )}
        <aside className={`skin-drawer ${skinDrawerOpen ? 'open' : ''}`}>
          <div className="skin-drawer-header">
            <div>
              <p className="skin-drawer-kicker">Character Select</p>
              <h3>เลือก skin ของแมว</h3>
              <p>เลือกเลขที่ต้องการ จากนั้นภาพปกติจะใช้ none-effect และถ้าปั่นความเร็วได้ถึง 13 CPS จะสลับเป็นร่าง Effect สุดทรงพลังทันที!</p>
            </div>
            <button className="skin-drawer-close" onClick={() => setSkinDrawerOpen(false)}>×</button>
          </div>
          <div className="skin-drawer-actions">
            <button 
              type="button" 
              className={`skin-card-default ${selectedSkinId === 'default' ? 'active' : ''}`} 
              onClick={() => {
                setSelectedSkinId('default');
                localStorage.setItem(SKIN_STORAGE_KEY, 'default');
                setSkinDrawerOpen(false);
              }}
            >
              <img src="/assent/popcat Costume/p.png" alt="Original Popcat" />
              <div>
                <span>Original</span>
                <br />
                <small>op / p</small>
              </div>
            </button>
            <div className="skin-grid">
              {Array.from({ length: SKIN_COUNT }).map((_, idx) => {
                const num = idx + 1;
                return (
                  <button
                    key={num}
                    type="button"
                    className={`skin-card ${selectedSkinId === String(num) ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedSkinId(String(num));
                      localStorage.setItem(SKIN_STORAGE_KEY, String(num));
                      setSkinDrawerOpen(false);
                    }}
                  >
                    <img src={getSkinPreviewSrc(num)} alt={`Skin ${num}`} loading="lazy" />
                    <span>Skin {num}</span>
                    <small>#{num}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Search Bar removed as per request */}

        {/* Starting State Overlay (Center) */}
        {isStartingOverlayVisible && (
          <div id="game-state-overlay">
            <div id="game-state-card">
              <div id="game-state-label">Game starts in</div>
              <div id="countdown-value">{getCountdownDisplay()}</div>
            </div>
          </div>
        )}

        {/* Ending State Overlay (Top Right) */}
        {isEndingOverlayVisible && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', background: 'rgba(0,0,0,0.8)', padding: '15px 30px', borderRadius: '15px', color: 'white', zIndex: 100, border: '2px solid #ef4444', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', textAlign: 'center', minWidth: '150px' }}>
            <div style={{ fontSize: '14px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>Ending in</div>
            <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#fca5a5' }}>{getCountdownDisplay()}</div>
          </div>
        )}

        {/* Summary Podium Overlay */}
        {isSummaryVisible && gameState.last_round_summary && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
            <h2 style={{ color: 'white', fontSize: '3rem', marginTop: '-60px', marginBottom: '60px', textShadow: '0 4px 15px rgba(255,255,255,0.3)', animation: 'pop 0.5s ease' }}>🏆 รอบการแข่งขันจบลงแล้ว 🏆</h2>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '20px', height: '350px', marginBottom: '50px' }}>
              {/* Rank 2 */}
              {gameState.last_round_summary.top3[1] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0.2s' }}>
                  <img src={getSkinPreviewSrc(Number(gameState.last_round_summary.top3[1].skin) || 1)} style={{ width: '120px', height: '120px', objectFit: 'contain', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))' }} />
                  <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#cbd5e1', fontSize: '20px', textShadow: '0 2px 4px black' }}>🥈 {gameState.last_round_summary.top3[1].name}</div>
                  <div style={{ color: 'white', fontSize: '18px' }}>{gameState.last_round_summary.top3[1].score.toLocaleString()}</div>
                  <div style={{ background: 'linear-gradient(180deg, #94a3b8, #475569)', width: '120px', height: '120px', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', marginTop: '15px', boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.2)' }}></div>
                </div>
              )}
              
              {/* Rank 1 */}
              {gameState.last_round_summary.top3[0] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0.4s' }}>
                  <div style={{ position: 'absolute', top: '-40px', fontSize: '40px', animation: 'bounce 2s infinite' }}>👑</div>
                  <img src={getSkinPreviewSrc(Number(gameState.last_round_summary.top3[0].skin) || 1)} style={{ width: '160px', height: '160px', objectFit: 'contain', filter: 'drop-shadow(0 15px 15px rgba(252,211,77,0.4))', zIndex: 2 }} />
                  <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#fcd34d', fontSize: '26px', textShadow: '0 2px 4px black' }}>🥇 {gameState.last_round_summary.top3[0].name}</div>
                  <div style={{ color: 'white', fontSize: '22px', fontWeight: 'bold' }}>{gameState.last_round_summary.top3[0].score.toLocaleString()}</div>
                  <div style={{ background: 'linear-gradient(180deg, #fbbf24, #b45309)', width: '140px', height: '160px', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', marginTop: '15px', boxShadow: 'inset 0 2px 15px rgba(255,255,255,0.4), 0 -5px 20px rgba(251,191,36,0.3)' }}></div>
                </div>
              )}

              {/* Rank 3 */}
              {gameState.last_round_summary.top3[2] && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'slideUp 0.6s ease forwards', opacity: 0, animationDelay: '0s' }}>
                  <img src={getSkinPreviewSrc(Number(gameState.last_round_summary.top3[2].skin) || 1)} style={{ width: '100px', height: '100px', objectFit: 'contain', filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))' }} />
                  <div style={{ marginTop: '10px', fontWeight: 'bold', color: '#b45309', fontSize: '18px', textShadow: '0 2px 4px black' }}>🥉 {gameState.last_round_summary.top3[2].name}</div>
                  <div style={{ color: 'white', fontSize: '16px' }}>{gameState.last_round_summary.top3[2].score.toLocaleString()}</div>
                  <div style={{ background: 'linear-gradient(180deg, #d97706, #78350f)', width: '100px', height: '90px', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', marginTop: '15px', boxShadow: 'inset 0 2px 10px rgba(255,255,255,0.1)' }}></div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
              <button 
                onClick={() => setHidePodium(true)}
                style={{ background: 'transparent', border: '2px solid rgba(255,255,255,0.3)', color: 'white', padding: '12px 24px', borderRadius: '30px', fontSize: '18px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                เล่นต่อโหมดซ้อมมือ
              </button>
            </div>
            
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
            `}</style>
          </div>
        )}

        {/* Main Cat Screen */}
        <div className="container">
          <h1 id="counter">{count}</h1>
          <div id="cps-display" style={{ color: cps > 10 ? '#fff' : '#444' }}>
            CPS: {Math.min(cps, DISPLAY_CPS_MAX).toFixed(1)}
          </div>
          
          <div 
            className={`cat-container ${chaosMode ? 'chaos-mode' : ''}`}
            style={catPosition}
          >
            <img 
              id="cat-img" 
              className={isShaking ? 'shaking' : ''}
              style={{ width: catWidth }}
              src={getCatSpriteSrc()} 
              alt="Popcat" 
              draggable="false"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src !== DEFAULT_CAT_CLOSED) {
                  img.src = DEFAULT_CAT_CLOSED;
                }
              }}
            />
          </div>
          
          {/* Chill Guy */}
          <div id="chill-guy-container" className={showChillGuy ? 'chill-visible' : ''}>
            <div id="speech-bubble">{speechQuote}</div>
            <img id="chill-guy-img" src="/chill_guy_png.png" alt="Chill Guy" />
          </div>

          <div id="chill-guy-container-left" className={showChillGuyLeft ? 'chill-visible' : ''}>
            <div id="speech-bubble-left">{speechQuoteLeft}</div>
            <img id="chill-guy-img-left" src="/chill_guy_png.png" alt="Chill Guy Left" />
          </div>

          {messageVisible && (
            <div id="message">{message}</div>
          )}
        </div>
      </div>
    </>
  );
}
