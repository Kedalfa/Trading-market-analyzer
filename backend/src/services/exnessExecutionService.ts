/**
 * Exness Automated Trade Execution Service
 * Translates SMC Setups (Entry, SL, TP1, TP2) into institutional MT4/MT5 orders
 * with dynamic risk-based lot sizing and position tracking.
 */

import { config } from '../config/config';
import { getInstrumentMapping, resolveExnessSymbol } from '../config/instrumentRegistry';
import { getExnessAccountInfo, fetchExnessQuote } from './exnessService';

export interface SMCTradeExecutionRequest {
  analysisId?: string;
  instrumentId: string;
  direction: 'BULLISH' | 'BEARISH' | 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number;
  takeProfit3?: number;
  riskPercent?: number; // Defaults to config.exness.maxRiskPercent (1.0%)
  orderType?: 'MARKET' | 'LIMIT' | 'STOP' | 'AUTO';
  comment?: string;
}

export interface ExnessExecutionResult {
  success: boolean;
  orderId?: string;
  positionId?: string;
  ticket?: number;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskAmount: number;
  status: 'PLACED' | 'EXECUTED' | 'REJECTED' | 'SIMULATED_TEST';
  message: string;
  timestamp: string;
}

export interface ExnessPosition {
  id: string;
  ticket: number;
  symbol: string;
  type: 'POSITION_TYPE_BUY' | 'POSITION_TYPE_SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: string;
  comment?: string;
}

/**
 * Calculate recommended lot size based on account balance, risk percentage, and SL distance.
 */
export function calculateExnessLotSize(
  equity: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number,
  pipSize: number,
  pipValuePerLot = 10 // $10 per pip per 1.0 standard lot for EURUSD/Gold approx
): { lotSize: number; riskAmount: number } {
  const safeEquity = Math.max(equity, 100);
  const safeRiskPercent = Math.min(Math.max(riskPercent, 0.1), 5.0); // 0.1% to 5% safe range
  const riskAmount = (safeEquity * safeRiskPercent) / 100;

  const slDistance = Math.abs(entryPrice - stopLossPrice);
  const slPips = slDistance / (pipSize > 0 ? pipSize : 0.0001);

  if (slPips <= 0) {
    return { lotSize: config.exness.defaultLotSize, riskAmount };
  }

  // Raw lot calculation: Risk / (SL Pips * Pip Value)
  const rawLots = riskAmount / (slPips * pipValuePerLot);
  // Round to nearest 0.01 standard lot (Exness micro lot step)
  const roundedLots = Math.max(0.01, Math.min(100.0, Math.round(rawLots * 100) / 100));

  return {
    lotSize: roundedLots,
    riskAmount: Number(riskAmount.toFixed(2)),
  };
}

/**
 * Executes or places an SMC setup trade on the Exness MT4/MT5 account
 */
export async function executeExnessTrade(
  req: SMCTradeExecutionRequest
): Promise<ExnessExecutionResult> {
  const mapping = getInstrumentMapping(req.instrumentId);
  if (!mapping) {
    return {
      success: false,
      symbol: req.instrumentId,
      type: req.direction,
      volume: 0,
      openPrice: req.entryPrice,
      stopLoss: req.stopLoss,
      takeProfit: req.takeProfit1,
      riskAmount: 0,
      status: 'REJECTED',
      message: `Unknown instrument ID: ${req.instrumentId}`,
      timestamp: new Date().toISOString(),
    };
  }

  const exnessSymbol = resolveExnessSymbol(req.instrumentId, config.exness.accountType);
  const isBuy = req.direction === 'BULLISH' || req.direction === 'BUY';

  // 1. Get Account Info for sizing
  const accountInfo = await getExnessAccountInfo();
  const effectiveEquity = accountInfo.equity > 0 ? accountInfo.equity : 1000;
  const riskPercent = req.riskPercent || config.exness.maxRiskPercent || 1.0;

  const { lotSize, riskAmount } = calculateExnessLotSize(
    effectiveEquity,
    riskPercent,
    req.entryPrice,
    req.stopLoss,
    mapping.pipSize
  );

  const { accountId, token, apiUrl, enabled } = config.exness;

  // If Exness is not configured with live credentials, return a validated structural response
  if (!enabled || !accountId || !token) {
    return {
      success: true,
      ticket: Math.floor(10000000 + Math.random() * 90000000),
      orderId: `SIM-${Date.now()}`,
      positionId: `POS-${Date.now()}`,
      symbol: exnessSymbol,
      type: isBuy ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      volume: lotSize,
      openPrice: req.entryPrice,
      stopLoss: req.stopLoss,
      takeProfit: req.takeProfit1,
      riskAmount,
      status: 'SIMULATED_TEST',
      message: `[EXNESS STANDBY] Ready for live orders. Connect credentials in .env (AccountId: ${accountId || 'None'}). Calculated Lot: ${lotSize} (${riskPercent}% Risk: $${riskAmount}).`,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // 2. Fetch latest quote to choose Market vs Limit order
    const liveQuote = await fetchExnessQuote(req.instrumentId);
    const currentPrice = liveQuote?.price || req.entryPrice;

    let orderType = req.orderType || 'AUTO';
    let metaApiActionType = isBuy ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL';

    if (orderType === 'AUTO') {
      const priceDiffPips = Math.abs(currentPrice - req.entryPrice) / mapping.pipSize;
      if (priceDiffPips <= 5) {
        // Close enough for direct market execution
        metaApiActionType = isBuy ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL';
      } else if (isBuy) {
        metaApiActionType = req.entryPrice < currentPrice ? 'ORDER_TYPE_BUY_LIMIT' : 'ORDER_TYPE_BUY_STOP';
      } else {
        metaApiActionType = req.entryPrice > currentPrice ? 'ORDER_TYPE_SELL_LIMIT' : 'ORDER_TYPE_SELL_STOP';
      }
    }

    const payload = {
      actionType: metaApiActionType,
      symbol: exnessSymbol,
      volume: lotSize,
      openPrice: metaApiActionType.includes('LIMIT') || metaApiActionType.includes('STOP') ? req.entryPrice : undefined,
      stopLoss: req.stopLoss,
      takeProfit: req.takeProfit1,
      comment: req.comment || `SMC-${req.analysisId?.slice(-6) || 'Auto'}`,
    };

    const url = `${apiUrl}/users/current/accounts/${accountId}/trade`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'auth-token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data: any = await res.json();

    if (res.ok && (data.orderId || data.numericCode === 10009 || data.stringCode === 'TRADE_RETCODE_DONE')) {
      return {
        success: true,
        orderId: String(data.orderId || data.positionId || data.ticket),
        positionId: String(data.positionId || data.orderId),
        ticket: data.numericCode || data.orderId,
        symbol: exnessSymbol,
        type: metaApiActionType,
        volume: lotSize,
        openPrice: req.entryPrice,
        stopLoss: req.stopLoss,
        takeProfit: req.takeProfit1,
        riskAmount,
        status: metaApiActionType.includes('LIMIT') || metaApiActionType.includes('STOP') ? 'PLACED' : 'EXECUTED',
        message: `Exness order placed successfully on ${config.exness.server}. Ticket: ${data.orderId || data.numericCode}`,
        timestamp: new Date().toISOString(),
      };
    } else {
      return {
        success: false,
        symbol: exnessSymbol,
        type: metaApiActionType,
        volume: lotSize,
        openPrice: req.entryPrice,
        stopLoss: req.stopLoss,
        takeProfit: req.takeProfit1,
        riskAmount,
        status: 'REJECTED',
        message: data.message || data.description || 'Order placement failed on Exness broker.',
        timestamp: new Date().toISOString(),
      };
    }
  } catch (err: any) {
    return {
      success: false,
      symbol: exnessSymbol,
      type: isBuy ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      volume: lotSize,
      openPrice: req.entryPrice,
      stopLoss: req.stopLoss,
      takeProfit: req.takeProfit1,
      riskAmount,
      status: 'REJECTED',
      message: `Network/Gateway error during Exness execution: ${err.message}`,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Retrieve open positions from Exness account
 */
export async function getExnessOpenPositions(): Promise<ExnessPosition[]> {
  const { accountId, token, apiUrl, enabled } = config.exness;
  if (!enabled || !accountId || !token) return [];

  try {
    const url = `${apiUrl}/users/current/accounts/${accountId}/positions`;
    const res = await fetch(url, {
      headers: {
        'auth-token': token,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data: any = await res.json();
      if (Array.isArray(data)) {
        return data.map((p: any) => ({
          id: String(p.id || p.positionId),
          ticket: Number(p.id || p.ticket || 0),
          symbol: p.symbol,
          type: p.type,
          volume: Number(p.volume),
          openPrice: Number(p.openPrice),
          currentPrice: Number(p.currentPrice),
          stopLoss: p.stopLoss ? Number(p.stopLoss) : undefined,
          takeProfit: p.takeProfit ? Number(p.takeProfit) : undefined,
          profit: Number(p.profit || 0),
          swap: Number(p.swap || 0),
          commission: Number(p.commission || 0),
          openTime: p.time || new Date().toISOString(),
          comment: p.comment,
        }));
      }
    }
  } catch (err: any) {
    console.warn(`[EXNESS] Error fetching positions: ${err.message}`);
  }

  return [];
}

/**
 * Close an active Exness position by ID
 */
export async function closeExnessPosition(positionId: string): Promise<{ success: boolean; message: string }> {
  const { accountId, token, apiUrl, enabled } = config.exness;
  if (!enabled || !accountId || !token) {
    return { success: false, message: 'Exness gateway is not enabled or credentials are missing.' };
  }

  try {
    const url = `${apiUrl}/users/current/accounts/${accountId}/trade`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'auth-token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actionType: 'POSITION_CLOSE_ID',
        positionId,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const data: any = await res.json();
    if (res.ok) {
      return { success: true, message: `Position ${positionId} closed successfully.` };
    }
    return { success: false, message: data.message || 'Failed to close position.' };
  } catch (err: any) {
    return { success: false, message: `Error closing position: ${err.message}` };
  }
}
