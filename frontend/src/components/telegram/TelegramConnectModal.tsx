'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchTelegramStatus, generateTelegramCode, disconnectTelegram,
  updateTelegramSettings, sendTestTelegramAlert, fetchTelegramAlertLogs,
  fetchTelegramAccounts, fetchTelegramAccountDetails, disconnectTelegramAccount,
  TelegramStatusResponse, TelegramAccountSummary, TelegramAccountDetails,
} from '@/services/api';
import {
  Send, Bot, CheckCircle2, XCircle, RefreshCw, Copy, Check,
  ExternalLink, Bell, Shield, Sliders, ListFilter, Trash2,
  AlertTriangle, Radio, Zap, X, Users, Clock, LogOut,
  ChevronRight, ChevronLeft, Search, Filter, Activity,
  UserCheck, UserX, AlertCircle, Timer, Lock, Unlock,
} from 'lucide-react';

interface TelegramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_INSTRUMENTS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'US500', 'NAS100'
];

type Tab = 'CONNECT' | 'ACCOUNTS' | 'WATCHLIST' | 'FILTERS' | 'LOGS';
type StatusFilter = 'ALL' | 'CONNECTED' | 'DISCONNECTED';

// ─── Code Countdown Timer ───────────────────────────────────────────────────
function CodeCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (remaining === 0) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        if (next <= 0) { clearInterval(id); return 0; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isExpired = remaining === 0;
  const isUrgent = remaining < 60;

  if (isExpired) {
    return (
      <span className="flex items-center gap-1 text-rose-400 font-semibold text-xs">
        <AlertCircle className="w-3 h-3" /> Code expired — generate a new one
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-xs font-mono ${isUrgent ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`}>
      <Timer className="w-3 h-3" />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')} remaining
    </span>
  );
}

// ─── Session Countdown ──────────────────────────────────────────────────────
function SessionCountdown({ expiresAt }: { expiresAt?: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!expiresAt) { setLabel(''); return; }
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setLabel('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span>{label}</span>;
}

// ─── Account Card ───────────────────────────────────────────────────────────
function AccountCard({
  account,
  onViewDetails,
  onDisconnect,
}: {
  account: TelegramAccountSummary;
  onViewDetails: () => void;
  onDisconnect: () => void;
}) {
  const displayName = account.firstName
    ? `${account.firstName}${account.lastName ? ' ' + account.lastName : ''}`
    : account.telegramUsername
    ? `@${account.telegramUsername}`
    : `ID: ${account.telegramUserId || account.chatId || account.internalUserId}`;

  const handle = account.telegramUsername ? `@${account.telegramUsername}` : null;
  const isActive = account.sessionIsActive;
  const isConnected = account.isConnected && account.isAuthorized;

  let statusColor = 'text-slate-400 bg-slate-800 border-slate-700';
  let statusLabel = 'Inactive';
  let StatusIcon = UserX;

  if (isActive) {
    statusColor = 'text-emerald-300 bg-emerald-950/60 border-emerald-700/50';
    statusLabel = 'Session Active';
    StatusIcon = UserCheck;
  } else if (isConnected) {
    statusColor = 'text-amber-300 bg-amber-950/50 border-amber-700/40';
    statusLabel = 'Session Expired';
    StatusIcon = Clock;
  }

  const lastActivity = account.lastActiveAt
    ? new Date(account.lastActiveAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="p-4 rounded-xl bg-[#0c1320] border border-slate-800 hover:border-slate-700 transition-all space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600/30 to-indigo-700/30 border border-blue-500/20 flex items-center justify-center shrink-0">
            <span className="text-lg">{account.firstName?.[0] || account.telegramUsername?.[0] || '?'}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{displayName}</p>
            {handle && handle !== displayName && (
              <p className="text-xs text-slate-400 truncate">{handle}</p>
            )}
            <p className="text-[11px] text-slate-500 font-mono">
              TG ID: {account.telegramUserId ?? account.chatId ?? '—'}
            </p>
          </div>
        </div>

        <span className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${statusColor}`}>
          <StatusIcon className="w-3 h-3" />
          {statusLabel}
        </span>
      </div>

      {/* Details row */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="space-y-0.5">
          <p className="text-slate-500">Last activity</p>
          <p className="text-slate-300">{lastActivity}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-slate-500">Session expires</p>
          <p className="text-slate-300">
            {account.sessionIsActive && account.sessionExpiresAt
              ? <SessionCountdown expiresAt={account.sessionExpiresAt} />
              : '—'}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-slate-500">Watching</p>
          <p className="text-slate-300 truncate">{account.watchlist?.length ? account.watchlist.slice(0, 3).join(', ') + (account.watchlist.length > 3 ? '…' : '') : '—'}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-slate-500">Notifications</p>
          <p className={account.isMuted ? 'text-rose-400' : 'text-emerald-400'}>
            {account.isMuted ? '🔕 Muted' : '🔔 Active'}
          </p>
        </div>
      </div>

      {/* Failed auth warning */}
      {account.failedAuthAttempts > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          {account.failedAuthAttempts} failed auth attempt{account.failedAuthAttempts !== 1 ? 's' : ''}
          {account.codeLockedUntil && new Date(account.codeLockedUntil) > new Date() && ' — LOCKED'}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" /> View Details
        </button>
        {(isConnected || isActive) && (
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/40 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Account Details Panel ──────────────────────────────────────────────────
function AccountDetailsPanel({
  details,
  onBack,
  onDisconnect,
}: {
  details: TelegramAccountDetails;
  onBack: () => void;
  onDisconnect: () => void;
}) {
  const isActive = details.sessionIsActive;
  const fmt = (d?: string) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Accounts
      </button>

      {/* Identity */}
      <div className="p-4 rounded-xl bg-[#0c1320] border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Telegram Identity</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {[
            ['Telegram User ID', details.telegramUserId ?? '—'],
            ['Chat ID', details.chatId ?? '—'],
            ['Username', details.telegramUsername ? `@${details.telegramUsername}` : '—'],
            ['First Name', details.firstName || '—'],
            ['Last Name', details.lastName || '—'],
            ['Language', details.languageCode || '—'],
            ['Internal ID', details.internalUserId],
            ['Linked Account', details.linkedWebUserId || '—'],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-slate-500">{label}</p>
              <p className="text-slate-200 font-mono text-[11px] break-all">{String(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Connection & Session */}
      <div className="p-4 rounded-xl bg-[#0c1320] border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Connection & Session</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {[
            ['Connected', details.isConnected ? '✅ Yes' : '❌ No'],
            ['Authorized', details.isAuthorized ? '✅ Yes' : '❌ No'],
            ['Session Active', isActive ? '🟢 Active' : '🔴 Inactive/Expired'],
            ['Session Expires', details.sessionExpiresAt ? <SessionCountdown expiresAt={details.sessionExpiresAt} /> : '—'],
            ['Connected At', fmt(details.connectedAt)],
            ['Last Active', fmt(details.lastActiveAt)],
            ['Session Created', fmt(details.sessionCreatedAt)],
            ['Last Interaction', fmt(details.sessionLastActivityAt)],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-slate-500">{label}</p>
              <p className="text-slate-200 text-[11px]">{value as React.ReactNode}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bot Activity */}
      <div className="p-4 rounded-xl bg-[#0c1320] border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Bot Activity</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {[
            ['Alerts Sent', details.totalAlertsSent],
            ['Alerts Failed', details.totalAlertsFailed],
            ['Notifications', details.settings?.isMuted ? '🔕 Muted' : '🔔 Active'],
            ['Quality Filter', details.settings?.minQuality || '—'],
            ['Failed Auth Attempts', details.failedAuthAttempts],
            ['Last Failed Auth', fmt(details.lastFailedAuthAt)],
            ['Locked Until', details.codeLockedUntil && new Date(details.codeLockedUntil) > new Date() ? fmt(details.codeLockedUntil) : 'Not locked'],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-slate-500">{label}</p>
              <p className="text-slate-200 text-[11px]">{String(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Verification History */}
      {details.verificationHistory.length > 0 && (
        <div className="p-4 rounded-xl bg-[#0c1320] border border-slate-800 space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Verification History (Last {details.verificationHistory.length})</h4>
          <div className="space-y-1.5">
            {[...details.verificationHistory].reverse().map((v, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  {v.success
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                  <span className="text-slate-400 font-mono">{v.codeHashPrefix}</span>
                </div>
                <span className="text-slate-500">
                  {new Date(v.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disconnect action */}
      {(details.isConnected || details.isAuthorized || details.sessionIsActive) && (
        <button
          onClick={onDisconnect}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/40 text-sm font-bold transition-colors"
        >
          <LogOut className="w-4 h-4" /> Disconnect This Account
        </button>
      )}
    </div>
  );
}

// ─── Disconnect Confirmation Dialog ─────────────────────────────────────────
function DisconnectConfirmDialog({
  accountName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  accountName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0b101d] border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Disconnect Telegram Account?</h3>
            <p className="text-slate-400 text-xs mt-0.5">{accountName}</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 space-y-1">
          <p>This will:</p>
          <p>• Revoke the current Telegram bot session</p>
          <p>• Stop all trading signal notifications</p>
          <p>• Require re-authentication to restore access</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {isLoading ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Accounts Tab ────────────────────────────────────────────────────────────
function AccountsTab() {
  const [accounts, setAccounts] = useState<TelegramAccountSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedDetails, setSelectedDetails] = useState<TelegramAccountDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<TelegramAccountSummary | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchTelegramAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[AccountsTab] Failed to load:', err);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleViewDetails = async (account: TelegramAccountSummary) => {
    const id = account.telegramUserId ?? account.chatId ?? account.internalUserId;
    setIsLoadingDetails(true);
    try {
      const details = await fetchTelegramAccountDetails(id);
      setSelectedDetails(details);
    } catch (err) {
      console.error('[AccountsTab] Failed to load details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectTarget) return;
    const id = disconnectTarget.telegramUserId ?? disconnectTarget.chatId ?? disconnectTarget.internalUserId;
    setIsDisconnecting(true);
    try {
      await disconnectTelegramAccount(id);
      setDisconnectTarget(null);
      setSelectedDetails(null);
      await loadAccounts();
    } catch (err) {
      console.error('[AccountsTab] Disconnect failed:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const filtered = accounts.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      a.telegramUsername?.toLowerCase().includes(q) ||
      a.firstName?.toLowerCase().includes(q) ||
      String(a.telegramUserId || '').includes(q) ||
      String(a.chatId || '').includes(q);

    const matchesStatus = statusFilter === 'ALL' ||
      (statusFilter === 'CONNECTED' && a.sessionIsActive) ||
      (statusFilter === 'DISCONNECTED' && !a.sessionIsActive);

    return matchesSearch && matchesStatus;
  });

  if (selectedDetails) {
    const target = disconnectTarget ?? accounts.find(a =>
      a.telegramUserId === selectedDetails.telegramUserId || a.internalUserId === selectedDetails.internalUserId
    );

    return (
      <>
        <AccountDetailsPanel
          details={selectedDetails}
          onBack={() => setSelectedDetails(null)}
          onDisconnect={() => {
            const a = accounts.find(acc =>
              acc.telegramUserId === selectedDetails.telegramUserId ||
              acc.internalUserId === selectedDetails.internalUserId
            );
            if (a) setDisconnectTarget(a);
          }}
        />
        {disconnectTarget && (
          <DisconnectConfirmDialog
            accountName={`${disconnectTarget.firstName || ''} ${disconnectTarget.telegramUsername ? '@' + disconnectTarget.telegramUsername : ''} (ID: ${disconnectTarget.telegramUserId ?? disconnectTarget.chatId ?? disconnectTarget.internalUserId})`}
            onConfirm={handleConfirmDisconnect}
            onCancel={() => setDisconnectTarget(null)}
            isLoading={isDisconnecting}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Telegram Account Management</h3>
          <p className="text-xs text-slate-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''} known to the bot</p>
        </div>
        <button
          onClick={loadAccounts}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, @username or Telegram ID…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#0c1320] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 transition-colors"
          />
        </div>

        <div className="flex rounded-lg border border-slate-800 overflow-hidden text-xs">
          {(['ALL', 'CONNECTED', 'DISCONNECTED'] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-2.5 py-2 font-semibold transition-colors ${
                statusFilter === f ? 'bg-blue-600 text-white' : 'bg-[#0c1320] text-slate-400 hover:text-white'
              }`}
            >
              {f === 'ALL' ? 'All' : f === 'CONNECTED' ? '🟢' : '⚫'}
            </button>
          ))}
        </div>
      </div>

      {/* Account list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Loading accounts…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-[#0e1628] border border-slate-800 text-slate-400 text-xs space-y-2">
          <Users className="w-8 h-8 mx-auto text-slate-600" />
          <p className="font-semibold text-sm">{searchQuery || statusFilter !== 'ALL' ? 'No accounts match your filter' : 'No Telegram accounts yet'}</p>
          <p>Accounts appear here once a Telegram user sends /start to the bot.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(account => (
            <AccountCard
              key={account.internalUserId}
              account={account}
              onViewDetails={() => handleViewDetails(account)}
              onDisconnect={() => setDisconnectTarget(account)}
            />
          ))}
        </div>
      )}

      {/* Disconnect confirmation dialog */}
      {disconnectTarget && !selectedDetails && (
        <DisconnectConfirmDialog
          accountName={`${disconnectTarget.firstName || ''} ${disconnectTarget.telegramUsername ? '@' + disconnectTarget.telegramUsername : ''} (ID: ${disconnectTarget.telegramUserId ?? disconnectTarget.chatId ?? disconnectTarget.internalUserId})`}
          onConfirm={handleConfirmDisconnect}
          onCancel={() => setDisconnectTarget(null)}
          isLoading={isDisconnecting}
        />
      )}
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────
export function TelegramConnectModal({ isOpen, onClose }: TelegramConnectModalProps) {
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('CONNECT');

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

  // Disconnect confirmation (own account)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTelegramStatus();
      setStatus(data);
      // Restore pending verification code if active on the backend
      if (data.activeCode && new Date(data.activeCode.expiresAt) > new Date()) {
        setPairingData({
          code: data.activeCode.code,
          expiresAt: data.activeCode.expiresAt,
          directLink: data.activeCode.directLink,
          botUsername: data.activeCode.botUsername,
        });
      }
    } catch (err) {
      console.error('[TelegramModal] Failed to load status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadStatus();

    // Auto-poll status every 4s to detect when Telegram user enters code and session becomes active
    const pollId = setInterval(async () => {
      try {
        const data = await fetchTelegramStatus();
        setStatus(data);
        if (data.sessionIsActive) {
          // Authentication succeeded! Clear pairing code
          setPairingData(null);
        } else if (data.activeCode && new Date(data.activeCode.expiresAt) > new Date()) {
          const ac = data.activeCode;
          setPairingData(prev => prev || {
            code: ac.code,
            expiresAt: ac.expiresAt,
            directLink: ac.directLink,
            botUsername: ac.botUsername,
          });
        }
      } catch {
        // Silent polling catch
      }
    }, 4000);

    return () => clearInterval(pollId);
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
    setIsDisconnecting(true);
    try {
      await disconnectTelegram();
      setPairingData(null);
      setShowDisconnectConfirm(false);
      await loadStatus();
    } catch (err) {
      console.error('[TelegramModal] Disconnect failed:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCopyCode = () => {
    if (pairingData?.code) {
      navigator.clipboard.writeText(pairingData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleWatchlist = async (sym: string) => {
    if (!status) return;
    const current = status.watchlist || [];
    const updated = current.includes(sym) ? current.filter(s => s !== sym) : [...current, sym];
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
      const res = await updateTelegramSettings({ settings: { [key]: value } });
      setStatus(prev => prev ? { ...prev, settings: res.settings } : null);
    } catch (err) {
      console.error('[TelegramModal] Update filter failed:', err);
    }
  };

  const handleToggleAlertType = async (typeKey: string) => {
    if (!status) return;
    const currentTypes = status.settings.alertTypes || {};
    await handleUpdateFilter('alertTypes', { ...currentTypes, [typeKey]: !currentTypes[typeKey] });
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

  const isCodeExpired = pairingData && new Date(pairingData.expiresAt) < new Date();

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
                {status?.sessionIsActive ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Session Active
                  </span>
                ) : status?.isConnected ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" /> Session Expired
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                    Not Connected
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Institutional SMC Confluence Alerts delivered directly to your Telegram
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-[#1e293b] bg-[#090e1a] gap-2 text-xs overflow-x-auto">
          {([
            { id: 'CONNECT', label: 'Connection', Icon: Bot },
            { id: 'ACCOUNTS', label: 'Accounts', Icon: Users },
            { id: 'WATCHLIST', label: `Watchlist (${status?.watchlist?.length ?? 0})`, Icon: ListFilter },
            { id: 'FILTERS', label: 'Alert Rules', Icon: Sliders },
            { id: 'LOGS', label: 'Alert Logs', Icon: Bell },
          ] as { id: Tab; label: string; Icon: any }[]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); if (id === 'LOGS') handleLoadLogs(); }}
              className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading && activeTab !== 'ACCOUNTS' ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="ml-3 text-slate-400 text-sm">Loading Telegram status…</span>
            </div>
          ) : activeTab === 'CONNECT' ? (
            <div className="space-y-4">
              {/* State 1: Connected with ACTIVE Session */}
              {status?.sessionIsActive ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <strong className="text-white text-sm block">
                          Linked: {status.telegramUsername ? `@${status.telegramUsername}` : status.firstName || 'Telegram Account'}
                        </strong>
                        <span className="text-[11px] text-slate-400">
                          Session active · expires in{' '}
                          {status.sessionExpiresAt && <SessionCountdown expiresAt={status.sessionExpiresAt} />}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDisconnectConfirm(true)}
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
              ) : null}

              {/* State 2: Connected but Session EXPIRED */}
              {status?.isConnected && !status?.sessionIsActive ? (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <strong className="text-white text-sm block">
                          Session Expired: {status.telegramUsername ? `@${status.telegramUsername}` : status.firstName || 'Telegram Account'}
                        </strong>
                        <span className="text-[11px] text-amber-300/80">
                          Authentication session ended. Re-verification required to resume live alerts.
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDisconnectConfirm(true)}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : null}

              {/* State 3: Code Generation / Verification Code Display (Visible when NOT active, or when pairingData is present) */}
              {(!status?.sessionIsActive || pairingData) && (
                <div className="p-5 rounded-xl bg-[#0e1628] border border-slate-800 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-400" />
                      {status?.isConnected ? 'Re-Authenticate Telegram Session' : 'Connect Your Telegram Account'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Generate a single-use 6-digit code below. Open the bot in Telegram and send the code to authenticate.
                    </p>
                  </div>

                  {pairingData ? (
                    <div className={`p-4 rounded-xl border space-y-3 ${isCodeExpired ? 'bg-rose-950/20 border-rose-700/40' : 'bg-black/50 border-blue-500/50'}`}>
                      <div className="text-center space-y-2">
                        <span className="text-xs text-slate-400">Your Verification Code:</span>
                        <div className={`text-3xl font-mono font-bold tracking-[0.3em] py-3 px-4 rounded-lg border select-all ${
                          isCodeExpired
                            ? 'text-rose-400 bg-rose-950/30 border-rose-700/40'
                            : 'text-blue-400 bg-[#070b14] border-blue-500/30'
                        }`}>
                          {pairingData.code}
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <CodeCountdown expiresAt={pairingData.expiresAt} />
                          <button
                            onClick={handleCopyCode}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                          >
                            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {isCodeExpired ? (
                        <div className="text-center">
                          <button
                            onClick={handleGenerateCode}
                            disabled={isGenerating}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all"
                          >
                            {isGenerating ? 'Generating…' : 'Generate New Code'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-center">
                          <a
                            href={pairingData.directLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Open Bot in Telegram (/start)
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </div>
                      )}

                      {!isCodeExpired && (
                        <p className="text-[11px] text-slate-400 text-center">
                          Or open Telegram, find <b>@{pairingData.botUsername}</b>, send <code>/start</code> and type this 6-digit code.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <button
                        onClick={handleGenerateCode}
                        disabled={isGenerating}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all"
                      >
                        {isGenerating ? 'Generating…' : (status?.isConnected ? 'Generate Re-Authentication Code' : 'Generate Telegram Verification Code')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#0e1628] border border-slate-800 space-y-1">
                  <strong className="text-blue-300 block flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Session-Based Auth
                  </strong>
                  <p className="text-slate-400 text-[11px]">
                    Authentication requires a fresh code on every /start. No permanent auto-access. Sessions expire after 24h.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#0e1628] border border-slate-800 space-y-1">
                  <strong className="text-emerald-300 block flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Full Lifecycle Tracking
                  </strong>
                  <p className="text-slate-400 text-[11px]">
                    Continuous notifications for Entry Approaching, Triggered, TP1, TP2, SL, and Invalidation — authenticated accounts only.
                  </p>
                </div>
              </div>
            </div>
          ) : activeTab === 'ACCOUNTS' ? (
            <AccountsTab />
          ) : activeTab === 'WATCHLIST' ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Monitored Instruments Watchlist</h3>
                <p className="text-xs text-slate-400">
                  Select which pairs the background scanner should evaluate for your alerts.
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
                        isChecked ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm' : 'bg-[#0e1628] border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>{sym}</span>
                      {isChecked ? <CheckCircle2 className="w-4 h-4 text-blue-400" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
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
                      status?.settings.minQuality === 'HIGH' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-black/30 border-slate-800 text-slate-400'
                    }`}
                  >
                    🔥 High Quality Only (Grade A/A+ ≥ 75)
                    <span className="text-[10px] text-slate-400 block font-normal mt-0.5">Fewer, selective institutional setups</span>
                  </button>
                  <button
                    onClick={() => handleUpdateFilter('minQuality', 'HIGH_AND_WATCH')}
                    className={`p-2.5 rounded-lg border text-left font-semibold ${
                      status?.settings.minQuality === 'HIGH_AND_WATCH' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-black/30 border-slate-800 text-slate-400'
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
                    className={`p-2 rounded-lg border text-left font-semibold ${status?.settings.newsFilter === 'BLOCK_HIGH' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-black/30 border-slate-800 text-slate-400'}`}
                  >
                    🛡️ Block Alerts During High-Impact News
                  </button>
                  <button
                    onClick={() => handleUpdateFilter('newsFilter', 'WARN_ONLY')}
                    className={`p-2 rounded-lg border text-left font-semibold ${status?.settings.newsFilter === 'WARN_ONLY' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-black/30 border-slate-800 text-slate-400'}`}
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
                          isChecked ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-black/30 border-slate-800 text-slate-500'
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
          <span>Backend Bot: <strong>@{status?.botUsername || 'Not configured'}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Own account disconnect confirmation */}
      {showDisconnectConfirm && (
        <DisconnectConfirmDialog
          accountName={status?.telegramUsername ? `@${status.telegramUsername}` : status?.firstName || 'Your account'}
          onConfirm={handleDisconnect}
          onCancel={() => setShowDisconnectConfirm(false)}
          isLoading={isDisconnecting}
        />
      )}
    </div>
  );
}
