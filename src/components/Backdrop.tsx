"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Props {
  /**
   * 0 = fila parada, 1 = fila no limite de downloads simultâneos.
   * Governa velocidade e brilho: o fundo é um medidor ambiente, não enfeite.
   */
  activity: number;
}

const PARTICLES = 700;
const FOV = 60;
const CAM_Z = 34;
/** Profundidade do volume: dá paralaxe sem afastar demais o plano de fundo. */
const DEPTH = 30;
/** Teto de DPR: acima de 1,5 o custo dobra sem ganho visível num campo de pontos. */
const MAX_DPR = 1.5;

/** Lê um token do :root e devolve como cor do three — nenhuma cor nova entra aqui. */
function tokenColor(name: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  try {
    return new THREE.Color(raw || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

/**
 * Campo de partículas em WebGL atrás da interface.
 *
 * Cobertura: as partículas ocupam um paralelepípedo dimensionado a partir do
 * frustum da câmera no plano mais distante, então o campo preenche a tela
 * inteira em qualquer proporção — retrato estreito de celular incluído. O
 * movimento é deriva com wrap nas bordas, e não rotação de um corpo: corpo que
 * gira deixa canto vazio, deriva com wrap nunca deixa.
 *
 * Degradação em três níveis, todos silenciosos:
 * 1. `prefers-reduced-motion` — desenha um único quadro e não abre loop.
 * 2. Sem WebGL — não monta nada.
 * 3. Aba em segundo plano — para o loop.
 *
 * Nos três casos a malha e o brilho de `body::before` continuam valendo, então
 * a página nunca fica sem fundo.
 */
export function Backdrop({ activity }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Ref, não state: o loop de animação lê a cada quadro e não pode re-renderizar.
  // A sincronia acontece em efeito — escrever ref durante o render é proibido.
  const activityRef = useRef(activity);
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
    } catch {
      return; // Sem WebGL: `body::before` já entrega o fundo.
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
    camera.position.z = CAM_Z;

    /**
     * Meia-altura e meia-largura visíveis no plano mais afastado do volume.
     * Dimensionar pelo plano mais distante garante que nenhuma faixa da tela
     * fique descoberta; sobra material fora do quadro no plano mais próximo,
     * que é o preço aceitável.
     */
    let halfW = 1;
    let halfH = 1;

    const measure = (w: number, h: number) => {
      const far = CAM_Z + DEPTH / 2;
      halfH = Math.tan((FOV * Math.PI) / 360) * far;
      halfW = halfH * (w / h);
    };

    measure(host.clientWidth || 1, host.clientHeight || 1);

    // Duas nuvens com as cores da marca. Separadas porque um único material não
    // faz duas cores sem custo de atributo por vértice.
    const specs = [
      { color: tokenColor("--accent", "#00f0ff"), size: 0.16, opacity: 0.55, speed: 1 },
      { color: tokenColor("--brand", "#ff2e97"), size: 0.2, opacity: 0.35, speed: 0.7 },
    ];

    interface Cloud {
      points: THREE.Points;
      positions: Float32Array;
      velocities: Float32Array;
      baseOpacity: number;
      speed: number;
    }

    const clouds: Cloud[] = specs.map((spec) => {
      const positions = new Float32Array(PARTICLES * 3);
      const velocities = new Float32Array(PARTICLES * 2);

      for (let i = 0; i < PARTICLES; i++) {
        positions[i * 3] = (Math.random() * 2 - 1) * halfW;
        positions[i * 3 + 1] = (Math.random() * 2 - 1) * halfH;
        positions[i * 3 + 2] = (Math.random() * 2 - 1) * (DEPTH / 2);
        // Deriva predominante na diagonal, com variação por partícula para que
        // o campo não pareça uma esteira.
        velocities[i * 2] = 0.6 + Math.random() * 0.9;
        velocities[i * 2 + 1] = (Math.random() * 2 - 1) * 0.35;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: spec.color,
        size: spec.size,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);
      return { points, positions, velocities, baseOpacity: spec.opacity, speed: spec.speed };
    });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;

      const previousW = halfW;
      const previousH = halfH;
      measure(w, h);

      // Reescala em vez de re-sortear: no celular a barra de endereço recolhe e
      // dispara resize o tempo todo — re-sortear a cada evento pisca o campo.
      const scaleX = halfW / previousW;
      const scaleY = halfH / previousH;
      for (const cloud of clouds) {
        for (let i = 0; i < PARTICLES; i++) {
          cloud.positions[i * 3] *= scaleX;
          cloud.positions[i * 3 + 1] *= scaleY;
        }
        cloud.points.geometry.attributes.position.needsUpdate = true;
      }

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = (host.clientWidth || 1) / (host.clientHeight || 1);
    camera.updateProjectionMatrix();

    let frame = 0;
    let last = performance.now();
    // Velocidade perseguida com folga: mudança de atividade entra como rampa,
    // não como corte seco.
    let speed = 0;

    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;

      const target = 0.35 + activityRef.current * 3.2;
      speed += (target - speed) * Math.min(delta * 1.5, 1);

      for (const cloud of clouds) {
        const { positions, velocities } = cloud;
        const step = speed * cloud.speed * delta;

        for (let i = 0; i < PARTICLES; i++) {
          const x = i * 3;
          const y = x + 1;
          positions[x] += velocities[i * 2] * step;
          positions[y] += velocities[i * 2 + 1] * step;

          // Wrap: quem sai por um lado reentra pelo oposto, então a cobertura
          // da tela é constante no tempo.
          if (positions[x] > halfW) positions[x] = -halfW;
          else if (positions[x] < -halfW) positions[x] = halfW;
          if (positions[y] > halfH) positions[y] = -halfH;
          else if (positions[y] < -halfH) positions[y] = halfH;
        }

        cloud.points.geometry.attributes.position.needsUpdate = true;
        const material = cloud.points.material as THREE.PointsMaterial;
        material.opacity = cloud.baseOpacity * (1 + activityRef.current * 0.6);
      }

      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const start = () => {
      if (frame || reduced) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    renderer.render(scene, camera); // Primeiro quadro: também é o único se houver reduced-motion.
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      for (const cloud of clouds) {
        cloud.points.geometry.dispose();
        (cloud.points.material as THREE.PointsMaterial).dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="backdrop" aria-hidden="true" />;
}
