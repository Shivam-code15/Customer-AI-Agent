# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import pandas as pd

# 1. Load environment variables (from .env)
load_dotenv(".env")

# 2. Create FastAPI app
app = FastAPI(
    title="Customer Orders & Agent API",
    description="JWT-secured FastAPI backend for orders and LLM agent interactions.",
    version="1.0.0",
)

# --- CORS Middleware Setup ---
# Read origins from environment variable, fallback to localhost
origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,           # restrict allowed origins (use ["*"] to allow all, not recommended in prod)
    allow_credentials=True,          # allow cookies, Authorization headers etc.
    allow_methods=["*"],             # allow GET, POST, PUT, DELETE etc.
    allow_headers=["*"],             # allow all headers
)

# 3. Import and include routers
from routers.auth import router as auth_router
from routers.orders import router as orders_router
from routers.agent import router as agent_router

# Include with prefixes or just as root, depending on how you've structured the routers
app.include_router(auth_router, tags=["Auth"])
app.include_router(orders_router, prefix="/orders", tags=["Orders"])
app.include_router(agent_router, prefix="/agent", tags=["Agent"])

# 4. (Optional) Healthcheck/root endpoint
@app.get("/")
def root():
    return {"status": "ok", "message": "Welcome to the Orders & Agent API"}
