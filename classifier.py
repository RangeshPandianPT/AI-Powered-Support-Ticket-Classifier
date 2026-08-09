import os
from dotenv import load_dotenv
from openai import OpenAI
from schema import TicketClassification

# Load environment variables (from .env file)
load_dotenv()

# Initialize OpenAI Client
# It automatically looks for OPENAI_API_KEY in environment variables
client = OpenAI()

def classify_ticket(ticket_text: str) -> TicketClassification:
    """
    Sends the ticket text to OpenAI and returns a structured Pydantic object
    representing the classification of the ticket.
    """
    completion = client.beta.chat.completions.parse(
        model="gpt-4o-2024-08-06", # Using a model that supports Native Structured Outputs
        messages=[
            {
                "role": "system", 
                "content": "You are an expert AI customer support assistant. Classify the user's support ticket accurately based on the provided schema."
            },
            {
                "role": "user", 
                "content": ticket_text
            }
        ],
        response_format=TicketClassification,
    )
    
    # Return the parsed Pydantic object
    return completion.choices[0].message.parsed

# Quick local test (runs only if this file is executed directly)
if __name__ == "__main__":
    sample_ticket = "I was charged twice for my subscription this month and I want a refund now!"
    print(f"Testing with ticket: '{sample_ticket}'\n")
    
    try:
        result = classify_ticket(sample_ticket)
        print("Classification Result:")
        print(f"Category: {result.category.value}")
        print(f"Team: {result.assigned_team.value}")
        print(f"Priority: {result.priority.value}")
        print(f"Sentiment: {result.sentiment.value}")
        print(f"Confidence: {result.confidence_score}")
    except Exception as e:
        print(f"Error: {e}")
        print("Did you remember to set your OPENAI_API_KEY in a .env file?")
