/**
 * Estación de sellos para Caja: el cajero escanea (cámara o lector USB) o
 * teclea el código del cliente, ve su tarjeta y le da sellos o le canjea el
 * premio. Todo pasa por RPCs que validan que el usuario es del negocio.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Gift, Minus, Plus, Search, Stamp, X } from 'lucide-react';
import { StampCard } from './StampCard';
import {
  LoyaltyCardState, LoyaltyProgram, getLoyaltyProgram,
  lookupCard, addStamps, redeemStampReward, parseCustomerCode,
} from '../services/loyalty';

interface Props {
  businessId: string;
  businessName: string;
  logoUrl?: string;
  staffName?: string;
}

/* ─── Escáner con cámara (jsQR se carga solo al usarlo) ─────────────── */
const QrScanner: React.FC<{ onCode: (text: string) => void; onClose: () => void }> = ({ onCode, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    (async () => {
      try {
        const { default: jsQR } = await import('jsqr');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = window.setInterval(() => {
          const v = videoRef.current;
          if (!v || !ctx || v.readyState < 2) return;
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const res = jsQR(img.data, img.width, img.height);
          if (res?.data) onCode(res.data);
        }, 250);
      } catch (e: any) {
        setError(e?.name === 'NotAllowedError'
          ? 'Permite el acceso a la cámara en el navegador para escanear.'
          : 'No se pudo abrir la cámara. Teclea el código del cliente.');
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white/80 text-sm">{error}</div>
      ) : (
        <>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-4 border-white/80 rounded-2xl" />
          </div>
        </>
      )}
      <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center">
        <X size={16} />
      </button>
    </div>
  );
};

export const StampStation: React.FC<Props> = ({ businessId, businessName, logoUrl, staffName }) => {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [input, setInput] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [card, setCard] = useState<LoyaltyCardState | null>(null);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error' | 'reward'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (businessId) getLoyaltyProgram(businessId).then(setProgram);
  }, [businessId]);

  const reset = () => {
    setCode(null); setCard(null); setInput(''); setCount(1); setNotice(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const search = async (raw: string) => {
    const c = parseCustomerCode(raw);
    if (!c) return;
    setBusy(true); setNotice(null);
    const r = await lookupCard(businessId, c);
    setBusy(false);
    if (r.error) { setNotice({ tone: 'error', text: r.error }); return; }
    if (!r.card?.found) { setCard(null); setCode(null); setNotice({ tone: 'error', text: `No existe un cliente con el código ${c}.` }); return; }
    setCode(c); setCard(r.card); setInput(c);
  };

  const onScanned = React.useCallback((text: string) => {
    setScanning(false);
    search(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const give = async () => {
    if (!code) return;
    setBusy(true); setNotice(null);
    const r = await addStamps(businessId, code, count, staffName);
    setBusy(false);
    if (r.error) { setNotice({ tone: 'error', text: r.error }); return; }
    setCard(r.card!);
    const earned = r.card?.rewardsEarnedNow || 0;
    setNotice(earned > 0
      ? { tone: 'reward', text: `¡Completó su tarjeta! Ganó: ${r.card!.rewardTitle}${earned > 1 ? ` (×${earned})` : ''}.` }
      : { tone: 'ok', text: `${count} sello${count === 1 ? '' : 's'} agregado${count === 1 ? '' : 's'}.` });
    setCount(1);
  };

  const redeem = async () => {
    if (!code || !card) return;
    if (!window.confirm(`¿Canjear "${card.rewardTitle}" para ${card.customerName || 'este cliente'}?`)) return;
    setBusy(true); setNotice(null);
    const r = await redeemStampReward(businessId, code, staffName);
    setBusy(false);
    if (r.error) { setNotice({ tone: 'error', text: r.error }); return; }
    setCard(r.card!);
    setNotice({ tone: 'ok', text: `Premio canjeado: ${r.card!.rewardTitle}.` });
  };

  const enabled = program?.enabled;

  return (
    <div className="h-full flex flex-col p-6 md:p-10 gap-6 overflow-y-auto custom-scrollbar">
      <div>
        <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase text-[#1a1c14]">Tarjeta de sellos</h2>
        <p className="text-[12px] font-black uppercase text-servirest-terracota/60 tracking-[0.3em] mt-3 italic">
          Escanea el QR del cliente o teclea su código
        </p>
      </div>

      {program && !enabled && (
        <div className="p-4 rounded-2xl bg-servirest-mostaza/10 border border-servirest-mostaza/30 text-[13px] text-[#2A2826]/80">
          La tarjeta de sellos está apagada. Actívala en <b>Canal Digital → Tarjeta de sellos</b>.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Búsqueda */}
        <div className="space-y-4">
          {scanning ? (
            <QrScanner onCode={onScanned} onClose={() => setScanning(false)} />
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); search(input); }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2A2826]/35" />
                {/* Funciona también con lector USB de códigos: "teclea" y manda Enter. */}
                <input
                  ref={inputRef}
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value.toUpperCase())}
                  placeholder="Código del cliente (ej. JULI4821)"
                  className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.15)] rounded-2xl py-4 pl-11 pr-4 text-[#1a1c14] text-lg font-black tracking-widest outline-none focus:border-servirest-terracota"
                />
              </div>
              <button type="submit" disabled={busy || !input.trim()}
                className="px-5 rounded-2xl bg-servirest-terracota text-servirest-hueso font-black uppercase tracking-widest text-[11px] disabled:opacity-40">
                Buscar
              </button>
            </form>
          )}

          <button
            onClick={() => setScanning((s) => !s)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-[rgba(42,40,38,0.15)] bg-servirest-surface text-[#2A2826]/70 hover:text-[#1a1c14] font-black uppercase tracking-widest text-[10px]"
          >
            {scanning ? <><CameraOff size={15} /> Cerrar cámara</> : <><Camera size={15} /> Escanear QR con la cámara</>}
          </button>

          {notice && (
            <div className={`p-4 rounded-2xl text-[13px] font-bold ${
              notice.tone === 'error' ? 'bg-red-500/10 text-red-600 border border-red-500/20'
              : notice.tone === 'reward' ? 'bg-servirest-mostaza/15 text-[#7a5a14] border border-servirest-mostaza/40'
              : 'bg-green-500/10 text-green-700 border border-green-500/20'
            }`}>
              {notice.tone === 'reward' && <Gift size={15} className="inline mr-2 -mt-0.5" />}
              {notice.text}
            </div>
          )}
        </div>

        {/* Tarjeta del cliente */}
        <div className="space-y-4">
          {card && code ? (
            <>
              <StampCard
                businessName={businessName}
                logoUrl={logoUrl}
                color={program?.cardColor || '#1A1E2E'}
                stampsRequired={card.stampsRequired}
                stamps={card.stamps}
                rewardTitle={card.rewardTitle}
                rewardsAvailable={card.rewardsAvailable}
                customerName={card.customerName}
              />

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-servirest-surface border border-[rgba(42,40,38,0.15)] rounded-2xl">
                  <button onClick={() => setCount((c) => Math.max(1, c - 1))} className="w-11 h-12 flex items-center justify-center text-[#2A2826]/60"><Minus size={16} /></button>
                  <span className="w-8 text-center font-black text-lg">{count}</span>
                  <button onClick={() => setCount((c) => Math.min(20, c + 1))} className="w-11 h-12 flex items-center justify-center text-[#2A2826]/60"><Plus size={16} /></button>
                </div>
                <button
                  onClick={give}
                  disabled={busy || !enabled}
                  className="flex-1 h-12 rounded-2xl bg-servirest-terracota text-servirest-hueso font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Stamp size={16} /> Dar {count} sello{count === 1 ? '' : 's'}
                </button>
              </div>

              {card.rewardsAvailable > 0 && (
                <button
                  onClick={redeem}
                  disabled={busy}
                  className="w-full h-12 rounded-2xl bg-servirest-mostaza text-servirest-midnight font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Gift size={16} /> Canjear premio ({card.rewardsAvailable} disponible{card.rewardsAvailable === 1 ? '' : 's'})
                </button>
              )}

              <div className="flex items-center justify-between text-[11px] text-[#2A2826]/50 font-bold uppercase tracking-wider">
                <span>{card.lifetimeStamps} sellos en total · {card.rewardsRedeemed} premios canjeados</span>
                <button onClick={reset} className="underline">Otro cliente</button>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-[rgba(42,40,38,0.15)] p-10 text-center text-[13px] text-[#2A2826]/45">
              Aquí aparece la tarjeta del cliente.<br />El cliente encuentra su código en su app, en <b>Mi cuenta</b>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
