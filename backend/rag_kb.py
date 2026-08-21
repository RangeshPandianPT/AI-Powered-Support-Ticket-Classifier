import chromadb
from chromadb.utils import embedding_functions
import os

# Initialize ChromaDB client
client = chromadb.Client()

# Use a default embedding function
sentence_transformer_ef = embedding_functions.DefaultEmbeddingFunction()

kb_collection = client.get_or_create_collection(
    name="support_kb", 
    embedding_function=sentence_transformer_ef
)

def populate_kb():
    """Populate the knowledge base with mock FAQ data."""
    docs = [
        "Refund Policy: Customers can request a full refund within 30 days of purchase. Refunds take 5-7 business days to process.",
        "Shipping Delays: Standard shipping takes 3-5 business days. International shipping can take up to 3 weeks.",
        "Password Reset: To reset a password, users should go to the login page and click 'Forgot Password'. A link will be sent to their email.",
        "Bug Report: If a user reports a 500 error on PDF export, this is a known issue. We are patching it in v2.4 releasing next week. Workaround: use CSV export.",
        "Subscription Cancellations: Subscriptions can be canceled from the Account Settings page under 'Billing'.",
        "Duplicate Charge: If a customer is charged twice, verify invoice number. Issue an immediate refund for the duplicate transaction."
    ]
    ids = [f"doc_{i}" for i in range(len(docs))]
    
    # Check if already populated
    if kb_collection.count() == 0:
        kb_collection.add(
            documents=docs,
            ids=ids
        )
        print("Knowledge base populated with FAQs.")

def search_kb(query: str, n_results: int = 2) -> str:
    """Search the knowledge base for a query and return relevant context."""
    if kb_collection.count() == 0:
        populate_kb()
        
    results = kb_collection.query(
        query_texts=[query],
        n_results=n_results
    )
    
    if results['documents'] and len(results['documents'][0]) > 0:
        # Join retrieved documents as context
        return " ".join(results['documents'][0])
    return "No relevant information found in Knowledge Base."

if __name__ == "__main__":
    populate_kb()
    print(search_kb("I need a refund"))
