/* Фон — скляна оранжева хвиля на білому.
   Три стрічки (головна, друга тонша, світна нитка) рахуються у фрагментному шейдері:
   кожна — хвиляста смуга, що закручується вздовж себе. Де стрічка повертається ребром,
   вона звужується і світиться по краях, як скло; по ній біжить світловий імпульс.

   Кожен слайд має свою хвилю (WAVES нижче, по порядку слайдів): інший кут, звідки вона
   заходить, вигин, ширина й закрут. При зміні слайда хвиля перетікає в нову позу й
   на мить прискорюється. Тема orange міняє кольори: оранжевий фон, кремове скло.

   API:
     Bg.scene()        — взяти хвилю активного слайда
     Bg.theme('light') — палітра: light | orange
     Bg.kick()         — поштовх (викликається при зміні слайда)                       */
(() => {
  const cv = document.getElementById('bg');
  const api = { scene() {}, theme() {}, kick() {} };
  window.Bg = api;

  const gl = cv.getContext('webgl', {
    antialias: false, alpha: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance'
  });
  if (!gl) { document.documentElement.classList.add('no-webgl'); return; }

  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `
precision highp float;
uniform vec2 R; uniform float T; uniform float PX;
uniform vec4 P[9];
uniform vec3 cBg; uniform vec3 cEdge; uniform vec3 cDeep; uniform vec3 cMid; uniform vec3 cLite; uniform vec3 cHalo;
uniform float haloI;

float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// A = (кут, x, y, масштаб)  B = (амплітуда, частота, закрут, півширина)  C = (фаза, вигин, кінець, -)
vec4 ribbon(vec2 p, vec4 A, vec4 B, vec4 C, inout float halo) {
  float ca = cos(A.x), sa = sin(A.x);
  vec2 q = p - A.yz;
  q = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y) / A.w;
  float x = q.x, t = C.x;
  float f1 = B.y, f2 = B.y * 1.87;
  float yc = B.x * sin(x * f1 + t) + B.x * .32 * sin(x * f2 - t * 1.4 + 1.7) + C.y * x * x;
  float dy = B.x * f1 * cos(x * f1 + t) + B.x * .32 * f2 * cos(x * f2 - t * 1.4 + 1.7) + 2. * C.y * x;
  float th = x * B.z + t * .5;                                  // повільніший закрут у часі
  float ct = cos(th);
  float tap = smoothstep(C.z, C.z - 1.2, x);                 // хвіст, що сходить нанівець
  float hw = B.w * (.2 + .8 * abs(ct)) * tap + 1e-4;          // ребром — вужча, але не в нитку
  float d = (q.y - yc) / sqrt(1. + dy * dy);
  float e = abs(d) / hw;
  float aa = PX / A.w / hw;
  float inside = 1. - smoothstep(1. - aa, 1. + aa, e);
  halo += exp(-max(abs(d) - hw, 0.) * 5.5) * tap * min(B.w * 4., 1.);
  if (inside <= 0.) return vec4(0.);

  float v = d / hw;
  float ang = th + v * .8;                                    // поперек стрічка трохи вигнута
  float fr = pow(1. - abs(cos(ang)), 2.);                     // під кутом — насиченіше
  vec3 col = mix(cLite, cMid, .4 + .6 * fr);
  col = mix(col, cDeep, fr * fr * .75);
  col = mix(col, cDeep, smoothstep(.35, -.35, ct) * .16);     // зворотний бік темнішає поступово
  float pl = pow(.5 + .5 * sin(x * 1.3 - t * 2.4), 10.);      // світло, що біжить уздовж
  col = mix(col, cLite, pl * .45 * (1. - fr));
  col += vec3(1.) * pow(max(0., sin(ang + .9)), 34.) * .6;    // відблиск
  float rim = smoothstep(.58, .84, e) * (1. - smoothstep(.86, .95, e));
  col = mix(col, vec3(1.), rim * (.4 + .5 * fr));              // світлий кант скла
  float line = smoothstep(.87, .99, e);
  col = mix(col, cDeep, line * .85);                          // тонкий темний край
  float al = max(inside * mix(.74, .97, fr), inside * line);
  return vec4(col, al);
}

void main() {
  vec2 uv = gl_FragCoord.xy / R;
  float asp = R.x / R.y;
  vec2 p = (uv * 2. - 1.) * vec2(asp, 1.);

  float fb = vn(p * 1.1 + vec2(T * .025, -T * .018)) * .6 + vn(p * 2.3 + vec2(-T * .03, T * .02)) * .4;
  vec3 col = mix(cBg, cHalo, (fb - .35) * .045 * haloI);
  col = mix(col, cEdge, .22 * smoothstep(.75, 1.95, length(p * vec2(.78, 1.))));

  float halo = 0.;
  vec4 r2 = ribbon(p, P[3], P[4], P[5], halo);
  vec4 r1 = ribbon(p, P[0], P[1], P[2], halo);
  vec4 r3 = ribbon(p, P[6], P[7], P[8], halo);
  col = mix(col, cHalo, min(halo, 1.) * .16 * haloI);
  col = mix(col, r2.rgb, r2.a);
  col = mix(col, r1.rgb, r1.a);
  col = mix(col, r3.rgb, r3.a);

  col += (hash(gl_FragCoord.xy + fract(T) * 61.) - .5) * .014;
  gl_FragColor = vec4(col, 1.);
}`;

  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn('bg shader:', e.message);
    document.documentElement.classList.add('no-webgl');
    return;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['R', 'T', 'PX', 'cBg', 'cEdge', 'cDeep', 'cMid', 'cLite', 'cHalo', 'haloI'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
  U.P = gl.getUniformLocation(prog, 'P[0]') || gl.getUniformLocation(prog, 'P');

  /* ───────── палітри ───────── */
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255);
  const PAL = {
    light:  { bg: hex('#fffdfb'), edge: hex('#ffe9dd'), deep: hex('#d2320a'), mid: hex('#ff6a1a'), lite: hex('#ffc2a0'), halo: hex('#ff7a2a'), haloI: 1 },
    orange: { bg: hex('#ff6a1a'), edge: hex('#e8470a'), deep: hex('#ffb48c'), mid: hex('#fff1e8'), lite: hex('#ffffff'), halo: hex('#ffffff'), haloI: .8 }
  };
  const palCur = JSON.parse(JSON.stringify(PAL.light));
  let palTo = PAL.light;
  api.theme = t => { palTo = PAL[t] || PAL.light; };

  /* ───────── хвилі по слайдах ─────────
     Екран: x від -1.78 до 1.78 (16:9), y від -1 (низ) до 1 (верх).
     W(кут, x, y, амплітуда, частота, закрут, півширина, вигин, кінець, фаза)
       кут     — напрям стрічки в радіанах (0 — зліва направо, 1.57 — знизу вгору)
       x, y    — точка, через яку вона проходить
       кінець  — де стрічка сходить нанівець (9 — не сходить, тягнеться через весь екран)
     У кожного слайда три стрічки: головна, друга тонша, світна нитка.            */
  const W = (a, x, y, amp, f, tw, w, bend = 0, len = 9, ph = 0) => [a, x, y, 1, amp, f, tw, w, ph, bend, len];
  const WAVES = [
    // 01 Обкладинка — знизу зліва вгору направо, текст ліворуч вільний
    [W(.62, .95, .05, .22, 1.3, 1.1, .25, -.06), W(.78, 1.3, -.1, .15, 1.7, 1.6, .1, 0, 9, 1.8), W(.52, .7, .3, .25, 1.1, .6, .007, 0, 9, 3.1)],
    // 02 Розділ — широка хвиля по низу, тонка по верху
    [W(-.06, 0, -.8, .2, 1.0, .8, .22, .02), W(.05, 0, .88, .14, 1.3, 1.3, .1, 0, 9, 1.2), W(-.1, 0, -.48, .3, .8, .5, .007, 0, 9, 2.6)],
    // 03 Проблема — круто з верхнього правого кута за скляну панель
    [W(-1.15, .95, 0, .2, 1.2, 1.0, .26), W(-1.0, 1.4, .1, .16, 1.6, 1.4, .1, 0, 9, 2.2), W(-1.28, .55, 0, .22, 1.0, .5, .007, 0, 9, .7)],
    // 04 Рішення — з верхнього лівого кута вниз направо за картками
    [W(-.32, 0, .02, .25, 1.1, 1.2, .24), W(-.22, .2, -.48, .14, 1.5, 1.7, .09, 0, 9, 2.4), W(-.42, 0, .36, .25, .9, .5, .007, 0, 9, 1.1)],
    // 05 Процес — піднімається знизу справа
    [W(.18, 0, -.74, .2, 1.4, 1.4, .22, .03), W(.28, .3, -.98, .14, 1.8, 1.6, .1, 0, 9, 1.6), W(.1, 0, -.42, .28, 1.0, .5, .007, 0, 9, 3.4)],
    // 06 Цифри — майже вертикально за центральною панеллю
    [W(1.25, .12, 0, .25, 1.2, 1.0, .3), W(1.42, -.38, 0, .16, 1.6, 1.5, .1, 0, 9, 2.0), W(1.08, .55, 0, .25, 1.0, .5, .007, 0, 9, .4)],
    // 07 Продукт — з нижнього лівого кута крізь вікно
    [W(.95, -.85, 0, .22, 1.2, 1.1, .27), W(.8, -1.28, .1, .14, 1.7, 1.5, .1, 0, 9, 2.7), W(1.05, -.48, -.1, .24, 1.0, .5, .007, 0, 9, 1.3)],
    // 08 Можливості — велика горизонтальна хвиля за картками
    [W(.04, 0, -.08, .3, 1.0, 1.5, .22), W(-.06, 0, -.58, .14, 1.4, 1.9, .09, 0, 9, 1.9), W(.08, 0, .32, .25, .8, .5, .007, 0, 9, 3.6)],
    // 09 Розділ 02 (оранжевий) — дві стрічки з протилежних кутів, центр вільний
    [W(-.5, -1.05, .72, .18, 1.3, 1.0, .28, 0, 1.5), W(2.64, 1.15, -.8, .16, 1.5, 1.3, .2, 0, 1.4, 1.5), W(-.12, 0, -.7, .22, .9, .5, .006, 0, 9, 2.2)],
    // 10 Технології — знизу справа майже вертикально
    [W(1.9, 1.0, 0, .25, 1.1, 1.2, .26), W(1.75, .58, 0, .15, 1.6, 1.6, .1, 0, 9, 2.5), W(2.06, 1.38, 0, .22, 1.0, .5, .007, 0, 9, .9)],
    // 11 Порівняння — по діагоналі знизу зліва за картками
    [W(.42, .1, -.05, .22, 1.3, .9, .25), W(.5, .32, -.5, .14, 1.7, 1.4, .1, 0, 9, 2.1), W(.34, 0, .4, .24, 1.0, .5, .007, 0, 9, 3.0)],
    // 12 Висновки — низом, під картками; тонка стрічка по верху праворуч
    [W(-.1, .1, -.82, .24, .9, .9, .25, .02), W(.05, .4, .92, .12, 1.4, 1.6, .1, 0, 9, 1.6), W(-.14, 0, -.52, .24, .8, .5, .007, 0, 9, 2.6)],
    // 13 Дорожня карта — низом, а в правий верхній кут заходить хвіст
    [W(-.1, .2, -.9, .24, .9, 1.0, .25), W(2.6, 1.95, .95, .14, 1.6, 1.4, .16, 0, 1.3, 2.3), W(-.08, 0, -.62, .2, .8, .5, .007, 0, 9, .5)],
    // 14 Дякую — праворуч знизу вгору, текст ліворуч вільний
    [W(2.0, 1.08, 0, .25, 1.1, 1.1, .3), W(1.82, 1.5, .1, .15, 1.6, 1.5, .12, 0, 9, 2.4), W(.42, .5, .62, .22, 1.0, .5, .007, 0, 9, 1.0)],
    // 15 Дякую (оранжевий) — праворуч знизу вгору, текст ліворуч вільний
    [W(2.0, 1.08, 0, .25, 1.1, 1.1, .3), W(1.82, 1.5, .1, .15, 1.6, 1.5, .12, 0, 9, 2.4), W(.42, .5, .62, .22, 1.0, .5, .007, 0, 9, 1.0)]
  ];

  const cur = WAVES[0].map(r => r.slice());
  const vel = WAVES[0].map(r => r.map(() => 0));   // швидкості для пружини
  let target = WAVES[0];
  let kick = 0, kickVel = 0, kickTo = 0;            // поштовх теж плавно наростає й спадає
  const SPEED = [.34, .46, .26];
  const phase = [0, 0, 0];

  api.scene = () => {
    const slides = [...document.querySelectorAll('.slide')];
    const i = Math.max(0, slides.indexOf(document.querySelector('.slide.is-active')));
    target = WAVES[i % WAVES.length].map((r, k) => {
      const t = r.slice();
      // кут — найкоротшим шляхом. Стрічка без хвоста (кінець 9) виглядає однаково,
      // якщо її повернути на пів оберту, тож для неї досить обертатися в межах ±90°
      const period = t[10] >= 9 && cur[k][10] >= 9 ? Math.PI : Math.PI * 2;
      t[0] += period * Math.round((cur[k][0] - t[0]) / period);
      return t;
    });
  };
  api.kick = (s = 1) => { kickTo = Math.max(kickTo, s); };
  addEventListener('pointerdown', () => api.kick(.35));

  /* ───────── курсор ───────── */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => {
    mouse.tx = (e.clientX / innerWidth - .5) * 2;
    mouse.ty = (.5 - e.clientY / innerHeight) * 2;
  }, { passive: true });

  /* ───────── роздільність: якщо не встигає — крок униз ───────── */
  const DPR = Math.min(devicePixelRatio || 1, 1.5);
  const LEVELS = [.75, .55, .4];
  let level = 0;
  function resize() {
    const q = LEVELS[level] * DPR;
    cv.width = Math.max(2, Math.round(innerWidth * q));
    cv.height = Math.max(2, Math.round(innerHeight * q));
    gl.viewport(0, 0, cv.width, cv.height);
  }
  resize();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 80); });

  /* ───────── кадр ───────── */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = performance.now(), lastDraw = 0, time = 0;
  let slow = 0, sampled = 0;
  const data = new Float32Array(36);

  function frame(ms) {
    requestAnimationFrame(frame);
    if (ms - lastDraw < 15.5 || document.hidden) return;   // не частіше 60 к/с
    lastDraw = ms;
    const dt = Math.min(.1, (ms - last) / 1000); last = ms;
    const rate = reduced ? .25 : 1;
    time += dt * rate;

    if (level < LEVELS.length - 1 && dt < .2) {
      sampled++; if (dt > .028) slow++;
      if (sampled >= 120) { if (slow > 70) { level++; resize(); } sampled = 0; slow = 0; }
    }

    // пружини з критичним загасанням: рух м'яко розганяється й м'яко сідає, без перельоту.
    // Рахуємо дрібними кроками, щоб на повільних кадрах не тремтіло.
    const SUB = Math.max(1, Math.ceil(dt / .016)), h = dt / SUB;
    const KS = 6.5, DS = 2 * Math.sqrt(KS);           // хвиля сідає за ~1,5 с
    const KK = 9, DK = 2 * Math.sqrt(KK);             // поштовх
    for (let s = 0; s < SUB; s++) {
      kickTo += (0 - kickTo) * (1 - Math.exp(-h * 2.4));
      kickVel += ((kickTo - kick) * KK - kickVel * DK) * h; kick += kickVel * h;
      for (let i = 0; i < 3; i++) {
        const c = cur[i], v = vel[i], tg = target[i];
        for (let j = 0; j < c.length; j++) { v[j] += ((tg[j] - c[j]) * KS - v[j] * DS) * h; c[j] += v[j] * h; }
      }
    }
    const kp = Math.max(0, kick);
    const k = 1 - Math.exp(-dt * 2.1);
    const km = 1 - Math.exp(-dt * 2.5);
    mouse.x += (mouse.tx - mouse.x) * km;
    mouse.y += (mouse.ty - mouse.y) * km;

    for (const key in palTo) {
      if (key === 'haloI') palCur.haloI += (palTo.haloI - palCur.haloI) * k * 1.3;
      else for (let j = 0; j < 3; j++) palCur[key][j] += (palTo[key][j] - palCur[key][j]) * k * 1.3;
    }

    for (let i = 0; i < 3; i++) {
      const c = cur[i];
      phase[i] += dt * rate * SPEED[i] * (1 + 1.2 * kp);
      const o = i * 12, depth = 1 + i * .6;
      const sway = Math.sin(time * .17 + i * 2.1) * .05;      // уся хвиля повільно гойдається
      data[o] = c[0] + sway * .4;
      data[o + 1] = c[1] + mouse.x * .035 * depth;
      data[o + 2] = c[2] + mouse.y * .025 * depth + sway * .3;
      data[o + 3] = c[3];
      data[o + 4] = c[4] * (1 + .1 * kp);
      data[o + 5] = c[5];
      data[o + 6] = c[6] * (1 + .15 * kp);
      data[o + 7] = c[7];
      data[o + 8] = phase[i] + c[8];
      data[o + 9] = c[9];
      data[o + 10] = c[10];
      data[o + 11] = 0;
    }

    gl.uniform2f(U.R, cv.width, cv.height);
    gl.uniform1f(U.T, time + 20);
    gl.uniform1f(U.PX, 2 / cv.height);
    gl.uniform4fv(U.P, data);
    gl.uniform3fv(U.cBg, palCur.bg); gl.uniform3fv(U.cEdge, palCur.edge);
    gl.uniform3fv(U.cDeep, palCur.deep); gl.uniform3fv(U.cMid, palCur.mid);
    gl.uniform3fv(U.cLite, palCur.lite); gl.uniform3fv(U.cHalo, palCur.halo);
    gl.uniform1f(U.haloI, palCur.haloI);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);

  // службове: Bg.bench(n) — середній час кадру на GPU, мс; Bg.debug() — стан хвилі
  api.bench = (n = 12) => {
    const px = new Uint8Array(4);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { gl.uniform1f(U.T, time + i * .016); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { msPerFrame: +((performance.now() - t0) / n).toFixed(2), size: [cv.width, cv.height], level };
  };
  api.debug = () => ({ cur: cur.map(r => r.map(v => +v.toFixed(2))), kick: +kick.toFixed(2), level, pal: palTo === PAL.light ? 'light' : 'orange' });
})();
