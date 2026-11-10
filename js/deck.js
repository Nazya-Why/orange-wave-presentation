/* Навігація, крокер зі скріншотами, лайтбокс, поява елементів, рамка, зміст, прелоадер. */
(() => {
  const $ = (s, e = document) => e.querySelector(s);
  const $$ = (s, e = document) => [...e.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 1920, H = 1080;

  const slides = $$('.slide');
  const N = slides.length;

  /* ───────── заголовки: слова → літери (зберігає <em>, <code>) ───────── */
  $$('.split').forEach(el => {
    const byWord = el.dataset.by === 'word';
    let ci = 0, wi = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(tn => {
      const frag = document.createDocumentFragment();
      tn.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'w';
        [...part].forEach(ch => {
          const c = document.createElement('span'); c.className = 'c'; c.textContent = ch;
          c.style.setProperty('--i', byWord ? wi : ci++); w.appendChild(c);
        });
        wi++;
        frag.appendChild(w);
      });
      tn.replaceWith(frag);
    });
  });

  /* ───────── крокер: зчитуємо кроки з .steps-data ───────── */
  const allFigs = [];
  slides.forEach(el => {
    const data = $('.steps-data', el);
    if (!data) return;
    const steps = $$(':scope > div', data).map(d => ({
      fig: d.dataset.fig, cap: d.dataset.cap, url: d.dataset.url, html: d.innerHTML
    }));
    el._steps = steps;
    steps.forEach(s => allFigs.push(s.fig));
    const segs = $('.segs', el);
    if (segs) segs.innerHTML = steps.map((_, k) => `<button data-step="${k}" aria-label="Крок ${k + 1}"></button>`).join('');
    // другий кадр для плавної зміни скріншотів
    const box = $('.shot-img', el);
    if (box && $$('img', box).length < 2) box.appendChild($('img', box).cloneNode());
    $$('.sn, .figno', el).forEach(n => n.classList.add('roll'));
  });

  /* ───────── плавна зміна скріншота: dir 1 — вперед, -1 — назад, 0 — вхід на слайд ───────── */
  function swapShot(el, src, cap, dir) {
    const box = $('.shot-img', el);
    const [a, b] = $$('img', box);
    const shown = box._cur;
    if (shown && shown.getAttribute('src') === src) return;
    const nx = shown === a ? b : a;
    const tok = box._tok = (box._tok || 0) + 1;
    nx.className = dir > 0 ? 'from-f' : dir < 0 ? 'from-b' : 'from-up';
    nx.alt = cap;
    nx.src = src;
    const run = () => {
      if (box._tok !== tok) return;
      void nx.offsetWidth;
      nx.className = 'show';
      if (shown) shown.className = dir < 0 ? 'to-b' : 'to-f';
      box._cur = nx;
    };
    (nx.decode ? nx.decode() : Promise.resolve()).then(run, run);
  }
  const tick = n => { n.classList.remove('tick'); void n.offsetWidth; n.classList.add('tick'); };

  /* ───────── рамка ───────── */
  $('#tot').textContent = pad(N);
  $('#ticks').innerHTML = slides.map((s, i) => `<button data-go="${i}" aria-label="${s.dataset.title}" title="${s.dataset.title}"></button>`).join('');
  const ticks = $$('#ticks button');
  $('#menuList').innerHTML = slides.map((s, i) => `<li><button data-go="${i}" style="--i:${i}"><span class="n">${pad(i + 1)}</span><span class="t">${s.dataset.title}</span><span class="s">${s.classList.contains('s-divider') ? 'Розділ' : ''}</span></button></li>`).join('');

  /* ───────── масштаб сцени ───────── */
  const stage = $('#stage');
  let sc = 1;
  function fit() { sc = Math.min(innerWidth / W, innerHeight / H); stage.style.setProperty('--sc', sc); }
  fit(); addEventListener('resize', fit);

  /* ───────── перехід між слайдами ───────── */
  let cur = -1;
  const seen = new Set();
  const stepOf = new Map();

  function go(i, step = 0) {
    i = Math.max(0, Math.min(N - 1, i));
    if (i === cur) { if (slides[i]._steps) setStep(i, step); return; }
    const out = slides[cur], inn = slides[i];
    if (out) {
      out.classList.remove('is-active'); out.classList.add('is-leaving');
      clearTimeout(out._t);
      out._t = setTimeout(() => { out.classList.add('reset'); out.classList.remove('is-leaving'); void out.offsetWidth; out.classList.remove('reset'); }, 720);
    }
    clearTimeout(inn._t);
    inn.classList.add('reset'); inn.classList.remove('is-leaving', 'is-active');
    void inn.offsetWidth; inn.classList.remove('reset');
    void inn.offsetWidth; inn.classList.add('is-active');

    cur = i; seen.add(i);
    const theme = inn.dataset.theme || 'light';
    document.body.dataset.theme = theme;
    $('meta[name=theme-color]').content = theme === 'orange' ? '#ff6a1a' : '#fffcf8';
    Bg.theme(theme); Bg.scene(); Bg.kick();
    chrome(i); runCounters(inn); LiquidGlass.observe(inn);
    if (inn._steps) { stepOf.delete(i); setStep(i, step, true); } else syncHash();
  }

  function next() {
    const el = slides[cur];
    if (el && el._steps) { const k = stepOf.get(cur) ?? 0; if (k < el._steps.length - 1) return setStep(cur, k + 1); }
    if (cur < N - 1) go(cur + 1);
  }
  function prev() {
    const el = slides[cur];
    if (el && el._steps) { const k = stepOf.get(cur) ?? 0; if (k > 0) return setStep(cur, k - 1); }
    if (cur > 0) { const p = cur - 1; go(p, slides[p]._steps ? slides[p]._steps.length - 1 : 0); }
  }

  /* ───────── крок усередині слайда ───────── */
  function setStep(i, k, entering = false) {
    const el = slides[i], steps = el._steps;
    k = Math.max(0, Math.min(steps.length - 1, k));
    const prevK = stepOf.get(i);
    if (prevK === k && !entering) return;
    const dir = entering || prevK == null ? 0 : (k > prevK ? 1 : -1);
    stepOf.set(i, k);
    const st = steps[k];
    $('.sn', el).textContent = pad(k + 1);
    $('.fig-lbl', el).textContent = st.cap.split(' — ')[0];
    $('.figno', el).textContent = st.cap.split(' — ')[0];
    if (dir) { tick($('.sn', el)); tick($('.figno', el)); }
    const su = $('.shot-url', el); if (su) su.textContent = st.url;
    $$('.segs button', el).forEach((b, j) => { b.classList.toggle('on', j === k); b.classList.toggle('done', j < k); });

    const txt = $('.step-text', el);
    txt.style.transition = 'none'; txt.style.opacity = '0'; txt.style.transform = `translateY(${dir < 0 ? -14 : 14}px)`;
    const show = () => { txt.innerHTML = st.html; void txt.offsetWidth; txt.style.transition = 'opacity .5s var(--ease), transform .6s var(--ease)'; txt.style.opacity = '1'; txt.style.transform = 'none'; };
    setTimeout(show, entering ? 240 : 150);

    el._shot = { src: st.fig, cap: st.cap };
    swapShot(el, st.fig, st.cap, dir);
    // підвантажити сусідні
    [k + 1, k + 2].forEach(j => { if (steps[j]) { const im = new Image(); im.src = steps[j].fig; } });
    if (cur === i) syncHash();
  }

  const nextSlide = () => { if (cur < N - 1) go(cur + 1); };
  const prevSlide = () => { if (cur > 0) go(cur - 1); };

  function syncHash() {
    const k = stepOf.get(cur);
    const h = `#${cur + 1}${(slides[cur]._steps && k) ? '.' + (k + 1) : ''}`;
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function chrome(i) {
    const c = $('#cnt');
    c.textContent = pad(i + 1); c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick');
    ticks.forEach((t, k) => { t.classList.toggle('on', k === i); t.classList.toggle('seen', seen.has(k) && k !== i); });
    $$('#menuList button').forEach((b, k) => b.classList.toggle('on', k === i));
    const now = $('#nowLabel');
    now.classList.add('out');
    setTimeout(() => { now.textContent = `${pad(i + 1)} — ${slides[i].dataset.title}`; now.classList.remove('out'); }, 260);
  }

  function runCounters(el) {
    $$('[data-count]', el).forEach(b => {
      const to = +b.dataset.count, t0 = performance.now() + 1000, dur = 1500;
      b.textContent = '0';
      const tick = now => {
        const p = Math.max(0, Math.min(1, (now - t0) / dur));
        b.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))).toLocaleString('uk-UA');
        if (p < 1 && el.classList.contains('is-active')) requestAnimationFrame(tick); else b.textContent = to.toLocaleString('uk-UA');
      };
      requestAnimationFrame(tick);
    });
  }

  /* ───────── лайтбокс ───────── */
  const lb = $('#lb'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  function openLb(src, cap) {
    lbImg.src = src; lbImg.alt = cap || ''; lbCap.textContent = cap || '';
    lb.hidden = false; void lb.offsetWidth; lb.classList.add('open');
  }
  function closeLb() { lb.classList.remove('open'); setTimeout(() => { lb.hidden = true; }, 500); }
  lb.addEventListener('click', closeLb);

  /* ───────── керування ───────── */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-go],[data-step],.window.shot,#nextBtn,#prevBtn,#menuBtn,#menuClose,#fsBtn');
    if (!t) return;
    if (t.closest('a[href]')) return;
    e.preventDefault();
    if (t.id === 'nextBtn') return next();
    if (t.id === 'prevBtn') return prev();
    if (t.id === 'menuBtn') return toggleMenu(true);
    if (t.id === 'menuClose') return toggleMenu(false);
    if (t.id === 'fsBtn') return toggleFs();
    if (t.dataset.step != null) return setStep(cur, +t.dataset.step);
    if (t.classList.contains('shot')) { const s = slides[cur]._shot; if (s) openLb(s.src, s.cap); return; }
    if (t.dataset.go != null) { toggleMenu(false); go(+t.dataset.go); }
  });

  document.addEventListener('keydown', e => {
    const k = e.key;
    if (!lb.hidden) { if (['Escape', ' ', 'Enter'].includes(k)) { e.preventDefault(); closeLb(); } return; }
    if (k === 'Enter' && slides[cur] && slides[cur]._steps && e.target.classList?.contains('shot')) { const s = slides[cur]._shot; if (s) return openLb(s.src, s.cap); }
    if (menuOpen && (k === 'Escape' || /^[mMьЬ]$/.test(k))) return toggleMenu(false);
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(N - 1); }
    else if (/^[fFаА]$/.test(k)) toggleFs();
    else if (/^[mMьЬ]$/.test(k) || k === 'Escape') toggleMenu(!menuOpen);
  });

  // колесо: один жест = один крок/слайд
  let acc = 0, lockUntil = 0;
  addEventListener('wheel', e => {
    e.preventDefault();
    if (menuOpen || !lb.hidden) return;
    const now = performance.now();
    if (now < lockUntil) { lockUntil = Math.max(lockUntil, now + 140); return; }
    acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(acc) > 50) { acc > 0 ? next() : prev(); acc = 0; lockUntil = now + 560; }
  }, { passive: false });

  let tx = 0, ty = 0;
  addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 50) return;
    if (!lb.hidden) { closeLb(); return; }
    if (menuOpen) return;
    (Math.abs(dx) > Math.abs(dy) ? dx < 0 : dy < 0) ? next() : prev();
  }, { passive: true });

  function toggleFs() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }

  let menuOpen = false;
  const menu = $('#menu');
  function toggleMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    if (open) { menu.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('open'))); }
    else { menu.classList.remove('open'); setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 650); }
  }

  /* ───────── курсор: паралакс і нахил ───────── */
  const fine = matchMedia('(pointer: fine)').matches && !reduced;
  let nx = 0, ny = 0, snx = 0, sny = 0;
  addEventListener('pointermove', e => { nx = e.clientX / innerWidth - .5; ny = e.clientY / innerHeight - .5; }, { passive: true });
  function pointerLoop() {
    snx += (nx - snx) * .06; sny += (ny - sny) * .06;
    const el = slides[cur];
    if (el && fine) {
      $$('.px', el).forEach(p => {
        const d = +p.dataset.depth || 0;
        p.style.transform = d ? `translate3d(${snx * d * 2}px, ${sny * d * 2}px, 0)` : '';
      });
      const t = $('.tilt', el);
      if (t) t.style.transform = `rotateY(${snx * 7}deg) rotateX(${-sny * 6}deg)`;
    }
    requestAnimationFrame(pointerLoop);
  }
  requestAnimationFrame(pointerLoop);

  /* ───────── старт: прелоадер → перший слайд ───────── */
  const parseHash = () => {
    const m = location.hash.match(/^#(\d+)(?:\.(\d+))?/);
    return m ? [Math.max(0, Math.min(N - 1, +m[1] - 1)), m[2] ? +m[2] - 1 : 0] : [0, 0];
  };
  addEventListener('hashchange', () => { const [i, k] = parseHash(); if (i !== cur || (slides[i]._steps && k !== stepOf.get(i))) go(i, k); });

  const pre = $('#pre'), preN = $('#preN'), preBar = $('#preBar');
  const [i0, k0] = parseHash();
  const firstFigs = slides.map(s => s._steps && s._steps[0].fig).filter(Boolean).slice(0, 4);
  const warm = firstFigs.map(src => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = src; }));
  const tasks = [document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 700)), ...warm];
  let done = 0, shown = 0, target = 0;
  tasks.forEach(p => p.then(() => { done++; target = done / tasks.length; }));
  const t0 = performance.now();
  (function preLoop(now) {
    shown += (Math.min(target, (now - t0) / 1300) - shown) * .12;
    preN.textContent = Math.round(shown * 100);
    preBar.style.transform = `scaleX(${shown})`;
    if (shown > .995 || now - t0 > 6000) {
      preN.textContent = '100'; preBar.style.transform = 'scaleX(1)';
      setTimeout(() => {
        pre.classList.add('done');
        setTimeout(() => go(i0, k0), reduced ? 0 : 300);
        setTimeout(() => pre.remove(), 1300);
      }, 180);
      return;
    }
    setTimeout(() => preLoop(performance.now()), 16);
  })(t0);

  // підвантажити решту скріншотів після старту
  setTimeout(() => allFigs.forEach(src => { const im = new Image(); im.src = src; }), 2000);
})();
