import os
import math
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import yfinance as yf
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

from langchain_groq import ChatGroq
from crewai import Agent, Task, Crew, Process, LLM

# Load environment variables
load_dotenv()

# Force environment injection for CrewAI core structures
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    os.environ["GEMINI_API_KEY"] = api_key
    os.environ["GOOGLE_API_KEY"] = api_key  
else:
    print("⚠️ WARNING: GEMINI_API_KEY not found in your .env file!")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = FastAPI(title="Quant Trading Swarm Backend")

# Single, Unified CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Waking up the Cloud Llama 3 Engine (Groq)...")
llm = ChatGroq(
    temperature=0, 
    groq_api_key=GROQ_API_KEY, 
    model_name="llama-3.1-8b-instant"
)

@app.get("/")
def root():
    return {"status": "live", "message": "Quant Trading Backend Operational"}

@app.get("/api/sentiment")
def get_sentiment():
    try:
        btc = yf.Ticker("BTC-USD")
        news_data = btc.news
        if isinstance(news_data, list) and len(news_data) > 0:
            live_headline = news_data[0]['title']
            prompt = f"Analyze this headline: '{live_headline}'. Respond with ONLY ONE WORD: BULLISH, BEARISH, or NEUTRAL."
            response = llm.invoke(prompt)
            return {"sentiment": response.content.strip()}
        return {"sentiment": "NEUTRAL"}
    except Exception as e:
        return {"sentiment": "ERROR"}

# CHANGED: Switched from path variable /api/fundamentals/{ticker} to query string parameter to handle dots
@app.get("/api/fundamentals")
def get_fundamentals(ticker: str = None):
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker parameter is required")
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        q_fin = stock.quarterly_financials
        
        q_rev_growth = "N/A"
        q_profit_growth = "N/A"
        q_revenue = "N/A"

        if q_fin is not None and not q_fin.empty and q_fin.shape[1] >= 2:
            try:
                rev_current = q_fin.loc['Total Revenue'].iloc[0]
                rev_prev = q_fin.loc['Total Revenue'].iloc[1]
                profit_current = q_fin.loc['Net Income'].iloc[0]
                profit_prev = q_fin.loc['Net Income'].iloc[1]

                is_indian = ticker.upper().endswith(('.NS', '.BO'))
                if is_indian:
                    q_revenue = f"₹{round(rev_current / 10000000, 2)} Cr"
                else:
                    q_revenue = f"${round(rev_current / 1000000000, 2)} B"

                if rev_prev and rev_prev > 0:
                    q_rev_growth = round(((rev_current - rev_prev) / rev_prev) * 100, 2)
                if profit_prev and profit_prev > 0:
                    q_profit_growth = round(((profit_current - profit_prev) / profit_prev) * 100, 2)
            except KeyError:
                pass

        eps = info.get('trailingEps', 0)
        bvps = info.get('bookValue', 0)
        pe = info.get('trailingPE', 0)
        growth = (info.get('earningsGrowth') or 0) * 100
        div_yield = (info.get('dividendYield') or 0) * 100

        intrinsic_val = round(math.sqrt(22.5 * eps * bvps), 2) if (eps and bvps and eps > 0 and bvps > 0) else "N/A"
        pegy = round(pe / (growth + div_yield), 2) if ((growth + div_yield) > 0 and pe and pe > 0) else "N/A"

        return {
            "symbol": ticker.upper(),
            "peg": info.get('pegRatio', "N/A"),
            "pegy": pegy,
            "pb": round(info.get('priceToBook', 0), 2) if info.get('priceToBook') else "N/A",
            "book_value": bvps if bvps else "N/A",
            "face_value": "Manual", 
            "intrinsic_value": intrinsic_val,
            "eps": eps if eps else "N/A",
            "roe": round(info.get('returnOnEquity', 0) * 100, 2) if info.get('returnOnEquity') else "N/A",
            "debt_to_equity": round(info.get('debtToEquity', 0), 2) if info.get('debtToEquity') else "N/A",
            "current_ratio": round(info.get('currentRatio', 0), 2) if info.get('currentRatio') else "N/A",
            "q_rev_growth": q_rev_growth,
            "q_profit_growth": q_profit_growth,
            "q_revenue": q_revenue
        }
    except Exception as e:
        return {"error": str(e)}

# CHANGED: Switched from path variable /api/dcf/{ticker} to query string parameter to handle dots
@app.get("/api/dcf")
def get_dcf(ticker: str = None):
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker parameter is required")
    print(f"Running DCF Valuation for {ticker}...")
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        cf = stock.cashflow

        if cf is None or cf.empty:
            return {"error": "No cash flow data available."}

        fcf = 0
        if 'Free Cash Flow' in cf.index:
            fcf = cf.loc['Free Cash Flow'].iloc[0]
        elif 'Operating Cash Flow' in cf.index and 'Capital Expenditure' in cf.index:
            fcf = cf.loc['Operating Cash Flow'].iloc[0] + cf.loc['Capital Expenditure'].iloc[0]
        
        shares = info.get('sharesOutstanding')
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')

        if not shares or not current_price or fcf <= 0:
            return {"error": "Negative Free Cash Flow or missing records. DCF invalid."}

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
        return {"error": str(e)}

# CHANGED: Switched from path variable /api/ai-summary/{ticker} to query string parameter to handle dots
@app.get("/api/ai-summary")
def get_ai_summary(ticker: str = None):
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker parameter is required")
    print(f"Agent reading financial statements for {ticker}...")
    try:
        stock = yf.Ticker(ticker)
        bs = stock.balance_sheet.iloc[:, 0].to_dict() if (stock.balance_sheet is not None and not stock.balance_sheet.empty) else "No Data"
        inc = stock.financials.iloc[:, 0].to_dict() if (stock.financials is not None and not stock.financials.empty) else "No Data"
        cf = stock.cashflow.iloc[:, 0].to_dict() if (stock.cashflow is not None and not stock.cashflow.empty) else "No Data"

        prompt = f"""
        You are a strict quantitative analyst. Review this recent data for {ticker}.
        Provide a concise summary (under 150 words total). 
        You MUST separate your response into exactly three sections using these exact headings. Do not add any conversational intro or outro.

        BALANCE SHEET:
        [1 sentence summary of assets vs liabilities]

        P&L STATEMENT:
        [1 sentence summary of revenue and profitability]

        CASH FLOW:
        [1 sentence summary of operating cash and liquidity]

        Data:
        Balance Sheet: {bs}
        Income Statement: {inc}
        Cash Flow: {cf}
        """
        response = llm.invoke(prompt)
        return {"summary": response.content.strip()}
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/news")
def get_news(ticker: str = None):
    """Fetch market headlines via yfinance (used by mobile/web dashboard)."""
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker parameter is required")
    try:
        symbol = ticker.upper().strip()
        stock = yf.Ticker(symbol)
        raw_news = stock.news or []
        formatted_news = []
        for item in raw_news[:5]:
            title = item.get("title") or item.get("content", {}).get("title", "Market Update")
            publisher = (
                item.get("publisher")
                or item.get("content", {}).get("provider", {}).get("displayName", "Yahoo Finance")
            )
            link = (
                item.get("link")
                or item.get("content", {}).get("canonicalUrl", {}).get("url", "#")
            )
            formatted_news.append({"title": title, "publisher": publisher, "link": link})
        return {"news": formatted_news}
    except Exception as e:
        return {"news": [], "error": str(e)}


@app.get("/api/monte-carlo")
def get_monte_carlo(ticker: str = None, days: int = 252, simulations: int = 500):
    """Monte Carlo 1-year price path simulation for the dashboard."""
    import numpy as np

    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker parameter is required")
    try:
        symbol = ticker.upper().strip()
        stock = yf.Ticker(symbol)
        hist = stock.history(period="1y")
        if hist.empty or len(hist) < 30:
            return {"error": f"Insufficient historical data for {symbol}"}

        info = stock.info or {}
        currency = (info.get("currency") or "").upper()
        if symbol.endswith((".NS", ".BO")) or currency == "INR":
            curr_symbol = "₹"
        elif currency == "EUR":
            curr_symbol = "€"
        elif currency == "GBP":
            curr_symbol = "£"
        else:
            curr_symbol = "$"

        close_series = hist["Close"].replace(0, np.nan).dropna()
        close_prices = close_series.values
        if len(close_prices) < 30:
            return {"error": f"Not enough valid price records for {symbol}"}

        log_returns = np.log(close_prices[1:] / close_prices[:-1])
        log_returns = log_returns[np.isfinite(log_returns)]
        if len(log_returns) == 0 or np.std(log_returns) == 0:
            return {"error": f"Invalid return distribution for {symbol}"}

        mu = float(np.mean(log_returns))
        sigma = float(np.std(log_returns))
        current_price = float(close_prices[-1])
        simulations = max(50, min(int(simulations), 1000))
        days = max(30, min(int(days), 365))

        simulation_matrix = np.zeros((simulations, days + 1))
        simulation_matrix[:, 0] = current_price
        shocks = np.random.normal(0, 1, (simulations, days))
        for t in range(1, days + 1):
            simulation_matrix[:, t] = simulation_matrix[:, t - 1] * np.exp(
                (mu - 0.5 * (sigma ** 2)) + sigma * shocks[:, t - 1]
            )

        p5_path = np.percentile(simulation_matrix, 5, axis=0)
        p50_path = np.percentile(simulation_matrix, 50, axis=0)
        p95_path = np.percentile(simulation_matrix, 95, axis=0)
        step = max(1, days // 30)
        time_points = list(range(0, days + 1, step))
        if time_points[-1] != days:
            time_points.append(days)

        chart_data = [
            {
                "day": t,
                "p5": round(float(p5_path[t]), 2),
                "median": round(float(p50_path[t]), 2),
                "p95": round(float(p95_path[t]), 2),
            }
            for t in time_points
        ]
        final_prices = simulation_matrix[:, -1]
        return {
            "currency_symbol": curr_symbol,
            "current_price": round(current_price, 2),
            "days": days,
            "simulations": simulations,
            "p5_final": round(float(np.percentile(final_prices, 5)), 2),
            "median_final": round(float(np.percentile(final_prices, 50)), 2),
            "p95_final": round(float(np.percentile(final_prices, 95)), 2),
            "chart_data": chart_data,
        }
    except Exception as e:
        return {"error": f"Monte Carlo calculation failed: {str(e)}"}


@app.get("/api/audit")
def run_audit(ticker: str = None):
    """Lightweight financial audit used by the dashboard."""
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker parameter is required")
    try:
        symbol = ticker.upper().strip()
        stock = yf.Ticker(symbol)
        info = stock.info or {}
        pe = info.get("trailingPE", "N/A")
        pb = info.get("priceToBook", "N/A")
        recommendation = str(info.get("recommendationKey", "N/A")).upper().replace("_", " ")
        mcap = info.get("marketCap")
        mcap_str = f"${mcap / 1e9:.2f}B" if mcap else "N/A"
        summary = (
            f"--- AI FINANCIAL AUDIT REPORT FOR {symbol} ---\n\n"
            f"• Market Capitalization: {mcap_str}\n"
            f"• Trailing P/E Ratio: {pe}\n"
            f"• Price-to-Book (P/B): {pb}\n"
            f"• Analyst Consensus: {recommendation}\n\n"
            f"Audit Verdict: {symbol} displays active market liquidity. "
            f"Cross-reference DCF output and risk metrics prior to positioning."
        )
        return {"summary": summary}
    except Exception as e:
        return {"summary": f"Audit Execution Error: {str(e)}"}


@app.get("/api/swarm")
async def run_ai_swarm(ticker: str = None):
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker parameter is required")
    try:
        # 1. Fetch and Prep Price Data
        df = yf.download(ticker, period="1y", interval="1d", progress=False)
        if df.empty:
            raise HTTPException(status_code=404, detail="Ticker data not found")

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)

        df["Return"] = df["Close"].pct_change()
        df["EMA_21"] = df["Close"].ewm(span=21, adjust=False).mean()
        df["EMA_50"] = df["Close"].ewm(span=50, adjust=False).mean()

        delta = df["Close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        df["RSI_14"] = 100 - (100 / (1 + (gain / loss)))

        df = df.dropna()
        df["Target"] = (df["Close"].shift(-1) > df["Close"]).astype(int)
        df = df.dropna()

        # 2. Train XGBoost
        features = ["Return", "EMA_21", "EMA_50", "RSI_14"]
        X = df[features]
        y = df["Target"]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

        model = XGBClassifier(n_estimators=100, learning_rate=0.1, random_state=42)
        model.fit(X_train, y_train)

        predictions = model.predict(X_test)
        accuracy = float(accuracy_score(y_test, predictions))
        latest_close = float(df["Close"].iloc[-1])
        latest_prediction = "UP (Buy)" if predictions[-1] == 1 else "DOWN (Sell/Short)"
        latest_rsi = float(df["RSI_14"].iloc[-1]) if "RSI_14" in df.columns else None

        # 3. News headlines (safe parsing)
        news_data = yf.Ticker(ticker).news or []
        headlines = []
        for item in news_data[:5]:
            title = item.get("title") or item.get("content", {}).get("title")
            if title:
                headlines.append(title)
        recent_news = " | ".join(headlines) if headlines else "No major recent news found."

        market_context = (
            f"The {ticker} latest close price is {latest_close:.2f}. "
            f"The XGBoost model predicts {latest_prediction} "
            f"(historical accuracy {accuracy * 100:.2f}%)."
        )
        news_context = f"Recent news for {ticker}: {recent_news}"

        # 4. Prefer CrewAI async (fixes event-loop crash). Fall back if keys/API fail.
        swarm_decision = None
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if gemini_key:
            try:
                gemini_brain = LLM(model="gemini/gemini-2.5-flash", api_key=gemini_key)
                analyst = Agent(
                    role="Quant",
                    goal="Analyze ML prediction.",
                    backstory="Veteran quant.",
                    verbose=False,
                    llm=gemini_brain,
                )
                news_analyst = Agent(
                    role="Fundamental Analyst",
                    goal="Analyze news sentiment.",
                    backstory="Expert in market psychology and news impact.",
                    verbose=False,
                    llm=gemini_brain,
                )
                risk = Agent(
                    role="Risk Officer",
                    goal="Evaluate downside.",
                    backstory="Conservative risk manager.",
                    verbose=False,
                    llm=gemini_brain,
                )
                ceo = Agent(
                    role="CEO",
                    goal="Make final decision.",
                    backstory="Decisive trader.",
                    verbose=False,
                    llm=gemini_brain,
                )
                task1 = Task(
                    description=f"Review context: {market_context}. Write a brief technical report.",
                    expected_output="Technical report.",
                    agent=analyst,
                )
                task2 = Task(
                    description=(
                        f"Review news: {news_context}. Write a brief paragraph assessing "
                        "if the sentiment is bullish, bearish, or neutral."
                    ),
                    expected_output="News sentiment report.",
                    agent=news_analyst,
                )
                task3 = Task(
                    description="Write a brief risk report based on the tech and news reports.",
                    expected_output="Risk report.",
                    agent=risk,
                )
                task4 = Task(
                    description=(
                        "Review all reports. Give final one-word verdict (BUY, SELL, HOLD) "
                        "and 2-sentence justification referencing BOTH the math and the news."
                    ),
                    expected_output="Final verdict.",
                    agent=ceo,
                )
                crew = Crew(
                    agents=[analyst, news_analyst, risk, ceo],
                    tasks=[task1, task2, task3, task4],
                    process=Process.sequential,
                    verbose=False,
                )
                # MUST be async inside FastAPI event loop
                result = await crew.kickoff_async()
                swarm_decision = getattr(result, "raw", None) or str(result)
            except Exception as crew_err:
                print(f"CrewAI swarm failed, using local fallback: {crew_err}")
                traceback.print_exc()
                swarm_decision = None

        if not swarm_decision:
            # Local multi-agent style fallback (always works, no external LLM needed)
            rsi_note = f"RSI_14≈{latest_rsi:.1f}" if latest_rsi is not None else "RSI unavailable"
            if "UP" in latest_prediction:
                verdict = "BUY" if (latest_rsi is None or latest_rsi < 70) else "HOLD"
            else:
                verdict = "SELL" if (latest_rsi is None or latest_rsi > 30) else "HOLD"
            swarm_decision = (
                f"--- INSTITUTIONAL SWARM INTELLIGENCE ({ticker.upper()}) ---\n\n"
                f"[AGENT 1 - QUANT]: XGBoost next-move signal = {latest_prediction} "
                f"(holdout accuracy {accuracy * 100:.1f}%). {rsi_note}. Close={latest_close:.2f}.\n"
                f"[AGENT 2 - FUNDAMENTAL]: News scan: {recent_news[:280]}\n"
                f"[AGENT 3 - RISK]: Align position size with model confidence and avoid "
                f"chasing extremes on RSI.\n\n"
                f"Final Swarm Verdict: {verdict}\n"
                f"Rationale: Blend the ML direction ({latest_prediction}) with headline risk "
                f"and keep stops tight."
            )

        return {
            "ticker": ticker,
            "latest_close": round(latest_close, 2),
            "xgboost_prediction": latest_prediction,
            "model_accuracy": round(accuracy * 100, 2),
            "swarm_decision": swarm_decision,
            "output": swarm_decision,
        }

    except HTTPException:
        raise
    except Exception as e:
        print("\n❌ ==================== SWARM API CRASH LOG ====================")
        traceback.print_exc()
        print("===============================================================\n")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # FIXED: Render needs to bind to dynamic deployment port environment variables
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run("agent:app", host="0.0.0.0", port=port, reload=True)