from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "live", "message": "Backend is running"}

@app.get("/api/fundamentals/{ticker}")
def get_fundamentals(ticker: str):
    return {
        "symbol": ticker.upper(),
        "peg": "N/A",
        "pegy": "N/A",
        "pb": "N/A",
        "book_value": "N/A",
        "intrinsic_value": "N/A",
        "eps": "N/A",
        "roe": "N/A",
        "debt_to_equity": "N/A",
        "current_ratio": "N/A",
        "q_rev_growth": "N/A",
        "q_profit_growth": "N/A",
        "q_revenue": "N/A"
    }

@app.get("/api/dcf/{ticker}")
def get_dcf(ticker: str):
    return {"current_price": 1000, "dcf_value": 1250, "upside": 25}

@app.get("/api/swarm")
async def run_ai_swarm(ticker: str):
    return {
        "ticker": ticker.upper(),
        "latest_close": 1000,
        "swarm_decision": "RECOMMENDATION: HOLD\nCONFIDENCE: Medium\nREASON: Market is neutral. Wait for better entry."
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))