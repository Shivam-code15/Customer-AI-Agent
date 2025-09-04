import os
import json
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import anthropic

CLAUDE_MODEL = "claude-3-5-sonnet-20241022"
CLAUDE_API_KEY = os.environ.get("CLAUDE_API_KEY")  # Ensure this is set

# Initialize Anthropic Client with API key
client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)

class AgentRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    previous_messages: Optional[List[Dict[str, str]]] = None

class AgentResponse(BaseModel):
    reply: str
    order_summary: Optional[Dict[str, Any]] = None

def call_claude_api(
    message: str,
    context: Dict[str, Any],
    previous_messages: Optional[List[Dict[str, str]]] = None,
) -> str:
    if not CLAUDE_API_KEY:
        raise RuntimeError("CLAUDE_API_KEY environment variable is not set")

    system_prompt = (
        "You are a helpful customer service agent for a NetSuite ERP system.\n"
        "Only use the 'display_status' field to refer to an order's status in your replies. Never include parenthetical NetSuite status or raw status values.\n"
        "IMPORTANT: Only provide information that is found in the 'Order Context'.\n"
        "Don't make up or infer anything that's not present.\n"
        "If multiple orders are found, ask which one the user wants.\n"
        "If no order is found, be helpful and prompt the user for a specific order number.\n"
        "Always use any data from the context that **is available** to fully answer the user's request.\n"
        "ONLY when a specific piece of information the user asked for is completely missing from the given order context "
        "(the field is not present or has no value), politely explain you do not have that detail and suggest contacting Customer Service.\n"
        "In that case, use exactly this contact info:\n"
        "📞 Phone: 1-324-123-6789\n"
        "📧 Email: customerservice@stage-of-art.com\n"
        "🕒 Hours: Mon–Fri, 9 AM–5 PM\n"
        "Do NOT show the Customer Service contact if you already provided the requested information.\n"
        "Encourage a multi-turn conversation to fully resolve the user's questions.\n"
        "Keep your responses clear and friendly.\n"
        "Format your reply in Markdown, using paragraphs or bullet points as appropriate."
    )

    # Serialize context dict to nicely formatted JSON string
    context_str = json.dumps(context, indent=2)
    full_system_prompt = f"{system_prompt}\n\nOrder Context:\n{context_str}"

    # Build the messages list
    messages = []
    if previous_messages:
        for msg in previous_messages:
            if (
                "role" in msg and
                msg["role"] in {"system", "user", "assistant"} and
                "content" in msg and
                msg["content"].strip()
            ):
                messages.append({"role": msg["role"], "content": msg["content"]})

    # Append the current user message
    messages.append({"role": "user", "content": message})

    # Call Anthropic Claude API
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        temperature=0,
        top_p=0.1,
        system=full_system_prompt,
        messages=messages,
    )

    # Extract text from response
    if hasattr(response, "content") and isinstance(response.content, list):
        texts = [getattr(block, "text", "") for block in response.content if getattr(block, "text", "")]
        full_text = "\n".join(texts).strip()
        if full_text:
            return full_text
    # If structure different or fallback
    return getattr(response, "text", "") or getattr(response, "content", "") or ""
