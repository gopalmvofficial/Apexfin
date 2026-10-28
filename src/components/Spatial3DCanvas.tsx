'use client';

import React, { useEffect, useRef } from 'react';

interface Spatial3DCanvasProps {
  status: 'safe' | 'warning' | 'scenario';
}

export function Spatial3DCanvas({ status }: Spatial3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle nodes for 3D perspective network
    const count = 45;
    const particles: Array<{
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      size: number;
      baseAlpha: number;
    }> = [];

    for (let i = 0; i < count; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * 800 + 100, // Z depth
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2.5 + 1.2,
        baseAlpha: Math.random() * 0.4 + 0.2,
      });
    }

    // Mouse and scroll parallax state
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let scrollY = window.scrollY;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX - width / 2) * 0.08;
      targetMouseY = (e.clientY - height / 2) * 0.08;
    };

    const handleScroll = () => {
      scrollY = window.scrollY;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // Color tokens based on status
    const getColor = (alpha: number) => {
      if (status === 'scenario') return `rgba(168, 85, 247, ${alpha})`; // Purple
      if (status === 'warning') return `rgba(245, 158, 11, ${alpha})`; // Amber
      return `rgba(59, 130, 246, ${alpha})`; // Blue/Emerald
    };

    const fov = 400; // Field of view
    const render = () => {
      // Smooth lerp mouse coordinates
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2 + currentMouseX;
      const centerY = height / 2 + currentMouseY - (scrollY * 0.15) % height;

      // Update and project 3D particles onto 2D viewport
      const projected = particles.map((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Wrap around boundaries
        if (p.z < 50) p.z = 900;
        if (p.z > 900) p.z = 50;

        const scale = fov / (fov + p.z);
        const x2d = centerX + p.x * scale;
        const y2d = centerY + p.y * scale;

        return { p, scale, x2d, y2d };
      });

      // Draw subtle connecting 3D wireframe mesh lines between nearby nodes
      ctx.lineWidth = 0.6;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x2d - projected[j].x2d;
          const dy = projected[i].y2d - projected[j].y2d;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.18;
            ctx.strokeStyle = getColor(alpha);
            ctx.beginPath();
            ctx.moveTo(projected[i].x2d, projected[i].y2d);
            ctx.lineTo(projected[j].x2d, projected[j].y2d);
            ctx.stroke();
          }
        }
      }

      // Draw particle nodes with depth scale
      for (const item of projected) {
        const radius = Math.max(0.8, item.p.size * item.scale);
        const alpha = Math.min(0.8, item.p.baseAlpha * item.scale * 1.8);

        ctx.fillStyle = getColor(alpha);
        ctx.beginPath();
        ctx.arc(item.x2d, item.y2d, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [status]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-40 transition-opacity duration-700"
      aria-hidden="true"
    />
  );
}
