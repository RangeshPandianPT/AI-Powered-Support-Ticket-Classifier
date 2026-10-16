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

def simulate_customer_reply_llm(
    ticket_context: dict, 
    message_history: list, 
    persona: str = "dynamic"
) -> dict:
    """
    Simulate a realistic customer follow-up reply in a multi-turn thread.
    Returns: {"message": str, "sentiment": str}
    """
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    persona_instructions = {
        "satisfied": (
            "The customer is happy and relieved. The agent's proposed resolution worked! "
            "Write a warm, concise customer response thanking the support agent and confirming the issue is solved. "
            "Sentiment must be 'Happy'."
        ),
        "frustrated": (
            "The customer is still blocked or tried the agent's instructions and hit a roadblock. "
            "Write a frustrated, urgent customer reply stating it didn't work and asking for immediate escalation. "
            "Sentiment must be 'Frustrated' or 'Angry'."
        ),
        "inquiring": (
            "The customer understands the agent's message but asks a natural follow-up question "
            "(e.g., timeline, confirmation receipt, or next steps). "
            "Sentiment must be 'Neutral'."
        ),
        "dynamic": (
            "Evaluate the agent's previous message realistically. "
            "If the agent provided a clear resolution or refund credit, be satisfied ('Happy'). "
            "If the agent gave vague steps or asked for info, provide the info or express minor frustration. "
            "Write a realistic customer reply matching that dynamic."
        )
    }

    instruction = persona_instructions.get(persona, persona_instructions["dynamic"])

    # Format conversation history
    thread_transcript = ""
    for msg in message_history[-6:]:
        sender_label = "Customer" if msg.get("sender") == "customer" else "Support Agent"
        thread_transcript += f"{sender_label}: {msg.get('message_text', '')}\n\n"

    system_prompt = (
        "You are simulating a customer replying to an ongoing support ticket thread.\n"
        f"Original Issue Category: {ticket_context.get('category', 'General')}\n"
        f"Persona Directive: {instruction}\n\n"
        "Output ONLY a valid JSON object with exactly two keys:\n"
        '{"message": "<realistic customer reply>", "sentiment": "<Happy|Frustrated|Neutral|Angry>"}'
    )

    user_prompt = f"Conversation so far:\n{thread_transcript}\nWrite the customer's next reply:"

    if openai_key:
        try:
            client = OpenAI(api_key=openai_key)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.75,
            )
            raw = completion.choices[0].message.content.strip()
            data = json.loads(raw)
            return {
                "message": data.get("message", "Thank you for the update."),
                "sentiment": data.get("sentiment", "Neutral")
            }
        except Exception as e:
            print(f"[OpenAI Customer Sim Error]: {e}")

    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            prompt = f"{system_prompt}\n\n{user_prompt}\nReturn JSON:"
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            raw_text = response.text.strip()
            # Clean possible markdown block
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            data = json.loads(raw_text)
            return {
                "message": data.get("message", "Thank you for looking into this."),
                "sentiment": data.get("sentiment", "Neutral")
            }
        except Exception as e:
            print(f"[Gemini Customer Sim Error]: {e}")

    # Fallback simulation
    if persona == "satisfied":
        return {
            "message": "Thank you so much! That worked perfectly and the problem is now completely solved. I really appreciate your fast response!",
            "sentiment": "Happy"
        }
    elif persona == "frustrated":
        return {
            "message": "I followed those exact instructions, but I am still experiencing the same error. This is halting our workflow—please escalate this to your senior team immediately!",
            "sentiment": "Frustrated"
        }
    elif persona == "inquiring":
        return {
            "message": "Thanks for clarifying. How long will it take for this update to reflect in our dashboard, and will I receive a confirmation receipt by email?",
            "sentiment": "Neutral"
        }
    else:
        return {
            "message": "Thank you for the reply. I've noted the steps and tested them on my end. Everything looks good now!",
            "sentiment": "Happy"
        }

def reclassify_conversation_thread(
    ticket_context: dict, 
    message_history: list
) -> dict:
    """
    Re-evaluate ticket state after a customer or agent multi-turn interaction.
    Returns: {"sentiment": str, "draft_response": str, "requires_immediate_escalation": bool, "status": str}
    """
    latest_msg = message_history[-1] if message_history else {}
    latest_sentiment = latest_msg.get("sentiment") or ticket_context.get("sentiment", "Neutral")
    latest_text = latest_msg.get("message_text", "")

    if latest_sentiment == "Happy" or "thank" in latest_text.lower() or "solved" in latest_text.lower():
        return {
            "sentiment": "Happy",
            "status": "Resolved",
            "requires_immediate_escalation": False,
            "draft_response": (
                "You are very welcome! We are thrilled to hear that the issue is fully resolved. "
                "If you ever need assistance in the future, don't hesitate to reach back out. "
                "Have a fantastic day ahead!"
            )
        }
    elif latest_sentiment in ["Frustrated", "Angry"] or "escalat" in latest_text.lower() or "still" in latest_text.lower():
        return {
            "sentiment": latest_sentiment,
            "status": "Open",
            "requires_immediate_escalation": True,
            "draft_response": (
                "We deeply apologize that the previous solution did not resolve your issue. "
                "I have flagged this ticket for immediate priority review by our lead engineering and operations team. "
                "A specialist is investigating your case right now, and we will update you as quickly as possible."
            )
        }
    else:
        return {
            "sentiment": "Neutral",
            "status": "Open",
            "requires_immediate_escalation": False,
            "draft_response": (
                "Thank you for following up. Regarding your question, our standard turnaround time is within 1 to 2 business hours, "
                "and an automated confirmation receipt will be sent directly to your registered email address. "
                "Please let us know if you need any additional details!"
            )
        }

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

