/* ════════════════════════════════════════════════════════════════════════════
   CRONOVA · Globo
   Un mundo limpio en hexágonos. Colombia con más detalle, tus paradas como
   pines y el recorrido en arcos finos. Se maneja con un dedo (girar) y
   pellizcando (acercar). Nada más.
   Usa three.js r128 + OrbitControls (js/vendor).
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const R = 1;
  const COL = { lat: 4.6, lon: -74.0 };
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.anim === "reducidas";
  const ease = t => 1 - Math.pow(1 - t, 3);
  function vec(lat, lon, r) {
    const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  }
  function latLonOf(v) { const n = v.clone().normalize(); const lat = 90 - Math.acos(n.y) * 180 / Math.PI;
    let lon = Math.atan2(n.z, -n.x) * 180 / Math.PI - 180; if (lon < -180) lon += 360; return { lat, lon }; }
  function css() {
    const s = getComputedStyle(document.documentElement); const g = (n, d) => (s.getPropertyValue(n).trim() || d);
    return { acc: g("--acc", "#4f46e5"), acc2: g("--acc-2", "#7c3aed") };
  }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function create(canvas, overlay, geo, world) {
    if (!window.THREE || !THREE.OrbitControls) throw new Error("three");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.09;
    controls.minDistance = 1.12; controls.maxDistance = 4.2; controls.zoomSpeed = 0.7;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    let C = css();

    // ---------- Esfera (azul suave, como el mundo de Shopify) ----------
    const globeMat = new THREE.ShaderMaterial({
      uniforms: { cA: { value: new THREE.Color("#eef5ff") }, cB: { value: new THREE.Color("#b9d3fb") }, cRim: { value: new THREE.Color("#c7d7ff") } },
      vertexShader: "varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(normalMatrix*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }",
      fragmentShader: "uniform vec3 cA; uniform vec3 cB; uniform vec3 cRim; varying vec3 vN; varying vec3 vW; void main(){ float l = clamp(dot(vN, normalize(vec3(-.45,.6,.65)))*.5+.5,0.,1.); vec3 c = mix(cB, cA, l); float rim = pow(1.-max(dot(vN, vec3(0.,0.,1.)),0.), 2.5); c = mix(c, cRim, rim*.35); gl_FragColor = vec4(c,1.); }"
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), globeMat); scene.add(globe);
    // halo exterior
    const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 64), new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(C.acc) } }, side: THREE.BackSide, transparent: true, depthWrite: false,
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: "uniform vec3 c; varying vec3 vN; void main(){ float i = pow(max(0., .78 - dot(vN, vec3(0.,0.,1.))), 2.2); gl_FragColor = vec4(c, i*.28); }"
    }));
    scene.add(halo);

    // ---------- Hexágonos ----------
    const dummy = new THREE.Object3D();
    function hexMesh(arr, size, colorFn) {
      const n = arr.length / 2;
      const mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(size, 6), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
      const col = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const lat = arr[i * 2] / 100, lon = arr[i * 2 + 1] / 100;
        const p = vec(lat, lon, R * 1.0015); dummy.position.copy(p); dummy.lookAt(p.clone().multiplyScalar(2)); dummy.rotateZ(Math.PI / 6); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix); colorFn(lat, lon, col, i); mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return mesh;
    }
    const mint = new THREE.Color("#7fe3c9"), teal = new THREE.Color("#5fb8e8");
    const worldHex = hexMesh(world.mundo, 0.0052, (lat, lon, c) => { c.copy(mint).lerp(teal, Math.min(1, Math.max(0, (40 - lat) / 95))); });
    scene.add(worldHex);
    let colHex = null;
    function paintCol() {
      if (colHex) { scene.remove(colHex); colHex.geometry.dispose(); colHex.material.dispose(); }
      const a = new THREE.Color(C.acc), b = new THREE.Color(C.acc2), w = new THREE.Color("#ffffff");
      colHex = hexMesh(world.colombia, 0.0055, (lat, lon, c) => { c.copy(a).lerp(b, (lat + 4) / 17).lerp(w, .18); });
      scene.add(colHex);
    }
    paintCol();

    // ---------- Municipios (puntos que aparecen al acercarte) ----------
    const mun = geo.mun;
    const mp = new Float32Array(mun.length * 3);
    mun.forEach((m, i) => { const v = vec(m[2], m[3], R * 1.0025); mp[i * 3] = v.x; mp[i * 3 + 1] = v.y; mp[i * 3 + 2] = v.z; });
    const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(mp, 3));
    const dotC = document.createElement("canvas"); dotC.width = dotC.height = 32; const dx = dotC.getContext("2d");
    dx.fillStyle = "#fff"; dx.beginPath(); dx.arc(16, 16, 13, 0, Math.PI * 2); dx.fill();
    const mMat = new THREE.PointsMaterial({ color: new THREE.Color("#ffffff"), size: 0.006, map: new THREE.CanvasTexture(dotC), transparent: true, alphaTest: .3, opacity: 0, depthWrite: false });
    const munPts = new THREE.Points(mg, mMat); scene.add(munPts);

    // ---------- Recorrido ----------
    const routeG = new THREE.Group(); scene.add(routeG);
    let movers = [], growers = [];
    function arcCurve(a, b) {
      const A = vec(a.lat, a.lon, 1), B = vec(b.lat, b.lon, 1);
      const ang = A.angleTo(B); const h = 0.012 + ang * 0.42;
      const pts = [];
      for (let i = 0; i <= 64; i++) { const t = i / 64; const p = new THREE.Vector3().copy(A).lerp(B, t).normalize(); // slerp aproximado
        p.multiplyScalar(R * 1.003 + Math.sin(Math.PI * t) * h); pts.push(p); }
      return new THREE.CatmullRomCurve3(pts);
    }
    function clearRoute() { while (routeG.children.length) { const o = routeG.children.pop(); o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); } movers = []; growers = []; }

    // ---------- Pines (HTML, siempre nítidos) ----------
    let pins = [];
    function clearPins(kind) { pins = pins.filter(p => { if (!kind || p.kind === kind) { p.el.remove(); return false; } return true; }); }
    function addPin(lat, lon, html, cls, kind, onClick, title) {
      const el = document.createElement("button"); el.type = "button"; el.className = "pin " + (cls || ""); el.innerHTML = html;
      if (title) { el.title = title; el.setAttribute("aria-label", title); }
      el.addEventListener("click", e => { e.stopPropagation(); onClick && onClick(); });
      overlay.appendChild(el); const p = { el, pos: vec(lat, lon, R * 1.004), kind }; pins.push(p); return p;
    }
    const api = { onPick: null, onPin: null };
    function setHome(h) {
      clearPins("home"); if (!h || h.lat == null) return;
      addPin(h.lat, h.lon, '<svg viewBox="0 0 24 24"><path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/></svg>', "home", "home", () => api.onPin && api.onPin({ home: true, loc: h }), "Tu casa: " + h.name);
    }
    function setRoute(stops, legs) {
      clearRoute(); clearPins("stop");
      const c1 = new THREE.Color(C.acc), c2 = new THREE.Color(C.acc2);
      (legs || []).forEach((lg, i) => {
        const curve = arcCurve(lg.a, lg.b);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.0011, 6, false), new THREE.MeshBasicMaterial({ color: i % 2 ? c2 : c1 }));
        routeG.add(tube);
        if (!reduce()) { tube.geometry.setDrawRange(0, 0); growers.push({ m: tube, total: tube.geometry.index.count, t0: performance.now() + i * 260 }); }
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.visible = !reduce(); routeG.add(dot); movers.push({ m: dot, c: curve, o: i * .37 });
      });
      (stops || []).forEach(s => { if (s.home) return;
        addPin(s.lat, s.lon, `<b>${esc(s.num)}</b>`, "stop", "stop", () => api.onPin && api.onPin(s), s.label); });
    }

    // ---------- Cámara ----------
    let anim = null;
    function goTo(lat, lon, dist, instant) {
      const toDir = vec(lat, lon, 1).normalize(); const fromDir = camera.position.clone().normalize();
      const fromD = camera.position.length(), toD = dist || fromD;
      if (instant || reduce()) { camera.position.copy(toDir.multiplyScalar(toD)); controls.update(); return; }
      anim = { t0: performance.now(), dur: 900, fromDir, toDir, fromD, toD };
    }
    const VIEWS = { colombia: [COL.lat - 1, COL.lon, 2.15], mundo: [COL.lat + 10, COL.lon - 8, 3.7] };
    goTo(VIEWS.colombia[0], VIEWS.colombia[1], VIEWS.colombia[2], true);

    // ---------- Toque: elegir un punto ----------
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
    canvas.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; anim = null; });
    canvas.addEventListener("pointerup", e => {
      if (!down) return; const mv = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (mv > 6 || dt > 500) return;
      const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(globe, false)[0];
      if (!hit) { api.onPick && api.onPick(null); return; }
      const ll = latLonOf(hit.point); api.onPick && api.onPick(ll, { x: e.clientX - r.left, y: e.clientY - r.top });
    });
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    // ---------- Bucle ----------
    let running = false, raf = 0;
    function resize() { const b = canvas.parentElement.getBoundingClientRect(); if (!b.width || !b.height) return;
      renderer.setSize(b.width, b.height, false); camera.aspect = b.width / b.height; camera.updateProjectionMatrix(); }
    new ResizeObserver(resize).observe(canvas.parentElement);
    const tmp = new THREE.Vector3(), camN = new THREE.Vector3();
    function frame(now) {
      if (!running) return; raf = requestAnimationFrame(frame);
      if (anim) { const k = Math.min(1, (now - anim.t0) / anim.dur), e = ease(k);
        const dir = anim.fromDir.clone().lerp(anim.toDir, e).normalize(); camera.position.copy(dir.multiplyScalar(anim.fromD + (anim.toD - anim.fromD) * e));
        if (k >= 1) anim = null; }
      const dist = camera.position.length();
      controls.rotateSpeed = Math.max(0.08, Math.min(0.9, (dist - 1) * 0.55));   // más lento cuando estás cerca: no se enreda
      controls.update();
      // municipios: aparecen al acercarte
      mMat.opacity = Math.max(0, Math.min(.85, (1.75 - dist) * 2.2)); munPts.visible = mMat.opacity > .02;
      mMat.size = Math.max(0.0028, (dist - 1) * 0.009);
      growers = growers.filter(g => { const k = Math.max(0, Math.min(1, (now - g.t0) / 1000)); g.m.geometry.setDrawRange(0, Math.floor(ease(k) * g.total / 3) * 3); return k < 1; });
      if (!reduce()) movers.forEach(m => { m.m.visible = true; m.m.position.copy(m.c.getPointAt(((now * 0.00016) + m.o) % 1)); });
      renderer.render(scene, camera);
      const w = canvas.clientWidth, h = canvas.clientHeight; camN.copy(camera.position).normalize();
      pins.forEach(p => { const facing = tmp.copy(p.pos).normalize().dot(camN) > 0.12;
        tmp.copy(p.pos).project(camera);
        p.el.style.opacity = facing ? 1 : 0; p.el.style.pointerEvents = facing ? "auto" : "none";
        p.el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`; });
    }
    function screenOf(lat, lon) { tmp.copy(vec(lat, lon, R)).project(camera); return { x: (tmp.x + 1) / 2 * canvas.clientWidth, y: (1 - tmp.y) / 2 * canvas.clientHeight }; }

    Object.assign(api, {
      start() { if (running) return; running = true; resize(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      setHome, setRoute, screenOf,
      flyTo(lat, lon, dist) { goTo(lat, lon, dist || 1.6); },
      view(name) { const v = VIEWS[name] || VIEWS.colombia; goTo(v[0], v[1], v[2]); },
      fit(points) {
        if (!points.length) return api.view("colombia");
        let la = 0, lo = 0; points.forEach(p => { la += p.lat; lo += p.lon; }); la /= points.length; lo /= points.length;
        let maxA = 0; const c = vec(la, lo, 1); points.forEach(p => { maxA = Math.max(maxA, c.angleTo(vec(p.lat, p.lon, 1))); });
        goTo(la, lo, Math.max(1.75, Math.min(2.8, 1.45 + maxA * 4.5)));
      },
      zoom(f) { const d = Math.max(controls.minDistance, Math.min(controls.maxDistance, 1 + (camera.position.length() - 1) * f)); const ll = latLonOf(camera.position); goTo(ll.lat, ll.lon, d); },
      setTheme() { C = css(); halo.material.uniforms.c.value.set(C.acc); paintCol(); }
    });
    return api;
  }
  window.CronovaMapa = { create };
})();
