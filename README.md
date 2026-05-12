This is a professional-grade "Proof of Competence" project demonstrating a live data pipeline integrated with a localized AI sentiment analysis engine.

🛠️ Core Technology Stack
Frontend: React, TypeScript, Vite, Tailwind CSS

Backend API: Python, FastAPI, Uvicorn

AI/NLP Engine: Llama 3 (via Ollama) & LangChain

Data Pipeline: Binance WebSockets (Live Prices) & Yahoo Finance (News Scraping)

🚀 Key Features
Real-time Price Engine: High-frequency data streaming directly from the exchange.

AI Market Regime Detection: A localized Llama 3 model that scrapes news headlines and classifies market sentiment as Bullish, Bearish, or Neutral.

Autonomous Risk Management: A "Kill Switch" architecture that prevents trading once a maximum drawdown threshold is reached.
