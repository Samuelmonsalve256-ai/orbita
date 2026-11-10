/* ════════════════════════════════════════════════════════════════════════════
   CRONOVA · Mapa 3D de Colombia
   Colombia sola, flotando como un mundo propio: departamentos en relieve,
   1.122 municipios como puntos de luz, tu casa y el recorrido del mes.
   Usa three.js r128 + OrbitControls (en js/vendor).
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const LAT0 = 4.6, LON0 = -73.3, COS0 = Math.cos(LAT0 * Math.PI / 180);
  const H = 0.22;                       // altura del relieve
  const TOP = H + 0.004;                // superficie superior
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.anim === "reducidas";
  const toX = lon => (lon - LON0) * COS0;
  const toZ = lat => -(lat - LAT0);
  const v3 = (lat, lon, y) => new THREE.Vector3(toX(lon), y, toZ(lat));
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function cssColors() {
    const s = getComputedStyle(document.documentElement);
    const g = n => s.getPropertyValue(n).trim() || "#888";
    return { bg: g("--bg"), land: g("--map-land"), top: g("--map-top"), edge: g("--map-edge"), dot: g("--map-dot"), floor: g("--map-floor"),
      acc: g("--acc"), acc2: g("--acc-2"), hot: g("--hot"), fg: g("--fg") };
  }
  function dotTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.45, "rgba(255,255,255,.95)"); gr.addColorStop(.6, "rgba(255,255,255,.25)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
  }
  function glowTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d"); const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,255,255,.55)"); gr.addColorStop(.5, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  }

  function create(canvas, labelsEl, data) {
    if (!window.THREE || !THREE.OrbitControls) throw new Error("three");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 400);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.screenSpacePanning = false;
    controls.minDistance = 1.2; controls.maxDistance = 40;
    controls.maxPolarAngle = 1.22;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.zoomSpeed = 0.9; controls.panSpeed = 0.9; controls.rotateSpeed = 0.6;

    let C = cssColors();
    scene.fog = new THREE.Fog(C.bg, 30, 75);
    const amb = new THREE.AmbientLight(0xffffff, 0.75); scene.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(-6, 14, 8); scene.add(sun);
    const rim = new THREE.PointLight(new THREE.Color(C.acc), 0.9, 40); rim.position.set(6, 6, -10); scene.add(rim);

    // ---------- Suelo, halo y estrellas ----------
    const glowTex = glowTexture();
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(C.acc), transparent: true, opacity: .55, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.set(0, -0.06, 0.5); scene.add(halo);
    const grid = new THREE.GridHelper(80, 80, new THREE.Color(C.edge), new THREE.Color(C.edge));
    grid.material.transparent = true; grid.material.opacity = 0.07; grid.position.y = -0.08; scene.add(grid);
    const starGeo = new THREE.BufferGeometry(); const sp = [];
    for (let i = 0; i < 900; i++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 1.6 - 0.6), r = 55 + Math.random() * 40;
      sp.push(r * Math.sin(ph) * Math.cos(th), Math.abs(r * Math.cos(ph)) * 0.6 + 4, r * Math.sin(ph) * Math.sin(th)); }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: new THREE.Color(C.fg), size: 0.18, transparent: true, opacity: .5, fog: false }));
    scene.add(stars);

    // ---------- Departamentos en relieve ----------
    const world = new THREE.Group(); scene.add(world);
    const sideMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(C.land) });
    const deptMeshes = [];
    const edgeGeoPts = [];
    data.depts.forEach((d, di) => {
      const topMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(C.top), emissive: new THREE.Color(C.acc), emissiveIntensity: 0 });
      d.p.forEach(ring => {
        const shape = new THREE.Shape(ring.map(([lon, lat]) => new THREE.Vector2(toX(lon), lat - LAT0)));
        const g = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false });
        g.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(g, [topMat, sideMat]); m.userData = { dept: d, idx: di };
        world.add(m); deptMeshes.push(m);
        for (let i = 0; i < ring.length - 1; i++) {
          edgeGeoPts.push(toX(ring[i][0]), TOP + .002, toZ(ring[i][1]), toX(ring[i + 1][0]), TOP + .002, toZ(ring[i + 1][1]));
        }
      });
    });
    const edgeGeo = new THREE.BufferGeometry(); edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgeGeoPts, 3));
    const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(C.edge), transparent: true, opacity: .55 }));
    world.add(edges);

    // ---------- Municipios (puntos de luz) ----------
    const dotTex = dotTexture();
    const mun = data.mun;
    const mPos = new Float32Array(mun.length * 3), mCol = new Float32Array(mun.length * 3);
    function paintDots() {
      const cd = new THREE.Color(C.dot), cc = new THREE.Color(C.acc2);
      mun.forEach((m, i) => { const c = m[4] ? cc : cd; mCol[i * 3] = c.r; mCol[i * 3 + 1] = c.g; mCol[i * 3 + 2] = c.b; });
    }
    mun.forEach((m, i) => { mPos[i * 3] = toX(m[3]); mPos[i * 3 + 1] = TOP + .012; mPos[i * 3 + 2] = toZ(m[2]); });
    paintDots();
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute("position", new THREE.BufferAttribute(mPos, 3));
    mGeo.setAttribute("color", new THREE.BufferAttribute(mCol, 3));
    const mMat = new THREE.PointsMaterial({ size: 0.075, map: dotTex, vertexColors: true, transparent: true, opacity: .85, depthWrite: false, alphaTest: 0.05 });
    const munPts = new THREE.Points(mGeo, mMat); world.add(munPts);

    // ---------- Marcadores ----------
    const markers = new THREE.Group(); world.add(markers);
    const routeGroup = new THREE.Group(); world.add(routeGroup);
    let labels = [], movers = [], growers = [];
    function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose && !o.material.__shared) o.material.dispose(); }); } }
    function addLabel(html, pos, cls) {
      const el = document.createElement("div"); el.className = "mlbl " + (cls || ""); el.innerHTML = html; labelsEl.appendChild(el);
      const L = { el, pos }; labels.push(L); return L;
    }
    function removeLabels(filter) { labels = labels.filter(l => { if (filter(l)) { l.el.remove(); return false; } return true; }); }

    // Casa
    const homeGroup = new THREE.Group(); world.add(homeGroup);
    let homeLabel = null, homePos = null;
    function setHome(h) {
      clearGroup(homeGroup); if (homeLabel) { removeLabels(l => l === homeLabel); homeLabel = null; }
      if (!h || h.lat == null) return;
      homePos = v3(h.lat, h.lon, TOP);
      const col = new THREE.Color(C.acc2);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 1.1, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.copy(homePos).add(new THREE.Vector3(0, .55, 0));
      const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), new THREE.MeshBasicMaterial({ color: col }));
      head.position.copy(homePos).add(new THREE.Vector3(0, 1.12, 0));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.13, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.copy(homePos).add(new THREE.Vector3(0, .01, 0));
      homeGroup.add(beam, head, ring);
      homeLabel = addLabel('<span class="num">⌂</span>' + esc(h.name || "Casa"), homePos.clone().add(new THREE.Vector3(0, 1.2, 0)), "home");
    }

    // Selección de un municipio
    const pickRing = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.hot), side: THREE.DoubleSide, transparent: true }));
    pickRing.rotation.x = -Math.PI / 2; pickRing.visible = false; world.add(pickRing);

    // Ruta
    function setRoute(stops, legs) {
      clearGroup(routeGroup); removeLabels(l => l.route); movers = []; growers = [];
      const cA = new THREE.Color(C.acc), cB = new THREE.Color(C.acc2), cH = new THREE.Color(C.hot);
      (legs || []).forEach((lg, i) => {
        let curve, color = lg.mode === "vuelo" ? cB : cA;
        if (lg.geom && lg.geom.length > 1) {
          const step = Math.max(1, Math.floor(lg.geom.length / 240));
          const pts = []; for (let k = 0; k < lg.geom.length; k += step) pts.push(v3(lg.geom[k][1], lg.geom[k][0], TOP + .03));
          const last = lg.geom[lg.geom.length - 1]; pts.push(v3(last[1], last[0], TOP + .03));
          curve = new THREE.CatmullRomCurve3(pts);
        } else {
          const A = v3(lg.a.lat, lg.a.lon, TOP + .03), B = v3(lg.b.lat, lg.b.lon, TOP + .03);
          const M = A.clone().add(B).multiplyScalar(.5); M.y += 0.25 + A.distanceTo(B) * 0.22;
          curve = new THREE.QuadraticBezierCurve3(A, M, B);
        }
        const segs = 200;
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, lg.mode === "vuelo" ? 0.016 : 0.024, 8, false), new THREE.MeshBasicMaterial({ color }));
        const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, 0.07, 8, false),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .14, blending: THREE.AdditiveBlending, depthWrite: false }));
        routeGroup.add(tube, glow);
        const total = tube.geometry.index.count;
        if (!reduce()) { tube.geometry.setDrawRange(0, 0); glow.geometry.setDrawRange(0, 0); growers.push({ meshes: [tube, glow], total, t0: performance.now() + i * 220 }); }
        const mv = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        mv.visible = !reduce(); routeGroup.add(mv); movers.push({ m: mv, c: curve, o: i * 0.31 });
      });
      (stops || []).forEach(s => {
        if (s.home) return;
        const p = v3(s.lat, s.lon, TOP);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8), new THREE.MeshBasicMaterial({ color: cH, transparent: true, opacity: .7 }));
        pin.position.copy(p).add(new THREE.Vector3(0, .25, 0));
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 18), new THREE.MeshBasicMaterial({ color: cH }));
        ball.position.copy(p).add(new THREE.Vector3(0, .52, 0));
        const base = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.09, 36), new THREE.MeshBasicMaterial({ color: cH, side: THREE.DoubleSide, transparent: true, opacity: .8 }));
        base.rotation.x = -Math.PI / 2; base.position.copy(p).add(new THREE.Vector3(0, .01, 0));
        routeGroup.add(pin, ball, base);
        const L = addLabel('<span class="num">' + s.num + '</span>' + esc(s.label), p.clone().add(new THREE.Vector3(0, .6, 0)));
        L.route = true;
      });
    }

    // ---------- Cámara ----------
    let tilted = true, anim = null;
    function setView(target, dist, polar, azim, instant) {
      const sph = new THREE.Spherical(dist, polar, azim);
      const camTo = new THREE.Vector3().setFromSpherical(sph).add(target);
      if (instant || reduce()) { controls.target.copy(target); camera.position.copy(camTo); controls.update(); return; }
      anim = { t0: performance.now(), dur: 850, fromT: controls.target.clone(), toT: target.clone(), fromC: camera.position.clone(), toC: camTo };
    }
    function currentSph() { const off = camera.position.clone().sub(controls.target); return new THREE.Spherical().setFromVector3(off); }
    function flyTo(lat, lon, dist) {
      const s = currentSph();
      setView(v3(lat, lon, 0), dist || 3.2, tilted ? Math.min(s.phi, .95) || .85 : 0.02, s.theta);
    }
    function fitPoints(pts) {
      if (!pts.length) return home();
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
      pts.forEach(p => { a = Math.min(a, p.lat); b = Math.max(b, p.lat); c = Math.min(c, p.lon); d = Math.max(d, p.lon); });
      const span = Math.max(b - a, (d - c) * COS0, 1.2);
      const s = currentSph();
      setView(v3((a + b) / 2, (c + d) / 2, 0), span * 1.55 + 2.2, tilted ? .8 : .02, s.theta);
    }
    function home() { setView(v3(4.2, -73.6, 0), 21, tilted ? .72 : .02, 0); }
    function toggleTilt() { tilted = !tilted; const s = currentSph(); setView(controls.target.clone(), s.radius, tilted ? .8 : .02, s.theta); return tilted; }
    function zoom(f) { const s = currentSph(); setView(controls.target.clone(), Math.max(controls.minDistance, Math.min(controls.maxDistance, s.radius * f)), s.phi, s.theta); }
    home(); setView(v3(4.2, -73.6, 0), 21, .72, 0, true);

    // límites para no perderse
    controls.addEventListener("change", () => {
      const t = controls.target; const cx = Math.max(-10, Math.min(8, t.x)), cz = Math.max(-10, Math.min(10, t.z));
      if (cx !== t.x || cz !== t.z) { const dx = cx - t.x, dz = cz - t.z; t.x = cx; t.z = cz; camera.position.x += dx; camera.position.z += dz; }
    });

    // ---------- Selección con el puntero ----------
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    let downAt = null, hoverDept = null; const api = { onPick: null, onHoverDept: null };
    function setNdc(e) { const r = canvas.getBoundingClientRect(); ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1; return r; }
    function nearestMuni(p) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < mun.length; i++) { const dx = mPos[i * 3] - p.x, dz = mPos[i * 3 + 2] - p.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
      return { i: best, d: Math.sqrt(bd) };
    }
    canvas.addEventListener("pointerdown", e => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; anim = null; });
    canvas.addEventListener("pointerup", e => {
      if (!downAt) return; const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y); const dt = performance.now() - downAt.t; downAt = null;
      if (moved > 6 || dt > 500 || e.button === 2) return;
      const r = setNdc(e); ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(deptMeshes, false);
      if (!hits.length) { pickRing.visible = false; api.onPick && api.onPick(null); return; }
      const nm = nearestMuni(hits[0].point);
      if (nm.i < 0 || nm.d > 0.6) { pickRing.visible = false; api.onPick && api.onPick(null); return; }
      const m = mun[nm.i]; selectIdx(nm.i);
      api.onPick && api.onPick(m, { x: e.clientX - r.left, y: e.clientY - r.top });
    });
    function selectIdx(i) { pickRing.position.set(mPos[i * 3], TOP + .015, mPos[i * 3 + 2]); pickRing.visible = true; }
    let lastMove = 0;
    canvas.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse" || e.buttons) return; const now = performance.now(); if (now - lastMove < 60) return; lastMove = now;
      setNdc(e); ray.setFromCamera(ndc, camera); const hits = ray.intersectObjects(deptMeshes, false);
      const d = hits.length ? hits[0].object.userData.idx : null;
      if (d !== hoverDept) {
        deptMeshes.forEach(m => { m.material[0].emissiveIntensity = (d != null && m.userData.idx === d) ? .22 : 0; });
        hoverDept = d; api.onHoverDept && api.onHoverDept(d != null ? data.depts[d] : null, e);
      } else if (d != null) api.onHoverDept && api.onHoverDept(data.depts[d], e);
    });
    canvas.addEventListener("pointerleave", () => { deptMeshes.forEach(m => m.material[0].emissiveIntensity = 0); hoverDept = null; api.onHoverDept && api.onHoverDept(null); });
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    // ---------- Tema ----------
    function setTheme() {
      C = cssColors();
      scene.fog.color.set(C.bg); halo.material.color.set(C.acc); grid.material.color.set(C.edge); rim.color.set(C.acc);
      sideMat.color.set(C.land); deptMeshes.forEach(m => { m.material[0].color.set(C.top); m.material[0].emissive.set(C.acc); });
      edges.material.color.set(C.edge); stars.material.color.set(C.fg); paintDots(); mGeo.attributes.color.needsUpdate = true;
      pickRing.material.color.set(C.hot);
      const light = document.documentElement.dataset.tema === "claro";
      amb.intensity = light ? 1.0 : .75; stars.visible = !light; grid.material.opacity = light ? .12 : .07;
      mMat.opacity = light ? .95 : .85;
    }
    setTheme();

    // ---------- Bucle ----------
    let running = false, raf = 0;
    function resize() {
      const r = canvas.parentElement.getBoundingClientRect(); if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas.parentElement);
    const tmp = new THREE.Vector3();
    function frame(now) {
      if (!running) return; raf = requestAnimationFrame(frame);
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / anim.dur), e = easeOut(k);
        controls.target.lerpVectors(anim.fromT, anim.toT, e); camera.position.lerpVectors(anim.fromC, anim.toC, e);
        if (k >= 1) anim = null;
      }
      controls.update();
      growers = growers.filter(g => { const k = Math.max(0, Math.min(1, (now - g.t0) / 900)); const n = Math.floor(easeOut(k) * g.total / 3) * 3;
        g.meshes.forEach(m => m.geometry.setDrawRange(0, n)); return k < 1; });
      if (!reduce()) movers.forEach(mv => { mv.m.visible = true; mv.m.position.copy(mv.c.getPointAt(((now * 0.00018) + mv.o) % 1)); });
      // tamaño de los puntos según la distancia
      const dist = camera.position.distanceTo(controls.target);
      mMat.size = Math.max(0.035, Math.min(0.11, dist * 0.0075));
      renderer.render(scene, camera);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      labels.forEach(L => {
        tmp.copy(L.pos).project(camera);
        const vis = tmp.z < 1 && tmp.x > -1.1 && tmp.x < 1.1 && tmp.y > -1.1 && tmp.y < 1.1;
        L.el.style.opacity = vis ? 1 : 0;
        if (vis) L.el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%, calc(-100% - 4px))`;
      });
    }
    function screenOf(lat, lon) { tmp.copy(v3(lat, lon, TOP)).project(camera); return { x: (tmp.x + 1) / 2 * canvas.clientWidth, y: (1 - tmp.y) / 2 * canvas.clientHeight }; }

    Object.assign(api, {
      start() { if (running) return; running = true; resize(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      setHome, setRoute, setTheme, flyTo, fitPoints, home, toggleTilt, zoom, screenOf,
      selectMuni(m) { const i = mun.indexOf(m); if (i >= 0) selectIdx(i); },
      clearPick() { pickRing.visible = false; }
    });
    return api;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  window.CronovaMapa = { create };
})();
