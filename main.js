/* ============================================================
   GHOST — Portfolio v2
   One scene, seven moods. Scroll and the geometry follows.
   ============================================================ */
(function () {
  'use strict';

  var qs = function (s, c) { return (c || document).querySelector(s); };
  var qsa = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { return t * t * (3 - 2 * t); };

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COARSE = window.matchMedia('(pointer: coarse)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var hasTHREE = typeof window.THREE !== 'undefined';

  /* ---------- console easter egg ---------- */
  try {
    console.log('%c✳ GHOST', 'font-size:40px;font-weight:800;color:#a855f7;font-family:Syne,sans-serif;');
    console.log('%cPoking around the devtools? Good instinct.\nbuild things / break things — ghostprodltd@gmail.com', 'font-size:12px;color:#f3ede4;font-family:monospace;line-height:1.6;');
  } catch (e) {}

  /* ============================================================
     SPLIT TEXT  (words -> chars, wrapping-safe)
     ============================================================ */
  qsa('[data-split]').forEach(function (el) {
    var words = el.textContent.split(/(\s+)/);
    el.textContent = '';
    words.forEach(function (w) {
      if (!w) return;
      if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(w.indexOf(String.fromCharCode(160)) > -1 ? String.fromCharCode(160) : " ")); return; }
      var wEl = document.createElement('span');
      wEl.className = 'word';
      for (var i = 0; i < w.length; i++) {
        var c = document.createElement('span');
        c.className = 'ch';
        c.textContent = w[i];
        wEl.appendChild(c);
      }
      el.appendChild(wEl);
    });
  });

  /* ============================================================
     PRELOADER  (lib-independent; resolves a promise when gone)
     ============================================================ */
  var introStarted = false;
  var introListeners = [];
  function onIntro(fn) { if (introStarted) fn(); else introListeners.push(fn); }
  function fireIntro() {
    if (introStarted) return;
    introStarted = true;
    introListeners.forEach(function (fn) { try { fn(); } catch (e) {} });
    introListeners.length = 0;
  }

  (function preloader() {
    var pre = qs('#preloader');
    if (!pre) { fireIntro(); return; }
    var nEl = qs('#preCount'), bEl = qs('#preBar'), wEl = qs('#preWord');
    var words = ['INITIALIZING GHOST', 'COMPILING MISCHIEF', 'BYPASSING SLEEP', 'LOADING THE TOOLKIT', 'ENUMERATING SKILLS', 'ESTABLISHING UPLINK'];
    var wi = 0;
    var wordTimer = setInterval(function () { wi = (wi + 1) % words.length; if (wEl) wEl.textContent = words[wi]; }, 340);
    var DUR = REDUCED ? 250 : 1750;
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = clamp((ts - t0) / DUR, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      if (nEl) nEl.textContent = Math.floor(e * 100);
      if (bEl) bEl.style.transform = 'scaleX(' + e + ')';
      if (p < 1) { requestAnimationFrame(frame); } else { finish(); }
    }
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(wordTimer);
      if (nEl) nEl.textContent = '100';
      pre.classList.add('done');
      setTimeout(fireIntro, 320);
      setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 1400);
      // move focus to main content for screen readers
      setTimeout(function () {
        var main = document.getElementById('main');
        if (main) main.focus();
      }, 1100);
    }
    requestAnimationFrame(frame);
    setTimeout(finish, 3000); // hard fallback, no matter what
  })();

  /* ============================================================
     THREE.JS — the geometry that follows you
     ============================================================ */
  if (hasTHREE) (function initThree() {
    var canvas = qs('#webgl');
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 5;

    var root = new THREE.Group();   // position / scale per section
    var spin = new THREE.Group();   // continuous rotation
    root.add(spin);
    scene.add(root);

    var accentCol = new THREE.Color('#a855f7'); // shared by most materials
    var lightCol = new THREE.Color('#ffffff');  // nucleus / halo (derived)
    var WHITE = new THREE.Color('#ffffff');

    // --- outer wireframe shell
    var shellMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.55 });
    shellMat.color = accentCol;
    var shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), shellMat);
    spin.add(shell);

    // --- finer additive lattice
    var edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
    edgeMat.color = accentCol;
    var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.05, 2)), edgeMat);
    spin.add(edges);

    // --- nucleus + inner glow
    var nucMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    nucMat.color = lightCol;
    var nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 3), nucMat);
    spin.add(nucleus);

    var glowMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
    glowMat.color = accentCol;
    var glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 3), glowMat);
    spin.add(glow);

    // --- halo sprite (soft radial bloom)
    var haloTexCanvas = document.createElement('canvas');
    haloTexCanvas.width = haloTexCanvas.height = 128;
    var hctx = haloTexCanvas.getContext('2d');
    var grad = hctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,.85)');
    grad.addColorStop(0.25, 'rgba(255,255,255,.28)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    hctx.fillStyle = grad;
    hctx.fillRect(0, 0, 128, 128);
    var haloMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloTexCanvas), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    haloMat.color = accentCol;
    var halo = new THREE.Sprite(haloMat);
    halo.scale.set(3.8, 3.8, 1);
    root.add(halo);

    // --- torus knot (morph target for "Work")
    var knotMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0 });
    knotMat.color = accentCol;
    var knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.78, 0.24, 150, 20), knotMat);
    spin.add(knot);

    // --- orbit rings
    var ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    ringMat.color = accentCol;
    var ringGroup = new THREE.Group();
    var ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.012, 8, 140), ringMat);
    ring1.rotation.x = 1.25;
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.008, 8, 140), ringMat);
    ring2.rotation.x = 1.85; ring2.rotation.y = 0.6;
    ringGroup.add(ring1); ringGroup.add(ring2);
    root.add(ringGroup);

    // --- particles (assemble <-> explode)
    // dedupe icosahedron verts: PolyhedronGeometry repeats them per face
    var srcPos = new THREE.IcosahedronGeometry(1.05, 3).attributes.position;
    var seen = {};
    var unique = [];
    for (var u = 0; u < srcPos.count; u++) {
      var ux = srcPos.getX(u), uy = srcPos.getY(u), uz = srcPos.getZ(u);
      var key = ux.toFixed(4) + ',' + uy.toFixed(4) + ',' + uz.toFixed(4);
      if (!seen[key]) { seen[key] = 1; unique.push(ux, uy, uz); }
    }
    var COUNT = unique.length / 3;
    var assembled = new Float32Array(COUNT * 3);
    var exploded = new Float32Array(COUNT * 3);
    var phase = new Float32Array(COUNT);
    for (var i = 0; i < COUNT; i++) {
      var x = unique[i * 3], y = unique[i * 3 + 1], z = unique[i * 3 + 2];
      assembled[i * 3] = x; assembled[i * 3 + 1] = y; assembled[i * 3 + 2] = z;
      var len = Math.sqrt(x * x + y * y + z * z) || 1;
      var r = 2.3 + Math.random() * 2.3;
      exploded[i * 3] = (x / len) * r + (Math.random() - 0.5) * 0.9;
      exploded[i * 3 + 1] = (y / len) * r + (Math.random() - 0.5) * 0.9;
      exploded[i * 3 + 2] = (z / len) * r + (Math.random() - 0.5) * 0.9;
      phase[i] = Math.random() * Math.PI * 2;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(assembled.slice(), 3));
    var pMat = new THREE.PointsMaterial({ size: 0.045, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    pMat.color = accentCol;
    var points = new THREE.Points(pGeo, pMat);
    spin.add(points);

    // --- background starfield
    var S_COUNT = 420;
    var sPos = new Float32Array(S_COUNT * 3);
    for (var s = 0; s < S_COUNT; s++) {
      sPos[s * 3] = (Math.random() - 0.5) * 36;
      sPos[s * 3 + 1] = (Math.random() - 0.5) * 22;
      sPos[s * 3 + 2] = -4 - Math.random() * 26;
    }
    var sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    var stars = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xf3ede4, size: 0.035, transparent: true, opacity: 0.45, depthWrite: false }));
    scene.add(stars);

    /* ---------- per-section choreography ---------- */
    var STATES = [
      { id: 'hero',       x: 0,     y: -0.05, z: 0,    s: 1.18, explode: 0,    morph: 0, rings: 1, speed: 0.16, color: '#a855f7' },
      { id: 'about',      x: 1.85,  y: 0.05,  z: 0,    s: 0.95, explode: 0.12, morph: 0, rings: 1, speed: 0.2,  color: '#22d3ee' },
      { id: 'experience', x: -1.9,  y: 0,     z: 0,    s: 0.9,  explode: 0,    morph: 0, rings: 1, speed: 0.24, color: '#818cf8' },
      { id: 'skills',     x: 0.1,   y: 0,     z: -0.7, s: 1.32, explode: 1,    morph: 0, rings: 0, speed: 0.32, color: '#c084fc' },
      { id: 'work',       x: -2.45, y: 0.1,   z: 0.35, s: 0.8,  explode: 0,    morph: 1, rings: 1, speed: 0.26, color: '#f472b6' },
      { id: 'opensource', x: 1.75,  y: -0.05, z: 0,    s: 0.78, explode: 0.2,  morph: 1, rings: 1, speed: 0.14, color: '#2dd4bf' },
      { id: 'contact',    x: 0,     y: 0.05,  z: 1.15, s: 1.05, explode: 0,    morph: 0, rings: 1, speed: 0.42, color: '#5dff9f' }
    ];
    STATES.forEach(function (st) {
      st.el = document.getElementById(st.id);
      st.col = new THREE.Color(st.color);
      st.top = 0;
    });

    function computeTops() {
      var sy = window.scrollY || window.pageYOffset || 0;
      STATES.forEach(function (st) {
        if (st.el) st.top = st.el.getBoundingClientRect().top + sy;
      });
    }

    // live values, lerped toward target every frame
    var cur = { x: 0, y: -0.05, z: 0, s: 1.18, explode: 0, morph: 0, rings: 1, speed: 0.16 };
    var curCol = new THREE.Color('#a855f7');
    var tgtCol = new THREE.Color('#a855f7');
    var tgt = { x: 0, y: 0, z: 0, s: 1, explode: 0, morph: 0, rings: 1, speed: 0.16 };

    var mouse = { x: 0, y: 0 }, mouseL = { x: 0, y: 0 };
    if (!COARSE) window.addEventListener('pointermove', function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    var xFactor = 1;
    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      xFactor = clamp((w / h) / 1.55, 0.32, 1);
      computeTops();
    }
    resize();
    window.addEventListener('resize', function () {
      clearTimeout(resize._t);
      resize._t = setTimeout(resize, 120);
    });
    window.addEventListener('load', function () { setTimeout(computeTops, 250); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(computeTops, 100); });

    var introP = REDUCED ? 1 : 0;
    var introOn = false;
    onIntro(function () { introOn = true; });

    var lastSy = window.scrollY || 0;
    var vel = 0, rotAccum = 0;
    var clock = new THREE.Clock();
    var posAttr = pGeo.attributes.position;

    function tick() {
      requestAnimationFrame(tick);
      if (document.hidden) return; // skip render while tab is in background
      var dt = Math.min(clock.getDelta(), 0.05);
      var time = clock.elapsedTime;

      // intro grow
      if (introOn && introP < 1) introP = Math.min(1, introP + dt / 1.5);
      var introE = 1 - Math.pow(1 - introP, 4);

      // which section are we between?
      var sy = window.scrollY || window.pageYOffset || 0;
      var anchor = sy + window.innerHeight * 0.45;
      var iA = 0;
      for (var i = 0; i < STATES.length; i++) { if (STATES[i].top <= anchor) iA = i; }
      var a = STATES[iA], b = STATES[Math.min(iA + 1, STATES.length - 1)];
      var span = Math.max(1, b.top - a.top);
      var t = (a === b) ? 0 : smooth(clamp((anchor - a.top) / span, 0, 1));

      tgt.x = lerp(a.x, b.x, t); tgt.y = lerp(a.y, b.y, t); tgt.z = lerp(a.z, b.z, t);
      tgt.s = lerp(a.s, b.s, t);
      tgt.explode = lerp(a.explode, b.explode, t);
      tgt.morph = lerp(a.morph, b.morph, t);
      tgt.rings = lerp(a.rings, b.rings, t);
      tgt.speed = lerp(a.speed, b.speed, t);
      tgtCol.copy(a.col).lerp(b.col, t);

      // ease toward targets
      var k = REDUCED ? 1 : (1 - Math.pow(0.0012, dt)); // ~smooth chase
      cur.x = lerp(cur.x, tgt.x, k); cur.y = lerp(cur.y, tgt.y, k); cur.z = lerp(cur.z, tgt.z, k);
      cur.s = lerp(cur.s, tgt.s, k);
      cur.explode = lerp(cur.explode, tgt.explode, k);
      cur.morph = lerp(cur.morph, tgt.morph, k);
      cur.rings = lerp(cur.rings, tgt.rings, k);
      cur.speed = lerp(cur.speed, tgt.speed, k);
      curCol.lerp(tgtCol, k);
      accentCol.copy(curCol);
      lightCol.copy(curCol).lerp(WHITE, 0.62);

      // scroll velocity -> extra spin
      var v = sy - lastSy; lastSy = sy;
      vel = lerp(vel, v, 0.12);

      var bob = REDUCED ? 0 : Math.sin(time * 0.55) * 0.05;
      root.position.set(cur.x * xFactor, cur.y + bob, cur.z);
      root.scale.setScalar(Math.max(0.0001, cur.s * introE));

      if (!REDUCED) rotAccum += dt * (cur.speed + Math.min(Math.abs(vel) * 0.001, 1.2));
      mouseL.x = lerp(mouseL.x, mouse.x, 0.05);
      mouseL.y = lerp(mouseL.y, mouse.y, 0.05);
      spin.rotation.y = rotAccum + sy * 0.0011 + mouseL.x * 0.35 + (1 - introE) * 2.4;
      spin.rotation.x = mouseL.y * 0.28 + (REDUCED ? 0 : Math.sin(time * 0.26) * 0.07);

      // particle assemble <-> explode (with a little organic swirl)
      var ex = cur.explode;
      var arr = posAttr.array;
      for (var p = 0; p < COUNT; p++) {
        var sw = REDUCED ? ex : ex * (0.78 + 0.22 * Math.sin(time * 1.15 + phase[p]));
        var i3 = p * 3;
        var breathe = REDUCED ? 0 : Math.sin(time * 1.6 + phase[p]) * 0.022 * (1 - ex);
        arr[i3] = lerp(assembled[i3], exploded[i3], sw) * (1 + breathe);
        arr[i3 + 1] = lerp(assembled[i3 + 1], exploded[i3 + 1], sw) * (1 + breathe);
        arr[i3 + 2] = lerp(assembled[i3 + 2], exploded[i3 + 2], sw) * (1 + breathe);
      }
      posAttr.needsUpdate = true;

      // material mood
      var mo = cur.morph;
      shellMat.opacity = (1 - mo) * (1 - ex * 0.92) * 0.55;
      edgeMat.opacity = (1 - mo) * (1 - ex) * 0.15;
      knotMat.opacity = mo * 0.62;
      knot.scale.setScalar(0.5 + 0.5 * mo);
      knot.rotation.x = time * 0.32;
      knot.rotation.z = time * 0.21;
      pMat.opacity = 0.85 * (1 - mo * 0.5);
      pMat.size = 0.045 * (1 + ex * 0.9);
      nucMat.opacity = 0.95 * (1 - ex * 0.55);
      var pulse = REDUCED ? 1 : 1 + Math.sin(time * 2.3) * 0.12;
      nucleus.scale.setScalar(pulse);
      glow.scale.setScalar(pulse * 1.15);
      glowMat.opacity = 0.16 + (REDUCED ? 0 : Math.sin(time * 2.3) * 0.05);
      ringMat.opacity = cur.rings * (1 - ex * 0.85) * 0.4;
      ringGroup.rotation.z += dt * 0.07;
      ringGroup.rotation.x = Math.sin(time * 0.18) * 0.12;
      haloMat.opacity = 0.3 * (1 - ex * 0.35);

      stars.rotation.y = time * 0.006 + sy * 0.00004;
      stars.position.x = mouseL.x * 0.4;
      stars.position.y = -mouseL.y * 0.25;

      renderer.render(scene, camera);
    }
    tick();

    // keep tops honest when ScrollTrigger recalculates layout
    if (hasGSAP) window.ScrollTrigger.addEventListener('refresh', computeTops);
    window.__ghostComputeTops = computeTops;
  })();

  /* ============================================================
     TERMINAL TYPING
     ============================================================ */
  (function terminal() {
    var body = qs('#termBody');
    if (!body) return;
    var LINES = [
      { p: '$ ', t: 'whoami', cls: '' },
      { t: 'ghost — developer · translator · security enthusiast', cls: 'out' },
      { p: '$ ', t: 'cat contact.txt', cls: '' },
      { t: 'instagram   @gustigost', cls: 'out' },
      { t: 'email       ghostprodltd@gmail.com', cls: 'out' },
      { p: '$ ', t: 'ghost --open-to-work', cls: '' },
      { t: '✓ available — let\'s build something', cls: 'ok' },
      { p: '$ ', t: '', cls: '', hold: true }
    ];
    var caret = document.createElement('span');
    caret.className = 'caret';
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function typeAll() {
      var li = 0;
      function nextLine() {
        if (li >= LINES.length) return;
        var L = LINES[li++];
        var line = document.createElement('div');
        line.className = 'tl-line ' + L.cls;
        if (L.p) {
          var pr = document.createElement('span');
          pr.className = 'prompt';
          pr.textContent = L.p;
          line.appendChild(pr);
        }
        var txt = document.createElement('span');
        line.appendChild(txt);
        line.appendChild(caret);
        body.appendChild(line);
        var ci = 0;
        var speed = L.p ? 34 : 11;
        (function typeChar() {
          if (REDUCED) { txt.textContent = L.t; ci = L.t.length; }
          if (ci < L.t.length) {
            txt.textContent += L.t[ci++];
            setTimeout(typeChar, speed + Math.random() * 28);
          } else {
            if (L.hold) return; // leave caret blinking on last line
            sleep(L.p ? 260 : 140).then(nextLine);
          }
        })();
      }
      nextLine();
    }
    if ('IntersectionObserver' in window) {
      var seen = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !seen) { seen = true; io.disconnect(); typeAll(); }
        });
      }, { threshold: 0.35 });
      io.observe(body);
    } else { typeAll(); }
  })();

  /* ============================================================
     COPY BUTTON + TOAST
     ============================================================ */
  (function copyCmd() {
    var btn = qs('#copyBtn'), toast = qs('#toast');
    if (!btn) return;
    var CMD = 'ghostprodltd@gmail.com';
    var tId;
    function show(msg) {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(tId);
      tId = setTimeout(function () { toast.classList.remove('show'); }, 4000);
    }
    btn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(CMD).then(
          function () { show('copied ' + CMD + ' — let\'s build something ✦'); },
          function () { show(CMD); }
        );
      } else { show(CMD); }
    });
  })();

  /* ============================================================
     GSAP — reveals, parallax, counters, bars, cursor, the rest
     ============================================================ */
  if (!hasGSAP) {
    // graceful degradation: show everything, fill bars, set counters
    document.body.classList.add('no-anim');
    qsa('[data-count]').forEach(function (el) { el.textContent = finalCount(el); });
    return;
  }

  function finalCount(el) {
    var v = parseFloat(el.getAttribute('data-count')) || 0;
    return formatCount(v, el);
  }
  function formatCount(v, el) {
    var fmt = el.getAttribute('data-format');
    var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
    if (fmt === 'compact') {
      if (v >= 1e6) { var m = v / 1e6; return (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).toString().replace(/\.0$/, '') + 'M'; }
      if (v >= 1e3) return Math.round(v / 1e3) + 'K';
      return Math.round(v).toString();
    }
    return dec > 0 ? v.toFixed(dec) : Math.round(v).toString();
  }

  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scroll (Lenis) ---------- */
  var lenis = null;
  if (!REDUCED && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  /* ---------- anchor navigation ---------- */
  qsa('[data-nav]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      var target = qs(href);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.5 });
      else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    });
  });

  /* ---------- hero intro ---------- */
  var heroChars = qsa('.hero-title .ch');
  var introEls = qsa('[data-intro]');
  if (!REDUCED) {
    gsap.set(heroChars, { yPercent: 118, rotate: 5 });
    gsap.set(introEls, { opacity: 0, y: 28 });
    gsap.set('.site-head', { y: -46, opacity: 0 });
    onIntro(function () {
      var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      tl.to(heroChars, { yPercent: 0, rotate: 0, duration: 1.35, stagger: 0.04 }, 0.05)
        .to(introEls, { opacity: 1, y: 0, duration: 1, stagger: 0.07 }, 0.5)
        .to('.site-head', { y: 0, opacity: 1, duration: 0.9 }, 0.65);
    });
  }

  /* ---------- section title char reveals ---------- */
  qsa('[data-sr]').forEach(function (el) {
    var chars = qsa('.ch', el);
    if (REDUCED || !chars.length) return;
    gsap.set(chars, { yPercent: 118, rotate: 4 });
    ScrollTrigger.create({
      trigger: el, start: 'top 86%', once: true,
      onEnter: function () { gsap.to(chars, { yPercent: 0, rotate: 0, duration: 1.15, ease: 'power4.out', stagger: 0.024 }); }
    });
  });

  /* ---------- generic reveals ---------- */
  qsa('[data-reveal]').forEach(function (el, idx) {
    if (REDUCED) return;
    gsap.set(el, { opacity: 0, y: 48 });
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: function () { gsap.to(el, { opacity: 1, y: 0, duration: 1.15, ease: 'power3.out', delay: (idx % 4) * 0.06 }); }
    });
  });

  /* ---------- section rules ---------- */
  qsa('.sec-rule').forEach(function (el) {
    if (REDUCED) return;
    gsap.set(el, { scaleX: 0 });
    ScrollTrigger.create({
      trigger: el, start: 'top 92%', once: true,
      onEnter: function () { gsap.to(el, { scaleX: 1, duration: 1.5, ease: 'expo.out' }); }
    });
  });

  /* ---------- parallax drift ---------- */
  if (!REDUCED) qsa('[data-speed]').forEach(function (el) {
    var sp = parseFloat(el.getAttribute('data-speed')) || 1;
    var amp = (sp - 1) * 240;
    gsap.fromTo(el, { y: -amp }, {
      y: amp, ease: 'none',
      scrollTrigger: { trigger: el.closest('section') || el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
    });
  });

  /* ---------- counters ---------- */
  qsa('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    if (REDUCED) { el.textContent = formatCount(target, el); return; }
    var obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: target, duration: 2.1, ease: 'power3.out',
          onUpdate: function () { el.textContent = formatCount(obj.v, el); },
          onComplete: function () { el.textContent = formatCount(target, el); }
        });
      }
    });
  });

  /* ---------- skill bars ---------- */
  qsa('.fill').forEach(function (f) {
    var lvl = parseFloat(f.getAttribute('data-level')) || 0;
    if (REDUCED) { f.style.width = lvl + '%'; return; }
    ScrollTrigger.create({
      trigger: f, start: 'top 92%', once: true,
      onEnter: function () { gsap.to(f, { width: lvl + '%', duration: 1.7, ease: 'expo.out' }); }
    });
  });

  /* ---------- marquee skew on velocity ---------- */
  if (!REDUCED) (function marqueeSkew() {
    var tracks = qsa('.marquee-track');
    if (!tracks.length) return;
    var proxy = { skew: 0 };
    var clampSkew = gsap.utils.clamp(-10, 10);
    ScrollTrigger.create({
      onUpdate: function (self) {
        var sk = clampSkew(self.getVelocity() / -260);
        if (Math.abs(sk) > Math.abs(proxy.skew)) {
          proxy.skew = sk;
          gsap.to(proxy, {
            skew: 0, duration: 0.75, ease: 'power3', overwrite: true,
            onUpdate: function () { tracks.forEach(function (tr) { tr.style.transform = 'skewX(' + proxy.skew + 'deg)'; }); }
          });
        }
      }
    });
  })();

  /* ---------- header behavior + progress bar ---------- */
  var head = qs('#siteHead');
  var lastY = 0;
  ScrollTrigger.create({
    onUpdate: function () {
      var sy = window.scrollY || 0;
      if (head) {
        head.classList.toggle('is-hidden', sy > lastY + 4 && sy > 180);
        head.classList.toggle('is-scrolled', sy > 50);
      }
      lastY = sy;
    }
  });
  gsap.to('.progress', {
    scaleX: 1, ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
  });

  /* ---------- per-section accent + active nav ---------- */
  qsa('[data-accent]').forEach(function (sec) {
    var color = sec.getAttribute('data-accent');
    var navLink = qs('.site-nav a[href="#' + sec.id + '"]');
    ScrollTrigger.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: function (self) {
        if (self.isActive) {
          document.documentElement.style.setProperty('--accent', color);
          qsa('.site-nav a').forEach(function (a) { a.removeAttribute('aria-current'); });
          if (navLink) navLink.setAttribute('aria-current', 'page');
        }
      }
    });
  });

  /* ---------- card tilt + shine ---------- */
  if (!COARSE && !REDUCED) qsa('[data-tilt]').forEach(function (card) {
    var rx = gsap.quickTo(card, 'rotationX', { duration: 0.55, ease: 'power2.out' });
    var ry = gsap.quickTo(card, 'rotationY', { duration: 0.55, ease: 'power2.out' });
    gsap.set(card, { transformPerspective: 900 });
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', px * 100 + '%');
      card.style.setProperty('--my', py * 100 + '%');
      ry((px - 0.5) * 9);
      rx((0.5 - py) * 9);
    });
    card.addEventListener('pointerleave', function () { rx(0); ry(0); });
  });

  /* ---------- magnetic buttons ---------- */
  if (!COARSE && !REDUCED) qsa('.magnetic').forEach(function (btn) {
    var qx = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
    var qy = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
    btn.addEventListener('pointermove', function (e) {
      var r = btn.getBoundingClientRect();
      qx((e.clientX - (r.left + r.width / 2)) * 0.22);
      qy((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    btn.addEventListener('pointerleave', function () { qx(0); qy(0); });
  });

  /* ---------- custom cursor ---------- */
  if (!COARSE) (function cursor() {
    var c = qs('.cursor'), d = qs('.cursor-dot');
    if (!c || !d) return;
    document.body.classList.add('cursor-on');
    var tx = -100, ty = -100, cx = -100, cy = -100;
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      d.style.transform = 'translate(calc(' + tx + 'px - 50%), calc(' + ty + 'px - 50%))';
    }, { passive: true });
    gsap.ticker.add(function () {
      cx = lerp(cx, tx, 0.16); cy = lerp(cy, ty, 0.16);
      c.style.transform = 'translate(calc(' + cx + 'px - 50%), calc(' + cy + 'px - 50%))';
    });
    var HOVER = 'a, button, .chip, .tile, [data-tilt]';
    document.addEventListener('pointerover', function (e) {
      c.classList.toggle('is-hovering', !!(e.target.closest && e.target.closest(HOVER)));
    }, { passive: true });
    document.addEventListener('pointerdown', function () { c.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { c.classList.remove('is-down'); });
  })();


  /* ---------- CDN image fallback ---------- */
  document.addEventListener('error', function (e) {
    if (e.target.tagName === 'IMG' && e.target.src && e.target.src.indexOf('simpleicons.org') > -1) {
      e.target.style.opacity = '0';
    }
  }, true);

  /* ---------- mobile nav toggle ---------- */
  (function mobileNav() {
    var toggle = qs('#navToggle');
    var nav = qs('#siteNav');
    if (!toggle || !nav) return;

    function openNav() {
      nav.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation');
      document.body.classList.add('nav-open');
      var first = qs('a', nav);
      if (first) first.focus();
    }

    function closeNav() {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
      document.body.classList.remove('nav-open');
      toggle.focus();
    }

    toggle.addEventListener('click', function () {
      nav.classList.contains('is-open') ? closeNav() : openNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) closeNav();
    });

    qsa('a', nav).forEach(function (link) {
      link.addEventListener('click', closeNav);
    });
  })();

  /* ---------- keep everything measured correctly ---------- */
  window.addEventListener('load', function () {
    setTimeout(function () { ScrollTrigger.refresh(); }, 350);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { setTimeout(function () { ScrollTrigger.refresh(); }, 120); });
  }
})();
