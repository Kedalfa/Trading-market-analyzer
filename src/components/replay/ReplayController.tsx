'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, SkipForward, RotateCcw, FastForward, 
  CheckCircle2, XCircle, Clock, Eye 
} from 'lucide-react';

interface ReplayControllerProps {
  totalBars: number;
  currentReplayIndex: number;
  onChangeReplayIndex: (index: number) => void;
  onExitReplay: () => void;
}

export function ReplayController({
  totalBars,
  currentReplayIndex,
  onChangeReplayIndex,
  onExitReplay
}: ReplayControllerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(800);

  // Playback timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        onChangeReplayIndex(Math.min(totalBars - 1, currentReplayIndex + 1));
        if (currentReplayIndex >= totalBars - 1) {
          setIsPlaying(false);
        }
      }, speedMs);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentReplayIndex, totalBars, speedMs, onChangeReplayIndex]);

  const handleStepForward = () => {
    setIsPlaying(false);
    onChangeReplayIndex(Math.min(totalBars - 1, currentReplayIndex + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    onChangeReplayIndex(Math.max(20, Math.floor(totalBars * 0.5)));
  };

  return (
    <div className="w-full bg-[#0b101d] rounded-xl border border-amber-500/40 p-4 shadow-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <strong className="text-white text-xs font-bold">Historical SMC Backtest & Bar-by-Bar Replay Mode</strong>
          <span className="text-[11px] text-amber-300/80 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            Future Candles Hidden
          </span>
        </div>

        <button
          onClick={onExitReplay}
          className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded bg-slate-800"
        >
          Exit Replay Mode
        </button>
      </div>

      {/* Scrub Slider */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-slate-400">Bar {currentReplayIndex + 1}/{totalBars}</span>
        <input
          type="range"
          min="20"
          max={totalBars - 1}
          value={currentReplayIndex}
          onChange={e => {
            setIsPlaying(false);
            onChangeReplayIndex(parseInt(e.target.value));
          }}
          className="flex-1 accent-amber-500 cursor-pointer"
        />
        <span className="text-[11px] font-mono text-slate-400">
          {totalBars - 1 - currentReplayIndex} Future Bars Hidden
        </span>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isPlaying 
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' 
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Play Bar Replay'}
          </button>

          <button
            onClick={handleStepForward}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Step 1 Bar
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            title="Reset to midpoint"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <span>Speed:</span>
          {[1200, 600, 300].map((ms, i) => (
            <button
              key={ms}
              onClick={() => setSpeedMs(ms)}
              className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                speedMs === ms ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {i === 0 ? '1x' : i === 1 ? '2x' : '4x'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
