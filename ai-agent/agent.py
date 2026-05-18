from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langchain_groq import ChatGroq
import uvicorn
import yfinance as yf
import math

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

# Add this CORS configuration right below it:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production we lock this down, but for local testing, allow everything
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CLOUD AI SETUP ---
# Put your actual Groq API key inside these quotes!
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

print("Waking up the Cloud Llama 3 Engine (Groq)...")
llm = ChatGroq(
    temperature=0, 
    groq_api_key=GROQ_API_KEY, 
    model_name="llama-3.1-8b-instant"
)

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

        intrinsic_val = round(math.sqrt(22.5 * eps * bvps), 2) if (eps > 0 and bvps > 0) else "N/A"
        pegy = round(pe / (growth + div_yield), 2) if ((growth + div_yield) > 0 and pe > 0) else "N/A"

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
            return {"error": "Company has negative Free Cash Flow or missing data. DCF invalid."}

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

@app.get("/api/ai-summary/{ticker}")
def get_ai_summary(ticker: str):
    print(f"Agent reading financial statements for {ticker}...")
    try:
        stock = yf.Ticker(ticker)
        bs = stock.balance_sheet.iloc[:, 0].to_dict() if not stock.balance_sheet.empty else "No Data"
        inc = stock.financials.iloc[:, 0].to_dict() if not stock.financials.empty else "No Data"
        cf = stock.cashflow.iloc[:, 0].to_dict() if not stock.cashflow.empty else "No Data"

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
    # --- NEW AI SWARM ENDPOINT ---
from fastapi import APIRouter, HTTPException
import yfinance as yf
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from crewai import Agent, Task, Crew, Process, LLM
import os
from dotenv import load_dotenv

# Load the .env file
load_dotenv()

# Explicitly force the keys into the global OS environment so CrewAI can see them
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    os.environ["GEMINI_API_KEY"] = api_key
    os.environ["GOOGLE_API_KEY"] = api_key  # Satisfies both old and new Google SDK wrappers
else:
    print("⚠️ WARNING: GEMINI_API_KEY not found in your .env file!")

@app.get("/api/swarm")
async def run_ai_swarm(ticker: str):
    try:
        # 1. Fetch and Prep Price Data
        df = yf.download(ticker, period="1y", interval="1d")
        if df.empty:
            raise HTTPException(status_code=404, detail="Ticker data not found")
            
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)
            
        df['Return'] = df['Close'].pct_change()
        df['EMA_21'] = df['Close'].ewm(span=21, adjust=False).mean()
        df['EMA_50'] = df['Close'].ewm(span=50, adjust=False).mean()
        
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        df['RSI_14'] = 100 - (100 / (1 + (gain / loss)))
        
        df = df.dropna()
        df['Target'] = (df['Close'].shift(-1) > df['Close']).astype(int)
        df = df.dropna()
        
        # 2. Train XGBoost (The Math Brain)
        features = ['Return', 'EMA_21', 'EMA_50', 'RSI_14']
        X = df[features]
        y = df['Target']
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
        
        model = XGBClassifier(n_estimators=100, learning_rate=0.1, random_state=42)
        model.fit(X_train, y_train)
        
        predictions = model.predict(X_test)
        accuracy = float(accuracy_score(y_test, predictions))
        latest_close = float(df['Close'].iloc[-1])
        latest_prediction = "UP (Buy)" if predictions[-1] == 1 else "DOWN (Sell/Short)"
        
        # ---> NEW: 3. Fetch Alternative Data (Live News) <---
        news_data = yf.Ticker(ticker).news
        recent_news = ""
        if news_data:
            # Extract just the text headlines from the top 5 news articles
            headlines = [item['title'] for item in news_data[:5] if 'title' in item]
            recent_news = " | ".join(headlines)
        else:
            recent_news = "No major recent news found."
        
        # 4. Run CrewAI Swarm
        gemini_brain = LLM(
            model="gemini/gemini-2.5-flash", 
            api_key=os.getenv("GEMINI_API_KEY")
        )
        
        market_context = f"The {ticker} latest close price is {latest_close:.2f}. The XGBoost machine learning model predicts the next move will be {latest_prediction} with an historical model accuracy of {accuracy * 100:.2f}%. The most important feature driving this was the EMA_50."
        
        # Give the headlines to the Swarm
        news_context = f"Recent news headlines for {ticker}: {recent_news}"
        
        # Define Agents
        analyst = Agent(role='Quant', goal='Analyze ML prediction.', backstory='Veteran quant.', verbose=False, llm=gemini_brain)
        
        # ---> NEW AGENT: The Fundamental Analyst <---
        news_analyst = Agent(role='Fundamental Analyst', goal='Analyze news sentiment.', backstory='Expert in market psychology and news impact. You find panic or hype in headlines.', verbose=False, llm=gemini_brain)
        
        risk = Agent(role='Risk Officer', goal='Evaluate downside.', backstory='Conservative risk manager.', verbose=False, llm=gemini_brain)
        ceo = Agent(role='CEO', goal='Make final decision.', backstory='Decisive trader.', verbose=False, llm=gemini_brain)
        
        # Define Tasks
        task1 = Task(description=f'Review context: {market_context}. Write a brief technical report.', expected_output='Technical report.', agent=analyst)
        
        # ---> NEW TASK: Read the News <---
        task2 = Task(description=f'Review news: {news_context}. Write a brief paragraph assessing if the sentiment is bullish, bearish, or neutral, and if it contradicts the technicals.', expected_output='News sentiment report.', agent=news_analyst)
        
        task3 = Task(description='Write a brief risk report based on the tech and news reports.', expected_output='Risk report.', agent=risk)
        task4 = Task(description='Review all reports. Give final one-word verdict (BUY, SELL, HOLD) and 2-sentence justification referencing BOTH the math and the news.', expected_output='Final verdict.', agent=ceo)
        
        # Add the new agent and task to the Crew
        crew = Crew(agents=[analyst, news_analyst, risk, ceo], tasks=[task1, task2, task3, task4], process=Process.sequential, verbose=False)
        result = crew.kickoff()
        
        # 5. Return Safe JSON to React
        return {
            "ticker": ticker,
            "latest_close": round(latest_close, 2),
            "xgboost_prediction": latest_prediction,
            "model_accuracy": round(accuracy * 100, 2),
            "swarm_decision": result.raw
        }
        
    except Exception as e:
        import traceback
        print("\n❌ ==================== SWARM API CRASH LOG ====================")
        traceback.print_exc() 
        print("===============================================================\n")
        raise HTTPException(status_code=500, detail=str(e))
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)