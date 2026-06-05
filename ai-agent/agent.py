from dotenv import load_dotenv
load_dotenv()

import os
import math
import traceback
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain_groq import ChatGroq
import yfinance as yf
import uvicorn

app = FastAPI(title="Institutional AI Swarm Backend")

# ====================== CORS ======================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====================== AI SETUP ======================
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
    os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

print(f"[{datetime.now()}] Institutional AI Swarm Backend Started")

llm = ChatGroq(
    temperature=0,
    groq_api_key=GROQ_API_KEY,
    model_name="llama-3.1-8b-instant"
)

# ====================== FUNDAMENTALS ======================
@app.get("/api/fundamentals/{ticker}")
def get_fundamentals(ticker: str):
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        q_fin = stock.quarterly_financials

        q_rev_growth = "N/A"
        q_profit_growth = "N/A"
        q_revenue = "N/A"

        if not q_fin.empty and q_fin.shape[1] >= 2:
            try:
                rev_current = q_fin.loc['Total Revenue'].iloc[0]
                rev_prev = q_fin.loc['Total Revenue'].iloc[1]
                profit_current = q_fin.loc['Net Income'].iloc[0]
                profit_prev = q_fin.loc['Net Income'].iloc[1]

                is_indian = ticker.upper().endswith(('.NS', '.BO'))
                if is_indian and rev_current:
                    q_revenue = f"₹{round(rev_current / 10000000, 2)} Cr"
                else:
                    q_revenue = f"${round(rev_current / 1000000000, 2)} B" if rev_current else "N/A"

                if rev_prev and rev_prev > 0:
                    q_rev_growth = round(((rev_current - rev_prev) / rev_prev) * 100, 2)
                if profit_prev and profit_prev > 0:
                    q_profit_growth = round(((profit_current - profit_prev) / profit_prev) * 100, 2)
            except:
                pass

        eps = info.get('trailingEps', 0)
        bvps = info.get('bookValue', 0)

        return {
            "symbol": ticker.upper(),
            "peg": info.get('pegRatio', "N/A"),
            "pegy": round(info.get('trailingPE', 0) / ((info.get('earningsGrowth') or 0)*100 + (info.get('dividendYield') or 0)*100), 2) if info.get('trailingPE') else "N/A",
            "pb": round(info.get('priceToBook', 0), 2),
            "book_value": bvps if bvps else "N/A",
            "intrinsic_value": round(math.sqrt(22.5 * (eps or 1) * (bvps or 1)), 2),
            "eps": eps if eps else "N/A",
            "roe": round((info.get('returnOnEquity') or 0) * 100, 2),
            "debt_to_equity": round(info.get('debtToEquity', 0), 2),
            "current_ratio": round(info.get('currentRatio', 0), 2),
            "q_rev_growth": q_rev_growth,
            "q_profit_growth": q_profit_growth,
            "q_revenue": q_revenue
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====================== DCF ======================
@app.get("/api/dcf/{ticker}")
def get_dcf(ticker: str):
    print(f"Running DCF Valuation for {ticker}...")
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        cf = stock.cashflow

        if cf.empty:
            return {"error": "No cash flow data available."}

        fcf = 0
        if 'Free Cash Flow' in cf.index:
            fcf = cf.loc['Free Cash Flow'].iloc[0]
        elif 'Operating Cash Flow' in cf.index and 'Capital Expenditure' in cf.index:
            fcf = cf.loc['Operating Cash Flow'].iloc[0] + cf.loc['Capital Expenditure'].iloc[0]

        shares = info.get('sharesOutstanding')
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')

        if not shares or not current_price or fcf <= 0:
            return {"error": "Missing data or negative FCF"}

        discount_rate = 0.10
        growth_rate = 0.15
        terminal_rate = 0.03

        projected_fcf = []
        present_values = []
        current_fcf = fcf

        for year in range(1, 6):
            current_fcf *= (1 + growth_rate)
            projected_fcf.append(current_fcf)
            pv = current_fcf / ((1 + discount_rate) ** year)
            present_values.append(pv)

        terminal_value = (projected_fcf[-1] * (1 + terminal_rate)) / (discount_rate - terminal_rate)
        pv_terminal_value = terminal_value / ((1 + discount_rate) ** 5)

        total_pv = sum(present_values) + pv_terminal_value
        dcf_value_per_share = total_pv / shares
        upside = ((dcf_value_per_share - current_price) / current_price) * 100

        return {
            "current_price": round(current_price, 2),
            "dcf_value": round(dcf_value_per_share, 2),
            "upside": round(upside, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ====================== SIMPLIFIED AI SWARM ======================
@app.get("/api/swarm")
async def run_ai_swarm(ticker: str):
    try:
        print(f"Running Simplified AI Swarm for {ticker}...")

        stock = yf.Ticker(ticker)
        info = stock.info
        current_price = info.get('currentPrice') or info.get('regularMarketPrice', 0)

        fundamentals = f"""
        Ticker: {ticker}
        Current Price: {current_price}
        PE Ratio: {info.get('trailingPE', 'N/A')}
        EPS: {info.get('trailingEps', 'N/A')}
        ROE: {round((info.get('returnOnEquity') or 0)*100, 2)}%
        Debt/Equity: {info.get('debtToEquity', 'N/A')}
        """

        prompt = f"""
        You are a senior institutional quant analyst.
        Analyze {ticker} based on the following data and give a clear recommendation.

        {fundamentals}

        Respond in this exact format only:

        RECOMMENDATION: [BUY / SELL / HOLD]
        CONFIDENCE: [High / Medium / Low]
        REASON: [2-3 clear sentences explaining your decision]
        """

        response = llm.invoke(prompt)

        return {
            "ticker": ticker.upper(),
            "latest_close": round(current_price, 2),
            "swarm_decision": response.content.strip(),
            "note": "Powered by Groq Llama 3.1 • Stable Version"
        }

    except Exception as e:
        print("Swarm Error:", str(e))
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="AI Swarm temporarily unavailable. Try again in a few seconds.")


@app.get("/")
def root():
    return {"status": "live", "message": "Institutional AI Swarm Backend is running ✅"}

if __name__ == "__main__":
    print("🚀 Starting Institutional AI Swarm on Render...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))