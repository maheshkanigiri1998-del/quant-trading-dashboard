from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

@app.get("/")
def root():
    return {"status": "live", "message": "Server is up and running"}

@app.get("/api/swarm")
def get_swarm_decision(ticker: str):
    return {
        "ticker": ticker.upper(),
        "latest_close": 2450,
        "swarm_decision": "RECOMMENDATION: BUY\nCONFIDENCE: High\nREASON: Strong fundamentals and positive technical momentum detected."
    }