from dotenv import load_dotenv
load_dotenv()

import os
import math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_groq import ChatGroq
import yfinance as yf
import uvicorn
from datetime import datetime

app = FastAPI(title="Institutional AI Swarm Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI Setup
llm = ChatGroq(
    temperature=0,
    groq_api_key=os.getenv("GROQ_API_KEY"),
    model_name="llama-3.1-8b-instant"
)

print(f"[{datetime.now()}] Backend started successfully")

@app.get("/")
def root():
    return {"status": "live", "message": "OK"}

@app.get("/api/fundamentals/{ticker}")
def get_fundamentals(ticker: str):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        return {
            "symbol": ticker.upper(),
            "peg": info.get('pegRatio', "N/A"),
            "pe": info.get('trailingPE', "N/A"),
            "eps": info.get('trailingEps', "N/A"),
            "roe": round((info.get('returnOnEquity') or 0) * 100, 2),
            "debt_to_equity": info.get('debtToEquity', "N/A"),
            "current_ratio": info.get('currentRatio', "N/A"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dcf/{ticker}")
def get_dcf(ticker: str):
    # Simple placeholder - you can expand later
    return {"current_price": 1000, "dcf_value": 1200, "upside": 20}

@app.get("/api/swarm")
async def run_ai_swarm(ticker: str):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        price = info.get('currentPrice') or info.get('regularMarketPrice', 0)

        prompt = f"Give a short investment recommendation for {ticker} at price {price}. Reply with BUY/SELL/HOLD and one reason."
        response = llm.invoke(prompt)

        return {
            "ticker": ticker.upper(),
            "latest_close": round(price, 2),
            "swarm_decision": response.content.strip()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="AI service busy, try again")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))