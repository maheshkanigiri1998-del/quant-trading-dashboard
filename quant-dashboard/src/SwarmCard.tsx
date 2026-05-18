import { useState } from 'react';

export default function SwarmCard() {
  const [ticker, setTicker] = useState("^NSEI"); // Defaults to Nifty 50
  const [swarmData, setSwarmData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSwarmAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      // Make sure this port matches your FastAPI terminal (8000)
      const response = await fetch(`https://quant-trading-dashboard-d8sy.onrender.com/api/swarm?ticker=${encodeURIComponent(ticker)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch data from backend");
      }
      const data = await response.json();
      setSwarmData(data);
    } catch (err: any) {
      console.error("Error fetching swarm:", err);
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ border: "1px solid #444", padding: "20px", marginTop: "20px", borderRadius: "8px", backgroundColor: "#1e1e1e", color: "white" }}>
      <h3 style={{ marginTop: 0, color: "#28a745" }}>🤖 Institutional AI Swarm</h3>
      <p style={{ fontSize: "14px", color: "#aaa" }}>Enter an index (e.g., ^NSEI, ^BSESN, ^GSPC) or stock ticker (e.g., RELIANCE.NS)</p>
      
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          style={{ padding: "8px", backgroundColor: "#333", color: "white", border: "1px solid #555", borderRadius: "4px", flexGrow: 1 }}
        />
        <button 
          onClick={fetchSwarmAnalysis} 
          disabled={loading} 
          style={{ padding: "8px 16px", backgroundColor: loading ? "#555" : "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", fontWeight: "bold" }}
        >
          {loading ? "Swarm is Debating (30s)..." : "RUN AI SWARM"}
        </button>
      </div>

      {error && <p style={{ color: "#ff4444" }}>⚠️ {error}</p>}

      {swarmData && (
        <div style={{ backgroundColor: "#2a2a2a", padding: "15px", borderRadius: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #444", paddingBottom: "10px", marginBottom: "10px" }}>
            <span><strong>Latest Close:</strong> {swarmData.latest_close}</span>
            <span><strong>XGBoost Target:</strong> <span style={{ color: swarmData.xgboost_prediction.includes("UP") ? "#28a745" : "#ff4444"}}>{swarmData.xgboost_prediction}</span></span>
            <span><strong>Accuracy:</strong> {swarmData.model_accuracy}%</span>
          </div>
          <div>
            <h4 style={{ margin: "0 0 5px 0", color: "#ffc107" }}>Final Swarm Verdict:</h4>
            <p style={{ margin: 0, lineHeight: "1.5" }}>{swarmData.swarm_decision}</p>
          </div>
        </div>
      )}
    </div>
  );
}