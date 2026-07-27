import { useState } from 'react';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `http://${window.location.hostname}:10000`
    : '');

export default function SwarmCard() {
  const [ticker, setTicker] = useState("^NSEI"); // Defaults to Nifty 50
  const [swarmData, setSwarmData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSwarmAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/swarm?ticker=${encodeURIComponent(ticker)}`
      );
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

  const verdict =
    swarmData?.swarm_decision ||
    swarmData?.output ||
    swarmData?.summary ||
    (swarmData ? JSON.stringify(swarmData, null, 2) : null);

  return (
    <div style={{ border: "1px solid #444", padding: "16px", marginTop: "16px", borderRadius: "8px", backgroundColor: "#1e1e1e", color: "white", maxWidth: "400px", marginLeft: "auto", marginRight: "auto", width: "100%", boxSizing: "border-box" }}>
      <h3 style={{ marginTop: 0, color: "#28a745" }}>🤖 Institutional AI Swarm</h3>
      <p style={{ fontSize: "14px", color: "#aaa" }}>Enter an index (e.g., ^NSEI, ^BSESN, ^GSPC) or stock ticker (e.g., RELIANCE.NS)</p>
      
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          style={{ padding: "8px", backgroundColor: "#333", color: "white", border: "1px solid #555", borderRadius: "4px", flexGrow: 1, minWidth: "140px" }}
        />
        <button 
          onClick={fetchSwarmAnalysis} 
          disabled={loading} 
          style={{ padding: "8px 16px", backgroundColor: loading ? "#555" : "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: loading ? "not-allowed" : "pointer", fontWeight: "bold" }}
        >
          {loading ? "Swarm is Debating..." : "RUN AI SWARM"}
        </button>
      </div>

      {error && <p style={{ color: "#ff4444" }}>⚠️ {error}</p>}

      {swarmData && (
        <div style={{ backgroundColor: "#2a2a2a", padding: "15px", borderRadius: "6px" }}>
          {(swarmData.latest_close != null || swarmData.xgboost_prediction || swarmData.model_accuracy != null) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "space-between", borderBottom: "1px solid #444", paddingBottom: "10px", marginBottom: "10px" }}>
              {swarmData.latest_close != null && <span><strong>Latest Close:</strong> {swarmData.latest_close}</span>}
              {swarmData.xgboost_prediction && (
                <span>
                  <strong>XGBoost Target:</strong>{" "}
                  <span style={{ color: String(swarmData.xgboost_prediction).includes("UP") ? "#28a745" : "#ff4444" }}>
                    {swarmData.xgboost_prediction}
                  </span>
                </span>
              )}
              {swarmData.model_accuracy != null && <span><strong>Accuracy:</strong> {swarmData.model_accuracy}%</span>}
            </div>
          )}
          <div>
            <h4 style={{ margin: "0 0 5px 0", color: "#ffc107" }}>Final Swarm Verdict:</h4>
            <p style={{ margin: 0, lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{verdict}</p>
          </div>
        </div>
      )}
    </div>
  );
}
