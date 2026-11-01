(function () {
  'use strict';

  // ---- Constants (logical pixels; the canvas is scaled for the display) ----
  var W = 600;
  var H = 150;
  var GROUND_Y = 131;          // y of the ground line (dino's feet rest here)
  var P = 2;                   // size of one sprite pixel
  var GRAVITY = 0.6;
  var JUMP_VELOCITY = -10;
  var MIN_JUMP_HEIGHT = 30;    // releasing early still clears this height
  var DROP_VELOCITY = -5;      // velocity cap when the jump key is released early
  var FAST_FALL = 1.2;         // extra gravity while ducking in the air
  var START_SPEED = 6;
  var MAX_SPEED = 13;
  var ACCELERATION = 0.0012;
  var NIGHT_EVERY = 700;       // points between day/night switches
  var BIRD_MIN_SCORE = 450;
  var STEP = 1000 / 60;        // fixed simulation step (ms)
  var HI_KEY = 'dino-runner-high-score';
  var MUTE_KEY = 'dino-runner-muted';

  // ---- Sprites: '#' is a filled pixel ----
  var BODY = [
    '...........########.',
    '..........##.#######',
    '..........##########',
    '..........##########',
    '..........##########',
    '..........#####.....',
    '..........########..',
    '#........#####......',
    '#.......######......',
    '##....##########....',
    '###..#########.#....',
    '##############......',
    '##############......',
    '.############.......',
    '..###########.......',
    '...#########........',
    '....#######.........'
  ];
  var DEAD_EYE = ['..........#...######', '..........#.#.######'];
  var LEGS = {
    stand: ['.....###.##', '.....##...#', '.....#....#', '.....##...##'],
    run1:  ['.....###.##', '.....##..##', '.....#.....', '.....##....'],
    run2:  ['.....###.##', '.....##...#', '..........#', '..........##']
  };
  var DUCK = [
    '...................#######..',
    '#.........########.##.######',
    '##.......##################.',
    '###....####################.',
    '#####################.......',
    '##################.#####....',
    '.#################..........',
    '..###############...........',
    '...############.............'
  ];
  var DUCK_LEGS = {
    run1: ['....###.##...', '....##..##...', '....#........'],
    run2: ['....###.##...', '....##...#...', '.........##..']
  };
  var BIRD = {
    up: [
      '.....##..............',
      '.....###.............',
      '.....####............',
      '..##.#####...........',
      '.###..#####..........',
      '#####.######.........',
      '..##################.',
      '....###############..',
      '......##########.....'
    ],
    down: [
      '.....................',
      '.....................',
      '.....................',
      '..##.................',
      '.###.................',
      '#####................',
      '..##################.',
      '....###############..',
      '......#######........',
      '......#####..........',
      '......####...........',
      '......###............',
      '......##.............'
    ]
  };

  function sprite(rows) {
    var w = 0;
    for (var i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    return { rows: rows, w: w * P, h: rows.length * P };
  }

  var SPR = {
    stand: sprite(BODY.concat(LEGS.stand)),
    run1: sprite(BODY.concat(LEGS.run1)),
    run2: sprite(BODY.concat(LEGS.run2)),
    dead: sprite([BODY[0]].concat(DEAD_EYE, BODY.slice(3), LEGS.stand)),
    duck1: sprite(DUCK.concat(DUCK_LEGS.run1)),
    duck2: sprite(DUCK.concat(DUCK_LEGS.run2)),
    birdUp: sprite(BIRD.up),
    birdDown: sprite(BIRD.down)
  };

  function drawSprite(ctx, spr, x, y) {
    var rows = spr.rows;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var start = -1;
      for (var c = 0; c <= row.length; c++) {
        var on = row.charAt(c) === '#';
        if (on && start < 0) start = c;
        if (!on && start >= 0) {
          ctx.fillRect(Math.round(x + start * P), Math.round(y + r * P), (c - start) * P, P);
          start = -1;
        }
      }
    }
  }

  // ---- Canvas setup ----
  var canvas = document.getElementById('game');
  var stage = document.getElementById('stage');
  var statusEl = document.getElementById('status');
  var playBtn = document.getElementById('playPause');
  var playIcon = document.getElementById('playIcon');
  var playLabel = document.getElementById('playLabel');
  var isTouch = ('ontouchstart' in window) ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (isTouch) statusEl.textContent = 'Tap the game or Start to play';
  var ctx = canvas.getContext('2d');

  function resize() {
    var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  resize();
  window.addEventListener('resize', resize);

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  // ---- Sound (tiny WebAudio beeps, no files) ----
  var audio = null;
  var muted = store(MUTE_KEY) === '1';

  function beep(freq, duration, type, slideTo) {
    if (muted) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      var t = audio.currentTime;
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t);
      osc.stop(t + duration);
    } catch (e) { /* audio unavailable */ }
  }

  var sfx = {
    jump: function () { beep(520, 0.09, 'square', 760); },
    point: function () { beep(880, 0.07); setTimeout(function () { beep(1320, 0.1); }, 80); },
    die: function () { beep(220, 0.25, 'sawtooth', 90); }
  };

  // ---- Game state ----
  var state;        // 'ready' | 'running' | 'paused' | 'over'
  var dino, obstacles, clouds, groundBumps, speed, distance, score, highScore;
  var spawnGap, frame, night, flashUntil, lastMilestone, overAt;
  var input = { jump: false, duck: false };

  highScore = parseInt(store(HI_KEY), 10) || 0;

  function reset() {
    dino = {
      x: 40, y: GROUND_Y - SPR.stand.h, vy: 0,
      jumping: false, ducking: false, releasedEarly: false, jumpStartY: 0
    };
    obstacles = [];
    clouds = [];
    groundBumps = [];
    for (var i = 0; i < 40; i++) groundBumps.push(randomBump(Math.random() * W));
    for (var j = 0; j < 3; j++) clouds.push({ x: 120 + j * 190, y: 20 + Math.random() * 50 });
    speed = START_SPEED;
    distance = 0;
    score = 0;
    spawnGap = 120;
    frame = 0;
    flashUntil = 0;
    lastMilestone = 0;
    setNight(false);
  }

  function randomBump(x) {
    return { x: x, y: GROUND_Y + 2 + Math.floor(Math.random() * 6), w: 1 + Math.floor(Math.random() * 3) };
  }

  function setNight(on) {
    night = on;
    document.body.classList.toggle('night', on);
  }

  function start() {
    if (state === 'running') return;
    if (state === 'over' && performance.now() - overAt < 400) return;
    reset();
    state = 'running';
    statusEl.textContent = 'Go!';
    updateControls();
    jump();
  }

  // ---- Play / pause ----
  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    input.jump = false;
    input.duck = false;
    statusEl.textContent = isTouch
      ? 'Paused. Tap the game or Resume to continue'
      : 'Paused. Press P or Space to continue';
    updateControls();
  }

  function resume() {
    if (state !== 'paused') return;
    state = 'running';
    // Restart the clock so the time spent paused is not simulated at once.
    last = performance.now();
    acc = 0;
    statusEl.textContent = 'Go!';
    updateControls();
  }

  // One button that starts, pauses, resumes or restarts depending on the state.
  function togglePlay() {
    if (state === 'running') pause();
    else if (state === 'paused') resume();
    else start();
  }

  function updateControls() {
    if (!playBtn) return;
    var label, icon;
    if (state === 'running') { label = 'Pause'; icon = '\u275A\u275A'; }
    else if (state === 'paused') { label = 'Resume'; icon = '\u25B6'; }
    else if (state === 'over') { label = 'Restart'; icon = '\u21BB'; }
    else { label = 'Start'; icon = '\u25B6'; }
    playLabel.textContent = label;
    playIcon.textContent = icon;
    playBtn.setAttribute('aria-label', label + ' game');
    playBtn.setAttribute('aria-pressed', state === 'paused' ? 'true' : 'false');
    playBtn.dataset.state = state;
  }

  function jump() {
    if (dino.jumping || dino.ducking) return;
    dino.jumping = true;
    dino.releasedEarly = false;
    dino.jumpStartY = dino.y;
    dino.vy = JUMP_VELOCITY - speed / 10;
    sfx.jump();
  }

  function gameOver() {
    state = 'over';
    overAt = performance.now();
    sfx.die();
    if (score > highScore) {
      highScore = score;
      store(HI_KEY, String(highScore));
    }
    statusEl.textContent = isTouch
      ? 'Game over. Tap the game or Restart to play again'
      : 'Game over. Press Space or tap to play again';
    updateControls();
    if (navigator.vibrate) { try { navigator.vibrate(150); } catch (e) {} }
  }

  // ---- Obstacles ----
  function spawnObstacle() {
    var r = Math.random();
    if (score >= BIRD_MIN_SCORE && r < 0.25) {
      var heights = [GROUND_Y - 26, GROUND_Y - 52, GROUND_Y - 76];
      obstacles.push({
        type: 'bird', x: W + 10,
        y: heights[Math.floor(Math.random() * heights.length)],
        w: SPR.birdUp.w, h: SPR.birdDown.h, flap: 0
      });
    } else {
      var big = Math.random() < 0.45;
      var maxCount = speed > 8 ? 3 : 2;
      var count = 1 + Math.floor(Math.random() * maxCount);
      var unitW = big ? 16 : 11;
      var h = big ? 48 : 34;
      obstacles.push({
        type: 'cactus', big: big, count: count, x: W + 10,
        y: GROUND_Y - h, w: count * unitW + (count - 1) * 3, h: h, unitW: unitW,
        seed: Math.random()
      });
    }
    // Gap grows with speed so the game stays fair.
    var minGap = 50 + speed * 6;
    spawnGap = minGap + Math.random() * 70;
  }

  function dinoHitboxes() {
    var x = dino.x, y = dino.y;
    if (dino.ducking && !dino.jumping) {
      return [{ x: x + 2, y: y + 4, w: SPR.duck1.w - 6, h: SPR.duck1.h - 6 }];
    }
    return [
      { x: x + 22, y: y + 2, w: 16, h: 14 },   // head
      { x: x + 4, y: y + 16, w: 26, h: 16 },   // body
      { x: x + 10, y: y + 32, w: 12, h: 10 }   // legs
    ];
  }

  function obstacleHitboxes(o) {
    if (o.type === 'bird') {
      return [{ x: o.x + 2, y: o.y + 10, w: o.w - 6, h: 6 }, { x: o.x + 8, y: o.y + 4, w: 10, h: 8 }];
    }
    var boxes = [];
    for (var i = 0; i < o.count; i++) {
      var cx = o.x + i * (o.unitW + 3);
      boxes.push({ x: cx + 2, y: o.y + 4, w: o.unitW - 4, h: o.h - 4 });
    }
    return boxes;
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function collides(o) {
    var ds = dinoHitboxes();
    var os = obstacleHitboxes(o);
    for (var i = 0; i < ds.length; i++) {
      for (var j = 0; j < os.length; j++) {
        if (overlap(ds[i], os[j])) return true;
      }
    }
    return false;
  }

  // ---- Update ----
  function update() {
    frame++;
    if (state !== 'running') return;

    speed = Math.min(MAX_SPEED, speed + ACCELERATION);
    distance += speed;
    score = Math.floor(distance / 10);

    var milestone = Math.floor(score / 100);
    if (milestone > lastMilestone) {
      lastMilestone = milestone;
      flashUntil = frame + 50;
      sfx.point();
    }
    var shouldBeNight = Math.floor(score / NIGHT_EVERY) % 2 === 1;
    if (shouldBeNight !== night) setNight(shouldBeNight);

    // Dino physics
    dino.ducking = input.duck;
    if (dino.jumping) {
      dino.vy += GRAVITY + (input.duck ? FAST_FALL : 0);
      if (!input.jump && !dino.releasedEarly && dino.jumpStartY - dino.y > MIN_JUMP_HEIGHT) {
        dino.releasedEarly = true;
        if (dino.vy < DROP_VELOCITY) dino.vy = DROP_VELOCITY;
      }
      dino.y += dino.vy;
      var groundTop = GROUND_Y - SPR.stand.h;
      if (dino.y >= groundTop) {
        dino.y = groundTop;
        dino.vy = 0;
        dino.jumping = false;
        if (input.jump) jump();   // holding the key keeps hopping
      }
    } else {
      dino.y = GROUND_Y - (dino.ducking ? SPR.duck1.h : SPR.stand.h);
      if (input.jump) jump();
    }

    // World scroll
    for (var i = 0; i < groundBumps.length; i++) {
      groundBumps[i].x -= speed;
      if (groundBumps[i].x < -4) groundBumps[i] = randomBump(W + Math.random() * 40);
    }
    for (var c = 0; c < clouds.length; c++) {
      clouds[c].x -= speed * 0.2;
      if (clouds[c].x < -50) clouds[c] = { x: W + Math.random() * 100, y: 15 + Math.random() * 55 };
    }

    spawnGap -= speed;
    if (spawnGap <= 0) spawnObstacle();

    for (var k = obstacles.length - 1; k >= 0; k--) {
      var o = obstacles[k];
      o.x -= o.type === 'bird' ? speed * 1.1 : speed;
      if (o.type === 'bird') o.flap++;
      if (o.x + o.w < -10) { obstacles.splice(k, 1); continue; }
      if (collides(o)) { gameOver(); return; }
    }
  }

  // ---- Render ----
  function fgColor() { return night ? '#e8eaed' : '#535353'; }

  function drawCactus(o) {
    var n = o.count;
    for (var i = 0; i < n; i++) {
      var x = o.x + i * (o.unitW + 3);
      var stemW = o.big ? 8 : 6;
      var sx = Math.round(x + (o.unitW - stemW) / 2);
      var top = o.y;
      ctx.fillRect(sx, top + 2, stemW, o.h - 2);
      ctx.fillRect(sx + 1, top, stemW - 2, 2);
      // arms, varied per cactus so groups do not look identical
      var armY = top + (o.big ? 14 : 10) + ((o.seed * 10 + i * 3) % 6);
      var armH = o.big ? 14 : 10;
      ctx.fillRect(sx - 4, armY, 2, armH);
      ctx.fillRect(sx - 4, armY + armH - 2, 4, 2);
      ctx.fillRect(sx + stemW + 2, armY - 4, 2, armH);
      ctx.fillRect(sx + stemW, armY + armH - 6, 4, 2);
    }
  }

  function drawCloud(cl) {
    ctx.fillRect(cl.x + 8, cl.y, 22, 2);
    ctx.fillRect(cl.x + 4, cl.y + 2, 6, 2);
    ctx.fillRect(cl.x + 28, cl.y + 2, 6, 2);
    ctx.fillRect(cl.x, cl.y + 4, 6, 2);
    ctx.fillRect(cl.x + 32, cl.y + 4, 8, 2);
    ctx.fillRect(cl.x, cl.y + 6, 44, 2);
  }

  function pad(n) { return ('00000' + n).slice(-5); }

  function render() {
    ctx.clearRect(0, 0, W, H);
    var fg = fgColor();
    ctx.fillStyle = fg;

    // Night: a moon and a few stars
    if (night) {
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(480, 30, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      var stars = [[90, 22], [210, 45], [330, 18], [560, 60], [150, 70]];
      for (var s = 0; s < stars.length; s++) ctx.fillRect(stars[s][0], stars[s][1], 2, 2);
    }

    // Clouds
    ctx.globalAlpha = 0.35;
    for (var c = 0; c < clouds.length; c++) drawCloud(clouds[c]);
    ctx.globalAlpha = 1;

    // Ground
    ctx.fillRect(0, GROUND_Y, W, 1);
    for (var g = 0; g < groundBumps.length; g++) {
      ctx.fillRect(Math.round(groundBumps[g].x), groundBumps[g].y, groundBumps[g].w, 1);
    }

    // Obstacles
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      if (o.type === 'cactus') drawCactus(o);
      else drawSprite(ctx, Math.floor(o.flap / 12) % 2 ? SPR.birdDown : SPR.birdUp, o.x, o.y);
    }

    // Dino
    var spr;
    if (state === 'over') spr = SPR.dead;
    else if (state === 'ready' || dino.jumping) spr = SPR.stand;
    else if (dino.ducking) spr = Math.floor(frame / 6) % 2 ? SPR.duck1 : SPR.duck2;
    else spr = Math.floor(frame / 6) % 2 ? SPR.run1 : SPR.run2;
    drawSprite(ctx, spr, dino.x, dino.y);

    // Score (flashes at every 100 points)
    ctx.font = '12px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    var showScore = !(frame < flashUntil && Math.floor(frame / 8) % 2 === 0);
    var text = (highScore ? 'HI ' + pad(highScore) + '  ' : '') + (showScore ? pad(score) : '     ');
    ctx.fillText(text, W - 10, 8);
    if (muted) { ctx.textAlign = 'left'; ctx.fillText('MUTED', 10, 8); }

    if (state === 'ready') {
      ctx.textAlign = 'center';
      ctx.fillText(isTouch ? 'TAP TO START' : 'PRESS SPACE OR TAP TO START', W / 2, 60);
    }

    if (state === 'paused') {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillText('P A U S E D', W / 2, 45);
      ctx.font = '12px "Courier New", monospace';
      ctx.fillText(isTouch ? 'TAP TO RESUME' : 'PRESS P OR SPACE TO RESUME', W / 2, 68);
    }

    if (state === 'over') {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillText('G A M E   O V E R', W / 2, 45);
      // restart icon
      var rx = W / 2 - 12, ry = 68;
      ctx.lineWidth = 3;
      ctx.strokeStyle = fg;
      ctx.beginPath();
      ctx.arc(rx + 12, ry + 12, 9, Math.PI * 0.35, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rx + 17, ry + 1);
      ctx.lineTo(rx + 25, ry + 4);
      ctx.lineTo(rx + 19, ry + 10);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- Main loop (fixed time step) ----
  var last = performance.now();
  var acc = 0;
  function loop(now) {
    acc += Math.min(now - last, 250);
    last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
    requestAnimationFrame(loop);
  }

  // ---- Input: keyboard ----
  var JUMP_KEYS = { Space: 1, ArrowUp: 1, ShiftLeft: 1, ShiftRight: 1, KeyW: 1 };
  var DUCK_KEYS = { ArrowDown: 1, KeyS: 1 };
  var PAUSE_KEYS = { KeyP: 1, Escape: 1 };

  function pressJump() {
    if (state === 'paused') { resume(); return; }
    input.jump = true;
    if (state !== 'running') start();
  }

  function releaseAll() { input.jump = false; input.duck = false; }

  document.addEventListener('keydown', function (e) {
    if (JUMP_KEYS[e.code]) {
      e.preventDefault();
      if (!e.repeat || state === 'running') pressJump();
    } else if (DUCK_KEYS[e.code]) {
      e.preventDefault();
      if (state === 'running') input.duck = true;
    } else if (PAUSE_KEYS[e.code]) {
      if (e.repeat) return;
      if (state === 'running') pause();
      else if (state === 'paused') resume();
    } else if (e.code === 'KeyM') {
      muted = !muted;
      store(MUTE_KEY, muted ? '1' : '0');
    }
  });

  document.addEventListener('keyup', function (e) {
    if (JUMP_KEYS[e.code]) input.jump = false;
    if (DUCK_KEYS[e.code]) input.duck = false;
  });

  // ---- Input: touch screens ----
  // Tap = jump (hold for a higher jump), swipe down = duck / fast-fall.
  // Listeners are non-passive so preventDefault() can stop scrolling,
  // double-tap zoom and the emulated mouse events that follow a touch.
  var SWIPE_DUCK_PX = 24;
  var touchId = null;
  var touchStartY = 0;

  function findTouch(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
    return null;
  }

  stage.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (touchId !== null) return;          // ignore extra fingers
    var t = e.changedTouches[0];
    touchId = t.identifier;
    touchStartY = t.clientY;
    pressJump();
  }, { passive: false });

  stage.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var t = findTouch(e.changedTouches, touchId);
    if (!t || state !== 'running') return;
    if (t.clientY - touchStartY > SWIPE_DUCK_PX) {
      input.jump = false;                  // a swipe down cancels the held jump
      input.duck = true;
    }
  }, { passive: false });

  function endTouch(e) {
    if (touchId === null || !findTouch(e.changedTouches, touchId)) return;
    e.preventDefault();
    touchId = null;
    releaseAll();
  }
  stage.addEventListener('touchend', endTouch, { passive: false });
  stage.addEventListener('touchcancel', endTouch, { passive: false });

  // ---- Input: mouse (desktop click to jump) ----
  stage.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    pressJump();
  });
  window.addEventListener('mouseup', function () { input.jump = false; });

  // Long-press would otherwise open the context menu on some phones.
  stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---- Play / pause button ----
  if (playBtn) {
    // Keep the button from stealing the touch as a jump or a zoom gesture.
    playBtn.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    playBtn.addEventListener('click', function (e) {
      togglePlay();
      // After a tap or click, drop focus so Space keeps jumping instead of
      // re-activating the button. Keyboard users (detail === 0) keep focus.
      if (e.detail > 0) playBtn.blur();
    });
  }

  // Pause automatically when the player leaves, so the dino doesn't crash unseen.
  window.addEventListener('blur', function () { releaseAll(); pause(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
    last = performance.now();
    acc = 0;
  });

  state = 'ready';
  reset();
  updateControls();
  requestAnimationFrame(loop);

  // Exposed for automated tests only.
  window.__dino = {
    get state() { return state; },
    get score() { return score; },
    get dino() { return dino; },
    get obstacles() { return obstacles; },
    get input() { return input; }
  };
})();
