/* ════════════════════════════════════════════════════════════════════════════
   CRONOVA · Planeta Colombia
   Todo el planeta es Colombia: el país se proyecta en grande sobre la esfera,
   con sus regiones de color, los límites de los departamentos, las capitales
   y los municipios. Las rutas son arcos con degradado que fluye en la
   dirección del viaje. Se maneja con un dedo (girar) y pellizcando (acercar).
   Usa three.js r128 + OrbitControls (js/vendor).
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  const R = 1, S = 7;                    // S: cuánto se agranda Colombia sobre la esfera
  const LAT0 = 4.3, LON0 = -73.6;        // centro del país
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.anim === "reducidas";
  const ease = t => 1 - Math.pow(1 - t, 3);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function sph(slat, slon, r) { const phi = (90 - slat) * Math.PI / 180, th = (slon + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); }
  const P = (lat, lon, r) => sph((lat - LAT0) * S, (lon - LON0) * S, r);          // lugar real → planeta
  function real(v) { const n = v.clone().normalize(); const slat = 90 - Math.acos(n.y) * 180 / Math.PI;
    let slon = Math.atan2(n.z, -n.x) * 180 / Math.PI - 180; if (slon < -180) slon += 360; return { lat: slat / S + LAT0, lon: slon / S + LON0 }; }
  const REGION = { "08": "caribe", "13": "caribe", "20": "caribe", "23": "caribe", "44": "caribe", "47": "caribe", "70": "caribe",
    "05": "andina", "11": "andina", "15": "andina", "17": "andina", "25": "andina", "41": "andina", "54": "andina", "63": "andina", "66": "andina", "68": "andina", "73": "andina",
    "19": "pacifico", "27": "pacifico", "52": "pacifico", "76": "pacifico", "50": "orinoquia", "81": "orinoquia", "85": "orinoquia", "99": "orinoquia",
    "18": "amazonia", "86": "amazonia", "91": "amazonia", "94": "amazonia", "95": "amazonia", "97": "amazonia", "88": "insular" };
  const REG_COL = { caribe: "#f5c46b", pacifico: "#4fc9b9", orinoquia: "#a5dc7c", amazonia: "#3fb68a", insular: "#6cc3f2" };
  const REG_NAME = { andina: "Andina", caribe: "Caribe", pacifico: "Pacífico", orinoquia: "Orinoquía", amazonia: "Amazonía", insular: "Insular" };
  function css() { const s = getComputedStyle(document.documentElement); const g = (n, d) => (s.getPropertyValue(n).trim() || d); return { acc: g("--acc", "#4f46e5"), acc2: g("--acc-2", "#7c3aed") }; }

  function create(canvas, overlay, geo, hexData) {
    if (!window.THREE || !THREE.OrbitControls) throw new Error("three");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.09;
    controls.minDistance = 1.15; controls.maxDistance = 4; controls.zoomSpeed = 0.7;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    let C = css();

    // ---------- Esfera ----------
    const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), new THREE.ShaderMaterial({
      uniforms: { cA: { value: new THREE.Color("#f4f8ff") }, cB: { value: new THREE.Color("#cfdff9") }, cRim: { value: new THREE.Color("#dfe7ff") } },
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: "uniform vec3 cA; uniform vec3 cB; uniform vec3 cRim; varying vec3 vN; void main(){ float l = clamp(dot(vN, normalize(vec3(-.45,.6,.65)))*.5+.5,0.,1.); vec3 c = mix(cB, cA, l); float rim = pow(1.-max(dot(vN, vec3(0.,0.,1.)),0.), 2.5); gl_FragColor = vec4(mix(c, cRim, rim*.35),1.); }"
    }));
    scene.add(globe);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 64), new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(C.acc) } }, side: THREE.BackSide, transparent: true, depthWrite: false,
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: "uniform vec3 c; varying vec3 vN; void main(){ float i = pow(max(0., .78 - dot(vN, vec3(0.,0.,1.))), 2.2); gl_FragColor = vec4(c, i*.28); }"
    }));
    scene.add(halo);

    // ---------- Colombia en hexágonos, por regiones ----------
    const H = hexData.hex, n = H.length / 3;
    const dummy = new THREE.Object3D();
    const hexMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0057, 6), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
    const occupied = new Set();
    for (let i = 0; i < n; i++) {
      const lat = H[i * 3] / 100, lon = H[i * 3 + 1] / 100;
      const p = P(lat, lon, R * 1.0012); dummy.position.copy(p); dummy.lookAt(p.clone().multiplyScalar(2)); dummy.rotateZ(Math.PI / 6); dummy.updateMatrix();
      hexMesh.setMatrixAt(i, dummy.matrix); occupied.add(Math.round(lat * 4) + ":" + Math.round(lon * 4));
    }
    hexMesh.instanceMatrix.needsUpdate = true; scene.add(hexMesh);
    function paintHex() {
      const col = new THREE.Color(), acc = new THREE.Color(C.acc), white = new THREE.Color("#ffffff");
      for (let i = 0; i < n; i++) {
        const d = geo.depts[H[i * 3 + 2]]; const reg = REGION[d.c] || "andina";
        if (reg === "andina") col.copy(acc).lerp(white, .38); else col.set(REG_COL[reg]);
        const v = ((parseInt(d.c, 10) * 37) % 9) / 9;      // leve variación por departamento
        col.lerp(white, v * .22);
        hexMesh.setColorAt(i, col);
      }
      hexMesh.instanceColor.needsUpdate = true;
    }
    paintHex();

    // Mar alrededor: puntitos suaves para que todo el planeta se sienta lleno
    const sea = []; const N = 9000, ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
      const v = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r); const ll = real(v);
      if (occupied.has(Math.round(ll.lat * 4) + ":" + Math.round(ll.lon * 4))) continue;
      v.multiplyScalar(R * 1.001); sea.push(v.x, v.y, v.z); }
    const seaG = new THREE.BufferGeometry(); seaG.setAttribute("position", new THREE.Float32BufferAttribute(sea, 3));
    const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.beginPath(); x.arc(16, 16, 13, 0, 7); x.fill(); return new THREE.CanvasTexture(c); })();
    const seaPts = new THREE.Points(seaG, new THREE.PointsMaterial({ color: new THREE.Color("#a9c3ee"), size: 0.0075, map: dotTex, transparent: true, alphaTest: .3, opacity: .7, depthWrite: false }));
    scene.add(seaPts);

    // Límites de departamentos
    const bp = [];
    geo.depts.forEach(d => d.p.forEach(ring => { for (let i = 0; i < ring.length - 1; i++) { const a = P(ring[i][1], ring[i][0], R * 1.0025), b = P(ring[i + 1][1], ring[i + 1][0], R * 1.0025); bp.push(a.x, a.y, a.z, b.x, b.y, b.z); } }));
    const bG = new THREE.BufferGeometry(); bG.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
    const borders = new THREE.LineSegments(bG, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85 }));
    scene.add(borders);

    // Municipios: puntitos que aparecen al acercarte
    const mun = geo.mun; const mp = new Float32Array(mun.length * 3);
    mun.forEach((m, i) => { const v = P(m[2], m[3], R * 1.003); mp[i * 3] = v.x; mp[i * 3 + 1] = v.y; mp[i * 3 + 2] = v.z; });
    const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(mp, 3));
    const mMat = new THREE.PointsMaterial({ color: new THREE.Color("#1e1b4b"), size: 0.005, map: dotTex, transparent: true, alphaTest: .3, opacity: 0, depthWrite: false });
    const munPts = new THREE.Points(mg, mMat); scene.add(munPts);

    // ---------- Etiquetas (capitales) y pines ----------
    let labels = [];
    function addLabel(lat, lon, html, cls, kind, minDist, onClick, title) {
      const el = document.createElement(onClick ? "button" : "div"); el.className = cls; el.innerHTML = html;
      if (onClick) { el.type = "button"; el.addEventListener("click", e => { e.stopPropagation(); onClick(); }); }
      if (title) { el.title = title; el.setAttribute("aria-label", title); }
      overlay.appendChild(el); const L = { el, pos: P(lat, lon, R * 1.004), kind, minDist: minDist || 99 }; labels.push(L); return L;
    }
    function clearLabels(kind) { labels = labels.filter(l => { if (l.kind === kind) { l.el.remove(); return false; } return true; }); }
    mun.filter(m => m[4]).forEach(m => addLabel(m[2], m[3], esc(m[0].replace(" D.C.", "")), "city-lbl", "city", 2.7));
    const api = { onPick: null, onPin: null };
    let hiddenCities = new Set();
    function setHome(h) {
      clearLabels("home"); if (!h || h.lat == null) return;
      addLabel(h.lat, h.lon, '<span class="pin-ico"><svg viewBox="0 0 24 24"><path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/></svg></span><span class="pl">Casa</span>', "pin home", "home", 99,
        () => api.onPin && api.onPin({ home: true, loc: h }), "Tu casa: " + h.name);
    }

    // ---------- Recorrido ----------
    const routeG = new THREE.Group(); scene.add(routeG);
    let flows = [], movers = [];
    const flowMat = (c1, c2) => new THREE.ShaderMaterial({
      uniforms: { c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, t: { value: 0 }, reveal: { value: reduce() ? 1 : 0 } }, transparent: true,
      vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: "uniform vec3 c1; uniform vec3 c2; uniform float t; uniform float reveal; varying vec2 vU; void main(){ if (vU.x > reveal) discard; vec3 c = mix(c1, c2, vU.x); float b = smoothstep(.0,.08, fract(vU.x*2.5 - t)) * (1.-smoothstep(.08,.2, fract(vU.x*2.5 - t))); c = mix(c, vec3(1.), b*.75); gl_FragColor = vec4(c, 1.); }"
    });
    function arcCurve(a, b) {
      const A = P(a.lat, a.lon, 1), B = P(b.lat, b.lon, 1); const ang = A.angleTo(B); const h = 0.02 + ang * 0.33; const pts = [];
      for (let i = 0; i <= 80; i++) { const t = i / 80; const p = A.clone().lerp(B, t).normalize(); p.multiplyScalar(R * 1.004 + Math.sin(Math.PI * t) * h); pts.push(p); }
      return new THREE.CatmullRomCurve3(pts);
    }
    function clearRoute() { while (routeG.children.length) { const o = routeG.children.pop(); o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); } flows = []; movers = []; }
    function setRoute(stops, legs) {
      clearRoute(); clearLabels("stop"); hiddenCities = new Set();
      (legs || []).forEach((lg, i) => {
        const curve = arcCurve(lg.a, lg.b);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.0026, 8, false), flowMat(C.acc, C.acc2));
        const shadow = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.009, 8, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.acc), transparent: true, opacity: .12, depthWrite: false }));
        routeG.add(shadow, tube); flows.push({ m: tube, t0: performance.now() + i * 280 });
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 14, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.visible = !reduce(); routeG.add(dot); movers.push({ m: dot, c: curve, o: i * .37 });
      });
      (stops || []).forEach(s => { if (s.home) return;
        addLabel(s.lat, s.lon, `<span class="pin-ico"><b>${esc(s.num)}</b></span><span class="pl">${esc(s.label)}</span>`, "pin stop", "stop", 99, () => api.onPin && api.onPin(s), s.label);
        mun.forEach((m, i) => { if (m[4] && Math.abs(m[2] - s.lat) < .05 && Math.abs(m[3] - s.lon) < .05) hiddenCities.add(m[0].replace(" D.C.", "")); }); });
    }

    // ---------- Cámara ----------
    let anim = null;
    function goToV(dir, dist, instant) {
      const toDir = dir.clone().normalize(), fromDir = camera.position.clone().normalize(), fromD = camera.position.length(), toD = dist || fromD;
      if (instant || reduce()) { camera.position.copy(toDir.multiplyScalar(toD)); controls.update(); return; }
      anim = { t0: performance.now(), dur: 900, fromDir, toDir, fromD, toD };
    }
    const goTo = (lat, lon, dist, instant) => goToV(P(lat, lon, 1), dist, instant);
    const ALL = [LAT0 + 1.6, LON0 - 0.6, 3.65];
    goTo(ALL[0], ALL[1], ALL[2], true);

    // ---------- Tocar el planeta ----------
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
    canvas.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; anim = null; });
    canvas.addEventListener("pointerup", e => {
      if (!down) return; const mv = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (mv > 6 || dt > 500) return;
      const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hit = ray.intersectObject(globe, false)[0];
      api.onPick && api.onPick(hit ? real(hit.point) : null, { x: e.clientX - r.left, y: e.clientY - r.top });
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
        camera.position.copy(anim.fromDir.clone().lerp(anim.toDir, e).normalize().multiplyScalar(anim.fromD + (anim.toD - anim.fromD) * e)); if (k >= 1) anim = null; }
      const dist = camera.position.length();
      controls.rotateSpeed = Math.max(0.08, Math.min(0.8, (dist - 1) * 0.42));
      controls.update();
      mMat.opacity = Math.max(0, Math.min(.75, (1.95 - dist) * 1.8)); munPts.visible = mMat.opacity > .02; mMat.size = Math.max(0.003, (dist - 1) * 0.008);
      flows.forEach(f => { const k = Math.max(0, Math.min(1, (now - f.t0) / 1100)); if (!reduce()) { f.m.material.uniforms.reveal.value = ease(k); f.m.material.uniforms.t.value = now * 0.00035; } });
      if (!reduce()) movers.forEach(m => { m.m.visible = true; m.m.position.copy(m.c.getPointAt(((now * 0.00012) + m.o) % 1)); });
      renderer.render(scene, camera);
      const w = canvas.clientWidth, h = canvas.clientHeight; camN.copy(camera.position).normalize();
      labels.forEach(L => {
        const facing = tmp.copy(L.pos).normalize().dot(camN) > 0.2;
        const show = facing && dist <= L.minDist && !(L.kind === "city" && hiddenCities.has(L.el.textContent));
        L.el.style.opacity = show ? 1 : 0; L.el.style.pointerEvents = show && L.kind !== "city" ? "auto" : "none";
        if (!show) return; tmp.copy(L.pos).project(camera);
        L.el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px)`;
      });
    }
    function screenOf(lat, lon) { tmp.copy(P(lat, lon, R)).project(camera); return { x: (tmp.x + 1) / 2 * canvas.clientWidth, y: (1 - tmp.y) / 2 * canvas.clientHeight }; }

    Object.assign(api, {
      start() { if (running) return; running = true; resize(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      setHome, setRoute, screenOf,
      flyTo(lat, lon, dist) { goTo(lat, lon, dist || 1.7); },
      view() { goTo(ALL[0], ALL[1], ALL[2]); },
      fit(points) {
        if (!points.length) return api.view();
        let la = 0, lo = 0; points.forEach(p => { la += p.lat; lo += p.lon; }); la /= points.length; lo /= points.length;
        let maxA = 0; const c = P(la, lo, 1); points.forEach(p => { maxA = Math.max(maxA, c.angleTo(P(p.lat, p.lon, 1))); });
        goTo(la, lo, Math.max(1.7, Math.min(3.6, 1.4 + maxA * 3.3)));
      },
      zoom(f) { const d = Math.max(controls.minDistance, Math.min(controls.maxDistance, 1 + (camera.position.length() - 1) * f)); goToV(camera.position.clone(), d); },
      setTheme() { C = css(); halo.material.uniforms.c.value.set(C.acc); paintHex(); routeG.children.forEach(o => { if (o.material.uniforms) { o.material.uniforms.c1.value.set(C.acc); o.material.uniforms.c2.value.set(C.acc2); } }); },
      regions: () => Object.keys(REG_NAME).map(k => ({ k, n: REG_NAME[k], c: REG_COL[k] || null }))
    });
    return api;
  }
  window.CronovaMapa = { create };
})();
