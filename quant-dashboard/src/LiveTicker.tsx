import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, AlertTriangle, CheckCircle2, TrendingUp, Cpu, Activity } from 'lucide-react';

interface Fundamentals {
  symbol: string;
  peg: string | number;
  pegy: string | number;
  pb: string | number;
  book_value: string | number;
  face_value: string;
  intrinsic_value: string | number;
  eps: string | number;
  roe: string | number;
  debt_to_equity: string | number;
  current_ratio: string | number;
  q_rev_growth: string | number;
  q_profit_growth: string | number;
  q_revenue: string;
}

interface DCFData {
  current_price: number;
  dcf_value: number;
  upside: number;
  error?: string;
}

interface AISummary {
  summary: string;
  error?: string;
}

interface SwarmResult {
  ticker: string;
  latest_close: number;
  xgboost_prediction: string;
  model_accuracy: number;
  swarm_decision: string;
}

export default function LiveTicker() {
  const [ticker, setTicker] = useState('RELIANCE.NS');
  const [inputTicker, setInputTicker] = useState('RELIANCE.NS');
  
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [dcf, setDcf] = useState<DCFData | null>(null);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [swarm, setSwarm] = useState<SwarmResult | null>(null);

  const [loadingFunds, setLoadingFunds] = useState(false);
  const [loadingDcf, setLoadingDcf] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingSwarm, setLoadingSwarm] = useState(false);

  const fetchBaseData = async (targetTicker: string) => {
    const cleanTicker = targetTicker.trim().toUpperCase();
    
    setLoadingFunds(true);
    try {
      const res = await fetch(`https://finance-swarm-backend-final3.onrender.com/api/fundamentals?ticker=${cleanTicker}`);
      const data = res.ok ? await res.json() : null;
      if (data && !data.error) {
        setFundamentals(data);
      } else {
        setFundamentals(null);
      }
    } catch (e) {
      console.error(e);
      setFundamentals(null);
    } finally {
      setLoadingFunds(false);
    }

    setLoadingDcf(true);
    try {
      const res = await fetch(`https://finance-swarm-backend-final3.onrender.com/api/dcf?ticker=${cleanTicker}`);
      const data = res.ok ? await res.json() : null;
      if (data && !data.error) {
        setDcf(data);
      } else {
        setDcf({ current_price: 0, dcf_value: 0, upside: 0, error: 'DCF Calculation Error' });
      }
    } catch (e) {
      console.error(e);
      setDcf({ current_price: 0, dcf_value: 0, upside: 0, error: 'Failed to fetch DCF' });
    } finally {
      setLoadingDcf(false);
    }

    setLoadingSummary(true);
    try {
      const res = await fetch(`https://finance-swarm-backend-final3.onrender.com/api/ai-summary?ticker=${cleanTicker}`);
      const data = res.ok ? await res.json() : null;
      if (data && !data.error) {
        setAiSummary(data);
      } else {
        setAiSummary({ summary: '', error: 'Summary Generation Error' });
      }
    } catch (e) {
      console.error(e);
      setAiSummary({ summary: '', error: 'Failed to load AI Audit summary' });
    } finally {
      setLoadingSummary(false);
    }
  };

  const runSwarmAnalysis = async () => {
    setLoadingSwarm(true);
    setSwarm(null);
    try {
      const res = await fetch(`https://finance-swarm-backend-final3.onrender.com/api/swarm?ticker=${ticker.trim().toUpperCase()}`);
      if (!res.ok) throw new Error("Swarm request failed");
      const data = await res.json();
      setSwarm(data);
    } catch (e) {
      console.error(e);
      alert("Failed to request backend. Try again in a moment.");
    } finally {
      setLoadingSwarm(false);
    }
  };

  useEffect(() => {
    fetchBaseData(ticker);
  }, [ticker]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTicker.trim()) {
      setTicker(inputTicker.trim().toUpperCase());
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans w-full block">
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6 w-full">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold uppercase tracking-wider text-sm">
            <Activity className="w-4 h-4 animate-pulse" /> Live Terminal Workspace
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            Quant Trading & AI Swarm Dashboard
          </h1>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={inputTicker}
            onChange={(e) => setInputTicker(e.target.value)}
            placeholder="e.g. RELIANCE.NS, AAPL"
            className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm uppercase w-48 md:w-64"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg transition-all text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            Fetch
          </button>
        </form>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 w-full text-left">
        <div className="lg:col-span-2 space-y-6 w-full block">
          
          {/* Fundamentals Matrix Component */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-6 shadow-xl w-full block">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2 border-b border-slate-800/60 pb-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" /> Fundamental Metrics Matrix: <span className="text-indigo-400 font-mono">{ticker}</span>
            </h2>

            {loadingFunds ? (
              <div className="py-12 flex justify-center items-center text-slate-400 text-sm font-mono animate-pulse">
                Loading live exchange fields...
              </div>
            ) : fundamentals ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">PEG Ratio</span>
                  <span className="text-slate-200 text-sm font-bold">{fundamentals.peg}</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">PEGY Valuation</span>
                  <span className="text-slate-200 text-sm font-bold">{fundamentals.pegy}</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Price to Book (P/B)</span>
                  <span className="text-slate-200 text-sm font-bold">{fundamentals.pb}</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Book Value / Share</span>
                  <span className="text-slate-200 text-sm font-bold">{fundamentals.book_value}</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Intrinsic Value</span>
                  <span className="text-emerald-400 text-sm font-bold">
                    {typeof fundamentals.intrinsic_value === 'number' ? `₹${fundamentals.intrinsic_value}` : fundamentals.intrinsic_value}
                  </span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Trailing EPS</span>
                  <span className="text-slate-200 text-sm font-bold">{fundamentals.eps}</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Return on Equity (ROE)</span>
                  <span className="text-slate-200 text-sm font-bold">{fundamentals.roe}%</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Debt to Equity</span>
                  <span className="text-slate-200 text-sm font-bold">{fundamentals.debt_to_equity}</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Current Ratio</span>
                  <span className="text-slate-200 text-sm font-bold">{fundamentals.current_ratio}</span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Qtrly Revenue Growth</span>
                  <span className={`text-sm font-bold ${typeof fundamentals.q_rev_growth === 'number' && fundamentals.q_rev_growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fundamentals.q_rev_growth}%
                  </span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Qtrly Profit Growth</span>
                  <span className={`text-sm font-bold ${typeof fundamentals.q_profit_growth === 'number' && fundamentals.q_profit_growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fundamentals.q_profit_growth}%
                  </span>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Quarterly Revenue</span>
                  <span className="text-indigo-400 text-sm font-bold">{fundamentals.q_revenue}</span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm font-mono border border-dashed border-slate-800 rounded-lg">
                No matching financial listings located for this tracking ticker symbol.
              </div>
            )}
          </div>

          {/* DCF Block Component */}
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-5 shadow-xl w-full block">
            <h3 className="text-md font-bold text-emerald-400 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> DCF MODEL (5-YR)
            </h3>
            {loadingDcf ? (
              <div className="text-slate-400 text-xs font-mono animate-pulse">Calculating intrinsic margins...</div>
            ) : dcf && !dcf.error ? (
              <div className="grid grid-cols-3 gap-4 font-mono text-center">
                <div className="bg-slate-950/40 p-3 rounded-lg border border-emerald-900/30">
                  <div className="text-slate-500 text-xs mb-1">Current Share Price</div>
                  <div className="text-md font-bold text-slate-200">₹{dcf.current_price}</div>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-emerald-900/30">
                  <div className="text-slate-500 text-xs mb-1">Fair DCF Valuation</div>
                  <div className="text-md font-bold text-emerald-400">₹{dcf.dcf_value}</div>
                </div>
                <div className="bg-slate-950/40 p-3 rounded-lg border border-emerald-900/30">
                  <div className="text-slate-500 text-xs mb-1">Implied Upside Margin</div>
                  <div className={`text-md font-bold ${dcf.upside >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {dcf.upside}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs font-mono">
                {dcf?.error || "Awaiting execution parameters."}
              </div>
            )}
          </div>

          {/* AI Financial Audit Component */}
          <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-5 shadow-xl w-full block">
            <h3 className="text-md font-bold text-indigo-400 mb-3 flex items-center gap-2">
              <Cpu className="w-5 h-5" /> AI FINANCIAL AUDIT
            </h3>
            {loadingSummary ? (
              <div className="text-slate-400 text-xs font-mono animate-pulse">Parsing reports and statements...</div>
            ) : aiSummary && !aiSummary.error ? (
              <div className="text-slate-300 text-xs leading-relaxed font-mono whitespace-pre-line bg-slate-950/30 p-4 rounded-lg border border-indigo-950/40">
                {aiSummary.summary}
              </div>
            ) : (
              <div className="text-slate-500 text-xs font-mono">
                {aiSummary?.error || "Awaiting execution parameters."}
              </div>
            )}
          </div>
        </div>

        {/* Right Column Component */}
        <div className="space-y-6 w-full block">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between h-full w-full">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800 w-full">
                <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-400" /> CrewAI Multi-Agent Swarm
                </h2>
                <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-800/60 text-purple-400 rounded text-[10px] font-mono uppercase tracking-wider font-semibold">
                  Gemini-2.5 Core
                </span>
              </div>

              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                Deploys a specialized committee of independent AI agents (Quant Analyst, Sentiment Strategist, and Chief Risk Officer) to audit the XGBoost models and generate a final trading verdict.
              </p>

              <button
                onClick={runSwarmAnalysis}
                disabled={loadingSwarm}
                className={`w-full py-3 rounded-xl font-bold font-mono tracking-wide text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                  loadingSwarm
                    ? 'bg-purple-950/40 border border-purple-800/40 text-purple-400 cursor-not-allowed animate-pulse'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/10'
                }`}
              >
                {loadingSwarm ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" /> RUNNING MULTI-AGENT SWARM...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" /> RUN AI SWARM DEEP AUDIT
                  </>
                )}
              </button>

              <div className="mt-6 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs min-h-[220px] flex flex-col justify-between w-full">
                <div>
                  <div className="text-slate-500 border-b border-slate-900 pb-1.5 mb-2 flex justify-between items-center w-full">
                    <span>Terminal Output:</span>
                    {loadingSwarm && <span className="text-purple-400 animate-pulse">● processing tokens</span>}
                  </div>
                  
                  {loadingSwarm ? (
                    <div className="space-y-2 text-purple-300/80 animate-pulse">
                      <div>&gt; [1/3] Gathering historical indicators...</div>
                      <div>&gt; [2/3] Tuning XGBoost matrices...</div>
                      <div>&gt; [3/3] Commencing sequential agent consensus...</div>
                    </div>
                  ) : swarm ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/40 p-2 rounded border border-slate-800/40 w-full">
                        <div>
                          <span className="text-slate-500">XGBoost Pick:</span>
                          <span className="text-slate-300 font-bold block">{swarm.xgboost_prediction}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Model Accuracy:</span>
                          <span className="text-indigo-400 font-bold block">{swarm.model_accuracy}%</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-purple-400 font-bold block mb-1">Swarm Committee Verdict:</span>
                        <div className="text-slate-200 text-xs bg-purple-950/10 p-2 rounded border border-purple-900/20 leading-relaxed max-h-40 overflow-y-auto">
                          {swarm.swarm_decision}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600 italic py-8 text-center w-full">
                      Awaiting deployment trigger. Click button above to execute calculations.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-[11px] font-mono text-slate-400 w-full">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Layer-2 Risk Filter
              </span>
              <span className="text-emerald-400 font-semibold uppercase tracking-wider">ACTIVE & ARMED</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}