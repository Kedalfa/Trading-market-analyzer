'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchTelegramStatus, generateTelegramCode, disconnectTelegram,
  updateTelegramSettings, sendTestTelegramAlert, fetchTelegramAlertLogs,
  TelegramStatusResponse
} from '@/services/api';
import {
  Send, Bot, CheckCircle2, XCircle, RefreshCw, Copy, Check,
  ExternalLink, Bell, Shield, Sliders, ListFilter, Trash2,
  AlertTriangle, Radio, Zap, X
} from 'lucide-react';

interface TelegramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_INSTRUMENTS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'US500', 'NAS100'
];

export function TelegramConnectModal({ isOpen, onClose }: TelegramConnectModalProps) {
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'CONNECT' | 'WATCHLIST' | 'FILTERS' | 'LOGS'>('CONNECT');
  
  // Connection Code state
  const [pairingData, setPairingData] = useState<{
    code: string;
    expiresAt: string;
    directLink: string;
    botUsername: string;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Test Alert state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Alert Logs state
  const [logs, setLogs] = useState<any[]>([]);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTelegramStatus();
      setStatus(data);
    } catch (err) {
      console.error('[TelegramModal] Failed to load status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const data = await generateTelegramCode();
      setPairingData(data);
    } catch (err) {
      console.error('[TelegramModal] Code gen failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your Telegram account from SMC Market Analyzer?')) return;
    try {
      await disconnectTelegram();
      setPairingData(null);
      await loadStatus();
    } catch (err) {
      console.error('[TelegramModal] Disconnect failed:', err);
    }
  };

  const handleToggleWatchlist = async (sym: string) => {
    if (!status) return;
    const current = status.watchlist || [];
    const updated = current.includes(sym)
      ? current.filter(s => s !== sym)
      : [...current, sym];

    try {
      const res = await updateTelegramSettings({ watchlist: updated });
      setStatus(prev => prev ? { ...prev, watchlist: res.watchlist } : null);
    } catch (err) {
      console.error('[TelegramModal] Update watchlist failed:', err);
    }
  };

  const handleUpdateFilter = async (key: string, value: any) => {
    if (!status) return;
    try {
      const updatedSettings = { ...status.settings, [key]: value };
      const res = await updateTelegramSettings({ settings: { [key]: value } });
      setStatus(prev => prev ? { ...prev, settings: res.settings } : null);
    } catch (err) {
      console.error('[TelegramModal] Update filter failed:', err);
    }
  };

  const handleToggleAlertType = async (typeKey: string) => {
    if (!status) return;
    const currentTypes = status.settings.alertTypes || {};
    const updatedTypes = { ...currentTypes, [typeKey]: !currentTypes[typeKey] };
    await handleUpdateFilter('alertTypes', updatedTypes);
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await sendTestTelegramAlert();
      setTestResult(res.message);
    } catch (err: any) {
      setTestResult(err?.message || 'Failed to send test alert');
    } finally {
      setIsTesting(false);
    }
  };

  const handleLoadLogs = async () => {
    try {
      const data = await fetchTelegramAlertLogs();
      setLogs(data);
    } catch (err) {
      console.error('[TelegramModal] Failed to load logs:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0b101d] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0e1628] border-b border-[#1e293b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Telegram AI Structural Intelligence Alert Bot
                {status?.isConnected ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                    Not Linked
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Institutional SMC Confluence Alerts delivered directly to your Telegram
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-[#1e293b] bg-[#090e1a] gap-2 text-xs">
          <button
            onClick={() => setActiveTab('CONNECT')}
            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'CONNECT'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" /> Connection
          </button>
          <button
            onClick={() => setActiveTab('WATCHLIST')}
            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'WATCHLIST'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" /> Watchlist ({status?.watchlist.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('FILTERS')}
            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'FILTERS'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Alert Quality & Rules
          </button>
          <button
            onClick={() => { setActiveTab('LOGS'); handleLoadLogs(); }}
            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'LOGS'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Alert Logs
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="ml-3 text-slate-400 text-sm">Loading Telegram status…</span>
            </div>
          ) : activeTab === 'CONNECT' ? (
            <div className="space-y-4">
              {/* Connected State Banner */}
              {status?.isConnected ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <strong className="text-white text-sm block">
                          Telegram Account Linked: @{status.telegramUsername || status.firstName || 'Trader'}
                        </strong>
                        <span className="text-[11px] text-slate-400">
                          Connected on {new Date(status.connectedAt || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleDisconnect}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>

                  <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      Notifications: <strong>{status.settings.isMuted ? '🔴 Muted' : '🟢 Active'}</strong>
                    </span>
                    <button
                      onClick={handleSendTest}
                      disabled={isTesting}
                      className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow"
                    >
                      {isTesting ? 'Sending…' : 'Send Test Alert'}
                    </button>
                  </div>

                  {testResult && (
                    <div className="p-2 rounded bg-black/40 border border-slate-700 text-xs font-mono text-emerald-300">
                      {testResult}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#0e1628] border border-slate-800 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">How to Pair with Telegram</h3>
                    <p className="text-xs text-slate-400">
                      Pair securely with your account using a single-use expiring token. Secrets and API keys are never exposed.
                    </p>
                  </div>

                  {pairingData ? (
                    <div className="p-4 rounded-xl bg-black/50 border border-blue-500/50 space-y-3">
                      <div className="text-center space-y-1">
                        <span className="text-xs text-slate-400">Your Temporary Pairing Code:</span>
                        <div className="text-2xl font-mono font-bold tracking-widest text-blue-400 bg-[#070b14] py-2 px-4 rounded-lg border border-blue-500/30 select-all">
                          {pairingData.code}
                        </div>
                        <span className="text-[10px] text-amber-400">Expires in 10 minutes</span>
                      </div>

                      <div className="flex items-center gap-2 justify-center pt-2">
                        <a
                          href={pairingData.directLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Open Bot in Telegram
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>

                      <p className="text-[11px] text-slate-400 text-center">
                        Or open Telegram, find <b>@{pairingData.botUsername}</b>, and send: <code>/connect {pairingData.code}</code>
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <button
                        onClick={handleGenerateCode}
                        disabled={isGenerating}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all"
                      >
                        {isGenerating ? 'Generating…' : 'Generate Telegram Connection Code'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#0e1628] border border-slate-800 space-y-1">
                  <strong className="text-blue-300 block flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> High-Confluence Filter
                  </strong>
                  <p className="text-slate-400 text-[11px]">
                    Only Grade A/A+ institutional setups with multi-timeframe alignment trigger default alerts.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#0e1628] border border-slate-800 space-y-1">
                  <strong className="text-emerald-300 block flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Full Lifecycle Tracking
                  </strong>
                  <p className="text-slate-400 text-[11px]">
                    Continuous notifications for Entry Approaching, Triggered, TP1, TP2, SL, and Invalidation.
                  </p>
                </div>
              </div>
            </div>
          ) : activeTab === 'WATCHLIST' ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Monitored Instruments Watchlist</h3>
                <p className="text-xs text-slate-400">
                  Select which Forex, Metals, Indices, or Crypto pairs the background scanner should evaluate for you.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {AVAILABLE_INSTRUMENTS.map(sym => {
                  const isChecked = status?.watchlist.includes(sym);
                  return (
                    <button
                      key={sym}
                      onClick={() => handleToggleWatchlist(sym)}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                        isChecked
                          ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                          : 'bg-[#0e1628] border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{sym}</span>
                      {isChecked ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : activeTab === 'FILTERS' ? (
            <div className="space-y-4 text-xs">
              {/* Min Setup Quality */}
              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-slate-800 space-y-2">
                <strong className="text-slate-200 block text-sm">Minimum Setup Quality Score</strong>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateFilter('minQuality', 'HIGH')}
                    className={`p-2.5 rounded-lg border text-left font-semibold ${
                      status?.settings.minQuality === 'HIGH'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-black/30 border-slate-800 text-slate-400'
                    }`}
                  >
                    🔥 High Quality Only (Grade A/A+ ≥ 75)
                    <span className="text-[10px] text-slate-400 block font-normal mt-0.5">Fewer, selective institutional setups</span>
                  </button>

                  <button
                    onClick={() => handleUpdateFilter('minQuality', 'HIGH_AND_WATCH')}
                    className={`p-2.5 rounded-lg border text-left font-semibold ${
                      status?.settings.minQuality === 'HIGH_AND_WATCH'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-black/30 border-slate-800 text-slate-400'
                    }`}
                  >
                    🟡 High + Watch (Score ≥ 60)
                    <span className="text-[10px] text-slate-400 block font-normal mt-0.5">Includes developing watchlist scenarios</span>
                  </button>
                </div>
              </div>

              {/* News Filter */}
              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-slate-800 space-y-2">
                <strong className="text-slate-200 block text-sm">High-Impact News Policy</strong>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateFilter('newsFilter', 'BLOCK_HIGH')}
                    className={`p-2 rounded-lg border text-left font-semibold ${
                      status?.settings.newsFilter === 'BLOCK_HIGH'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-black/30 border-slate-800 text-slate-400'
                    }`}
                  >
                    🛡️ Block Alerts During High-Impact News
                  </button>
                  <button
                    onClick={() => handleUpdateFilter('newsFilter', 'WARN_ONLY')}
                    className={`p-2 rounded-lg border text-left font-semibold ${
                      status?.settings.newsFilter === 'WARN_ONLY'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-black/30 border-slate-800 text-slate-400'
                    }`}
                  >
                    ⚠️ Send With Risk Warning Banner
                  </button>
                </div>
              </div>

              {/* Lifecycle Alert Toggles */}
              <div className="p-3.5 rounded-xl bg-[#0e1628] border border-slate-800 space-y-2">
                <strong className="text-slate-200 block text-sm">Lifecycle Notification Events</strong>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'newSetup', label: '🔥 New Grade A Setup Detected' },
                    { key: 'entryApproaching', label: '⚠️ Entry Zone Approaching' },
                    { key: 'entryTriggered', label: '🟢 Entry Condition Triggered' },
                    { key: 'tp1', label: '🎯 Take Profit 1 & 2 Reached' },
                    { key: 'sl', label: '🛑 Stop Loss Hit' },
                    { key: 'invalidated', label: '⚠️ Structural Invalidation' },
                  ].map(item => {
                    const isChecked = !!status?.settings.alertTypes?.[item.key];
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleToggleAlertType(item.key)}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between ${
                          isChecked
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                            : 'bg-black/30 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span className="font-semibold text-xs">{item.label}</span>
                        {isChecked ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <div className="w-3.5 h-3.5 rounded border border-slate-700" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Telegram Notification Delivery Audit Logs</h3>
                <button
                  onClick={handleLoadLogs}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-[#0e1628] border border-slate-800 text-slate-400 text-xs">
                  No alert logs recorded yet. Once high-confluence setups are detected, delivery audit records will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((l, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-[#0e1628] border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white mr-2">{l.symbol}</span>
                        <span className="text-blue-300 font-mono text-[11px] mr-2">[{l.alertType}]</span>
                        <span className="text-slate-400 text-[11px]">{l.message}</span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          l.deliveryStatus === 'SENT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {l.deliveryStatus}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {new Date(l.sentAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#0e1628] border-t border-[#1e293b] flex items-center justify-between text-xs text-slate-400">
          <span>Backend Telegram Bot Engine: <strong>@{status?.botUsername || 'Caleb_SMC_bot'}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
