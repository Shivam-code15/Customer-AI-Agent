from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from typing import List, Optional

# Import your Pydantic schemas for orders
from services.orders import Order, OrdersResponse, OrderItem, OrderDetailResponse
# Import business logic helpers
from services.orders import get_orders_for_customer, get_order_details_for_customer, get_sales_orders
# Import cookie-based auth dependency
from services.auth import get_current_customer_id_from_cookie

router = APIRouter()

@router.get(
    "/",
    response_model=OrdersResponse,
    summary="List orders with optional filters and pagination"
)
def list_orders(
    tranid: Optional[str] = Query(None, description="Optional Sales Order Number filter"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Orders per page"),
    current_customer_id: str = Depends(get_current_customer_id_from_cookie)
):
    """
    Returns paginated sales orders for the authenticated customer.
    Pagination is done server-side using NetSuite REST API `limit` and `offset` parameters.
    """
    offset = (page - 1) * per_page
    orders = get_sales_orders(
        customer_id=current_customer_id,
        tranid=tranid,
        limit=per_page,
        offset=offset
    )

    return OrdersResponse(
        customer_id=current_customer_id,
        orders=orders
    )

@router.get(
    "/{order_id}", 
    response_model=OrderDetailResponse, 
    summary="Get detailed information for a sales order of the authenticated customer"
)
def get_order_details(
    order_id: str = Path(..., description="Sales Order Number"),
    current_customer_id: str = Depends(get_current_customer_id_from_cookie)
):
    """
    Returns detailed information for a specific sales order.
    """
    order_details = get_order_details_for_customer(current_customer_id, order_id)
    if order_details is None:
        raise HTTPException(
            status_code=404,
            detail="Order not found or does not belong to the authenticated customer"
        )
    return order_details
