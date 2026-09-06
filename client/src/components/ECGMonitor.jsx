import React, { useEffect, useRef, useState } from 'react';
import { Heart, Activity, Volume2, VolumeX, Shield, Radio } from 'lucide-react';
import { sounds } from '../utils/soundEffects';

export default function ECGMonitor({ bpm = 74, spo2 = 98, bp = '120/80' }) {
  const canvasRef = useRef(null);
  const [audioActive, setAudioActive] = useState(false);
  const [currentBpm, setCurrentBpm] = useState(bpm);

  const toggleSound = () => {
    const newState = !audioActive;
    setAudioActive(newState);
    sounds.toggleSound(newState);
    if (newState) {
      sounds.playSuccessChime();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let x = 0;
    const width = canvas.width;
    const height = canvas.height;
    const midY = height / 2;

    // Clear canvas
    ctx.fillStyle = '#030814';
    ctx.fillRect(0, 0, width, height);

    // Standard P-Q-R-S-T waveform generator
    const getWaveY = (pos) => {
      const cycle = pos % 120; // 120 pixels per heartbeat cycle
      if (cycle < 20) return midY; // Baseline
      if (cycle >= 20 && cycle < 35) return midY - Math.sin(((cycle - 20) / 15) * Math.PI) * 6; // P Wave
      if (cycle >= 35 && cycle < 45) return midY; // PR segment
      if (cycle >= 45 && cycle < 50) return midY + 4; // Q wave
      if (cycle >= 50 && cycle < 55) {
        // Trigger heartbeat sound at peak of R wave if audio is active
        if (cycle === 52 && audioActive) {
          sounds.playHeartbeat();
        }
        return midY - 32; // R peak (sharp spike)
      }
      if (cycle >= 55 && cycle < 60) return midY + 10; // S wave
      if (cycle >= 60 && cycle < 75) return midY; // ST segment
      if (cycle >= 75 && cycle < 95) return midY - Math.sin(((cycle - 75) / 20) * Math.PI) * 10; // T wave
      return midY; // Baseline
    };

    const render = () => {
      // Clear a sweeping beam ahead of x with soft phosphor fade
      const scanWidth = 10;
      ctx.fillStyle = '#030814';
      ctx.fillRect(x, 0, scanWidth, height);

      // Subtle clinical grid under beam
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
      ctx.lineWidth = 1;
      for (let j = 0; j < height; j += 16) {
        ctx.beginPath();
        ctx.moveTo(x, j);
        ctx.lineTo(x + scanWidth, j);
        ctx.stroke();
      }

      // Draw the ECG line with dual glow
      const prevX = (x - 1 + width) % width;
      const prevY = getWaveY(prevX);
      const currY = getWaveY(x);

      // Outer soft glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#10B981';
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, currY);
      ctx.stroke();

      // Reset shadow for performance
      ctx.shadowBlur = 0;

      x = (x + 1.6) % width;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [audioActive]);

  return (
    <div className="hud-panel p-4 flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden relative border border-slate-200/90 shadow-sm">
      {/* Top subtle red accent highlight line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />

      {/* Vital signs status badge */}
      <div className="flex items-center gap-5 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative p-2 rounded-2xl bg-red-50 border border-red-200 shadow-sm">
            <Heart className="w-6 h-6 text-red-500 fill-red-500 animate-heartbeat" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-slate-900 tracking-tight leading-none">{currentBpm}</span>
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">BPM</span>
            </div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sinus Rhythm Normal
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 border-l border-slate-200 pl-5">
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black font-mono text-cyan-600 leading-none">{spo2}%</span>
              <span className="text-[9px] text-slate-500 uppercase font-mono font-semibold">SpO2</span>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Pulse Oximetry</p>
          </div>

          <div className="space-y-0.5 border-l border-slate-200 pl-4">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black font-mono text-purple-600 leading-none">{bp}</span>
              <span className="text-[9px] text-slate-500 uppercase font-mono font-semibold">mmHg</span>
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Blood Pressure</p>
          </div>
        </div>
      </div>

      {/* Real-time Oscilloscope Canvas with CRT Bezel */}
      <div className="flex-1 w-full h-16 relative flex items-center justify-center overflow-hidden rounded-xl bg-[#030914] border border-emerald-500/30 shadow-inner scanline-overlay">
        <canvas
          ref={canvasRef}
          width={600}
          height={64}
          className="w-full h-full object-cover block"
        />
        
        {/* Oscilloscope HUD telemetry tags */}
        <div className="absolute top-1.5 left-2.5 pointer-events-none flex items-center gap-3">
          <span className="text-[9px] font-mono text-emerald-400 font-bold tracking-widest flex items-center gap-1.5 drop-shadow">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            LEAD II • 25mm/s • 10mm/mV
          </span>
          <span className="hidden lg:inline text-[9px] font-mono text-slate-400">GAIN: 1.0X</span>
        </div>

        <div className="absolute bottom-1 right-2.5 pointer-events-none">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
            Markham Clinical Telemetry
          </span>
        </div>
      </div>

      {/* Audio & Telemetry Switch */}
      <div className="flex items-center gap-2 shrink-0 z-10">
        <button
          onClick={toggleSound}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-sm ${
            audioActive
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-emerald-500/10'
              : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
          title="Toggle Hospital Audio Chimes"
        >
          {audioActive ? <Volume2 className="w-4 h-4 text-emerald-600 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          <span>{audioActive ? 'Pulse Audio: ON' : 'Audio: Muted'}</span>
        </button>
      </div>
    </div>
  );
}
