import { useEffect, useState } from 'react';

export default function LiveTicker() {
  // 1. Data Pipeline Memory
  const [price, setPrice] = useState<string>('Loading...');
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [latency, setLatency] = useState<number | null>(null);
  
  // 2. Risk Management Memory
  const [entryPrice, setEntryPrice] = useState<number | null>(null);
  const [isLiquidated, setIsLiquidated] = useState<boolean>(false);
  const MAX_LOSS = -5.00; 

  // 3. NEW: AI Agent Memory
  const [sentiment, setSentiment] = useState<string>('Standby');
  const [isThinking, setIsThinking] = useState<boolean>(false);

  useEffect(() => {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

    ws.onopen = () => setConnectionStatus('Connected');

    ws.onmessage = (event) => {
      const tradeData = JSON.parse(event.data);
      const currentPrice = parseFloat(tradeData.p).toFixed(2); 
      setPrice(`$${currentPrice}`);
      setLatency(Date.now() - tradeData.E);
    };

    ws.onerror = () => {
      setConnectionStatus('Error: Connection Dropped');
      setLatency(null);
    };

    return () => ws.close();
  }, []);

  const handleBuy = () => {
    if (price !== 'Loading...' && !isLiquidated) {
      const numericPrice = parseFloat(price.replace('$', ''));
      setEntryPrice(numericPrice);
    }
  };

  const currentPriceNum = price !== 'Loading...' ? parseFloat(price.replace('$', '')) : 0;
  let pnl = 0;
  
  if (entryPrice && !isLiquidated) {
    pnl = currentPriceNum - entryPrice;
    if (pnl <= MAX_LOSS) {
      setIsLiquidated(true);
      setEntryPrice(null); 
    }
  }

  // NEW: The Bridge to Python
  const fetchAISentiment = async () => {
    setIsThinking(true);
    setSentiment('Analyzing News...');
    
    try {
      // React "knocks" on the Python server's door
      const response = await fetch('http://127.0.0.1:8000/api/sentiment');
      const data = await response.json();
      
      // Update the dashboard with the AI's answer
      setSentiment(data.sentiment.toUpperCase());
    } catch (error) {
      setSentiment('ERROR: API OFFLINE');
    }
    
    setIsThinking(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', border: isLiquidated ? '2px solid #ff4444' : '1px solid #333', maxWidth: '400px', backgroundColor: '#1e1e1e', color: '#fff', borderRadius: '8px', transition: 'all 0.3s' }}>
      <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#888' }}>BTC/USDT Live Feed</h2>
      <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', color: '#fff' }}>{price}</h1>
      
      {/* Trading Panel */}
      <div style={{ padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '6px', marginBottom: '15px' }}>
        <button 
          onClick={handleBuy}
          disabled={isLiquidated}
          style={{ width: '100%', padding: '10px', backgroundColor: isLiquidated ? '#555' : '#4CAF50', color: isLiquidated ? '#aaa' : 'white', border: 'none', borderRadius: '4px', cursor: isLiquidated ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginBottom: '10px' }}
        >
          {isLiquidated ? 'SYSTEM LOCKED: MAX DRAWDOWN REACHED' : 'EXECUTE: BUY 1 BTC'}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <span style={{ color: '#aaa' }}>Entry Price:</span>
          <span>{entryPrice ? `$${entryPrice.toFixed(2)}` : 'No Position'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}>
          <span style={{ color: '#aaa' }}>Live PnL:</span>
          <span style={{ color: pnl >= 0 ? '#00ff00' : '#ff4444', fontWeight: 'bold' }}>
            {entryPrice ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '$0.00'}
          </span>
        </div>
      </div>

      {/* NEW: AI Sentiment Module */}
      <div style={{ padding: '15px', backgroundColor: '#1a237e', borderRadius: '6px', marginBottom: '15px', border: '1px solid #3f51b5' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ color: '#8c9eff', fontWeight: 'bold', fontSize: '14px' }}>Llama 3 Sentiment AI</span>
          <button 
            onClick={fetchAISentiment}
            disabled={isThinking}
            style={{ padding: '5px 10px', backgroundColor: isThinking ? '#555' : '#3f51b5', color: 'white', border: 'none', borderRadius: '4px', cursor: isThinking ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}
          >
            {isThinking ? 'Processing...' : 'Run Analysis'}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
          <span style={{ color: '#aaa' }}>Market Regime:</span>
          <span style={{ color: sentiment === 'BULLISH' ? '#00ff00' : sentiment === 'BEARISH' ? '#ff4444' : '#ffd700', fontWeight: 'bold' }}>
            {sentiment}
          </span>
        </div>
      </div>

      {/* Connection Data */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #333', paddingTop: '10px' }}>
        <p style={{ margin: '0', fontSize: '12px', color: '#aaa' }}>Status: {connectionStatus}</p>
        <p style={{ margin: '0', fontSize: '12px', color: (!latency) ? '#888' : (latency < 150) ? '#00ff00' : (latency < 400) ? '#ffd700' : '#ff4444', fontWeight: 'bold' }}>
          {latency ? `${latency}ms` : 'Calculating...'}
        </p>
      </div>
    </div>
  );
}