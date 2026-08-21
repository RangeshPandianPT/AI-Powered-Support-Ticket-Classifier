import os
from typing import Optional, Tuple
from dotenv import load_dotenv
from openai import OpenAI
from schema import TicketClassification

load_dotenv()

def classify_ticket_openai(ticket_text: str, api_key: Optional[str] = None) -> TicketClassification:
    """Classify ticket using OpenAI's Structured Outputs API."""
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("Missing OpenAI API Key.")
    
    client = OpenAI(api_key=key)
    completion = client.beta.chat.completions.parse(
        model="gpt-4o-2024-08-06",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert AI customer support assistant. Classify the user's support ticket accurately based on the provided schema. "
                    "Provide a helpful draft response email, key action items for agents, and set escalation flag to true if priority is High and sentiment is Angry or Frustrated."
                )
            },
            {
                "role": "user",
                "content": ticket_text
            }
        ],
        response_format=TicketClassification,
    )
    return completion.choices[0].message.parsed

def classify_ticket_gemini(ticket_text: str, api_key: Optional[str] = None) -> TicketClassification:
    """Classify ticket using Google Gemini Structured Outputs API."""
    key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise ValueError("Missing Gemini API Key.")
    
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=key)
        system_instruction = (
            "You are an expert AI customer support assistant. Classify the user's support ticket accurately based on the provided schema. "
            "Provide a helpful draft response email, key action items for agents, and set escalation flag to true if priority is High and sentiment is Angry or Frustrated."
        )
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=ticket_text,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=TicketClassification,
            ),
        )
        return TicketClassification.model_validate_json(response.text)
    except Exception as e:
        raise RuntimeError(f"Gemini Classification Failed: {str(e)}")

def classify_ticket(
    ticket_text: str, 
    provider: str = "Auto", 
    openai_key: Optional[str] = None, 
    gemini_key: Optional[str] = None
) -> Tuple[TicketClassification, str]:
    """
    Classify a support ticket using specified provider ('OpenAI', 'Google Gemini', or 'Auto').
    Returns a tuple of (TicketClassification, provider_used).
    """
    openai_available = bool(openai_key or os.getenv("OPENAI_API_KEY"))
    gemini_available = bool(gemini_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))

    if provider == "OpenAI":
        return classify_ticket_openai(ticket_text, openai_key), "OpenAI"
    elif provider == "Google Gemini":
        return classify_ticket_gemini(ticket_text, gemini_key), "Google Gemini"
    else:
        # Auto selection / Fallback strategy
        if openai_available:
            try:
                return classify_ticket_openai(ticket_text, openai_key), "OpenAI"
            except Exception as e:
                if gemini_available:
                    return classify_ticket_gemini(ticket_text, gemini_key), "Google Gemini (Fallback)"
                raise e
        elif gemini_available:
            return classify_ticket_gemini(ticket_text, gemini_key), "Google Gemini"
        else:
            raise ValueError("No API Key found! Please set OPENAI_API_KEY or GEMINI_API_KEY in your .env file or UI sidebar.")

if __name__ == "__main__":
    sample_ticket = "I was charged twice for my subscription this month and I want a refund now!"
    print(f"Testing ticket: '{sample_ticket}'\n")
    try:
        result, provider_used = classify_ticket(sample_ticket)
        print(f"Provider Used: {provider_used}")
        print(f"Summary: {result.summary}")
        print(f"Category: {result.category.value}")
        print(f"Team: {result.assigned_team.value}")
        print(f"Priority: {result.priority.value}")
        print(f"Sentiment: {result.sentiment.value}")
        print(f"Confidence: {result.confidence_score}")
        print(f"Draft Response: {result.draft_response}")
        print(f"Action Items: {result.key_action_items}")
        print(f"Requires Escalation: {result.requires_immediate_escalation}")
    except Exception as e:
        print(f"Error during classification test: {e}")
