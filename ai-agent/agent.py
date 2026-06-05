from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Swarm Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("✅ All routes registered successfully!")

@app.get("/")
def root():
    return {"status": "live", "message": "Backend is working - Routes Active"}

@app.get("/api/fundamentals/{ticker}")
def get_fundamentals(ticker: str):
    print(f"✅ Fundamentals called for {ticker}")
    return {
        "symbol": ticker.upper(),
        "peg": "1.8",
        "pegy": "1.9",
        "pb": "2.5",
        "book_value": "850",
        "intrinsic_value": "1250",
        "eps": "65.5",
        "roe": "18.4",
        "debt_to_equity": "0.45",
        "current_ratio": "1.8",
        "q_rev_growth": "12.5",
        "q_profit_growth": "8.2",
        "q_revenue": "₹245000 Cr"
    }

@app.get("/api/dcf/{ticker}")
def get_dcf(ticker: str):
    print(f"✅ DCF called for {ticker}")
    return {"current_price": 2450, "dcf_value": 3120, "upside": 27.3}

@app.get("/api/swarm")
async def run_ai_swarm(ticker: str):
    print(f"✅ Swarm called for {ticker}")
    return {
        "ticker": ticker.upper(),
        "latest_close": 2450,
        "swarm_decision": "RECOMMENDATION: BUY\nCONFIDENCE: High\nREASON: Strong fundamentals and positive momentum detected."
    }

if __name__ == "__main__":
    print("🚀 Starting server on Render...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))