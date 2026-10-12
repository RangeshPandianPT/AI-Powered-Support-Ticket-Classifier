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

def rewrite_draft_llm(ticket_text: str, current_draft: str, tone_instruction: str) -> str:
    """Rewrite a support draft response matching a tone or formatting instruction."""
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    prompt = (
        f"Customer Ticket:\n\"{ticket_text}\"\n\n"
        f"Current Draft Response:\n\"{current_draft}\"\n\n"
        f"Instruction: {tone_instruction}\n\n"
        f"Please rewrite the customer draft response following this instruction. "
        f"Keep it professional, empathetic, and directly applicable. "
        f"Output ONLY the new draft response message without surrounding quotes or conversational filler."
    )

    if openai_key:
        try:
            client = OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a professional customer support response editor."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"[OpenAI Rewrite Error]: {e}")

    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            print(f"[Gemini Rewrite Error]: {e}")

    # Fallback template if no API keys are active
    if "empathetic" in tone_instruction.lower():
        return f"Dear Customer,\n\nWe deeply apologize for the inconvenience this has caused you. We understand your frustration regarding this matter and are prioritizing your resolution immediately.\n\n{current_draft}\n\nWarm regards,\nCustomer Care Team"
    elif "concise" in tone_instruction.lower():
        return f"Hello,\n\nThank you for reaching out. We have received your request and our team is actively addressing it.\n\nNext steps: We will update you as soon as this is resolved.\n\nBest,\nSupport Team"
    return f"{current_draft}\n\n[Updated per instruction: {tone_instruction}]"

def copilot_chat_llm(ticket_context: dict, user_message: str, history: list = None, kb_context: str = "") -> str:
    """Interactive copilot assistant for support agents regarding a specific ticket."""
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    system_prompt = (
        "You are an expert AI Support Copilot helping a human customer support agent handle a ticket.\n"
        f"Ticket Context:\n"
        f"- ID: #{ticket_context.get('id', 'N/A')}\n"
        f"- Category: {ticket_context.get('category', 'N/A')}\n"
        f"- Assigned Team: {ticket_context.get('assigned_team', 'N/A')}\n"
        f"- Priority: {ticket_context.get('priority', 'N/A')}\n"
        f"- Sentiment: {ticket_context.get('sentiment', 'N/A')}\n"
        f"- Customer Message: \"{ticket_context.get('ticket_text', '')}\"\n"
        f"- Current Draft: \"{ticket_context.get('draft_response', '')}\"\n"
        f"- Relevant Knowledge Base Context: \"{kb_context}\"\n\n"
        "Provide helpful, concise, actionable assistance. If asked to draft internal notes, reply messages, or explain policies, do so directly."
    )

    if openai_key:
        try:
            client = OpenAI(api_key=openai_key)
            messages = [{"role": "system", "content": system_prompt}]
            if history:
                for h in history[-4:]:
                    messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
            messages.append({"role": "user", "content": user_message})
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
            )
            return completion.choices[0].message.content.strip()
        except Exception as e:
            print(f"[OpenAI Copilot Error]: {e}")

    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            prompt = f"{system_prompt}\n\nAgent Question: {user_message}"
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            print(f"[Gemini Copilot Error]: {e}")

    return f"Copilot Advisor: Based on this {ticket_context.get('category', 'Support')} ticket ({ticket_context.get('priority', 'Medium')} priority), recommend confirming the customer's account credentials and escalating to {ticket_context.get('assigned_team', 'Support')} if unresolved within SLA."

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
