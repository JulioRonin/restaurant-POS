/**
 * Reconocimiento facial del PERSONAL para el módulo Visión IA (beta).
 *
 * Permite registrar empleados (2–3 capturas de rostro → descriptor de 128
 * dimensiones) y reconocerlos en vivo para etiquetar sus tracks por nombre
 * ("Ana · Hostess") y diferenciarlos de los clientes.
 *
 * ⚠️ PRIVACIDAD / LFPDPPP: los rasgos faciales son DATOS PERSONALES
 * SENSIBLES en México. Este módulo:
 *   · Guarda los descriptores SOLO en este equipo (localStorage) — nunca
 *     se suben a la nube.
 *   · Requiere consentimiento expreso POR ESCRITO del empleado antes de
 *     registrarlo (la UI lo recuerda).
 *   · Solo se registra PERSONAL, nunca clientes.
 *
 * Implementación: @vladmandic/face-api (variante nobundle — reutiliza el
 * MISMO TensorFlow.js del detector de personas). Modelos servidos locales
 * desde /face-models (~7 MB, carga lazy solo si activas la función).
 */

let faceapi: any = null;
let modelsReady = false;
let loading: Promise<boolean> | null = null;

export interface StaffFace {
  id: string;
  name: string;
  role: string;                // Hostess, Mesero, Gerente…
  descriptors: number[][];     // 2–3 capturas de 128 dims
}

export interface RecognizedFace {
  x: number; y: number; w: number; h: number; // caja normalizada 0–1
  name: string;
  role: string;
  distance: number;            // qué tan seguro (menor = mejor)
}

/** Carga face-api + modelos (una sola vez, lazy). */
export async function loadFaceApi(): Promise<boolean> {
  if (modelsReady) return true;
  if (loading) return loading;
  loading = (async () => {
    try {
      // nobundle: reutiliza el @tensorflow/tfjs ya cargado por Visión IA.
      faceapi = await import('@vladmandic/face-api/dist/face-api.esm-nobundle.js');
      const base = 'face-models'; // relativo al base './' de Vite
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(base),
        faceapi.nets.faceLandmark68Net.loadFromUri(base),
        faceapi.nets.faceRecognitionNet.loadFromUri(base),
      ]);
      modelsReady = true;
      return true;
    } catch (e) {
      console.warn('[faceid] carga de modelos falló:', e);
      loading = null;
      return false;
    }
  })();
  return loading;
}

const detectorOptions = () =>
  new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });

/**
 * Captura el descriptor del rostro MÁS GRANDE visible en el video (para el
 * alta de un empleado — debe pararse de frente y cerca de la cámara).
 */
export async function captureFaceDescriptor(video: HTMLVideoElement): Promise<number[] | null> {
  if (!(await loadFaceApi())) return null;
  try {
    const det = await faceapi
      .detectSingleFace(video, detectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    return det ? Array.from(det.descriptor as Float32Array) : null;
  } catch (e) {
    console.warn('[faceid] captura falló:', e);
    return null;
  }
}

const euclidean = (a: Float32Array | number[], b: number[]): number => {
  let s = 0;
  for (let i = 0; i < b.length; i++) { const d = (a[i] as number) - b[i]; s += d * d; }
  return Math.sqrt(s);
};

// Umbral estándar de face-api: < 0.5 = misma persona (0.6 es laxo).
const MATCH_THRESHOLD = 0.5;

/**
 * Reconoce a los empleados registrados en el frame actual. Devuelve solo
 * los rostros que MATCHEAN con el personal (los no reconocidos se ignoran —
 * los clientes jamás se registran ni se comparan contra nada).
 */
export async function recognizeStaff(
  video: HTMLVideoElement,
  staff: StaffFace[]
): Promise<RecognizedFace[]> {
  if (staff.length === 0) return [];
  if (!(await loadFaceApi())) return [];
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  try {
    const dets = await faceapi
      .detectAllFaces(video, detectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    const out: RecognizedFace[] = [];
    for (const d of dets) {
      let bestName: string | null = null;
      let bestRole = '';
      let bestDist = MATCH_THRESHOLD;
      for (const s of staff) {
        for (const ref of s.descriptors) {
          const dist = euclidean(d.descriptor, ref);
          if (dist < bestDist) { bestDist = dist; bestName = s.name; bestRole = s.role; }
        }
      }
      if (bestName) {
        const b = d.detection.box;
        out.push({ x: b.x / vw, y: b.y / vh, w: b.width / vw, h: b.height / vh, name: bestName, role: bestRole, distance: bestDist });
      }
    }
    return out;
  } catch (e) {
    console.warn('[faceid] reconocimiento falló:', e);
    return [];
  }
}
