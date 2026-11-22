"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function FieldView3D() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      el.textContent = "3D դաշտի տեսարանը հասանելի չէ այս սարքում։";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(el.clientWidth || 700, 340);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#101b20");
    const camera = new THREE.PerspectiveCamera(
      48,
      (el.clientWidth || 700) / 340,
      0.1,
      100,
    );
    camera.position.set(0, 25, 32);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x263c2c, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(-10, 24, 12);
    scene.add(light);
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 22),
      new THREE.MeshStandardMaterial({ color: "#28784d", roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    scene.add(grass);
    for (let i = 0; i < 10; i++) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 22),
        new THREE.MeshBasicMaterial({ color: i % 2 ? "#2b8052" : "#246d46" }),
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-15.3 + i * 3.4, 0.012, 0);
      scene.add(stripe);
    }
    const lineMat = new THREE.MeshBasicMaterial({ color: "#f4f3e9" });
    const line = (w: number, h: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.025, z);
      scene.add(m);
    };
    line(32, 0.12, 0, -10.8);
    line(32, 0.12, 0, 10.8);
    line(0.12, 22, -16, 0);
    line(0.12, 22, 16, 0);
    line(0.12, 21.6, 0, 0);
    const circle = new THREE.Mesh(
      new THREE.RingGeometry(3.5, 3.62, 64),
      lineMat,
    );
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.03;
    scene.add(circle);
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: "#e9e8df",
          metalness: 0.15,
          roughness: 0.5,
        }),
      );
      m.position.set(x, y, z);
      scene.add(m);
    };
    // goals and simplified grandstands
    box(5, 0.12, 0.12, 0, 2, -10.8);
    box(0.12, 2, 0.12, -2.5, 1, -10.8);
    box(0.12, 2, 0.12, 2.5, 1, -10.8);
    box(5, 0.12, 0.12, 0, 2, 10.8);
    box(0.12, 2, 0.12, -2.5, 1, 10.8);
    box(0.12, 2, 0.12, 2.5, 1, 10.8);
    for (const side of [-1, 1])
      for (let r = 0; r < 5; r++) {
        const stand = new THREE.Mesh(
          new THREE.BoxGeometry(36, 0.8, 1.4),
          new THREE.MeshStandardMaterial({
            color: r % 2 ? "#55416f" : "#76558e",
          }),
        );
        stand.position.set(0, 0.4 + r * 0.65, side * (13 + r * 0.9));
        scene.add(stand);
      }
    let frame = 0;
    let dragging = false;
    let lastX = 0;
    let yaw = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (dragging) {
        yaw += (e.clientX - lastX) * 0.006;
        lastX = e.clientX;
      }
    };
    const up = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    const resize = () => {
      const w = el.clientWidth || 700;
      renderer.setSize(w, 340);
      camera.aspect = w / 340;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const animate = () => {
      frame = requestAnimationFrame(animate);
      camera.position.x = Math.sin(yaw) * 32;
      camera.position.z = Math.cos(yaw) * 32;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.dispose();
      if (renderer.domElement.parentNode === el)
        el.removeChild(renderer.domElement);
    };
  }, []);
  return (
    <section className="field3d">
      <div className="field3d-heading">
        <div>
          <span className="eyebrow">IMMERSIVE VENUE</span>
          <h3>Մարզադաշտի 3D տեսք</h3>
        </div>
        <span className="muted">Քաշիր՝ տեսարանը պտտելու համար</span>
      </div>
      <div ref={host} />
    </section>
  );
}
