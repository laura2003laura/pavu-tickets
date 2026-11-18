// @ts-nocheck
// 3D hall + "view from my seat". Plain three.js code shared with the demo page.
export function createSeatScene(THREE: any, el: HTMLElement, seats: any[], zoneNames: string[], getState: () => { selectedId: string | null; mode: string }): () => void {
  const COLORS = ["#ff9447", "#8f6bff", "#3ec9a7", "#e0556f", "#4b7bff"];
  const SW = 0.62, RD = 0.95, RISE = 0.24;
  const maxCol = Math.max(1, ...seats.map((s) => s.col));
  const maxRow = Math.max(1, ...seats.map((s) => Number(s.row)));
  const cx = (maxCol + 1) / 2;
  const isBalcony = (s) => s.zone === "Պատշգամբ";
  const pos = (s) => {
    const r = Number(s.row) - 1;
    return new THREE.Vector3((s.col - cx) * SW, r * RISE + (isBalcony(s) ? 1.6 : 0), 4 + r * RD + (isBalcony(s) ? 1.2 : 0));
  };
  const hallW = maxCol * SW + 5, hallD = 4 + maxRow * RD + 5;
  const byId = new Map(seats.map((s) => [s.id, s]));

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (e) {
    el.textContent = "3D տեսարանը հասանելի չէ այս սարքում։";
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;height:auto;touch-action:none;cursor:grab";
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#14091f");
  scene.fog = new THREE.Fog("#14091f", 18, 48);
  const camera = new THREE.PerspectiveCamera(68, 1.8, 0.1, 100);

  const box = (w, h, d, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };

  // hall shell, floor, stage
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(hallW, 9, hallD + 7),
    new THREE.MeshStandardMaterial({ color: "#1b0f2c", side: THREE.BackSide, roughness: 1 })
  );
  shell.position.set(0, 4.5, (hallD - 7) / 2);
  scene.add(shell);
  box(hallW, 0.1, hallD + 7, "#241338", 0, -0.05, (hallD - 7) / 2);
  box(hallW - 2, 1, 6.5, "#3b2457", 0, 0.5, -3);

  // backdrop with the brand gradient
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 128;
  const g = cv.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 512, 0);
  gr.addColorStop(0, "#8f6bff"); gr.addColorStop(0.55, "#c04cb0"); gr.addColorStop(1, "#ff9447");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#fff"; g.font = "bold 46px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("PAVU tickets", 256, 64);
  const bw = hallW - 4;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(bw, bw / 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  backdrop.position.set(0, 3.4, -6.2);
  scene.add(backdrop);

  // stepped floor (one riser per row)
  const rowInfo = new Map();
  for (const s of seats) if (!rowInfo.has(s.row)) rowInfo.set(s.row, pos(s));
  let maxY = 0;
  for (const p of rowInfo.values()) {
    maxY = Math.max(maxY, p.y);
    const h = p.y + 0.12;
    box(hallW - 1.5, h, RD, "#2d1a4a", 0, h / 2, p.z);
  }

  // seats (instanced for speed)
  const n = seats.length;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const base = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.45, 0.46), mat, n);
  const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.55, 0.08), mat, n);
  const mx = new THREE.Matrix4(), cl = new THREE.Color();
  seats.forEach((s, i) => {
    const p = pos(s);
    mx.makeTranslation(p.x, p.y + 0.25, p.z); base.setMatrixAt(i, mx);
    mx.makeTranslation(p.x, p.y + 0.6, p.z + 0.22); back.setMatrixAt(i, mx);
    cl.set(s.taken ? "#555060" : COLORS[Math.max(0, zoneNames.indexOf(s.zone)) % COLORS.length]);
    base.setColorAt(i, cl); back.setColorAt(i, cl);
  });
  scene.add(base); scene.add(back);

  // marker shown in the overview
  const marker = new THREE.Group();
  marker.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshBasicMaterial({ color: "#ffe0c2" })));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 8), new THREE.MeshBasicMaterial({ color: "#ffe0c2" }));
  stick.position.y = -1;
  marker.add(stick);
  marker.visible = false;
  scene.add(marker);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.5);
  sun.position.set(0, 10, 10);
  scene.add(sun);
  const warm = new THREE.PointLight(0xffa860, 1.3, 40);
  warm.position.set(0, 6, -2);
  scene.add(warm);
  const cool = new THREE.PointLight(0x8f6bff, 0.9, 30);
  cool.position.set(0, 5, 3);
  scene.add(cool);

  // look-around by dragging
  let yaw = 0, pitch = 0, drag = null, lastKey = "";
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    yaw = Math.max(-1.1, Math.min(1.1, yaw + (e.clientX - drag.x) * 0.006));
    pitch = Math.max(-0.5, Math.min(0.5, pitch + (e.clientY - drag.y) * 0.005));
    drag = { x: e.clientX, y: e.clientY };
  });
  const end = () => { drag = null; canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  function resize() {
    const w = el.clientWidth || 600;
    const h = Math.round(Math.max(240, w * 0.56));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  const eye = new THREE.Vector3(0, maxY + 9, hallD + 4);
  const tmp = new THREE.Vector3();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const st = getState();
    const s = st.selectedId ? byId.get(st.selectedId) : null;
    const seatMode = st.mode === "seat" && !!s;
    const key = st.mode + ":" + (s ? s.id : "");
    if (key !== lastKey) { lastKey = key; yaw = 0; pitch = 0; }

    let goal, target;
    if (seatMode) {
      const p = pos(s);
      goal = new THREE.Vector3(p.x, p.y + 1.15, p.z + 0.05);
      target = new THREE.Vector3(0, 2.6, -3);
    } else {
      goal = new THREE.Vector3(0, maxY + 9, hallD + 4);
      target = new THREE.Vector3(0, 1.5, hallD * 0.35);
    }
    eye.lerp(goal, 0.15);
    camera.position.copy(eye);
    tmp.copy(target).sub(eye);
    camera.rotation.order = "YXZ";
    camera.rotation.y = Math.atan2(-tmp.x, -tmp.z) + (seatMode ? yaw : 0);
    camera.rotation.x = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)) + (seatMode ? pitch : 0);
    camera.rotation.z = 0;

    marker.visible = !seatMode && !!s;
    if (s) marker.position.copy(pos(s)).add(new THREE.Vector3(0, 1.4, 0));
    renderer.render(scene, camera);
  }
  frame();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.dispose();
    if (canvas.parentNode === el) el.removeChild(canvas);
  };
}
