import os
import logging
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError, ExpiredSignatureError  # Removed JWTClaimsError import

# Environment variables with proper validation
SECRET_KEY = os.environ.get("SECRET_KEY", "12Au23432GNfcsdi23sdcCVUGB2132VInbcsdkc213")
ALGORITHM = os.environ.get("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Configurable CSV path
CUSTOMER_CSV_PATH = Path.home() / "Downloads" / "Customer_2.csv"

# Setup logging
logger = logging.getLogger(__name__)

def authenticate_customer(customer_id: str) -> bool:
    """
    Check if the customer_id exists in the customer CSV file (case-insensitive).
    Returns True if found, False otherwise.
    """
    try:
        if not CUSTOMER_CSV_PATH.exists():
            logger.error(f"Customer CSV file not found: {CUSTOMER_CSV_PATH}")
            return False
            
        df = pd.read_csv(CUSTOMER_CSV_PATH, dtype=str)
        
        if "Customer ID" not in df.columns:
            logger.error("Customer ID column not found in CSV")
            return False
            
        normalized = df["Customer ID"].str.strip().str.upper()
        return customer_id.strip().upper() in normalized.values
        
    except Exception as e:
        logger.error(f"Customer authentication error: {e}")
        return False

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """
    Create JWT token encoding the data with expiration.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    
    try:
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        logger.error(f"Token creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create access token"
        )

def get_current_customer_id_from_cookie(request: Request) -> str:
    """
    FastAPI dependency to extract and validate JWT token from HttpOnly cookie.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - no token cookie found"
        )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        customer_id = payload.get("sub")
        
        if customer_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token - no customer ID"
            )
            
        # Optional: Re-validate customer exists (for revoked access)
        if not authenticate_customer(customer_id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Customer access revoked"
            )
            
        return customer_id
        
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except JWTError as e:  # Catch all JWT-related errors including claims
        logger.warning(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

# Keep Bearer token support for API testing/Swagger
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token", auto_error=False)

def get_current_customer_id_from_header(token: str = Depends(oauth2_scheme)) -> str:
    """
    Alternative dependency for Bearer token authentication (for API testing).
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - no bearer token"
        )
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        customer_id = payload.get("sub")
        
        if customer_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token - no customer ID"
            )
            
        return customer_id
        
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

# Utility function for token validation without raising exceptions
def validate_token_from_cookie(request: Request) -> dict:
    """
    Validate token and return payload without raising exceptions.
    Returns {"valid": bool, "customer_id": str|None, "error": str|None}
    """
    token = request.cookies.get("access_token")
    if not token:
        return {"valid": False, "customer_id": None, "error": "No token cookie"}
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        customer_id = payload.get("sub")
        
        if not customer_id:
            return {"valid": False, "customer_id": None, "error": "No customer ID in token"}
            
        return {"valid": True, "customer_id": customer_id, "error": None}
        
    except ExpiredSignatureError:
        return {"valid": False, "customer_id": None, "error": "Token expired"}
    except JWTError:
        return {"valid": False, "customer_id": None, "error": "Invalid token"}
