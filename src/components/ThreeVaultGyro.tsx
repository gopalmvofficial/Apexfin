'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { formatCurrency } from '@/lib/formatters';
import { ShieldCheck, ShieldAlert, Sparkles, Move } from 'lucide-react';
import { sounds } from '@/lib/sound-effects';

interface ThreeVaultGyroProps {
  cardholderName: string;
  balance: number;
  safetyBuffer: number;
  currency?: string;
  accountName: string;
}

export function ThreeVaultGyro({
  cardholderName,
  balance,
  safetyBuffer,
  currency = 'USD',
  accountName,
}: ThreeVaultGyroProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isSafe = balance >= safetyBuffer;
  const [interactiveNotice, setInteractiveNotice] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 360;
    const height = 260;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);

    // Group for mouse tilt
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // PBR Materials
    const goldColor = isSafe ? 0x10b981 : 0xf59e0b;
    const accentColor = isSafe ? 0x3b82f6 : 0xef4444;

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      emissive: accentColor,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      wireframe: false,
    });

    const wireMaterial = new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });

    // 1. Central Core: Beveled Icosahedron + Wireframe cage
    const coreGeo = new THREE.IcosahedronGeometry(1.4, 1);
    const coreMesh = new THREE.Mesh(coreGeo, coreMaterial);
    mainGroup.add(coreMesh);

    const wireCage = new THREE.Mesh(coreGeo, wireMaterial);
    wireCage.scale.setScalar(1.04);
    mainGroup.add(wireCage);

    // 2. Outer Gyroscope Rings (Titanium & Gold)
    const ring1Geo = new THREE.TorusGeometry(2.3, 0.05, 16, 100);
    const ring1Mat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.95,
      roughness: 0.2,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    mainGroup.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(2.8, 0.04, 16, 100);
    const ring2Mat = new THREE.MeshStandardMaterial({
      color: goldColor,
      metalness: 0.9,
      roughness: 0.25,
      emissive: goldColor,
      emissiveIntensity: 0.2,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI / 3;
    mainGroup.add(ring2);

    // 3. Orbiting Financial Coin Tokens
    const coinCount = 5;
    const coinGroup = new THREE.Group();
    mainGroup.add(coinGroup);

    const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 32);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
    });

    const coins: THREE.Mesh[] = [];
    for (let i = 0; i < coinCount; i++) {
      const coin = new THREE.Mesh(coinGeo, coinMat);
      coins.push(coin);
      coinGroup.add(coin);
    }

    // 4. Floating ambient star particles
    const particleCount = 60;
    const particleGeo = new THREE.BufferGeometry();
    const posArr = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      posArr[i] = (Math.random() - 0.5) * 8;
      posArr[i + 1] = (Math.random() - 0.5) * 6;
      posArr[i + 2] = (Math.random() - 0.5) * 4;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.06,
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);

    const pointLight = new THREE.PointLight(accentColor, 3.5, 10);
    pointLight.position.set(-3, -2, 2);
    scene.add(pointLight);

    // Shockwave ring on click
    const shockwaveGeo = new THREE.RingGeometry(0.1, 0.15, 64);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const shockwave = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    scene.add(shockwave);

    let shockwaveScale = 0;
    let shockwaveActive = false;

    // Mouse tilt interaction (lerp)
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = x;
      mouseY = y;
      targetRotY = mouseX * 0.75;
      targetRotX = -mouseY * 0.75;
    };

    const handlePointerLeave = () => {
      targetRotX = 0;
      targetRotY = 0;
    };

    const handleClick = () => {
      sounds.playSuccess();
      shockwaveScale = 0.5;
      shockwaveActive = true;
      shockwaveMat.opacity = 0.9;
      setInteractiveNotice(false);
    };

    mount.addEventListener('pointermove', handlePointerMove);
    mount.addEventListener('pointerleave', handlePointerLeave);
    mount.addEventListener('click', handleClick);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Smooth camera / group tilt
      mainGroup.rotation.x += (targetRotX - mainGroup.rotation.x) * 0.08;
      mainGroup.rotation.y += (targetRotY - mainGroup.rotation.y) * 0.08;

      // Idle continuous orbital rotation
      coreMesh.rotation.x = elapsedTime * 0.35;
      coreMesh.rotation.y = elapsedTime * 0.45;
      wireCage.rotation.x = -elapsedTime * 0.25;
      wireCage.rotation.y = -elapsedTime * 0.35;

      ring1.rotation.y = elapsedTime * 0.5;
      ring1.rotation.z = Math.sin(elapsedTime * 0.5) * 0.3;

      ring2.rotation.x = Math.PI / 3 + Math.cos(elapsedTime * 0.4) * 0.25;
      ring2.rotation.y = -elapsedTime * 0.6;

      // Orbit coins in circular ring
      const radius = 2.1;
      coins.forEach((coin, i) => {
        const angle = (i / coinCount) * Math.PI * 2 + elapsedTime * 0.8;
        coin.position.x = Math.cos(angle) * radius;
        coin.position.z = Math.sin(angle) * radius;
        coin.position.y = Math.sin(angle * 2 + elapsedTime) * 0.35;
        coin.rotation.x = Math.PI / 2 + Math.cos(angle) * 0.5;
        coin.rotation.y = angle;
      });

      // Expand shockwave on click
      if (shockwaveActive) {
        shockwaveScale += 0.12;
        shockwave.scale.setScalar(shockwaveScale);
        shockwaveMat.opacity *= 0.92;
        if (shockwaveMat.opacity < 0.02) {
          shockwaveActive = false;
          shockwaveMat.opacity = 0;
        }
      }

      // Slowly rotate star particles
      particles.rotation.y = elapsedTime * 0.04;

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
      mount.removeEventListener('pointermove', handlePointerMove);
      mount.removeEventListener('pointerleave', handlePointerLeave);
      mount.removeEventListener('click', handleClick);

      // Clean GPU memory
      coreGeo.dispose();
      ring1Geo.dispose();
      ring2Geo.dispose();
      coinGeo.dispose();
      particleGeo.dispose();
      shockwaveGeo.dispose();
      coreMaterial.dispose();
      wireMaterial.dispose();
      ring1Mat.dispose();
      ring2Mat.dispose();
      coinMat.dispose();
      particleMat.dispose();
      shockwaveMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [isSafe]);

  return (
    <div className="relative w-full max-w-sm mx-auto select-none rounded-2xl glass-panel p-4 border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-[260px] cursor-grab active:cursor-grabbing relative flex items-center justify-center">
        {interactiveNotice && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-[10px] text-slate-300 flex items-center gap-1.5 backdrop-blur-md">
            <Move className="w-3 h-3 text-blue-400" />
            <span>Interactive 3D Vault (Hover & Click)</span>
          </div>
        )}
      </div>

      {/* Floating HUD Badges & Information Overlay */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
            {accountName}
          </span>
          <div className="text-xl font-extrabold text-white font-mono tabular-nums tracking-tight">
            {formatCurrency(balance, currency)}
          </div>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md ${
            isSafe
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
          }`}
        >
          {isSafe ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />}
          <span>{isSafe ? 'Runway Protected' : 'Low Buffer'}</span>
        </div>
      </div>
    </div>
  );
}
