import { useEffect, useState } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer, YAxis, CartesianGrid } from 'recharts';

interface Fundamentals {
  symbol: string;
  currency_symbol?: string;
  peg: number | string;
  pegy: number | string;
  pb: number | string;
  book_value: number | string;
  face_value: string;
  intrinsic_value: number | string;
  eps: number | string;
  roe: number | string;
  debt_to_equity: number | string;
  current_ratio: number | string;
  q_rev_growth: number | string;
  q_profit_growth: number | string;
  q_revenue: string;
}

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
}

interface DCFData {
  currency_symbol?: string;
  current_price: number;
  dcf_value: number;
  upside: number;
  error?: string;
}

interface MonteCarloData {
  currency_symbol: string;
  current_price: number;
  days: number;
  simulations: number;
  p5_final: number;
  median_final: number;
  p95_final: number;
  chart_data: Array<{ day: number; p5: number; median: number; p95: number }>;
  error?: string;
}

export default function LiveTicker() {
  const [price, setPrice] = useState<string>('Loading...');
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [latency, setLatency] = useState<number | null>(null);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  const [isLiquidated, setIsLiquidated] = useState<boolean>(false);
  
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [financialSummary, setFinancialSummary] = useState<string | null>(null);
  const [dcfData, setDcfData] = useState<DCFData | null>(null);
  const [mcData, setMcData] = useState<MonteCarloData | null>(null);
  
  const [isFetchingData, setIsFetchingData] = useState<boolean>(false);
  const [isFetchingNews, setIsFetchingNews] = useState<boolean>(false);
  const [isFetchingSummary, setIsFetchingSummary] = useState<boolean>(false);
  const [isFetchingDCF, setIsFetchingDCF] = useState<boolean>(false);
  const [isFetchingMC, setIsFetchingMC] = useState<boolean>(false);
  
  const [tickerInput, setTickerInput] = useState<string>('AAPL');
  const [auditStep, setAuditStep] = useState<number>(0);

  const MAX_LOSS = -5.00;

  // Dynamically uses hostname (localhost or 127.0.0.1) to avoid browser CORS origin blocks
  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:10000` 
    : 'https://finance-swarm-backend-final3.onrender.com';

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        ws = new WebSocket('wss://stream.binance.com/ws/btcusdt@trade');
        ws.onopen = () => setConnectionStatus('Connected');
        ws.onerror = () => setConnectionStatus('Offline / Blocked');

        ws.onclose = () => {
          setConnectionStatus('Disconnected');
          reconnectTimeout = setTimeout(connect, 10000); 
        };

        ws.onmessage = (event) => {
          const tradeData = JSON.parse(event.data);
          const currentPriceNum = parseFloat(tradeData.p);
          setPrice(`$${currentPriceNum.toFixed(2)}`);
          setLatency(Date.now() - tradeData.E);
          
          setPriceHistory((prev: number[]) => {
            const newHistory = [...prev, currentPriceNum];
            if (newHistory.length > 40) newHistory.shift();
            return newHistory;
          });
        };
      } catch (err) {
        console.warn('WebSocket connection failed:', err);
      }
    }

    connect();
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, []);

  const currentPriceNum = parseFloat(price.replace('$', '')) || 0;
  const pnl = entryPrice && !isLiquidated ? currentPriceNum - entryPrice : 0;

  useEffect(() => {
    if (entryPrice && pnl <= MAX_LOSS) {
      setIsLiquidated(true);
      setEntryPrice(null);
    }
  }, [pnl, entryPrice]);

  const handleBuy = () => {
    if (price !== 'Loading...' && !isLiquidated) {
      setEntryPrice(parseFloat(price.replace('$', '')));
    }
  };

  const getSafeTicker = () => encodeURIComponent(tickerInput.toUpperCase().trim());

  const fetchFundamentalsAndNews = async () => {
    setIsFetchingData(true);
    setIsFetchingNews(true);
    setFundamentals(null);
    setNewsList([]);

    // Fetch Fundamentals
    try {
      const response = await fetch(`${API_BASE_URL}/api/fundamentals?ticker=${getSafeTicker()}`);
      const data = await response.json();
      setFundamentals(data && !data.error ? data : null);
    } catch (error) {
      console.error("Failed fetching fundamentals", error);
    } finally {
      setIsFetchingData(false);
    }

    // Fetch News
    try {
      const newsResp = await fetch(`${API_BASE_URL}/api/news?ticker=${getSafeTicker()}`);
      const newsData = await newsResp.json();
      setNewsList(newsData?.news || []);
    } catch (error) {
      console.error("Failed fetching news", error);
    } finally {
      setIsFetchingNews(false);
    }
  };

  const fetchDCF = async () => {
    setIsFetchingDCF(true);
    setDcfData(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dcf?ticker=${getSafeTicker()}`);
      const data = await response.json();
      setDcfData(data);
    } catch (error) {
      console.error("DCF Failed", error);
      setDcfData({ error: "Could not connect to Python backend." } as DCFData);
    } finally {
      setIsFetchingDCF(false);
    }
  };

  const fetchMonteCarlo = async () => {
    setIsFetchingMC(true);
    setMcData(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/monte-carlo?ticker=${getSafeTicker()}&days=252&simulations=500`);
      const data = await response.json();
      setMcData(data);
    } catch (error) {
      console.error("Monte Carlo Failed", error);
      setMcData({ error: "Could not connect to Python backend." } as MonteCarloData);
    } finally {
      setIsFetchingMC(false);
    }
  };

  const runFinancialAudit = async () => {
    setIsFetchingSummary(true);
    setFinancialSummary(null);
    setAuditStep(0);
    try {
      const response = await fetch(`${API_BASE_URL}/api/audit?ticker=${getSafeTicker()}`);
      if (response.ok) {
        const data = await response.json();
        setFinancialSummary(data.summary || data.analysis || JSON.stringify(data));
      } else {
        setFinancialSummary("⚠️ AI ENGINE ERROR: Check backend logs.");
      }
    } catch (error) {
      setFinancialSummary("⚠️ SERVER ERROR: Could not connect to Python backend.");
    } finally {
      setIsFetchingSummary(false);
    }
  };

  const runInstitutionalSwarm = async () => {
    setIsFetchingSummary(true);
    setFinancialSummary(null);
    setAuditStep(0);
    try {
      const response = await fetch(`${API_BASE_URL}/api/swarm?ticker=${getSafeTicker()}`);
      if (response.ok) {
        const data = await response.json();
        setFinancialSummary(data.output || data.result || data.summary || JSON.stringify(data));
      } else {
        setFinancialSummary("⚠️ Swarm API Error: Check Gemini Quotas.");
      }
    } catch (error) {
      setFinancialSummary("❌ Failed to reach the Python backend.");
    } finally {
      setIsFetchingSummary(false);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isFetchingSummary) {
      interval = setInterval(() => {
        setAuditStep((prev: number) => (prev < 3 ? prev + 1 : prev));
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isFetchingSummary]);

  const chartData = priceHistory.map((p: number, index: number) => ({ time: index, price: p }));
  const currSym = fundamentals?.currency_symbol || dcfData?.currency_symbol || mcData?.currency_symbol || '$';

  const pipelineMessages = [
    "Initializing secure connection...",
    `[1/3] Scraping raw financial data for ${tickerInput.toUpperCase()}...`,
    "[2/3] Passing heavy context to cloud engine...",
    "[3/3] Generating quantitative summary..."
  ];

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '400px', backgroundColor: '#1e1e1e', color: '#fff', borderRadius: '8px', margin: '0 auto' }}>
      
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
          .skeleton-box {
            animation: shimmer 1.5s infinite linear;
            background: linear-gradient(to right, #252525 8%, #383838 18%, #252525 33%);
            background-size: 800px 100%;
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}
      </style>

      {/* CRYPTO PIPELINE */}
      <div style={{ border: isLiquidated ? '2px solid #ff4444' : '1px solid #333', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0', fontSize: '14px', color: '#888' }}>LIVE BTC/USDT</h2>
        <h1 style={{ margin: '5px 0', fontSize: '32px' }}>{price}</h1>
        <div style={{ fontSize: '11px', color: connectionStatus === 'Connected' ? '#00ff00' : '#ff4444', marginBottom: '8px' }}>
          ● {connectionStatus} {latency !== null ? `| ${latency}ms` : ''}
        </div>

        <div style={{ height: '120px', width: '100%', minWidth: 0, marginBottom: '15px', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <YAxis domain={['auto', 'auto']} stroke="#555" fontSize={10} width={45} tickFormatter={(val: any) => `$${val}`} />
              <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #444', borderRadius: '4px' }} itemStyle={{ color: '#00ff00', fontWeight: 'bold' }} labelStyle={{ display: 'none' }} />
              <Line type="monotone" dataKey="price" stroke="#00ff00" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '6px', marginBottom: '15px' }}>
          <button onClick={handleBuy} disabled={isLiquidated} style={{ width: '100%', padding: '10px', backgroundColor: isLiquidated ? '#444' : '#4CAF50', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isLiquidated ? 'SYSTEM LOCKED' : 'EXECUTE BUY'}
          </button>
        </div>
      </div>

      {/* EQUITY METRICS */}
      <div style={{ border: '1px solid #333', padding: '15px', borderRadius: '6px', backgroundColor: '#121212', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#888' }}>EQUITY METRICS</h2>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input 
            type="text" 
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            placeholder="Enter Ticker"
            style={{ flex: 1, padding: '8px', backgroundColor: '#252525', border: '1px solid #444', color: 'white', borderRadius: '4px', textTransform: 'uppercase' }}
          />
          <button onClick={fetchFundamentalsAndNews} disabled={isFetchingData || isFetchingNews} style={{ padding: '8px 15px', backgroundColor: '#ff9800', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {isFetchingData ? '...' : 'FETCH'}
          </button>
        </div>

        {isFetchingData ? (
          <div>
            <div className="skeleton-box" style={{ height: '24px', width: '120px', margin: '0 auto 15px auto', borderRadius: '4px' }}></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[...Array(12)].map((_: any, i: number) => (
                <div key={i} className="skeleton-box" style={{ height: '60px', borderRadius: '4px' }}></div>
              ))}
            </div>
          </div>
        ) : fundamentals ? (
          <div>
            <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#ff9800' }}>
              {fundamentals.symbol}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { label: 'PEG', value: fundamentals.peg },
                { label: 'PEGY', value: fundamentals.pegy },
                { label: 'QUARTER SALES', value: fundamentals.q_revenue },
                { label: 'QoQ REV GROWTH', value: typeof fundamentals.q_rev_growth === 'number' ? `${fundamentals.q_rev_growth}%` : fundamentals.q_rev_growth },
                { label: 'QoQ PROFIT GROWTH', value: typeof fundamentals.q_profit_growth === 'number' ? `${fundamentals.q_profit_growth}%` : fundamentals.q_profit_growth },
                { label: 'ROE (%)', value: fundamentals.roe },
                { label: 'DEBT/EQ', value: fundamentals.debt_to_equity },
                { label: 'EPS', value: typeof fundamentals.eps === 'number' ? `${currSym}${fundamentals.eps.toFixed(2)}` : fundamentals.eps },
                { label: 'CURR RATIO', value: fundamentals.current_ratio },
                { label: 'P/B RATIO', value: fundamentals.pb },
                { label: 'BOOK VAL', value: typeof fundamentals.book_value === 'number' ? `${currSym}${fundamentals.book_value.toFixed(2)}` : fundamentals.book_value },
                { label: 'INTRINSIC VAL', value: typeof fundamentals.intrinsic_value === 'number' ? `${currSym}${fundamentals.intrinsic_value.toFixed(2)}` : fundamentals.intrinsic_value }
              ].map((metric: any, i: number) => (
                <div key={i} style={{ backgroundColor: '#252525', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '5px' }}>{metric.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{metric.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#555', fontSize: '12px', padding: '10px 0' }}>
            Enter a ticker and click Fetch.
          </div>
        )}
      </div>

      {/* STOCK NEWS CARD */}
      <div style={{ border: '1px solid #00bcd4', padding: '15px', borderRadius: '6px', backgroundColor: '#00363a', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#80deea' }}>📰 LATEST HEADLINES ({tickerInput.toUpperCase()})</h2>
        {isFetchingNews ? (
          <div className="skeleton-box" style={{ height: '80px', borderRadius: '4px' }}></div>
        ) : newsList.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {newsList.map((item: NewsItem, idx: number) => (
              <div key={idx} style={{ backgroundColor: '#002528', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #00bcd4' }}>
                <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#e0f7fa', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  {item.title}
                </a>
                <span style={{ fontSize: '10px', color: '#80deea' }}>Source: {item.publisher}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#80deea', fontSize: '12px', padding: '10px 0' }}>
            No recent news articles found for this ticker.
          </div>
        )}
      </div>

      {/* VALUATION MODULE */}
      <div style={{ border: '1px solid #4CAF50', padding: '15px', borderRadius: '6px', backgroundColor: '#1b5e20', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: '0', fontSize: '14px', color: '#a5d6a7' }}>DCF MODEL (5-YR)</h2>
          <button onClick={fetchDCF} disabled={isFetchingDCF} style={{ padding: '5px 10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {isFetchingDCF ? 'CALCULATING...' : 'RUN DCF'}
          </button>
        </div>

        {dcfData ? (
          dcfData.error ? (
            <div style={{ color: '#ff5252', fontSize: '12px', textAlign: 'center' }}>{dcfData.error}</div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#003300', padding: '15px', borderRadius: '4px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#a5d6a7', marginBottom: '5px' }}>CURRENT PRICE</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{dcfData.currency_symbol || '$'}{dcfData.current_price}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#a5d6a7', marginBottom: '5px' }}>INTRINSIC VALUE</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{dcfData.currency_symbol || '$'}{dcfData.dcf_value}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#a5d6a7', marginBottom: '5px' }}>UPSIDE</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: dcfData.upside > 0 ? '#00ff00' : '#ff4444' }}>
                  {dcfData.upside > 0 ? '+' : ''}{dcfData.upside}%
                </div>
              </div>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', color: '#a5d6a7', fontSize: '12px', padding: '10px 0' }}>
            Awaiting execution for {tickerInput.toUpperCase()}.
          </div>
        )}
      </div>

      {/* MONTE CARLO SIMULATION MODULE */}
      <div style={{ border: '1px solid #9c27b0', padding: '15px', borderRadius: '6px', backgroundColor: '#4a148c', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: '0', fontSize: '14px', color: '#e1bee7' }}>MONTE CARLO (1-YR)</h2>
          <button onClick={fetchMonteCarlo} disabled={isFetchingMC} style={{ padding: '5px 10px', backgroundColor: '#ab47bc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
            {isFetchingMC ? 'SIMULATING...' : 'RUN SIMULATION'}
          </button>
        </div>

        {mcData ? (
          mcData.error ? (
            <div style={{ color: '#ff5252', fontSize: '12px', textAlign: 'center' }}>{mcData.error}</div>
          ) : (
            <div>
              <div style={{ height: '140px', width: '100%', minWidth: 0, marginBottom: '15px' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={mcData.chart_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#6a1b9a" vertical={false} />
                    <YAxis domain={['auto', 'auto']} stroke="#ce93d8" fontSize={10} width={45} tickFormatter={(val: any) => `${mcData.currency_symbol}${val}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #9c27b0', borderRadius: '4px' }} itemStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="p95" stroke="#00ff00" strokeWidth={1.5} dot={false} name="95th % (Bull)" />
                    <Line type="monotone" dataKey="median" stroke="#ffeb3b" strokeWidth={2} dot={false} name="Median (Expected)" />
                    <Line type="monotone" dataKey="p5" stroke="#ff4444" strokeWidth={1.5} dot={false} name="5th % (Bear)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', backgroundColor: '#311b92', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#ff8a80' }}>BEAR (5%)</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff5252' }}>{mcData.currency_symbol}{mcData.p5_final}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#ffee58' }}>MEDIAN</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{mcData.currency_symbol}{mcData.median_final}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', color: '#b9f6ca' }}>BULL (95%)</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#00e676' }}>{mcData.currency_symbol}{mcData.p95_final}</div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', color: '#e1bee7', fontSize: '12px', padding: '10px 0' }}>
            Run 500 stochastic price path projections for {tickerInput.toUpperCase()}.
          </div>
        )}
      </div>

      {/* AI FINANCIAL AGENT */}
      <div style={{ border: '1px solid #3f51b5', padding: '15px', borderRadius: '6px', backgroundColor: '#1a237e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: '0', fontSize: '14px', color: '#8c9eff' }}>AI FINANCIAL AUDIT</h2>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={runFinancialAudit} disabled={isFetchingSummary} style={{ padding: '5px 10px', backgroundColor: '#3f51b5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {isFetchingSummary ? '...' : 'AUDIT'}
            </button>
            <button onClick={runInstitutionalSwarm} disabled={isFetchingSummary} style={{ padding: '5px 10px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {isFetchingSummary ? '...' : 'SWARM'}
            </button>
          </div>
        </div>
        
        {isFetchingSummary ? (
          <div style={{ backgroundColor: '#000', padding: '15px', borderRadius: '4px', border: '1px solid #333', minHeight: '80px' }}>
            <div style={{ fontSize: '11px', color: '#4caf50', marginBottom: '5px' }}>Terminal Output:</div>
            <div style={{ fontSize: '12px', color: '#00ff00', fontFamily: 'monospace' }}>
              &gt; {pipelineMessages[auditStep]}
              <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
            </div>
          </div>
        ) : financialSummary ? (
           <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#e8eaf6', whiteSpace: 'pre-wrap', backgroundColor: '#0d1140', padding: '10px', borderRadius: '4px' }}>
             {financialSummary}
           </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#8c9eff', fontSize: '12px', padding: '20px 0' }}>
            Agent on standby.
          </div>
        )}
      </div>

    </div>
  );
}