'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { PredictionResult } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Eye, RotateCcw, AlertTriangle, ShieldCheck, Box, Layers } from 'lucide-react';

interface ThreeCashflowHorizonProps {
  prediction: PredictionResult | null;
  currency?: string;
  isScenarioActive?: boolean;
}

export function ThreeCashflowHorizon({
  prediction,
  currency = 'USD',
  isScenarioActive = false,
}: ThreeCashflowHorizonProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{ date: string; balance: number; day: number } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !prediction || prediction.dailyTimeline.length === 0) return;

    const width = mount.clientWidth || 800;
    const height = 340;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090d16, 0.04);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 5.5, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const timeline = prediction.dailyTimeline;
    const pointsCount = timeline.length;

    // Normalization scale
    const minBal = Math.min(...timeline.map((d) => d.baselineBalance), prediction.safetyBuffer);
    const maxBal = Math.max(...timeline.map((d) => d.baselineBalance));
    const balRange = maxBal - minBal || 1;

    // 1. Generate 3D Curve points
    const curvePoints: THREE.Vector3[] = [];
    const curvePointsSim: THREE.Vector3[] = [];
    const spanWidth = 14;

    timeline.forEach((pt, i) => {
      const x = (i / (pointsCount - 1) - 0.5) * spanWidth;
      const normalizedY = ((pt.baselineBalance - minBal) / balRange) * 3.5 - 1.2;
      const z = 0;
      curvePoints.push(new THREE.Vector3(x, normalizedY, z));

      if (isScenarioActive) {
        const simY = ((pt.simulatedBalance - minBal) / balRange) * 3.5 - 1.2;
        curvePointsSim.push(new THREE.Vector3(x, simY, z));
      }
    });

    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(curve, pointsCount * 2, 0.08, 12, false);

    // Glowing Neon Material
    const tubeMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.2,
      clearcoat: 1.0,
    });
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tubeMesh);

    // 2. Translucent Financial Terrain / Ribbon Grid under the curve
    const planeGeo = new THREE.PlaneGeometry(spanWidth, 4, pointsCount - 1, 16);
    const pos = planeGeo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const ratio = (px + spanWidth / 2) / spanWidth;
      const index = Math.min(pointsCount - 1, Math.max(0, Math.floor(ratio * (pointsCount - 1))));
      const pt = timeline[index];
      const targetY = ((pt.baselineBalance - minBal) / balRange) * 3.5 - 1.2;

      // Displace upper vertices to match curve, lower vertices to floor
      const py = pos.getY(i);
      if (py > 0) {
        pos.setY(i, targetY);
      } else {
        pos.setY(i, -2.2);
      }
    }
    planeGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.2,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    scene.add(terrainMesh);

    // 3. Safety Buffer Horizon Plane slice (Horizontal Amber plane)
    const bufferY = ((prediction.safetyBuffer - minBal) / balRange) * 3.5 - 1.2;
    const bufferGeo = new THREE.PlaneGeometry(spanWidth + 2, 0.04);
    const bufferMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.8,
    });
    const bufferLine = new THREE.Mesh(bufferGeo, bufferMat);
    bufferLine.position.set(0, bufferY, 0);
    scene.add(bufferLine);

    // 4. Lowest Liquidity Trough Beacon (Floating 3D Diamond)
    const lowestIdx = timeline.findIndex((d) => d.date === prediction.baselineLowestDate);
    let troughBeacon: THREE.Mesh | null = null;

    if (lowestIdx >= 0) {
      const beaconGeo = new THREE.OctahedronGeometry(0.24, 0);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.8,
        metalness: 0.8,
        roughness: 0.2,
      });
      troughBeacon = new THREE.Mesh(beaconGeo, beaconMat);
      const lowX = (lowestIdx / (pointsCount - 1) - 0.5) * spanWidth;
      const lowY = ((prediction.baselineLowestBalance - minBal) / balRange) * 3.5 - 1.2;
      troughBeacon.position.set(lowX, lowY + 0.6, 0);
      scene.add(troughBeacon);
    }

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x60a5fa, 2.5);
    dirLight.position.set(5, 8, 7);
    scene.add(dirLight);

    const amberLight = new THREE.PointLight(0xf59e0b, 2.0, 15);
    amberLight.position.set(0, bufferY, 2);
    scene.add(amberLight);

    // Interactive Drag / Orbit rotation
    let isDragging = false;
    let prevMouseX = 0;
    let rotSpeed = 0.005;
    let targetRotationY = 0;
    let targetRotationX = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        targetRotationY += deltaX * rotSpeed;
        prevMouseX = e.clientX;
      }

      // Raycast to find closest timeline point on ribbon
      const rect = mount.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      );

      const ratio = (mouse.x + 1) / 2;
      const idx = Math.min(pointsCount - 1, Math.max(0, Math.floor(ratio * pointsCount)));
      const point = timeline[idx];
      if (point) {
        setHoveredInfo({ date: point.date, balance: point.baselineBalance, day: point.day });
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    mount.addEventListener('pointerdown', onPointerDown);
    mount.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Render loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Smooth camera orbit lerp
      camera.position.x += (Math.sin(targetRotationY) * 12 - camera.position.x) * 0.08;
      camera.position.z += (Math.cos(targetRotationY) * 12 - camera.position.z) * 0.08;
      camera.lookAt(0, 0, 0);

      // Pulse beacon
      if (troughBeacon) {
        troughBeacon.rotation.y = elapsed * 2.0;
        troughBeacon.position.y += Math.sin(elapsed * 4) * 0.004;
      }

      // Gentle wave animation in terrain wireframe
      terrainMat.opacity = 0.3 + Math.sin(elapsed * 2) * 0.08;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!mount) return;
      const newW = mount.clientWidth;
      camera.aspect = newW / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', onPointerUp);
      mount.removeEventListener('pointerdown', onPointerDown);
      mount.removeEventListener('pointermove', onPointerMove);

      // Cleanup GPU resources
      tubeGeo.dispose();
      tubeMat.dispose();
      planeGeo.dispose();
      terrainMat.dispose();
      bufferGeo.dispose();
      bufferMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [prediction, isScenarioActive]);

  if (!prediction) return null;

  return (
    <div className="relative w-full rounded-2xl glass-panel p-5 border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* 3D Header Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Spatial 3D Cashflow Landscape
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                WebGL Interactive Horizon
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Drag horizontally to orbit in 3D • Peak heights represent liquid balances
            </p>
          </div>
        </div>

        {/* Hover readout indicator */}
        {hoveredInfo && (
          <div className="hidden sm:flex items-center gap-3 px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs font-mono">
            <span className="text-slate-400">Day {hoveredInfo.day} ({formatDate(hoveredInfo.date)}):</span>
            <span className="text-white font-bold">{formatCurrency(hoveredInfo.balance, currency)}</span>
          </div>
        )}
      </div>

      {/* WebGL Canvas Viewport */}
      <div
        ref={mountRef}
        className="w-full h-[340px] rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-grab active:cursor-grabbing relative overflow-hidden"
      >
        {/* Floating 3D Legend Elements */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 text-[11px] font-mono pointer-events-none">
          <div className="flex items-center gap-1.5 px-2 py-0.8 rounded bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-blue-400">
            <span className="w-2.5 h-1 rounded bg-blue-500" />
            <span>3D Cashflow Trajectory</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.8 rounded bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-amber-400">
            <span className="w-2.5 h-0.5 rounded bg-amber-500" />
            <span>Safety Threshold ({formatCurrency(prediction.safetyBuffer, currency, 0)})</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.8 rounded bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-rose-400">
            <span className="w-2 h-2 rotate-45 bg-rose-500" />
            <span>Lowest Trough: {formatCurrency(prediction.baselineLowestBalance, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
