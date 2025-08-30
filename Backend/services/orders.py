import os
import requests
from typing import List, Optional
from pydantic import BaseModel, Field, ValidationError
from requests_oauthlib import OAuth1
from pydantic.functional_validators import field_validator
from pydantic import computed_field  # Pydantic v2

# NetSuite API credentials and endpoint from environment
ACCOUNT_ID = os.environ.get("NETSUITE_ACCOUNT_ID", "")
CONSUMER_KEY = os.environ.get("CONSUMER_KEY", "")
CONSUMER_SECRET = os.environ.get("CONSUMER_SECRET", "")
TOKEN_KEY = os.environ.get("TOKEN_KEY", "")
TOKEN_SECRET = os.environ.get("TOKEN_SECRET", "")
OAUTH_REALM = os.environ.get("OAUTH_REALM", "")

if not all([ACCOUNT_ID, CONSUMER_KEY, CONSUMER_SECRET, TOKEN_KEY, TOKEN_SECRET, OAUTH_REALM]):
    raise RuntimeError("NetSuite API OAuth credentials are not fully set in environment variables.")

SUITEQL_URL = f"https://{ACCOUNT_ID}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql"

# OAuth1 auth for requests
auth = OAuth1(
    CONSUMER_KEY,
    CONSUMER_SECRET,
    TOKEN_KEY,
    TOKEN_SECRET,
    signature_method="HMAC-SHA256",
    realm=OAUTH_REALM,
)

# Status Mapping Helpers

def extract_ns_status(ui_status: Optional[str]) -> str:
    if not ui_status:
        return ""
    parts = ui_status.split(":")
    return parts[1].strip() if len(parts) > 1 else ui_status.strip()

def map_ns_status_to_customer_status(ns_status: str, is_partial: bool = False) -> str:
    status = ns_status.lower() if ns_status else ""
    if status == "pending approval":
        return "Order Received"
    elif status == "pending fulfillment":
        return "Processing"
    elif "partially fulfilled" in status or ("pending billing" in status and is_partial):
        return "Partially Shipped"
    elif status == "pending billing" or status == "billed":
        return "Shipped"
    elif status == "closed":
        return "Completed"
    elif status == "cancelled" or status == "canceled":
        return "Cancelled"
    return "Processing"  # default fallback

# Pydantic Data Models

class OrderItem(BaseModel):
    item_number: str = Field(..., alias="item_number")
    item_description: Optional[str] = None
    item_unit: Optional[str] = None
    line_quantity: int
    line_net_amount: float

class Order(BaseModel):
    sales_order_number: str
    order_date: Optional[str] = None
    requested_ship_date: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    status: Optional[str] = None
    items: List[OrderItem] = []
    order_total: Optional[float] = None
    is_partial: Optional[bool] = False

    @computed_field
    @property
    def display_status(self) -> str:
        return self.friendly_status

    @property
    def raw_status(self) -> str:
        return extract_ns_status(self.status)

    @property
    def friendly_status(self) -> str:
        return map_ns_status_to_customer_status(self.raw_status, self.is_partial)

# SuiteQL Query Helper

def netsuite_suiteql_query(query: str, limit: int = None, offset: int = None) -> List[dict]:
    url = SUITEQL_URL
    params = []
    if limit is not None:
        params.append(f"limit={limit}")
    if offset is not None:
        params.append(f"offset={offset}")
    if params:
        url += "?" + "&".join(params)

    headers = {"Content-Type": "application/json", "Prefer": "transient"}
    payload = {"q": query}

    try:
        response = requests.post(url, auth=auth, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
    except requests.RequestException as e:
        raise RuntimeError(f"NetSuite SuiteQL query failed: {e}")

    data = response.json()
    return data.get("items", [])

# Service Functions

def get_sales_orders(
    customer_id: str,
    tranid: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None
) -> List[Order]:
    if not customer_id:
        raise ValueError("customer_id must be provided")

    where_clauses = ["type = 'SalesOrd'"]

    if tranid:
        clean_tranid = tranid.strip()
        if clean_tranid:
            where_clauses.append(f"tranid = '{clean_tranid}'")

    where_clauses.append(
        f"TRIM(SUBSTR(BUILTIN.DF(entity), 1, INSTR(BUILTIN.DF(entity) || ' ', ' ') - 1)) = '{customer_id.strip()}'"
    )

    where_sql = " AND ".join(where_clauses)

    query = f"""
        SELECT
            tranid AS sales_order_number,
            to_char(trandate, 'YYYY-MM-DD') AS order_date,
            to_char(shipdate, 'YYYY-MM-DD') AS requested_ship_date,
            TRIM(SUBSTR(BUILTIN.DF(entity), 1, INSTR(BUILTIN.DF(entity) || ' ', ' ') - 1)) AS customer_id,
            TRIM(SUBSTR(BUILTIN.DF(entity), INSTR(BUILTIN.DF(entity), ' ') + 1)) AS customer_name,
            BUILTIN.DF(status) AS status,
            foreigntotal AS order_total
        FROM
            transaction
        WHERE
            {where_sql}
        ORDER BY
            trandate DESC,
            tranid
    """

    raw_orders = netsuite_suiteql_query(query, limit=limit, offset=offset)

    orders = []
    for raw_order in raw_orders:
        try:
            orders.append(Order.parse_obj(raw_order))
        except ValidationError as ve:
            print(f"Warning: Skipping invalid order data: {ve}")

    return orders

def get_order_details(sales_order_number: str) -> Optional[Order]:
    if not sales_order_number:
        raise ValueError("sales_order_number must be provided")

    query = f"""
        SELECT
            t.tranid AS sales_order_number,
            to_char(t.trandate, 'YYYY-MM-DD') AS order_date,
            to_char(t.shipdate, 'YYYY-MM-DD') AS requested_ship_date,
            TRIM(SUBSTR(BUILTIN.DF(t.entity), 1, INSTR(BUILTIN.DF(t.entity) || ' ', ' ') - 1)) AS customer_id,
            TRIM(SUBSTR(BUILTIN.DF(t.entity), INSTR(BUILTIN.DF(t.entity), ' ') + 1)) AS customer_name,
            BUILTIN.DF(t.status) AS status,
            i.itemid AS item_number,
            COALESCE(i.description, i.displayname) AS item_description,
            BUILTIN.DF(i.stockunit) AS item_unit,
            ABS(tl.quantity) AS line_quantity,
            ABS(tl.netamount) AS line_net_amount,
            ABS(t.foreigntotal) AS order_total
        FROM
            transaction t
        JOIN
            transactionLine tl ON t.id = tl.transaction
        JOIN
            item i ON tl.item = i.id
        WHERE
            t.tranid = '{sales_order_number}' AND tl.netamount IS NOT NULL
        ORDER BY
            t.trandate DESC, t.tranid
    """

    raw_lines = netsuite_suiteql_query(query)
    if not raw_lines:
        return None

    first = raw_lines[0]
    try:
        order = Order(
            sales_order_number=first.get("sales_order_number"),
            order_date=first.get("order_date"),
            requested_ship_date=first.get("requested_ship_date"),
            customer_id=first.get("customer_id"),
            customer_name=first.get("customer_name"),
            status=first.get("status"),
            order_total=first.get("order_total"),
            items=[]
        )
    except ValidationError as ve:
        print(f"Error validating order data: {ve}")
        return None

    for line in raw_lines:
        try:
            item = OrderItem.parse_obj(line)
            order.items.append(item)
        except ValidationError as ve:
            print(f"Warning: Skipping invalid order item data: {ve}")

    return order

def format_order_context(order: Order) -> str:
    lines = [
        f"Order ID: {order.sales_order_number}",
        f"Customer ID: {order.customer_id or 'N/A'}",
        f"Customer Name: {order.customer_name or 'N/A'}",
        f"Status: {order.friendly_status}",
        f"Order Date: {order.order_date or 'N/A'}",
        f"Requested Ship Date: {order.requested_ship_date or 'N/A'}",
        f"Total Amount: ${order.order_total:.2f}" if order.order_total else "Total Amount: N/A",
        "Items:",
    ]
    for item in order.items:
        lines.append(
            f"  - Item Number: {item.item_number}, Description: {item.item_description or 'N/A'}, "
            f"Quantity: {item.line_quantity}, Price: ${item.line_net_amount:.2f}"
        )
    return "\n".join(lines)

class OrdersResponse(BaseModel):
    customer_id: str
    orders: List[Order]

class OrderDetailResponse(Order):
    pass

def get_orders_for_customer(customer_id: str, limit: Optional[int] = None) -> List[Order]:
    print("Fetching orders for customer_id from token:", repr(customer_id))
    orders = get_sales_orders(customer_id, limit=limit)
    print("Fetched orders:", [o.sales_order_number for o in orders])
    return orders

def get_order_details_for_customer(customer_id: str, order_id: str) -> Optional[Order]:
    order = get_order_details(order_id)
    if order and order.customer_id == customer_id:
        return order
    return None
