import chromadb
from chromadb.utils import embedding_functions
import os
import uuid
import json
from typing import List, Dict, Any, Optional

# Initialize ChromaDB persistent client
client = chromadb.PersistentClient(path="./chroma_db")

# Use a default embedding function
sentence_transformer_ef = embedding_functions.DefaultEmbeddingFunction()

kb_collection = client.get_or_create_collection(
    name="support_kb", 
    embedding_function=sentence_transformer_ef
)

def populate_kb():
    """Populate the knowledge base with mock FAQ data if empty."""
    if kb_collection.count() > 0:
        return
        
    docs = [
        "Refund Policy: Customers can request a full refund within 30 days of purchase. Refunds take 5-7 business days to process.",
        "Shipping Delays: Standard shipping takes 3-5 business days. International shipping can take up to 3 weeks.",
        "Password Reset: To reset a password, users should go to the login page and click 'Forgot Password'. A link will be sent to their email.",
        "Bug Report: If a user reports a 500 error on PDF export, this is a known issue. We are patching it in v2.4 releasing next week. Workaround: use CSV export.",
        "Subscription Cancellations: Subscriptions can be canceled from the Account Settings page under 'Billing'.",
        "Duplicate Charge: If a customer is charged twice, verify invoice number. Issue an immediate refund for the duplicate transaction."
    ]
    ids = [f"doc_{i}" for i in range(len(docs))]
    
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

def add_to_kb(text: str, doc_id: str = None):
    """Add a new document to the knowledge base."""
    if not doc_id:
        doc_id = str(uuid.uuid4())
    kb_collection.add(documents=[text], ids=[doc_id])
    return doc_id

def delete_from_kb(doc_id: str):
    """Delete a document from the knowledge base."""
    kb_collection.delete(ids=[doc_id])

def get_all_kb_docs():
    """Retrieve all documents in the knowledge base."""
    if kb_collection.count() == 0:
        return []
    results = kb_collection.get()
    
    docs = []
    if results and results.get("ids") and results.get("documents"):
        for i in range(len(results["ids"])):
            docs.append({
                "id": results["ids"][i],
                "content": results["documents"][i]
            })
    return docs

def search_kb_with_scores(query: str, n_results: int = 3) -> List[Dict[str, Any]]:
    """Query ChromaDB and return ranked chunks with computed semantic similarity scores (0-100%)."""
    if kb_collection.count() == 0:
        populate_kb()

    count = kb_collection.count()
    if count == 0 or not query.strip():
        return []

    k = min(max(1, n_results), count)
    results = kb_collection.query(
        query_texts=[query],
        n_results=k,
        include=["documents", "distances"]
    )

    ranked = []
    ids = results.get("ids", [[]])[0]
    docs = results.get("documents", [[]])[0]
    dists = results.get("distances", [[]])[0]

    for idx in range(len(docs)):
        dist = float(dists[idx]) if idx < len(dists) else 1.5
        similarity = max(5, min(99, round((1.0 - (dist / 2.0)) * 100)))
        ranked.append({
            "id": ids[idx],
            "content": docs[idx],
            "distance": round(dist, 4),
            "similarity_score": similarity
        })
    return ranked

def analyze_knowledge_gaps() -> Dict[str, Any]:
    """
    Scan recent tickets against ChromaDB vector embeddings to detect recurring
    support topics with weak or missing Knowledge Base coverage.
    """
    import database as db

    if kb_collection.count() == 0:
        populate_kb()

    tickets = db.get_all_tickets()
    if not tickets:
        return {
            "kb_coverage_score": 100,
            "total_docs": kb_collection.count(),
            "scanned_tickets": 0,
            "gaps": []
        }

    sample = tickets[:30]
    covered_count = 0
    gap_buckets: Dict[str, Dict[str, Any]] = {}

    for t in sample:
        query_text = f"{t.get('category', '')} {t.get('summary') or t.get('ticket_text', '')[:160]}"
        matches = search_kb_with_scores(query_text, n_results=1)
        top_sim = matches[0]["similarity_score"] if matches else 0

        if top_sim >= 52:
            covered_count += 1
        else:
            cat = t.get("category") or "General"
            if cat not in gap_buckets:
                gap_buckets[cat] = {
                    "category": cat,
                    "topic": f"Uncovered {cat} Workflows & Troubleshooting",
                    "ticket_count": 0,
                    "sample_ticket_ids": [],
                    "sample_summaries": [],
                    "total_sim": 0,
                    "suggested_title": f"{cat} Resolution & Escalation Playbook"
                }
            bucket = gap_buckets[cat]
            bucket["ticket_count"] += 1
            bucket["total_sim"] += top_sim
            if len(bucket["sample_ticket_ids"]) < 4:
                bucket["sample_ticket_ids"].append(t["id"])
                bucket["sample_summaries"].append((t.get("summary") or t.get("ticket_text", ""))[:90])

    gaps = []
    for cat, b in gap_buckets.items():
        avg_sim = round(b["total_sim"] / b["ticket_count"]) if b["ticket_count"] > 0 else 0
        gaps.append({
            "category": b["category"],
            "topic": b["topic"],
            "ticket_count": b["ticket_count"],
            "sample_ticket_ids": b["sample_ticket_ids"],
            "sample_summaries": b["sample_summaries"],
            "avg_similarity": avg_sim,
            "suggested_title": b["suggested_title"]
        })

    gaps.sort(key=lambda x: x["ticket_count"], reverse=True)
    coverage_score = round((covered_count / len(sample)) * 100) if sample else 100

    return {
        "kb_coverage_score": coverage_score,
        "total_docs": kb_collection.count(),
        "scanned_tickets": len(sample),
        "covered_tickets": covered_count,
        "gaps": gaps
    }

def synthesize_kb_article(
    topic: Optional[str] = None,
    ticket_id: Optional[int] = None,
    auto_publish: bool = False
) -> Dict[str, Any]:
    """
    Synthesize a structured Help Center Knowledge Base article from a resolved ticket
    or a detected knowledge gap, and optionally index it into ChromaDB.
    """
    import database as db

    ticket = db.get_ticket_by_id(ticket_id) if ticket_id else None
    if ticket_id and not ticket:
        raise ValueError(f"Ticket #{ticket_id} not found.")

    subject_label = topic or (ticket.get("summary") if ticket else "General Support Policy")
    category = ticket.get("category", "General Support") if ticket else "Knowledge Base"
    draft_ref = ticket.get("draft_response", "") if ticket else ""
    issue_ref = ticket.get("ticket_text", "") if ticket else (topic or "")

    article = None
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    prompt = (
        "You are a Technical Writer creating a concise, reusable Support Knowledge Base article.\n"
        f"Category: {category}\n"
        f"Topic / Issue: {issue_ref}\n"
        f"Agent Resolution Reference: {draft_ref}\n\n"
        "Return strict JSON with keys:\n"
        "{\n"
        "  \"title\": \"Clear searchable article title\",\n"
        "  \"category\": \"Category name\",\n"
        "  \"content\": \"Single cohesive paragraph/playbook (2-4 sentences) stating the issue, policy, and exact resolution steps.\",\n"
        "  \"tags\": [\"tag1\", \"tag2\"]\n"
        "}"
    )

    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            res = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            article = json.loads(res.text if hasattr(res, "text") else res.choices[0].message.content)
        except Exception as e:
            print(f"[OpenAI KB Synth Error]: {e}")

    if not article and gemini_key:
        try:
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=gemini_key)
            res = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            article = json.loads(res.text)
        except Exception as e:
            print(f"[Gemini KB Synth Error]: {e}")

    if not article:
        clean_summary = (subject_label or "Support Procedure").strip()
        resolution_snippet = (
            draft_ref.strip()[:280]
            if draft_ref and len(draft_ref.strip()) > 25
            else f"Verify customer account details, review {category.lower()} logs, and apply standard SLA resolution steps."
        )
        article = {
            "title": f"{category}: {clean_summary[:70]}",
            "category": category,
            "content": f"{category} Policy & Troubleshooting ({clean_summary}): {resolution_snippet}",
            "tags": [category, "Auto-Synthesized"]
        }

    doc_id = None
    if auto_publish:
        formatted_doc = f"{article['title']} — {article['content']}"
        doc_id = add_to_kb(formatted_doc)

    return {
        "title": article.get("title"),
        "category": article.get("category", category),
        "content": article.get("content"),
        "tags": article.get("tags", []),
        "published": auto_publish,
        "doc_id": doc_id,
        "source_ticket_id": ticket_id
    }

if __name__ == "__main__":
    populate_kb()
    print(search_kb("I need a refund"))
