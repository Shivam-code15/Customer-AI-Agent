import os
from fastapi import APIRouter, Depends, HTTPException, status, Response, Form
from datetime import timedelta
from pydantic import BaseModel

# Import the cache clearing function
from routers.agent import clear_user_cache
from services.auth import authenticate_customer, create_access_token, get_current_customer_id_from_cookie

router = APIRouter()

class TokenResponse(BaseModel):
    message: str
    customer_id: str

# Read secure cookie flag from environment
secure_cookie = os.getenv("SECURE_COOKIE", "False").lower() == "true"

@router.post("/token", response_model=TokenResponse)
def login_for_access_token(
    response: Response, 
    username: str = Form(...), 
    password: str = Form("")
):
    customer = authenticate_customer(username)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid customer ID",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=60)
    access_token = create_access_token(
        data={"sub": username},
        expires_delta=access_token_expires,
    )
    
    # Set HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure_cookie,
        samesite="strict",
        max_age=60 * 60,  # 1 hour
        path="/",  # Available for all routes
    )
    
    return {
        "message": "Login successful",
        "customer_id": username
    }

@router.post("/logout")
def logout(
    response: Response,
    customer_id: str = Depends(get_current_customer_id_from_cookie)
):  
    # Clear the user's cached data
    clear_user_cache(customer_id)
    
    response.delete_cookie(
        key="access_token",
        path="/",
        secure=secure_cookie,
        samesite="strict"
    )
    return {"message": "Logged out successfully"}

@router.get("/me")
def read_current_user(customer_id: str = Depends(get_current_customer_id_from_cookie)):
    return {"customer_id": customer_id}

# Add token validation endpoint
@router.get("/validate")
def validate_session(customer_id: str = Depends(get_current_customer_id_from_cookie)):
    return {"valid": True, "customer_id": customer_id}