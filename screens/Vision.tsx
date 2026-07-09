/**
 * Módulo VISIÓN IA (experimental) — control de zonas y tiempos por cámara.
 *
 * Detecta PERSONAS en vivo con TensorFlow.js (COCO-SSD) corriendo 100% en el
 * navegador — sin servidor, sin enviar video a la nube. Sobre el video se
 * dibujan ZONAS (Cocina, Barra, Caja…) con dos tipos de regla:
 *
 *   · Zona atendida    → alerta si queda SIN personal más de X minutos.
 *   · Zona restringida → alerta si ALGUIEN entra (con cooldown de 60s).
 *
 * Cada alerta: beep + notificación del navegador + WhatsApp (CallMeBot,
 * opcional) + evento en Supabase con snapshot del momento.
 *
 * Fase 0 (este módulo): PC + webcam. Para cámaras RTSP existentes y la
 * versión de producción ver docs/business-plan/koso-pos/GUIA_VISION_COMPUTACIONAL.md
 *
 * Privacidad: detecta "persona" (silueta), NO identifica rostros ni
 * individuos. Avisa a tu personal y coloca señalética de videovigilancia
 * (LFPDPPP). El video nunca sale del equipo; solo se suben capturas de
 * eventos.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, Play, Square, Trash2, Eye, AlertTriangle, Clock, Bell,
  ShieldAlert, UserCheck, Settings2, X, RefreshCw, MessageCircle,
  ScanEye, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { notify, requestNotifyPermission } from '../services/notify';
import {
  logVisionEvent, loadVisionEvents, sendWhatsAppAlert, type VisionEvent,
} from '../services/vision';
import { SrKicker, SrChip, SrLabel } from '../components/ui/servirest';

// ── Tipos ────────────────────────────────────────────────────────────────
type ZoneRule = 'attended' | 'restricted';

interface Zone {
  id: string;
  name: string;
  rule: ZoneRule;
  maxVacantMin: number;       // solo para 'attended'
  // Rect normalizado 0–1 (sobrevive cambios de resolución)
  x: number; y: number; w: number; h: number;
}

interface ZoneRuntime {
  occupied: boolean;
  since: number;              // ts del último cambio de estado
  alerted: boolean;           // ya alertó esta vacancia
  lastIntrusionAlert: number;
  occupiedMs: number;
  vacantMs: number;
  episodes: number;           // vacancias que dispararon alerta
  lastTick: number;
  persons: number;
}

interface VisionConfig {
  cameraName: string;
  whatsPhone: string;
  whatsKey: string;
  whatsEnabled: boolean;
  intervalMs: number;
  minScore: number;
}

const DEFAULT_CONFIG: VisionConfig = {
  cameraName: 'PC',
  whatsPhone: '',
  whatsKey: '',
  whatsEnabled: false,
  intervalMs: 700,
  minScore: 0.5,
};

const ZONE_COLORS = ['#C4633F', '#C9A24A', '#4A7BC9', '#5FA05A', '#9A5FA0', '#C94A6B'];

const fmtDur = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

const beepAlarm = () => {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [0, 0.25, 0.5].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 700 + i * 180;
      gain.gain.value = 0.12;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.18);
    });
    setTimeout(() => ctx.close(), 1200);
    navigator.vibrate?.([150, 80, 150]);
  } catch { /* best-effort */ }
};

// ── Componente principal ─────────────────────────────────────────────────
export const VisionScreen: React.FC = () => {
  const { authProfile } = useUser();
  const { settings } = useSettings();
  const businessId = authProfile?.businessId || '';

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<any>(null);
  const detectionsRef = useRef<any[]>([]);
  const runtimeRef = useRef<Map<string, ZoneRuntime>>(new Map());
  const loopRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const zonesRef = useRef<Zone[]>([]);
  const configRef = useRef<VisionConfig>(DEFAULT_CONFIG);
  const busyRef = useRef(false);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [zones, setZones] = useState<Zone[]>([]);
  const [events, setEvents] = useState<VisionEvent[]>([]);
  const [config, setConfig] = useState<VisionConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [inferMs, setInferMs] = useState(0);
  const [, setTick] = useState(0); // re-render de timers cada segundo
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Dibujo de zona nueva
  const drawingRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [pendingRect, setPendingRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneRule, setZoneRule] = useState<ZoneRule>('attended');
  const [zoneMaxVacant, setZoneMaxVacant] = useState(3);

  zonesRef.current = zones;
  configRef.current = config;

  // ── Persistencia local (zonas y config viven por equipo/cámara) ──────
  useEffect(() => {
    if (!businessId) return;
    try {
      const z = localStorage.getItem(`vision_zones_${businessId}`);
      if (z) setZones(JSON.parse(z));
      const c = localStorage.getItem(`vision_config_${businessId}`);
      if (c) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(c) });
    } catch { /* no-op */ }
    loadVisionEvents(businessId, 40).then(setEvents);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    localStorage.setItem(`vision_zones_${businessId}`, JSON.stringify(zones));
  }, [zones, businessId]);

  useEffect(() => {
    if (!businessId) return;
    localStorage.setItem(`vision_config_${businessId}`, JSON.stringify(config));
  }, [config, businessId]);

  // ── Cámaras disponibles ───────────────────────────────────────────────
  const refreshCameras = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const cams = devs.filter((d) => d.kind === 'videoinput');
      setCameras(cams);
      if (!cameraId && cams[0]) setCameraId(cams[0].deviceId);
    } catch { /* sin permisos aún */ }
  };
  useEffect(() => { refreshCameras(); }, []);

  // ── Iniciar / detener ─────────────────────────────────────────────────
  const start = async () => {
    try {
      requestNotifyPermission();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId ? { deviceId: { exact: cameraId }, width: 1280, height: 720 } : { width: 1280, height: 720 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      refreshCameras(); // ahora sí con labels
      setRunning(true);
      setStartedAt(Date.now());
      runtimeRef.current = new Map();

      // Carga del modelo (una sola vez, lazy — code-split de Vite)
      if (!modelRef.current) {
        setModelState('loading');
        try {
          const tf = await import('@tensorflow/tfjs');
          await tf.ready();
          const cocoSsd = await import('@tensorflow-models/coco-ssd');
          modelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
          setModelState('ready');
        } catch (e) {
          console.error('[Vision] model load failed:', e);
          setModelState('error');
          return;
        }
      } else {
        setModelState('ready');
      }
      scheduleDetect();
    } catch (e: any) {
      alert('No pudimos abrir la cámara: ' + (e.message || 'revisa permisos'));
    }
  };

  const stop = () => {
    setRunning(false);
    setStartedAt(null);
    if (loopRef.current) { clearTimeout(loopRef.current); loopRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectionsRef.current = [];
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => () => { stop(); cancelAnimationFrame(rafRef.current); }, []);

  // Timers en pantalla (1s)
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Snapshot del momento (video + zonas) ──────────────────────────────
  const takeSnapshot = (): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const W = 480;
    const H = Math.round((video.videoHeight / video.videoWidth) * W);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, W, H);
    zonesRef.current.forEach((z, i) => {
      ctx.strokeStyle = ZONE_COLORS[i % ZONE_COLORS.length];
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);
    });
    return c.toDataURL('image/jpeg', 0.6);
  };

  // ── Alerta (beep + notif + whats + Supabase) ──────────────────────────
  const fireAlert = (zone: Zone, type: 'zone_vacant' | 'zone_intrusion' | 'zone_recovered', message: string, durationSec?: number) => {
    if (type !== 'zone_recovered') beepAlarm();
    notify(`Visión IA — ${zone.name}`, message);

    const snap = type === 'zone_recovered' ? null : takeSnapshot();
    const cfg = configRef.current;

    // Persistencia + WhatsApp en segundo plano
    (async () => {
      const snapshotUrl = await logVisionEvent(
        businessId, cfg.cameraName, zone.name, type, message, durationSec ?? null, snap
      );
      if (cfg.whatsEnabled && type !== 'zone_recovered') {
        const text = `🎥 ${settings.name || 'ServiRest'} — ${message}${snapshotUrl ? `\n📸 ${snapshotUrl}` : ''}`;
        sendWhatsAppAlert(cfg.whatsPhone, cfg.whatsKey, text);
      }
      loadVisionEvents(businessId, 40).then(setEvents);
    })();

    // Refleja de inmediato en el timeline local
    setEvents((prev) => [{
      id: `local-${prev.length}-${zone.id}`,
      camera: cfg.cameraName, zone: zone.name, type, message,
      durationSec: durationSec ?? null, snapshotUrl: null,
      createdAt: new Date().toISOString(),
    }, ...prev].slice(0, 60));
  };

  // ── Loop de detección ─────────────────────────────────────────────────
  const scheduleDetect = () => {
    loopRef.current = window.setTimeout(runDetect, configRef.current.intervalMs);
  };

  const runDetect = async () => {
    const video = videoRef.current;
    if (!streamRef.current || !video || !modelRef.current) return;
    if (busyRef.current) { scheduleDetect(); return; }
    busyRef.current = true;
    try {
      const t0 = performance.now();
      const preds = await modelRef.current.detect(video);
      setInferMs(Math.round(performance.now() - t0));

      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;
      const persons = preds
        .filter((p: any) => p.class === 'person' && p.score >= configRef.current.minScore)
        .map((p: any) => ({
          x: p.bbox[0] / vw, y: p.bbox[1] / vh, w: p.bbox[2] / vw, h: p.bbox[3] / vh,
          score: p.score,
        }));
      detectionsRef.current = persons;

      // Punto ancla: centro-inferior del bbox (los pies de la persona)
      const anchors = persons.map((p: any) => ({ ax: p.x + p.w / 2, ay: p.y + p.h }));
      const now = Date.now();

      zonesRef.current.forEach((z) => {
        const inside = anchors.filter((a) => a.ax >= z.x && a.ax <= z.x + z.w && a.ay >= z.y && a.ay <= z.y + z.h).length;
        let rt = runtimeRef.current.get(z.id);
        if (!rt) {
          rt = { occupied: inside > 0, since: now, alerted: false, lastIntrusionAlert: 0, occupiedMs: 0, vacantMs: 0, episodes: 0, lastTick: now, persons: inside };
          runtimeRef.current.set(z.id, rt);
          return;
        }
        // Acumula tiempo en el estado actual
        const delta = now - rt.lastTick;
        if (rt.occupied) rt.occupiedMs += delta; else rt.vacantMs += delta;
        rt.lastTick = now;
        rt.persons = inside;

        const occupiedNow = inside > 0;
        if (occupiedNow !== rt.occupied) {
          // Cambio de estado
          if (occupiedNow && rt.alerted && z.rule === 'attended') {
            const dur = Math.round((now - rt.since) / 1000);
            fireAlert(z, 'zone_recovered', `La zona "${z.name}" volvió a estar cubierta (estuvo vacía ${fmtDur(dur * 1000)}).`, dur);
          }
          rt.occupied = occupiedNow;
          rt.since = now;
          rt.alerted = false;
        }

        if (z.rule === 'attended' && !rt.occupied && !rt.alerted) {
          const vacantFor = now - rt.since;
          if (vacantFor > z.maxVacantMin * 60000) {
            rt.alerted = true;
            rt.episodes += 1;
            fireAlert(z, 'zone_vacant', `⚠️ Zona "${z.name}" SIN personal desde hace ${fmtDur(vacantFor)} (límite ${z.maxVacantMin} min).`, Math.round(vacantFor / 1000));
          }
        }
        if (z.rule === 'restricted' && occupiedNow && now - rt.lastIntrusionAlert > 60000) {
          rt.lastIntrusionAlert = now;
          fireAlert(z, 'zone_intrusion', `🚨 Persona detectada en zona restringida "${z.name}".`);
        }
      });
    } catch (e) {
      console.warn('[Vision] detect error:', e);
    } finally {
      busyRef.current = false;
      if (streamRef.current) scheduleDetect();
    }
  };

  // ── Overlay (zonas + detecciones) ─────────────────────────────────────
  useEffect(() => {
    const draw = () => {
      const canvas = overlayRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const W = video.clientWidth || 1;
        const H = video.clientHeight || 1;
        if (canvas.width !== W) canvas.width = W;
        if (canvas.height !== H) canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, W, H);

          // Zonas
          zonesRef.current.forEach((z, i) => {
            const color = ZONE_COLORS[i % ZONE_COLORS.length];
            const rt = runtimeRef.current.get(z.id);
            const alertActive = rt && ((z.rule === 'attended' && rt.alerted) || (z.rule === 'restricted' && rt.occupied));
            ctx.fillStyle = color + (alertActive ? '44' : '1A');
            ctx.strokeStyle = alertActive ? '#E53E3E' : color;
            ctx.lineWidth = alertActive ? 3 : 2;
            ctx.fillRect(z.x * W, z.y * H, z.w * W, z.h * H);
            ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillStyle = '#FFF';
            const label = `${z.name} · ${rt?.persons ?? 0}👤`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = alertActive ? '#E53E3E' : color;
            ctx.fillRect(z.x * W, z.y * H - 18, tw + 12, 18);
            ctx.fillStyle = '#FFF';
            ctx.fillText(label, z.x * W + 6, z.y * H - 5);
          });

          // Personas detectadas
          detectionsRef.current.forEach((p: any) => {
            ctx.strokeStyle = '#5FA05A';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x * W, p.y * H, p.w * W, p.h * H);
            // punto ancla (pies)
            ctx.fillStyle = '#5FA05A';
            ctx.beginPath();
            ctx.arc((p.x + p.w / 2) * W, (p.y + p.h) * H, 4, 0, Math.PI * 2);
            ctx.fill();
          });

          // Rect en dibujo
          const d = drawingRef.current;
          if (d) {
            ctx.strokeStyle = '#C4633F';
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 2;
            ctx.strokeRect(Math.min(d.x0, d.x1) * W, Math.min(d.y0, d.y1) * H, Math.abs(d.x1 - d.x0) * W, Math.abs(d.y1 - d.y0) * H);
            ctx.setLineDash([]);
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Dibujo de zonas con el mouse/dedo ─────────────────────────────────
  const norm = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!running) return;
    const p = norm(e);
    drawingRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const p = norm(e);
    drawingRef.current.x1 = p.x;
    drawingRef.current.y1 = p.y;
  };
  const onPointerUp = () => {
    const d = drawingRef.current;
    drawingRef.current = null;
    if (!d) return;
    const w = Math.abs(d.x1 - d.x0);
    const h = Math.abs(d.y1 - d.y0);
    if (w < 0.03 || h < 0.03) return; // click accidental
    setPendingRect({ x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w, h });
    setZoneName('');
    setZoneRule('attended');
    setZoneMaxVacant(3);
  };

  const savePendingZone = () => {
    if (!pendingRect || !zoneName.trim()) return;
    setZones((prev) => [...prev, {
      id: crypto.randomUUID(),
      name: zoneName.trim(),
      rule: zoneRule,
      maxVacantMin: Math.max(1, zoneMaxVacant),
      ...pendingRect,
    }]);
    setPendingRect(null);
  };

  const removeZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    runtimeRef.current.delete(id);
  };

  // ── UI ────────────────────────────────────────────────────────────────
  const now = Date.now();

  return (
    <div className="h-full w-full bg-servirest-hueso text-servirest-carbon flex flex-col overflow-hidden antialiased">
      {/* Header */}
      <header className="flex-shrink-0 px-6 md:px-10 pt-8 pb-5 border-b border-[rgba(42,40,38,0.08)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <SrKicker>Módulo experimental</SrKicker>
              <SrChip tone="mostaza">Beta</SrChip>
            </div>
            <h1 className="font-serif italic text-servirest-midnight text-3xl md:text-4xl mt-1 flex items-center gap-3">
              <ScanEye size={30} className="text-servirest-terracota" /> Visión IA
            </h1>
            <p className="text-[13px] text-[rgba(42,40,38,0.55)] mt-1 max-w-xl">
              Dibuja zonas sobre la cámara y recibe alertas si quedan sin personal o si alguien entra donde no debe.
              El video se procesa en este equipo — nunca sale a internet.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              disabled={running}
              className="h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[13px] font-medium max-w-[220px]"
            >
              {cameras.length === 0 && <option value="">Cámara predeterminada</option>}
              {cameras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${i + 1}`}</option>
              ))}
            </select>
            <button onClick={() => setShowConfig(true)} className="w-11 h-11 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] flex items-center justify-center text-[rgba(42,40,38,0.6)] hover:text-servirest-terracota">
              <Settings2 size={18} />
            </button>
            {!running ? (
              <button onClick={start} className="h-11 px-6 rounded-full bg-servirest-terracota text-servirest-hueso font-black uppercase tracking-[0.12em] text-[11px] flex items-center gap-2 hover:scale-105 transition-transform">
                <Play size={15} /> Iniciar cámara
              </button>
            ) : (
              <button onClick={stop} className="h-11 px-6 rounded-full bg-servirest-midnight text-servirest-hueso font-black uppercase tracking-[0.12em] text-[11px] flex items-center gap-2">
                <Square size={14} /> Detener
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 max-w-7xl">
          {/* ── Video + overlay ── */}
          <div>
            <div className="relative rounded-3xl overflow-hidden bg-servirest-midnight aspect-video shadow-lg">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain" muted playsInline />
              <canvas
                ref={overlayRef}
                className="absolute inset-0 w-full h-full touch-none"
                style={{ cursor: running ? 'crosshair' : 'default' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
              {!running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-servirest-hueso/60">
                  <Camera size={44} className="mb-3" />
                  <p className="text-[13px]">Inicia la cámara para monitorear tus zonas</p>
                </div>
              )}
              {running && modelState === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-servirest-midnight/70 text-servirest-hueso">
                  <RefreshCw size={34} className="animate-spin mb-3" />
                  <p className="text-[13px]">Cargando modelo de detección… (solo la primera vez)</p>
                </div>
              )}
              {running && modelState === 'ready' && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-black/50 text-white text-[10px] font-mono">{inferMs} ms</span>
                  <span className="px-2.5 py-1 rounded-full bg-green-600/80 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> En vivo
                  </span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-[rgba(42,40,38,0.45)] mt-2 flex items-center gap-1.5">
              <Eye size={13} /> Con la cámara activa, <b>arrastra sobre el video</b> para dibujar una zona nueva. Detección: personas (verde), punto = posición de los pies.
            </p>

            {startedAt && (
              <div className="mt-3 text-[11px] text-[rgba(42,40,38,0.5)] flex items-center gap-2">
                <Clock size={13} /> Monitoreando desde hace {fmtDur(now - startedAt)}
              </div>
            )}
          </div>

          {/* ── Panel: zonas + eventos ── */}
          <div className="space-y-5">
            {/* Zonas */}
            <div className="rounded-3xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-5">
              <div className="font-serif italic text-servirest-midnight text-[17px] mb-3">Zonas ({zones.length})</div>
              {zones.length === 0 ? (
                <p className="text-[12px] text-[rgba(42,40,38,0.5)]">Aún no hay zonas. Inicia la cámara y arrastra sobre el video para crear la primera (ej. "Barra", "Caja", "Cocina").</p>
              ) : (
                <div className="space-y-2.5">
                  {zones.map((z, i) => {
                    const rt = runtimeRef.current.get(z.id);
                    const color = ZONE_COLORS[i % ZONE_COLORS.length];
                    const stateFor = rt ? now - rt.since : 0;
                    const total = rt ? rt.occupiedMs + rt.vacantMs : 0;
                    const pct = total > 0 ? Math.round((rt!.occupiedMs / total) * 100) : null;
                    return (
                      <div key={z.id} className="rounded-2xl bg-servirest-hueso border border-[rgba(42,40,38,0.08)] p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
                          <span className="font-bold text-servirest-midnight text-[13px] flex-1 truncate">{z.name}</span>
                          {z.rule === 'attended'
                            ? <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-servirest-mostaza/20 text-servirest-mostaza flex items-center gap-1"><UserCheck size={10} /> Atendida ≤{z.maxVacantMin}m</span>
                            : <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-servirest-danger/15 text-servirest-danger flex items-center gap-1"><ShieldAlert size={10} /> Restringida</span>}
                          <button onClick={() => removeZone(z.id)} className="text-[rgba(42,40,38,0.35)] hover:text-servirest-danger flex-shrink-0"><Trash2 size={14} /></button>
                        </div>
                        {running && rt && (
                          <div className="flex items-center gap-3 mt-2 text-[11px]">
                            {rt.occupied
                              ? <span className="text-green-700 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Cubierta · {rt.persons}👤 · {fmtDur(stateFor)}</span>
                              : <span className={`font-bold flex items-center gap-1 ${rt.alerted ? 'text-servirest-danger' : 'text-[rgba(42,40,38,0.55)]'}`}><AlertTriangle size={12} /> Vacía {fmtDur(stateFor)}</span>}
                            {pct !== null && <span className="text-[rgba(42,40,38,0.45)] font-mono ml-auto">{pct}% cubierta · {rt.episodes} alertas</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Eventos */}
            <div className="rounded-3xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-serif italic text-servirest-midnight text-[17px]">Eventos</div>
                <Bell size={15} className="text-servirest-terracota" />
              </div>
              {events.length === 0 ? (
                <p className="text-[12px] text-[rgba(42,40,38,0.5)]">Sin eventos aún. Aquí verás las alertas con su captura.</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {events.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2.5 rounded-xl bg-servirest-hueso border border-[rgba(42,40,38,0.06)] p-2.5">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        ev.type === 'zone_intrusion' ? 'bg-servirest-danger/15 text-servirest-danger'
                        : ev.type === 'zone_vacant' ? 'bg-servirest-mostaza/25 text-servirest-mostaza'
                        : 'bg-green-600/15 text-green-700'
                      }`}>
                        {ev.type === 'zone_intrusion' ? <ShieldAlert size={13} /> : ev.type === 'zone_vacant' ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-servirest-midnight leading-snug">{ev.message}</div>
                        <div className="text-[10px] text-[rgba(42,40,38,0.45)] mt-0.5 flex items-center gap-2">
                          {new Date(ev.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {ev.camera}
                          {ev.snapshotUrl && (
                            <a href={ev.snapshotUrl} target="_blank" rel="noreferrer" className="text-servirest-terracota font-bold flex items-center gap-0.5 hover:underline">
                              <ExternalLink size={10} /> Captura
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: nombrar zona nueva ── */}
      {pendingRect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-5" onClick={() => setPendingRect(null)}>
          <div className="w-full max-w-sm bg-servirest-hueso rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-serif italic text-servirest-midnight text-xl mb-4">Nueva zona</div>
            <SrLabel className="block mb-1.5">Nombre de la zona</SrLabel>
            <input
              autoFocus
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="Ej. Barra, Caja, Cocina…"
              className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] mb-4 focus:outline-none focus:border-servirest-terracota"
            />
            <SrLabel className="block mb-1.5">Regla</SrLabel>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setZoneRule('attended')} className={`h-16 rounded-2xl border text-left px-3 transition-all ${zoneRule === 'attended' ? 'border-servirest-terracota bg-servirest-terracota/5' : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface'}`}>
                <div className="text-[11px] font-black text-servirest-midnight flex items-center gap-1"><UserCheck size={13} /> Atendida</div>
                <div className="text-[10px] text-[rgba(42,40,38,0.5)] mt-0.5">Alerta si queda vacía</div>
              </button>
              <button onClick={() => setZoneRule('restricted')} className={`h-16 rounded-2xl border text-left px-3 transition-all ${zoneRule === 'restricted' ? 'border-servirest-danger bg-servirest-danger/5' : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface'}`}>
                <div className="text-[11px] font-black text-servirest-midnight flex items-center gap-1"><ShieldAlert size={13} /> Restringida</div>
                <div className="text-[10px] text-[rgba(42,40,38,0.5)] mt-0.5">Alerta si alguien entra</div>
              </button>
            </div>
            {zoneRule === 'attended' && (
              <div className="mb-4">
                <SrLabel className="block mb-1.5">Minutos máximos sin personal</SrLabel>
                <input
                  type="number" min={1} max={120}
                  value={zoneMaxVacant}
                  onChange={(e) => setZoneMaxVacant(Number(e.target.value) || 1)}
                  className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setPendingRect(null)} className="flex-1 h-11 rounded-full border border-[rgba(42,40,38,0.15)] text-[rgba(42,40,38,0.6)] text-[11px] font-black uppercase tracking-[0.1em]">Cancelar</button>
              <button onClick={savePendingZone} disabled={!zoneName.trim()} className="flex-1 h-11 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black uppercase tracking-[0.1em] disabled:opacity-40">Guardar zona</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: configuración ── */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-5" onClick={() => setShowConfig(false)}>
          <div className="w-full max-w-md bg-servirest-hueso rounded-3xl p-6 shadow-2xl max-h-[85dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="font-serif italic text-servirest-midnight text-xl">Configuración</div>
              <button onClick={() => setShowConfig(false)} className="w-9 h-9 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.5)]"><X size={16} /></button>
            </div>

            <SrLabel className="block mb-1.5">Nombre de esta cámara / punto</SrLabel>
            <input
              value={config.cameraName}
              onChange={(e) => setConfig((c) => ({ ...c, cameraName: e.target.value }))}
              placeholder="Ej. Barra principal"
              className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] mb-4 focus:outline-none focus:border-servirest-terracota"
            />

            <div className="rounded-2xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-black text-servirest-midnight flex items-center gap-1.5"><MessageCircle size={14} className="text-green-600" /> Alertas por WhatsApp</div>
                <button
                  onClick={() => setConfig((c) => ({ ...c, whatsEnabled: !c.whatsEnabled }))}
                  className={`w-11 h-6 rounded-full transition-colors relative ${config.whatsEnabled ? 'bg-green-600' : 'bg-[rgba(42,40,38,0.2)]'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${config.whatsEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              <p className="text-[10px] text-[rgba(42,40,38,0.5)] mb-3 leading-relaxed">
                Usa CallMeBot (gratis, para pruebas): 1) agrega +34 644 71 81 99 a tus contactos, 2) mándale por WhatsApp
                "I allow callmebot to send me messages", 3) te responde tu <b>apikey</b> — pégala aquí.
              </p>
              <input
                value={config.whatsPhone}
                onChange={(e) => setConfig((c) => ({ ...c, whatsPhone: e.target.value }))}
                placeholder="Teléfono con lada, ej. +5214771234567"
                className="w-full h-10 px-4 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[13px] mb-2 focus:outline-none focus:border-servirest-terracota"
              />
              <input
                value={config.whatsKey}
                onChange={(e) => setConfig((c) => ({ ...c, whatsKey: e.target.value }))}
                placeholder="apikey de CallMeBot"
                className="w-full h-10 px-4 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[13px] mb-2 focus:outline-none focus:border-servirest-terracota"
              />
              <button
                onClick={() => { sendWhatsAppAlert(config.whatsPhone, config.whatsKey, '✅ Prueba de Visión IA — ServiRest'); alert('Enviado (si tu apikey es correcta llegará en unos segundos).'); }}
                className="w-full h-10 rounded-full bg-green-600 text-white text-[11px] font-black uppercase tracking-[0.1em]"
              >
                Enviar prueba
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <SrLabel className="block mb-1.5">Intervalo (ms)</SrLabel>
                <input
                  type="number" min={300} max={5000} step={100}
                  value={config.intervalMs}
                  onChange={(e) => setConfig((c) => ({ ...c, intervalMs: Math.max(300, Number(e.target.value) || 700) }))}
                  className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota"
                />
              </div>
              <div>
                <SrLabel className="block mb-1.5">Confianza mín.</SrLabel>
                <input
                  type="number" min={0.2} max={0.9} step={0.05}
                  value={config.minScore}
                  onChange={(e) => setConfig((c) => ({ ...c, minScore: Math.min(0.9, Math.max(0.2, Number(e.target.value) || 0.5)) }))}
                  className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota"
                />
              </div>
            </div>
            <p className="text-[10px] text-[rgba(42,40,38,0.45)] leading-relaxed">
              Tip: si tu PC va lenta sube el intervalo a 1000–1500 ms. Si detecta "fantasmas", sube la confianza a 0.6.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisionScreen;
