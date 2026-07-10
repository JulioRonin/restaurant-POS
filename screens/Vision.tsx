/**
 * Módulo VISIÓN IA (experimental) — control de zonas y tiempos por cámara.
 *
 * Detecta PERSONAS en vivo con TensorFlow.js (COCO-SSD) corriendo 100% en el
 * navegador — sin servidor, sin enviar video a la nube.
 *
 * ── Multi-cámara ────────────────────────────────────────────────────────
 * Defines varias CÁMARAS (perfiles con nombre + dispositivo). Cada cámara
 * tiene SUS PROPIAS zonas e inspecciones. En la PC analizas una cámara a la
 * vez (cambias entre ellas); en producción (Frigate) corren todas a la vez.
 *
 * ── Herramientas / reglas por zona ──────────────────────────────────────
 *   · Atendida         → alerta si queda sin personal > X min.
 *   · Restringida      → alerta si alguien entra.
 *   · Puesto anfitrión → dónde debe estar el host (mide cobertura del puesto).
 *   · Llegada clientes → puerta/entrada donde aparece el cliente.
 *
 * ── Modo Recepción ──────────────────────────────────────────────────────
 * Si una cámara tiene un "Puesto anfitrión" + una "Llegada de clientes", el
 * sistema CORRELACIONA ambas para medir el problema clásico: clientes que
 * llegan, no encuentran a nadie y se van. KPIs: llegadas, atendidos,
 * ABANDONOS (clientes perdidos), tiempo de recepción y % de cobertura del
 * puesto. Alerta EN VIVO cuando hay alguien esperando sin atención.
 *
 * Privacidad: detecta "persona" (silueta), NO identifica rostros. Coloca
 * señalética de videovigilancia y avisa a tu personal (LFPDPPP). El video
 * nunca sale del equipo; solo se suben capturas de eventos.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, Play, Square, Trash2, Eye, AlertTriangle, Clock, Bell,
  ShieldAlert, UserCheck, Settings2, X, RefreshCw, MessageCircle,
  ScanEye, CheckCircle2, ExternalLink, Plus, DoorOpen, Users, UserX,
  Pencil, TrendingUp, Timer,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { notify, requestNotifyPermission } from '../services/notify';
import {
  logVisionEvent, loadVisionEvents, sendWhatsAppAlert,
  type VisionEvent, type VisionEventType,
} from '../services/vision';
import { SrKicker, SrChip, SrLabel } from '../components/ui/servirest';

// ── Tipos ────────────────────────────────────────────────────────────────
type ZoneRule = 'attended' | 'restricted' | 'host_post' | 'guest_arrival';

interface CameraProfile { key: string; name: string; deviceId: string; }

interface Zone {
  id: string;
  cameraKey: string;          // a qué cámara pertenece
  name: string;
  rule: ZoneRule;
  maxVacantMin: number;       // 'attended' / 'host_post'
  x: number; y: number; w: number; h: number; // rect normalizado 0–1
}

interface ZoneRuntime {
  occupied: boolean;
  since: number;
  alerted: boolean;
  lastIntrusionAlert: number;
  occupiedMs: number;
  vacantMs: number;
  episodes: number;
  lastTick: number;
  persons: number;
}

interface ReceptionRuntime {
  arrivals: number;
  attended: number;
  unattended: number;
  sumGreetSec: number;
  maxWaitSec: number;
  // transitorio
  guestActive: boolean;
  guestSince: number;
  counted: boolean;
  greeted: boolean;
  waitAlerted: boolean;
}

interface VisionConfig {
  whatsPhone: string;
  whatsKey: string;
  whatsEnabled: boolean;
  intervalMs: number;
  minScore: number;
  arrivalMinDwellSec: number; // segundos para contar una llegada real (filtra paso)
  waitAlertSec: number;       // segundos esperando sin atención → alerta en vivo
}

const DEFAULT_CONFIG: VisionConfig = {
  whatsPhone: '', whatsKey: '', whatsEnabled: false,
  intervalMs: 700, minScore: 0.5,
  arrivalMinDwellSec: 3, waitAlertSec: 12,
};

const RULE_META: Record<ZoneRule, { label: string; short: string; color: string; icon: React.ElementType }> = {
  attended:      { label: 'Zona atendida',    short: 'Atendida',     color: '#C9A24A', icon: UserCheck },
  restricted:    { label: 'Zona restringida', short: 'Restringida',  color: '#C94A6B', icon: ShieldAlert },
  host_post:     { label: 'Puesto anfitrión', short: 'Anfitrión',    color: '#4A7BC9', icon: Users },
  guest_arrival: { label: 'Llegada clientes', short: 'Entrada',      color: '#9A5FA0', icon: DoorOpen },
};

const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

const beepAlarm = (urgent = false) => {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const tones = urgent ? [0, 0.2, 0.4, 0.6] : [0, 0.25, 0.5];
    tones.forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = (urgent ? 820 : 700) + i * 180;
      gain.gain.value = 0.12;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.18);
    });
    setTimeout(() => ctx.close(), 1400);
    navigator.vibrate?.(urgent ? [200, 80, 200, 80, 200] : [150, 80, 150]);
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
  const receptionRef = useRef<Map<string, ReceptionRuntime>>(new Map());
  const loopRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const zonesRef = useRef<Zone[]>([]);
  const configRef = useRef<VisionConfig>(DEFAULT_CONFIG);
  const activeKeyRef = useRef<string>('');
  const busyRef = useRef(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<CameraProfile[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [zones, setZones] = useState<Zone[]>([]);
  const [events, setEvents] = useState<VisionEvent[]>([]);
  const [config, setConfig] = useState<VisionConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [inferMs, setInferMs] = useState(0);
  const [, setTick] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Alta/edición de cámara
  const [camModal, setCamModal] = useState<CameraProfile | null>(null);

  // Dibujo de zona
  const drawingRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [pendingRect, setPendingRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneRule, setZoneRule] = useState<ZoneRule>('attended');
  const [zoneMaxVacant, setZoneMaxVacant] = useState(3);

  zonesRef.current = zones;
  configRef.current = config;
  activeKeyRef.current = activeKey;

  const activeCamera = cameras.find((c) => c.key === activeKey) || null;
  const activeZones = zones.filter((z) => z.cameraKey === activeKey);
  const hostZone = activeZones.find((z) => z.rule === 'host_post');
  const guestZone = activeZones.find((z) => z.rule === 'guest_arrival');
  const receptionActive = !!hostZone && !!guestZone;

  // ── Persistencia local ────────────────────────────────────────────────
  useEffect(() => {
    if (!businessId) return;
    try {
      const cs = localStorage.getItem(`vision_cameras_${businessId}`);
      const parsedCams: CameraProfile[] = cs ? JSON.parse(cs) : [];
      setCameras(parsedCams);
      setActiveKey((prev) => prev || parsedCams[0]?.key || '');
      const z = localStorage.getItem(`vision_zones_${businessId}`);
      if (z) setZones(JSON.parse(z));
      const c = localStorage.getItem(`vision_config_${businessId}`);
      if (c) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(c) });
    } catch { /* no-op */ }
    loadVisionEvents(businessId, 50).then(setEvents);
  }, [businessId]);

  useEffect(() => { if (businessId) localStorage.setItem(`vision_cameras_${businessId}`, JSON.stringify(cameras)); }, [cameras, businessId]);
  useEffect(() => { if (businessId) localStorage.setItem(`vision_zones_${businessId}`, JSON.stringify(zones)); }, [zones, businessId]);
  useEffect(() => { if (businessId) localStorage.setItem(`vision_config_${businessId}`, JSON.stringify(config)); }, [config, businessId]);

  // ── Dispositivos ──────────────────────────────────────────────────────
  const refreshDevices = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      setDevices(devs.filter((d) => d.kind === 'videoinput'));
    } catch { /* sin permiso aún */ }
  };
  useEffect(() => { refreshDevices(); }, []);

  // ── Stream de la cámara activa ────────────────────────────────────────
  const openStream = async (deviceId: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId }, width: 1280, height: 720 } : { width: 1280, height: 720 },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    refreshDevices();
  };

  const start = async () => {
    if (!activeCamera) { alert('Primero agrega una cámara con el botón "+ Cámara".'); return; }
    try {
      requestNotifyPermission();
      await openStream(activeCamera.deviceId);
      setRunning(true);
      setStartedAt(Date.now());
      runtimeRef.current = new Map();
      receptionRef.current = new Map();
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
      } else { setModelState('ready'); }
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

  // Cambiar de cámara activa: si está corriendo, cambia el stream en caliente.
  const switchCamera = async (key: string) => {
    setActiveKey(key);
    runtimeRef.current = new Map();
    receptionRef.current = new Map();
    detectionsRef.current = [];
    if (running) {
      const cam = cameras.find((c) => c.key === key);
      if (cam) { try { await openStream(cam.deviceId); setStartedAt(Date.now()); } catch { /* */ } }
    }
  };

  useEffect(() => () => { stop(); cancelAnimationFrame(rafRef.current); }, []);
  useEffect(() => { const iv = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(iv); }, []);

  // ── Snapshot ──────────────────────────────────────────────────────────
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
    zonesRef.current.filter((z) => z.cameraKey === activeKeyRef.current).forEach((z) => {
      ctx.strokeStyle = RULE_META[z.rule].color;
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);
    });
    return c.toDataURL('image/jpeg', 0.6);
  };

  // ── Alerta ────────────────────────────────────────────────────────────
  const fireAlert = (zoneLabel: string, type: VisionEventType, message: string, durationSec?: number, urgent = false) => {
    const silent = type === 'zone_recovered' || type === 'guest_attended';
    if (!silent) beepAlarm(urgent);
    notify(`Visión IA — ${activeCameraRef()?.name || 'Cámara'}`, message);
    const snap = silent ? null : takeSnapshot();
    const cam = activeCameraRef();
    const cfg = configRef.current;
    (async () => {
      const snapshotUrl = await logVisionEvent(businessId, cam?.name || 'PC', zoneLabel, type, message, durationSec ?? null, snap);
      if (cfg.whatsEnabled && !silent) {
        const text = `🎥 ${settings.name || 'ServiRest'} · ${cam?.name || ''} — ${message}${snapshotUrl ? `\n📸 ${snapshotUrl}` : ''}`;
        sendWhatsAppAlert(cfg.whatsPhone, cfg.whatsKey, text);
      }
      loadVisionEvents(businessId, 50).then(setEvents);
    })();
    setEvents((prev) => [{
      id: `local-${prev.length}-${Date.now() % 100000}`,
      camera: cam?.name || 'PC', zone: zoneLabel, type, message,
      durationSec: durationSec ?? null, snapshotUrl: null, createdAt: new Date().toISOString(),
    }, ...prev].slice(0, 80));
  };
  const activeCameraRef = () => cameras.find((c) => c.key === activeKeyRef.current) || null;

  // ── Loop de detección ─────────────────────────────────────────────────
  const scheduleDetect = () => { loopRef.current = window.setTimeout(runDetect, configRef.current.intervalMs); };

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
      const cfg = configRef.current;
      const persons = preds
        .filter((p: any) => p.class === 'person' && p.score >= cfg.minScore)
        .map((p: any) => ({ x: p.bbox[0] / vw, y: p.bbox[1] / vh, w: p.bbox[2] / vw, h: p.bbox[3] / vh }));
      detectionsRef.current = persons;
      const anchors = persons.map((p: any) => ({ ax: p.x + p.w / 2, ay: p.y + p.h })); // pies
      const now = Date.now();
      const camKey = activeKeyRef.current;
      const camZones = zonesRef.current.filter((z) => z.cameraKey === camKey);

      const inCount = (z: Zone) => anchors.filter((a) => a.ax >= z.x && a.ax <= z.x + z.w && a.ay >= z.y && a.ay <= z.y + z.h).length;

      // Reglas por zona (atendida / restringida / cobertura del puesto)
      camZones.forEach((z) => {
        const inside = inCount(z);
        let rt = runtimeRef.current.get(z.id);
        if (!rt) {
          rt = { occupied: inside > 0, since: now, alerted: false, lastIntrusionAlert: 0, occupiedMs: 0, vacantMs: 0, episodes: 0, lastTick: now, persons: inside };
          runtimeRef.current.set(z.id, rt);
          return;
        }
        const delta = now - rt.lastTick;
        if (rt.occupied) rt.occupiedMs += delta; else rt.vacantMs += delta;
        rt.lastTick = now;
        rt.persons = inside;
        const occupiedNow = inside > 0;
        const vacancyRule = z.rule === 'attended' || z.rule === 'host_post';

        if (occupiedNow !== rt.occupied) {
          if (occupiedNow && rt.alerted && vacancyRule) {
            const dur = Math.round((now - rt.since) / 1000);
            fireAlert(z.name, 'zone_recovered', `"${z.name}" volvió a estar cubierta (estuvo vacía ${fmtDur(dur * 1000)}).`, dur);
          }
          rt.occupied = occupiedNow; rt.since = now; rt.alerted = false;
        }
        if (vacancyRule && !rt.occupied && !rt.alerted) {
          const vacantFor = now - rt.since;
          if (vacantFor > z.maxVacantMin * 60000) {
            rt.alerted = true; rt.episodes += 1;
            fireAlert(z.name, 'zone_vacant', `⚠️ "${z.name}" sin personal desde hace ${fmtDur(vacantFor)} (límite ${z.maxVacantMin} min).`, Math.round(vacantFor / 1000));
          }
        }
        if (z.rule === 'restricted' && occupiedNow && now - rt.lastIntrusionAlert > 60000) {
          rt.lastIntrusionAlert = now;
          fireAlert(z.name, 'zone_intrusion', `🚨 Persona detectada en zona restringida "${z.name}".`);
        }
      });

      // ── Motor de RECEPCIÓN (correlación anfitrión + llegada) ──────────
      const hz = camZones.find((z) => z.rule === 'host_post');
      const gz = camZones.find((z) => z.rule === 'guest_arrival');
      if (hz && gz) {
        const hostOcc = inCount(hz) > 0;
        const guestOcc = inCount(gz) > 0;
        let rc = receptionRef.current.get(camKey);
        if (!rc) {
          rc = { arrivals: 0, attended: 0, unattended: 0, sumGreetSec: 0, maxWaitSec: 0, guestActive: false, guestSince: 0, counted: false, greeted: false, waitAlerted: false };
          receptionRef.current.set(camKey, rc);
        }
        if (guestOcc) {
          if (!rc.guestActive) { rc.guestActive = true; rc.guestSince = now; rc.counted = false; rc.greeted = false; rc.waitAlerted = false; }
          const dwell = now - rc.guestSince;
          if (!rc.counted && dwell >= cfg.arrivalMinDwellSec * 1000) { rc.counted = true; rc.arrivals += 1; }
          if (rc.counted && !rc.greeted && hostOcc) {
            rc.greeted = true;
            const greet = (now - rc.guestSince) / 1000;
            rc.attended += 1; rc.sumGreetSec += greet;
            fireAlert(gz.name, 'guest_attended', `✅ Cliente atendido en recepción (${Math.round(greet)}s).`, Math.round(greet));
          }
          // Alerta EN VIVO: cliente esperando sin atención
          if (rc.counted && !rc.greeted && !hostOcc && !rc.waitAlerted && dwell >= cfg.waitAlertSec * 1000) {
            rc.waitAlerted = true;
            rc.maxWaitSec = Math.max(rc.maxWaitSec, Math.round(dwell / 1000));
            fireAlert(gz.name, 'guest_waiting', `🔔 ¡Cliente esperando en recepción sin atención (${fmtDur(dwell)})! Nadie en "${hz.name}".`, Math.round(dwell / 1000), true);
          }
        } else if (rc.guestActive) {
          const dwell = now - rc.guestSince;
          if (rc.counted && !rc.greeted) {
            rc.unattended += 1;
            rc.maxWaitSec = Math.max(rc.maxWaitSec, Math.round(dwell / 1000));
            fireAlert(gz.name, 'guest_unattended', `❌ Cliente se fue SIN ser atendido tras esperar ${fmtDur(dwell)} (posible cliente perdido).`, Math.round(dwell / 1000), true);
          }
          rc.guestActive = false;
        }
      }
    } catch (e) {
      console.warn('[Vision] detect error:', e);
    } finally {
      busyRef.current = false;
      if (streamRef.current) scheduleDetect();
    }
  };

  // ── Overlay ───────────────────────────────────────────────────────────
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
          zonesRef.current.filter((z) => z.cameraKey === activeKeyRef.current).forEach((z) => {
            const color = RULE_META[z.rule].color;
            const rt = runtimeRef.current.get(z.id);
            const alertActive = rt && ((z.rule === 'attended' || z.rule === 'host_post') && rt.alerted) || (z.rule === 'restricted' && rt?.occupied);
            ctx.fillStyle = color + (alertActive ? '44' : '1A');
            ctx.strokeStyle = alertActive ? '#E53E3E' : color;
            ctx.lineWidth = alertActive ? 3 : 2;
            ctx.fillRect(z.x * W, z.y * H, z.w * W, z.h * H);
            ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);
            ctx.font = 'bold 12px Inter, sans-serif';
            const label = `${z.name} · ${rt?.persons ?? 0}👤`;
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = alertActive ? '#E53E3E' : color;
            ctx.fillRect(z.x * W, z.y * H - 18, tw + 12, 18);
            ctx.fillStyle = '#FFF';
            ctx.fillText(label, z.x * W + 6, z.y * H - 5);
          });
          detectionsRef.current.forEach((p: any) => {
            ctx.strokeStyle = '#5FA05A';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x * W, p.y * H, p.w * W, p.h * H);
            ctx.fillStyle = '#5FA05A';
            ctx.beginPath();
            ctx.arc((p.x + p.w / 2) * W, (p.y + p.h) * H, 4, 0, Math.PI * 2);
            ctx.fill();
          });
          const d = drawingRef.current;
          if (d) {
            ctx.strokeStyle = '#C4633F';
            ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
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

  // ── Dibujo de zonas ───────────────────────────────────────────────────
  const norm = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!running || !activeKey) return;
    const p = norm(e);
    drawingRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const p = norm(e);
    drawingRef.current.x1 = p.x; drawingRef.current.y1 = p.y;
  };
  const onPointerUp = () => {
    const d = drawingRef.current;
    drawingRef.current = null;
    if (!d) return;
    const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
    if (w < 0.03 || h < 0.03) return;
    setPendingRect({ x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w, h });
    setZoneName(''); setZoneRule('attended'); setZoneMaxVacant(3);
  };

  const savePendingZone = () => {
    if (!pendingRect || !zoneName.trim() || !activeKey) return;
    setZones((prev) => [...prev, {
      id: crypto.randomUUID(), cameraKey: activeKey, name: zoneName.trim(),
      rule: zoneRule, maxVacantMin: Math.max(1, zoneMaxVacant), ...pendingRect,
    }]);
    setPendingRect(null);
  };
  const removeZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    runtimeRef.current.delete(id);
  };

  // ── Cámaras (perfiles) ────────────────────────────────────────────────
  const saveCamera = (cam: CameraProfile) => {
    setCameras((prev) => {
      const exists = prev.some((c) => c.key === cam.key);
      return exists ? prev.map((c) => (c.key === cam.key ? cam : c)) : [...prev, cam];
    });
    setActiveKey(cam.key);
    setCamModal(null);
  };
  const removeCamera = (key: string) => {
    if (!confirm('¿Eliminar esta cámara y sus zonas?')) return;
    setCameras((prev) => prev.filter((c) => c.key !== key));
    setZones((prev) => prev.filter((z) => z.cameraKey !== key));
    if (activeKey === key) setActiveKey(cameras.find((c) => c.key !== key)?.key || '');
  };

  const now = Date.now();
  const reception = receptionRef.current.get(activeKey);

  return (
    <div className="h-full w-full bg-servirest-hueso text-servirest-carbon flex flex-col overflow-hidden antialiased">
      {/* Header */}
      <header className="flex-shrink-0 px-6 md:px-10 pt-8 pb-4 border-b border-[rgba(42,40,38,0.08)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <SrKicker>Módulo experimental</SrKicker>
              <SrChip tone="mostaza">Beta</SrChip>
            </div>
            <h1 className="font-serif italic text-servirest-midnight text-3xl md:text-4xl mt-1 flex items-center gap-3">
              <ScanEye size={30} className="text-servirest-terracota" /> Visión IA
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowConfig(true)} className="w-11 h-11 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] flex items-center justify-center text-[rgba(42,40,38,0.6)] hover:text-servirest-terracota"><Settings2 size={18} /></button>
            {!running ? (
              <button onClick={start} disabled={!activeCamera} className="h-11 px-6 rounded-full bg-servirest-terracota text-servirest-hueso font-black uppercase tracking-[0.12em] text-[11px] flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-40"><Play size={15} /> Iniciar</button>
            ) : (
              <button onClick={stop} className="h-11 px-6 rounded-full bg-servirest-midnight text-servirest-hueso font-black uppercase tracking-[0.12em] text-[11px] flex items-center gap-2"><Square size={14} /> Detener</button>
            )}
          </div>
        </div>

        {/* Barra de cámaras */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {cameras.map((c) => (
            <button
              key={c.key}
              onClick={() => switchCamera(c.key)}
              className={`flex-shrink-0 h-9 pl-3 pr-2 rounded-full text-[12px] font-bold flex items-center gap-2 transition-all border ${
                c.key === activeKey ? 'bg-servirest-midnight text-servirest-hueso border-servirest-midnight' : 'bg-servirest-surface text-[rgba(42,40,38,0.6)] border-[rgba(42,40,38,0.12)]'
              }`}
            >
              <Camera size={13} /> {c.name}
              <span className="text-[9px] opacity-60">{zones.filter((z) => z.cameraKey === c.key).length}z</span>
              <span onClick={(e) => { e.stopPropagation(); setCamModal(c); }} className="ml-0.5 p-1 rounded-full hover:bg-white/10"><Pencil size={11} /></span>
            </button>
          ))}
          <button
            onClick={() => setCamModal({ key: crypto.randomUUID(), name: '', deviceId: devices[0]?.deviceId || '' })}
            className="flex-shrink-0 h-9 px-3 rounded-full text-[12px] font-black uppercase tracking-wider text-servirest-terracota border border-dashed border-servirest-terracota/40 flex items-center gap-1.5"
          >
            <Plus size={14} /> Cámara
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_390px] gap-6 max-w-7xl">
          {/* Video */}
          <div>
            <div className="relative rounded-3xl overflow-hidden bg-servirest-midnight aspect-video shadow-lg">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain" muted playsInline />
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full touch-none" style={{ cursor: running ? 'crosshair' : 'default' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
              {!running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-servirest-hueso/60 px-6 text-center">
                  <Camera size={44} className="mb-3" />
                  <p className="text-[13px]">{activeCamera ? `Inicia "${activeCamera.name}" para monitorear sus zonas` : 'Agrega una cámara con "+ Cámara" para empezar'}</p>
                </div>
              )}
              {running && modelState === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-servirest-midnight/70 text-servirest-hueso">
                  <RefreshCw size={34} className="animate-spin mb-3" />
                  <p className="text-[13px]">Cargando modelo… (solo la primera vez)</p>
                </div>
              )}
              {running && modelState === 'ready' && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-black/50 text-white text-[10px] font-mono">{inferMs} ms</span>
                  <span className="px-2.5 py-1 rounded-full bg-green-600/80 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {activeCamera?.name}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-[rgba(42,40,38,0.45)] mt-2 flex items-center gap-1.5">
              <Eye size={13} /> Con la cámara activa, <b>arrastra sobre el video</b> para crear una zona. El punto verde = pies de la persona (dibuja las zonas sobre el piso).
            </p>
            {startedAt && <div className="mt-2 text-[11px] text-[rgba(42,40,38,0.5)] flex items-center gap-2"><Clock size={13} /> Monitoreando "{activeCamera?.name}" desde hace {fmtDur(now - startedAt)}</div>}

            {/* KPIs de Recepción */}
            {receptionActive && (
              <div className="mt-4 rounded-3xl bg-servirest-midnight text-servirest-hueso p-5">
                <div className="flex items-center gap-2 mb-4">
                  <DoorOpen size={17} className="text-servirest-mostaza" />
                  <div className="font-serif italic text-[18px]">Recepción · {activeCamera?.name}</div>
                  <SrChip tone="mostaza" >En vivo</SrChip>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <RecKpi icon={Users}     value={reception?.arrivals ?? 0}   label="Llegadas" />
                  <RecKpi icon={UserCheck} value={reception?.attended ?? 0}   label="Atendidos" tone="green" />
                  <RecKpi icon={UserX}     value={reception?.unattended ?? 0} label="Se fueron sin atender" tone="red" />
                  <RecKpi icon={Timer}     value={reception && reception.attended ? `${Math.round(reception.sumGreetSec / reception.attended)}s` : '—'} label="Recepción prom." />
                </div>
                {reception && reception.arrivals > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2.5 rounded-full bg-servirest-hueso/10 overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((reception.attended / reception.arrivals) * 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-servirest-mostaza">{Math.round((reception.attended / reception.arrivals) * 100)}% atención</span>
                  </div>
                )}
                <p className="text-[10px] text-servirest-hueso/45 mt-3 leading-relaxed">
                  Mide clientes que llegan a "{guestZone?.name}" y si hay alguien en "{hostZone?.name}" para atenderlos. Alerta en vivo si esperan más de {config.waitAlertSec}s sin atención.
                </p>
              </div>
            )}
          </div>

          {/* Panel: zonas + eventos */}
          <div className="space-y-5">
            <div className="rounded-3xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-5">
              <div className="font-serif italic text-servirest-midnight text-[17px] mb-1">Inspecciones de {activeCamera?.name || '—'}</div>
              <p className="text-[11px] text-[rgba(42,40,38,0.5)] mb-3">{activeZones.length} zona(s) en esta cámara</p>
              {!activeCamera ? (
                <p className="text-[12px] text-[rgba(42,40,38,0.5)]">Agrega una cámara arriba para empezar.</p>
              ) : activeZones.length === 0 ? (
                <p className="text-[12px] text-[rgba(42,40,38,0.5)]">Sin zonas. Inicia la cámara y arrastra sobre el video. Para medir recepción crea un <b>Puesto anfitrión</b> + una <b>Llegada de clientes</b>.</p>
              ) : (
                <div className="space-y-2.5">
                  {activeZones.map((z) => {
                    const rt = runtimeRef.current.get(z.id);
                    const meta = RULE_META[z.rule];
                    const stateFor = rt ? now - rt.since : 0;
                    const total = rt ? rt.occupiedMs + rt.vacantMs : 0;
                    const pct = total > 0 ? Math.round((rt!.occupiedMs / total) * 100) : null;
                    const Icon = meta.icon;
                    return (
                      <div key={z.id} className="rounded-2xl bg-servirest-hueso border border-[rgba(42,40,38,0.08)] p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: meta.color }} />
                          <span className="font-bold text-servirest-midnight text-[13px] flex-1 truncate">{z.name}</span>
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: meta.color + '22', color: meta.color }}>
                            <Icon size={10} /> {meta.short}{(z.rule === 'attended' || z.rule === 'host_post') ? ` ≤${z.maxVacantMin}m` : ''}
                          </span>
                          <button onClick={() => removeZone(z.id)} className="text-[rgba(42,40,38,0.35)] hover:text-servirest-danger flex-shrink-0"><Trash2 size={14} /></button>
                        </div>
                        {running && rt && (z.rule === 'attended' || z.rule === 'host_post' || z.rule === 'restricted') && (
                          <div className="flex items-center gap-3 mt-2 text-[11px]">
                            {rt.occupied
                              ? <span className="text-green-700 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Ocupada · {rt.persons}👤 · {fmtDur(stateFor)}</span>
                              : <span className={`font-bold flex items-center gap-1 ${rt.alerted ? 'text-servirest-danger' : 'text-[rgba(42,40,38,0.55)]'}`}><AlertTriangle size={12} /> Vacía {fmtDur(stateFor)}</span>}
                            {pct !== null && <span className="text-[rgba(42,40,38,0.45)] font-mono ml-auto">{pct}% cubierta</span>}
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
                  {events.map((ev) => <EventRow key={ev.id} ev={ev} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: cámara */}
      {camModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-5" onClick={() => setCamModal(null)}>
          <div className="w-full max-w-sm bg-servirest-hueso rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-serif italic text-servirest-midnight text-xl">{cameras.some((c) => c.key === camModal.key) ? 'Editar cámara' : 'Nueva cámara'}</div>
              {cameras.some((c) => c.key === camModal.key) && <button onClick={() => removeCamera(camModal.key)} className="text-servirest-danger"><Trash2 size={16} /></button>}
            </div>
            <SrLabel className="block mb-1.5">Nombre / punto</SrLabel>
            <input autoFocus value={camModal.name} onChange={(e) => setCamModal({ ...camModal, name: e.target.value })} placeholder="Ej. Recepción, Barra, Almacén…" className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] mb-4 focus:outline-none focus:border-servirest-terracota" />
            <SrLabel className="block mb-1.5">Dispositivo / fuente de video</SrLabel>
            <select value={camModal.deviceId} onChange={(e) => setCamModal({ ...camModal, deviceId: e.target.value })} className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[13px] mb-2">
              {devices.length === 0 && <option value="">Predeterminada</option>}
              {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Cámara ${i + 1}`}</option>)}
            </select>
            <p className="text-[10px] text-[rgba(42,40,38,0.45)] mb-4 leading-relaxed">¿No ves tus cámaras del techo? Usa "OBS Virtual Camera" (guía) para meter un stream RTSP como fuente. Los nombres aparecen tras dar permiso una vez.</p>
            <div className="flex gap-2">
              <button onClick={() => setCamModal(null)} className="flex-1 h-11 rounded-full border border-[rgba(42,40,38,0.15)] text-[rgba(42,40,38,0.6)] text-[11px] font-black uppercase tracking-[0.1em]">Cancelar</button>
              <button onClick={() => saveCamera(camModal)} disabled={!camModal.name.trim()} className="flex-1 h-11 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black uppercase tracking-[0.1em] disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: zona nueva */}
      {pendingRect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-5" onClick={() => setPendingRect(null)}>
          <div className="w-full max-w-sm bg-servirest-hueso rounded-3xl p-6 shadow-2xl max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="font-serif italic text-servirest-midnight text-xl mb-1">Nueva inspección</div>
            <p className="text-[11px] text-[rgba(42,40,38,0.5)] mb-4">en {activeCamera?.name}</p>
            <SrLabel className="block mb-1.5">Nombre</SrLabel>
            <input autoFocus value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Ej. Puesto host, Puerta, Barra…" className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] mb-4 focus:outline-none focus:border-servirest-terracota" />
            <SrLabel className="block mb-1.5">Herramienta / regla</SrLabel>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(Object.keys(RULE_META) as ZoneRule[]).map((r) => {
                const m = RULE_META[r]; const Icon = m.icon; const on = zoneRule === r;
                return (
                  <button key={r} onClick={() => setZoneRule(r)} className={`h-[68px] rounded-2xl border text-left px-3 transition-all ${on ? 'bg-servirest-terracota/5' : 'bg-servirest-surface'}`} style={{ borderColor: on ? m.color : 'rgba(42,40,38,0.12)' }}>
                    <div className="text-[11px] font-black text-servirest-midnight flex items-center gap-1"><Icon size={13} style={{ color: m.color }} /> {m.short}</div>
                    <div className="text-[9px] text-[rgba(42,40,38,0.5)] mt-1 leading-tight">
                      {r === 'attended' ? 'Alerta si queda vacía' : r === 'restricted' ? 'Alerta si alguien entra' : r === 'host_post' ? 'Dónde debe estar el host' : 'Puerta / llegada de clientes'}
                    </div>
                  </button>
                );
              })}
            </div>
            {(zoneRule === 'attended' || zoneRule === 'host_post') && (
              <div className="mb-4">
                <SrLabel className="block mb-1.5">Minutos máximos sin personal</SrLabel>
                <input type="number" min={1} max={120} value={zoneMaxVacant} onChange={(e) => setZoneMaxVacant(Number(e.target.value) || 1)} className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota" />
              </div>
            )}
            {receptionActive && (zoneRule === 'host_post' || zoneRule === 'guest_arrival') && (
              <p className="text-[10px] text-servirest-terracota mb-3">Ya tienes recepción configurada en esta cámara — esto la reemplazará.</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setPendingRect(null)} className="flex-1 h-11 rounded-full border border-[rgba(42,40,38,0.15)] text-[rgba(42,40,38,0.6)] text-[11px] font-black uppercase tracking-[0.1em]">Cancelar</button>
              <button onClick={savePendingZone} disabled={!zoneName.trim()} className="flex-1 h-11 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black uppercase tracking-[0.1em] disabled:opacity-40">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: configuración */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-5" onClick={() => setShowConfig(false)}>
          <div className="w-full max-w-md bg-servirest-hueso rounded-3xl p-6 shadow-2xl max-h-[85dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="font-serif italic text-servirest-midnight text-xl">Configuración</div>
              <button onClick={() => setShowConfig(false)} className="w-9 h-9 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.5)]"><X size={16} /></button>
            </div>

            <div className="rounded-2xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-black text-servirest-midnight flex items-center gap-1.5"><MessageCircle size={14} className="text-green-600" /> Alertas por WhatsApp</div>
                <button onClick={() => setConfig((c) => ({ ...c, whatsEnabled: !c.whatsEnabled }))} className={`w-11 h-6 rounded-full transition-colors relative ${config.whatsEnabled ? 'bg-green-600' : 'bg-[rgba(42,40,38,0.2)]'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${config.whatsEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
              <p className="text-[10px] text-[rgba(42,40,38,0.5)] mb-3 leading-relaxed">CallMeBot (pruebas): agrega +34 644 71 81 99, mándale "I allow callmebot to send me messages" y pega tu apikey aquí.</p>
              <input value={config.whatsPhone} onChange={(e) => setConfig((c) => ({ ...c, whatsPhone: e.target.value }))} placeholder="Teléfono +5214771234567" className="w-full h-10 px-4 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[13px] mb-2 focus:outline-none focus:border-servirest-terracota" />
              <input value={config.whatsKey} onChange={(e) => setConfig((c) => ({ ...c, whatsKey: e.target.value }))} placeholder="apikey de CallMeBot" className="w-full h-10 px-4 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[13px] mb-2 focus:outline-none focus:border-servirest-terracota" />
              <button onClick={() => { sendWhatsAppAlert(config.whatsPhone, config.whatsKey, '✅ Prueba de Visión IA'); alert('Enviado (si tu apikey es correcta llegará en segundos).'); }} className="w-full h-10 rounded-full bg-green-600 text-white text-[11px] font-black uppercase tracking-[0.1em]">Enviar prueba</button>
            </div>

            <div className="text-[12px] font-black text-servirest-midnight mb-2 flex items-center gap-1.5"><DoorOpen size={14} className="text-[#9A5FA0]" /> Recepción</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <SrLabel className="block mb-1.5">Seg. para contar llegada</SrLabel>
                <input type="number" min={1} max={30} value={config.arrivalMinDwellSec} onChange={(e) => setConfig((c) => ({ ...c, arrivalMinDwellSec: Math.max(1, Number(e.target.value) || 3) }))} className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota" />
              </div>
              <div>
                <SrLabel className="block mb-1.5">Seg. de espera → alerta</SrLabel>
                <input type="number" min={3} max={120} value={config.waitAlertSec} onChange={(e) => setConfig((c) => ({ ...c, waitAlertSec: Math.max(3, Number(e.target.value) || 12) }))} className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <SrLabel className="block mb-1.5">Intervalo (ms)</SrLabel>
                <input type="number" min={300} max={5000} step={100} value={config.intervalMs} onChange={(e) => setConfig((c) => ({ ...c, intervalMs: Math.max(300, Number(e.target.value) || 700) }))} className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota" />
              </div>
              <div>
                <SrLabel className="block mb-1.5">Confianza mín.</SrLabel>
                <input type="number" min={0.2} max={0.9} step={0.05} value={config.minScore} onChange={(e) => setConfig((c) => ({ ...c, minScore: Math.min(0.9, Math.max(0.2, Number(e.target.value) || 0.5)) }))} className="w-full h-11 px-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// KPI de recepción
const RecKpi: React.FC<{ icon: React.ElementType; value: React.ReactNode; label: string; tone?: 'green' | 'red' }> = ({ icon: Icon, value, label, tone }) => (
  <div className="bg-servirest-hueso/5 rounded-2xl p-3 text-center">
    <Icon size={16} className={`mx-auto mb-1 ${tone === 'green' ? 'text-green-400' : tone === 'red' ? 'text-red-400' : 'text-servirest-mostaza'}`} />
    <div className={`font-serif italic text-2xl leading-none ${tone === 'green' ? 'text-green-400' : tone === 'red' ? 'text-red-400' : 'text-servirest-hueso'}`}>{value}</div>
    <div className="text-[9px] uppercase tracking-[0.1em] text-servirest-hueso/50 mt-1.5 leading-tight">{label}</div>
  </div>
);

const EVENT_ICON: Record<VisionEventType, { icon: React.ElementType; cls: string }> = {
  zone_intrusion:   { icon: ShieldAlert,  cls: 'bg-servirest-danger/15 text-servirest-danger' },
  zone_vacant:      { icon: AlertTriangle, cls: 'bg-servirest-mostaza/25 text-servirest-mostaza' },
  zone_recovered:   { icon: CheckCircle2, cls: 'bg-green-600/15 text-green-700' },
  guest_waiting:    { icon: Bell,         cls: 'bg-servirest-terracota/15 text-servirest-terracota' },
  guest_attended:   { icon: UserCheck,    cls: 'bg-green-600/15 text-green-700' },
  guest_unattended: { icon: UserX,        cls: 'bg-servirest-danger/15 text-servirest-danger' },
};

const EventRow: React.FC<{ ev: VisionEvent }> = ({ ev }) => {
  const m = EVENT_ICON[ev.type as VisionEventType] || EVENT_ICON.zone_vacant;
  const Icon = m.icon;
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-servirest-hueso border border-[rgba(42,40,38,0.06)] p-2.5">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.cls}`}><Icon size={13} /></span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-servirest-midnight leading-snug">{ev.message}</div>
        <div className="text-[10px] text-[rgba(42,40,38,0.45)] mt-0.5 flex items-center gap-2">
          {new Date(ev.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {ev.camera}
          {ev.snapshotUrl && <a href={ev.snapshotUrl} target="_blank" rel="noreferrer" className="text-servirest-terracota font-bold flex items-center gap-0.5 hover:underline"><ExternalLink size={10} /> Captura</a>}
        </div>
      </div>
    </div>
  );
};

export default VisionScreen;
