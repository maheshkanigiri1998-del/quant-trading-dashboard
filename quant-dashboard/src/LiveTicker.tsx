import { useEffect, useState } from 'react';

export default function LiveTicker() {
  const [price, setPrice] = useState<string>('Loading...');
  const [priceHistory, setPriceHistory] = useState<number[]>([]); // NEW: Stores last 10 prices
  const [sma, setSma] = useState<number | null>(null); // NEW: Calculated indicator
  
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [latency, setLatency] = useState<number | null>(null);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  const [isLiquidated, setIsLiquidated] = useState<boolean>(false);
  const [sentiment, setSentiment] = useState<string>('Standby');
  const [isThinking, setIsThinking] = useState<boolean>(false);

  const MAX_LOSS = -5.00;

  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

    ws.onmessage = (event) => {
      const tradeData = JSON.parse(event.data);
      const currentPriceNum = parseFloat(tradeData.p);
      
      setPrice(`$${currentPriceNum.toFixed(2)}`);
      setLatency(Date.now() - tradeData.E);

      // --- INDICATOR LOGIC START ---
      setPriceHistory((prev) => {
        // Add new price to the end of the array
        const newHistory = [...prev, currentPriceNum];
        // Keep only the last 10 prices (The "Window")
        if (newHistory.length > 10) {
          newHistory.shift(); 
        }
        
        // Calculate SMA
        const sum = newHistory.reduce((a, b) => a + b, 0);
        setSma(sum / newHistory.length);
        
        return newHistory;
      });
      // --- INDICATOR LOGIC END ---
    };

    ws.onopen = () => setConnectionStatus('Connected');
    ws.onerror = () => setConnectionStatus('Error');

    return () => ws.close();
  }, []);

  // Trading logic
  const handleBuy = () => {
    if (price !== 'Loading...' && !isLiquidated) {
      setEntryPrice(parseFloat(price.replace('$', '')));
    }
  };

  const currentPriceNum = parseFloat(price.replace('$', '')) || 0;
  const pnl = entryPrice && !isLiquidated ? currentPriceNum - entryPrice : 0;
  
  if (entryPrice && pnl <= MAX_LOSS) {
    setIsLiquidated(true);
    setEntryPrice(null);
  }

  const fetchAISentiment = async () => {
    setIsThinking(true);
    setSentiment('Analyzing...');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/sentiment');
      const data = await response.json();
      setSentiment(data.sentiment.toUpperCase());
    } catch {
      setSentiment('OFFLINE');
    }
    setIsThinking(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', border: isLiquidated ? '2px solid #ff4444' : '1px solid #333', maxWidth: '400px', backgroundColor: '#1e1e1e', color: '#fff', borderRadius: '8px' }}>
      <h2 style={{ margin: '0', fontSize: '14px', color: '#888' }}>LIVE BTC/USDT</h2>
      <h1 style={{ margin: '5px 0', fontSize: '32px' }}>{price}</h1>
      
      {/* NEW: Technical Indicator Display */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', padding: '10px', backgroundColor: '#252525', borderRadius: '4px', borderLeft: '3px solid #ffd700' }}>
        <span style={{ color: '#ffd700', fontSize: '12px', fontWeight: 'bold' }}>10-PERIOD SMA:</span>
        <span style={{ fontWeight: 'bold' }}>{sma ? `$${sma.toFixed(2)}` : 'Calculating...'}</span>
      </div>

      <div style={{ padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '6px', marginBottom: '10px' }}>
        <button onClick={handleBuy} disabled={isLiquidated} style={{ width: '100%', padding: '10px', backgroundColor: isLiquidated ? '#444' : '#4CAF50', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          {isLiquidated ? 'SYSTEM LOCKED' : 'EXECUTE BUY'}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px' }}>
          <span style={{ color: '#aaa' }}>PnL:</span>
          <span style={{ color: pnl >= 0 ? '#00ff00' : '#ff4444' }}>${pnl.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ padding: '15px', backgroundColor: '#1a237e', borderRadius: '6px', border: '1px solid #3f51b5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#8c9eff' }}>LLAMA 3 AI</span>
          <button onClick={fetchAISentiment} disabled={isThinking} style={{ padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>ANALYZE</button>
        </div>
        <div style={{ marginTop: '5px', fontSize: '18px', fontWeight: 'bold', color: sentiment === 'BULLISH' ? '#00ff00' : '#ff4444' }}>{sentiment}</div>
      </div>
    </div>
  );
}