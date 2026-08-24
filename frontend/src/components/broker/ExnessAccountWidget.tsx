'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet, ShieldCheck, RefreshCw,
  Power, TrendingUp, TrendingDown,
  X, CheckCircle, AlertTriangle, Play
} from 'lucide-react';

interface ExnessAccountData {
  accountId: string;
  login: string;
  server: string;
  name: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  credit: number;
  state: 'CONNECTED' | 'DISCONNECTED' | 'SYNCHRONIZING' | 'UNCONFIGURED';
  accountType: 'standard' | 'raw_spread' | 'pro' | 'zero';
  isAutoExecutionEnabled: boolean;
  lastUpdated: string;
}

interface ExnessPosition {
  id: string;
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  openTime: string;
}

interface ExnessAccountWidgetProps {
  currentSetup?: {
    instrumentId: string;
    symbol: string;
    direction: 'BULLISH' | 'BEARISH';
    entryPrice: number;
    stopLossPrice: number;
    targetPrice: number;
  };
}

export function ExnessAccountWidget({ currentSetup }: ExnessAccountWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [account, setAccount] = useState<ExnessAccountData | null>(null);
  const [positions, setPositions] = useState<ExnessPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Editable settings
  const [autoExecute, setAutoExecute] = useState(false);
  const [maxRiskPercent, setMaxRiskPercent] = useState(1.0);
  const [accountType, setAccountType] = useState<'standard' | 'raw_spread' | 'pro' | 'zero'>('standard');
  const [serverName, setServerName] = useState('Exness-Real19');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const [resStatus, resPositions] = await Promise.all([
        fetch('http://localhost:4000/api/exness/status'),
        fetch('http://localhost:4000/api/exness/positions'),
      ]);

      if (resStatus.ok) {
        const data = await resStatus.json();
        if (data.data) {
          setAccount(data.data);
          setAutoExecute(data.data.isAutoExecutionEnabled);
          setAccountType(data.data.accountType || 'standard');
          setServerName(data.data.server || 'Exness-Real19');
        }
      }

      if (resPositions.ok) {
        const pData = await resPositions.json();
        if (pData.data) {
          setPositions(pData.data);
        }
      }
    } catch (err) {
      console.warn('Exness status fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:4000/api/exness/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: true,
          autoExecute,
          maxRiskPercent,
          accountType,
          server: serverName,
          ...(accountIdInput ? { accountId: accountIdInput } : {}),
          ...(tokenInput ? { token: tokenInput } : {}),
        }),
      });

      if (res.ok) {
        setActionMessage('Exness broker settings updated successfully.');
        fetchStatus();
      }
    } catch (err: any) {
      setActionMessage(`Error updating settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualExecute = async () => {
    if (!currentSetup) return;
    try {
      setExecuting(true);
      setActionMessage(null);
      const res = await fetch('http://localhost:4000/api/exness/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrumentId: currentSetup.instrumentId,
          direction: currentSetup.direction,
          entryPrice: currentSetup.entryPrice,
          stopLoss: currentSetup.stopLossPrice,
          takeProfit1: currentSetup.targetPrice,
          riskPercent: maxRiskPercent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMessage(`Trade placed on Exness! Status: ${data.data?.status} (${data.data?.message})`);
        fetchStatus();
      } else {
        setActionMessage(`Order failed: ${data.error || data.data?.message}`);
      }
    } catch (err: any) {
      setActionMessage(`Execution error: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleClosePosition = async (positionId: string) => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:4000/api/exness/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Position ${positionId} closed.`);
        fetchStatus();
      } else {
        setActionMessage(`Failed to close position: ${data.message}`);
      }
    } catch (err: any) {
      setActionMessage(`Close position error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = account?.state === 'CONNECTED';

  return (
    <>
      {/* Header Button Pill */}
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm ${
          isConnected
            ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-500/40'
            : account?.state === 'SYNCHRONIZING'
            ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border-amber-500/40'
            : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-700'
        }`}
        title="Exness MT4/MT5 Broker Integration"
      >
        <Wallet className="w-3.5 h-3.5 text-yellow-400" />
        <span className="font-mono">Exness:</span>
        <span className="font-semibold">
          {isConnected ? `$${account?.equity?.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Broker'}
        </span>
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
          }`}
        />
      </button>

      {/* Exness Broker Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0c1222] border border-[#1e293b] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b] bg-[#080d1a]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                    Exness Broker Integration
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        isConnected
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {account?.state || 'STANDBY'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live MT4/MT5 price streaming and institutional SMC auto-execution
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Account Financial Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#080d1a] border border-[#1e293b] p-3.5 rounded-xl">
                  <span className="text-slate-400 text-[11px] block">Equity</span>
                  <span className="text-base font-extrabold text-emerald-400 font-mono">
                    ${account?.equity?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                  </span>
                </div>
                <div className="bg-[#080d1a] border border-[#1e293b] p-3.5 rounded-xl">
                  <span className="text-slate-400 text-[11px] block">Balance</span>
                  <span className="text-base font-extrabold text-white font-mono">
                    ${account?.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                  </span>
                </div>
                <div className="bg-[#080d1a] border border-[#1e293b] p-3.5 rounded-xl">
                  <span className="text-slate-400 text-[11px] block">Free Margin</span>
                  <span className="text-base font-extrabold text-slate-200 font-mono">
                    ${account?.freeMargin?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                  </span>
                </div>
                <div className="bg-[#080d1a] border border-[#1e293b] p-3.5 rounded-xl">
                  <span className="text-slate-400 text-[11px] block">Leverage / Server</span>
                  <span className="text-xs font-bold text-blue-400 font-mono block truncate">
                    1:{account?.leverage || 2000} ({account?.server || 'Real19'})
                  </span>
                </div>
              </div>

              {/* Action Banner Message */}
              {actionMessage && (
                <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-blue-200 flex items-center justify-between">
                  <span>{actionMessage}</span>
                  <button onClick={() => setActionMessage(null)} className="text-blue-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* SMC Setup Direct Execution Bar */}
              {currentSetup && (
                <div className="bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-700/50 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-sm">{currentSetup.symbol}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          currentSetup.direction === 'BULLISH'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {currentSetup.direction}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] mt-1 font-mono">
                      Entry: <span className="text-white font-bold">{currentSetup.entryPrice}</span> | SL:{' '}
                      <span className="text-rose-400">{currentSetup.stopLossPrice}</span> | TP:{' '}
                      <span className="text-emerald-400">{currentSetup.targetPrice}</span>
                    </p>
                  </div>

                  <button
                    onClick={handleManualExecute}
                    disabled={executing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-600/30 whitespace-nowrap self-stretch sm:self-auto justify-center"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    {executing ? 'Executing...' : 'Execute on Exness'}
                  </button>
                </div>
              )}

              {/* Execution & Risk Configuration */}
              <div className="bg-[#080d1a] border border-[#1e293b] p-4 rounded-xl space-y-4">
                <h4 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Auto-Trade & Risk Engine
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Auto-execute toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#0c1222] border border-[#1e293b]">
                    <div>
                      <span className="font-bold text-white block">Auto-Execute SMC Setups</span>
                      <span className="text-[11px] text-slate-400">
                        Automatically place orders when Grade A setups form
                      </span>
                    </div>
                    <button
                      onClick={() => setAutoExecute(!autoExecute)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        autoExecute ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          autoExecute ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Risk per trade slider */}
                  <div className="p-3 rounded-lg bg-[#0c1222] border border-[#1e293b] space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">Risk Per Trade</span>
                      <span className="font-mono text-emerald-400 font-bold">{maxRiskPercent}% of Equity</span>
                    </div>
                    <input
                      type="range"
                      min="0.25"
                      max="3.0"
                      step="0.25"
                      value={maxRiskPercent}
                      onChange={(e) => setMaxRiskPercent(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>

                {/* Exness Account Type & Server Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">Exness Account Type</label>
                    <select
                      value={accountType}
                      onChange={(e: any) => setAccountType(e.target.value)}
                      className="w-full bg-[#0c1222] border border-[#1e293b] text-white rounded-lg p-2 font-medium"
                    >
                      <option value="standard">Standard Account (e.g. EURUSDm, XAUUSDm)</option>
                      <option value="raw_spread">Raw Spread Account (EURUSD, XAUUSD)</option>
                      <option value="pro">Pro Account</option>
                      <option value="zero">Zero Spread Account</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 text-[11px]">Exness Server Name</label>
                    <input
                      type="text"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      placeholder="e.g. Exness-Real19 or Exness-Trial6"
                      className="w-full bg-[#0c1222] border border-[#1e293b] text-white rounded-lg p-2 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Save Broker Settings
                  </button>
                </div>
              </div>

              {/* Active Open Positions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">
                    Open Exness Positions ({positions.length})
                  </h4>
                  <button
                    onClick={fetchStatus}
                    className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {positions.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-[#1e293b] rounded-xl text-slate-500">
                    No active open positions on this Exness account.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {positions.map((pos) => (
                      <div
                        key={pos.id}
                        className="bg-[#080d1a] border border-[#1e293b] p-3 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white">{pos.symbol}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                pos.type.includes('BUY')
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {pos.type.includes('BUY') ? 'BUY' : 'SELL'} {pos.volume} Lots
                            </span>
                          </div>
                          <span className="text-slate-400 text-[11px] font-mono block mt-0.5">
                            Open: {pos.openPrice} | Current: {pos.currentPrice}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono font-bold text-xs ${
                              pos.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {pos.profit >= 0 ? `+$${pos.profit.toFixed(2)}` : `-$${Math.abs(pos.profit).toFixed(2)}`}
                          </span>
                          <button
                            onClick={() => handleClosePosition(pos.id)}
                            className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-[11px] font-semibold transition-all"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
