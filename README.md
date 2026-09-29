# AI Powered Support Ticket Classifier

An intelligent, multi-agent support ticket classification and management system built with Next.js, FastAPI, and LangGraph.

This platform automates the ingestion, classification, and drafting of responses for customer support tickets using Large Language Models (LLMs). It seamlessly routes tickets to the appropriate teams, assesses customer sentiment, and flags urgent issues for immediate escalation.

## 🌟 Key Features

* **AI Ticket Classification**: Automatically categorizes tickets, assigns them to the correct internal team (e.g., IT, Sales, Logistics), and calculates priority based on the issue urgency and customer sentiment.
* **Multi-Agent Workflow (LangGraph)**: Utilizes LangGraph to process tickets through a structured workflow, analyzing them with OpenAI or Gemini models.
* **RAG-Enhanced Knowledge Base**: Upload PDF or text documents to the Knowledge Base to give the AI context. The AI generates highly accurate, context-aware draft responses for support agents.
* **Email Ingestion Simulation**: Simulates fetching incoming customer emails via IMAP and processing them directly into the ticket pipeline.
* **Ticket Management Dashboard**: A comprehensive Next.js frontend for agents to view incoming tickets, review AI-generated action items and draft responses, and mark tickets as resolved.
* **Urgent Escalation System**: Automatically detects high-priority, frustrated customers and triggers an escalation alert (simulating a Slack webhook).

## 🏗️ Architecture

The project is split into two main directories:

### Backend (`/backend`)
* **Framework**: FastAPI (Python)
* **AI & Logic**: LangGraph, LangChain, OpenAI API / Google Gemini API
* **Database**: SQLite (local storage for tickets and analytics)
* **Document Parsing**: PyPDF for reading Knowledge Base documents.

### Frontend (`/frontend`)
* **Framework**: Next.js (React) with App Router
* **Styling**: Custom CSS and Lucide React icons
* **Data Fetching**: Axios

## 🚀 Getting Started

### Prerequisites
* Python 3.9+
* Node.js 18+
* OpenAI API Key or Google Gemini API Key

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   * Create a `.env` file based on `.env.example`.
   * Add your `OPENAI_API_KEY` or `GEMINI_API_KEY`.
5. Run the FastAPI server:
   ```bash
   python main.py
   ```
   *The backend will be available at `http://127.0.0.1:8000`.*

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *The frontend will be available at `http://localhost:3000`.*

## 💻 Usage

1. **Dashboard Overview**: Navigate to `http://localhost:3000` to see the AI Agent Helpdesk.
2. **Ingest Emails**: Click "Simulate IMAP Ingestion" to fetch sample emails and have the AI classify them.
3. **Manual Ticket**: Paste a customer message into the manual ticket form to test the LangGraph classification workflow.
4. **Knowledge Base**: Scroll down to the Knowledge Base section to upload PDFs or text. The AI will use these documents to formulate draft responses for future tickets.
5. **Manage Tickets**: Click "View All Tickets" to open the Ticket Management Dashboard, where you can view detailed AI analysis, action items, and resolve tickets.

## 📄 License

This project is open-source and available under the MIT License.
