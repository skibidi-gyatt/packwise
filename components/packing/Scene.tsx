'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Plan } from '@/lib/packing/model';

export default function Scene({
  plan,
  selected,
  onSelect,
  exploded,
  step,
  moved,
}: {
  plan: Plan;
  selected: string | null;
  onSelect: (id: string) => void;
  exploded: boolean;
  step: number;
  moved: string[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<THREE.Vector3 | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const el = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      '3D packing model. Drag to orbit and scroll to zoom. Select items using the inventory.',
    );
    const scene = new THREE.Scene();
    const [w, h, d] = plan.container.dims;
    const scale = Math.max(w, h, d);
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 2000);
    camera.position.copy(
      view.current ?? new THREE.Vector3(scale * 1.45, h * 0.9, scale * 1.8),
    );
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, h * 0.48, 0);
    controls.enableDamping = true;
    controls.minDistance = scale;
    controls.maxDistance = scale * 4;
    controls.maxPolarAngle = Math.PI * 0.85;
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(40, 90, 60);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb3d7e7, 1.5);
    fill.position.set(-50, 20, -40);
    scene.add(fill);
    const bagGeo = new THREE.BoxGeometry(w, h, d);
    const envelope = new THREE.LineSegments(
      new THREE.EdgesGeometry(bagGeo),
      new THREE.LineBasicMaterial({
        color: 0x657f8e,
        transparent: true,
        opacity: 0.58,
      }),
    );
    envelope.position.set(0, h / 2, 0);
    scene.add(envelope);
    bagGeo.dispose();
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        color: 0x9cb9c6,
        transparent: true,
        opacity: 0.11,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    back.position.set(0, h / 2, -d / 2 - 0.1);
    scene.add(back);
    const grid = new THREE.GridHelper(
      Math.max(w, d) * 1.55,
      12,
      0xafc2cc,
      0xd0dce1,
    );
    grid.position.y = -0.2;
    scene.add(grid);
    const label = (text: string, color = '#395564', size = 5) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.font = '600 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.fillText(text, 256, 56);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          depthTest: false,
          transparent: true,
        }),
      );
      sprite.scale.set(size * 5.33, size, 1);
      return sprite;
    };
    const backLabel = label('BACK PANEL', '#5b7685', 2.7);
    backLabel.position.set(0, h + 4, -d / 2);
    scene.add(backLabel);
    const widthLabel = label(`${w} cm`, '#5b7685', 2.7);
    widthLabel.position.set(0, -3, d / 2 + 3);
    scene.add(widthLabel);
    const heightLabel = label(`${h} cm`, '#5b7685', 2.7);
    heightLabel.position.set(w / 2 + 5, h / 2, -d / 2);
    scene.add(heightLabel);
    const selectable: THREE.Object3D[] = [];
    const anim: {
      mesh: THREE.Group;
      target: THREE.Vector3;
      start: THREE.Vector3;
    }[] = [];
    for (const p of plan.placements) {
      if (p.order > step) continue;
      const isSelected = selected === p.item.id;
      const group = new THREE.Group();
      const geometry = new THREE.BoxGeometry(
        ...(p.dims.map((v) => Math.max(0.1, v - 0.16)) as [
          number,
          number,
          number,
        ]),
      );
      const mat = new THREE.MeshStandardMaterial({
        color: p.item.color,
        roughness: 0.6,
        metalness: 0.05,
        transparent: true,
        opacity: selected && !isSelected ? 0.5 : 0.91,
      });
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.userData.id = p.item.id;
      selectable.push(mesh);
      group.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: isSelected
            ? 0xffffff
            : moved.includes(p.item.id)
              ? 0x007b68
              : 0x314858,
          transparent: true,
          opacity: isSelected ? 1 : 0.35,
        }),
      );
      group.add(edges);
      const itemLabel = label(
        `${p.order}  ${p.item.name}`,
        isSelected ? '#004f43' : '#193a48',
        Math.min(p.dims[0] / 5.5, 2.5),
      );
      itemLabel.position.set(0, p.dims[1] / 2 + 0.8, p.dims[2] / 2 + 0.2);
      group.add(itemLabel);
      const target = new THREE.Vector3(
        p.pos[0] + p.dims[0] / 2 - w / 2,
        p.pos[1] + p.dims[1] / 2 + (exploded ? p.order * 4 : 0),
        p.pos[2] + p.dims[2] / 2 - d / 2,
      );
      const start = target.clone().add(new THREE.Vector3(0, 6, 0));
      group.position.copy(start);
      scene.add(group);
      anim.push({ mesh: group, target, start });
    }
    if (plan.placements.length && step >= plan.placements.length) {
      const c = plan.metrics.com;
      const point = new THREE.Vector3(c[0] - w / 2, c[1], c[2] - d / 2);
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
      );
      ball.position.copy(point);
      ball.renderOrder = 99;
      scene.add(ball);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.17, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x067c67, depthTest: false }),
      );
      ring.position.copy(point);
      ring.lookAt(camera.position);
      ring.renderOrder = 100;
      scene.add(ring);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        point,
        new THREE.Vector3(point.x, 0, point.z),
      ]);
      scene.add(
        new THREE.Line(
          lineGeo,
          new THREE.LineDashedMaterial({
            color: 0x007b68,
            dashSize: 1,
            gapSize: 0.7,
          }),
        ).computeLineDistances(),
      );
    }
    const resize = () => {
      const width = el.clientWidth,
        height = el.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = [0, 0];
    const pointerDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const pick = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = el.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(selectable)[0];
      if (hit) onSelect(hit.object.userData.id);
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pick);
    let frame = 0;
    const start = performance.now(),
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => {
      const t = reduced ? 1 : Math.min(1, (performance.now() - start) / 550),
        ease = 1 - (1 - t) ** 3;
      for (const a of anim)
        a.mesh.position.lerpVectors(a.start, a.target, ease);
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      view.current = camera.position.clone();
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pick);
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Line ||
          o instanceof THREE.LineSegments ||
          o instanceof THREE.Sprite
        ) {
          if ('geometry' in o) o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if ('map' in m) (m.map as THREE.Texture | null)?.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [plan, selected, exploded, step, moved, onSelect]);
  return (
    <div className="scene" ref={host}>
      {failed && (
        <div className="scene-fallback">
          3D is unavailable on this device. All dimensions, packing steps, and
          results remain available below.
        </div>
      )}
    </div>
  );
}
