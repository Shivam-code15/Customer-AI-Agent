from fastapi import APIRouter, Depends, Body, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import threading

from services.agent import AgentRequest, AgentResponse, call_claude_api
from services.auth import get_current_customer_id_from_cookie
from services.orders import get_order_details_for_customer, get_orders_for_customer, Order

router = APIRouter()

# Simple in-memory cache
_order_cache = {}
_cache_lock = threading.Lock()

def get_cached_orders(customer_id: str, limit: int = 15) -> List[Order]:
    cache_key = f"{customer_id}_{limit}"
    now = datetime.now()
    
    with _cache_lock:
        if cache_key in _order_cache:
            cached_data, expires_at = _order_cache[cache_key]
            if now < expires_at:
                print(f"Cache HIT for {customer_id}")
                return cached_data
    
    # Cache miss - fetch from database
    print(f"Cache MISS for {customer_id} - fetching from database")
    orders = get_orders_for_customer(customer_id, limit=limit)
    
    with _cache_lock:
        _order_cache[cache_key] = (orders, now + timedelta(minutes=10))
    
    return orders

def clear_user_cache(customer_id: str):
    """Clear cached orders for a specific customer"""
    with _cache_lock:
        keys_to_remove = [key for key in _order_cache.keys() if key.startswith(f"{customer_id}_")]
        for key in keys_to_remove:
            del _order_cache[key]
    print(f"Cleared cache for customer {customer_id}")
    
class AgentRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    previous_messages: Optional[List[Dict[str, str]]] = None  # Maintain entire conversation history

@router.post("/", response_model=AgentResponse, summary="Chat with the Customer Service Agent")
def agent_endpoint(
    req: AgentRequest = Body(...),
    current_customer_id: str = Depends(get_current_customer_id_from_cookie)
):
    message = req.message
    context = req.context or {}
    previous_messages = req.previous_messages or []

    order_id = context.get("order_id")
    order_summary = None
    
    # Smart fetching - only when message needs order data
    message_lower = message.lower()
    order_related_keywords = [
        "order", "status", "latest", "recent", "shipment", 
        "shipping", "delivery", "track", "when will", "where is",
        "show", "tell", "about", "details", "what", "info", "information"
    ]

    needs_orders = (
        any(keyword in message_lower for keyword in order_related_keywords) or
        any(char.isdigit() for char in message)  # Contains numbers (likely order number)
    )

    if needs_orders:
        recent_orders = get_cached_orders(current_customer_id, limit=15)
    else:
        recent_orders = []
    
    # If no explicit order_id in context, check if message mentions a specific order
    if not order_id and recent_orders:
        for order in recent_orders:
            order_num = str(order.sales_order_number)
            if order_num.lower() in message.lower():
                order_id = order_num
                break
    
    print("Debug: Final order_id =", order_id, "Message =", message)
    
    if order_id:
        # Handle specific order ID requests (either from context OR extracted from message)
        order_details = get_order_details_for_customer(current_customer_id, order_id)
        
        if order_details is None:
            reply = "Sorry, I couldn't find that order. Could you please confirm the order number?"
            return AgentResponse(reply=reply)

        context_payload = {
        "order": {
            "sales_order_number": order_details.sales_order_number,
            "display_status": order_details.display_status,
            "order_date": order_details.order_date,
            "order_total": order_details.order_total,
             }
        }
        order_summary = {
            "sales_order_number": order_details.sales_order_number or order_id,
            "display_status": order_details.display_status,
            "order_date": order_details.order_date,
            "order_total": order_details.order_total,
        }
        
    else:
        # General order queries without specific order number
        context_payload = {
            "recent_orders": [order.dict() for order in recent_orders],
            "customer_id": current_customer_id,
        }
        
        if recent_orders:
            message_lower = message.lower()
            order_related_keywords = [
                "order", "status", "latest", "recent", "shipment", 
                "shipping", "delivery", "track", "when will", "where is",
                "show", "tell", "about", "details", "what", "info", "information"
            ]
            # Multi-order or comparative keywords
            comparative_keywords = ["compare", "all", "orders", "list", "show me orders"]
            # Only provide summary for general queries (no specific order mentioned)
            if (any(keyword in message_lower for keyword in order_related_keywords) and 
                not any(keyword in message_lower for keyword in comparative_keywords)):
                target_order = recent_orders[0]  # Default to most recent
                
                order_summary = {
                    "sales_order_number": target_order.sales_order_number,
                    "display_status": target_order.display_status,
                    "order_date": target_order.order_date,
                    "order_total": target_order.order_total,
                }

    try:
        reply = call_claude_api(message, context_payload, previous_messages=previous_messages)
    except Exception as e:
        raise HTTPException(status_code=500, detail="AI service unavailable. Please try again later.")

    return AgentResponse(reply=reply, order_summary=order_summary)