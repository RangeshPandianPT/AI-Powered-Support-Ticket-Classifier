# AI Powered Support Ticket Classifier

An intelligent, multi-agent support ticket classification and management system built with Next.js, FastAPI, and LangGraph.

This platform automates the ingestion, classification, and drafting of responses for customer support tickets using Large Language Models (LLMs). It seamlessly routes tickets to the appropriate teams, assesses customer sentiment, and flags urgent issues for immediate escalation.

## 🌟 Key Features

* **Multi-Agent Workflow (LangGraph)**: Processes tickets through structured agents: Triage Agent ➡️ RAG Knowledge Retrieval ➡️ Response Drafter ➡️ Escalation Sentinel.
* **Live Agent Execution Stepper**: Visualizes real-time execution steps, agent decisions, confidence scores, and retrieved policies in the UI.
* **AI Ticket Classification & Triage**: Categorizes issues, routes to teams (IT, Sales, Logistics, Customer Success), and determines priority and emotional sentiment.
* **RAG-Enhanced Knowledge Base**: Upload PDF or text policies to ChromaDB vector store; agent responses are automatically grounded in company guidelines.
* **Multi-Turn Conversation Threads**: Track complete back-and-forth message histories between customers and support agents with delivery timestamps, message counts, and sentiment tracking.
* **Customer Reply Simulation Engine**: Simulate realistic customer follow-up reactions using LLM personas (Auto Dynamic Reaction, Solved/Thankful, Still Failing/Escalating, Clarification Question, or Custom Inbound Message) to test full support lifecycles.
* **SLA Breach Monitoring & Countdown Timers**: Dynamic priority-based SLA tracking (4h High, 12h Medium, 24h Low) with real-time remaining countdown badges and breach indicators.
* **Interactive AI Response Studio**: Agents can edit draft responses, adjust tone with 1-click (Empathetic, Concise, Executive, Refund Credit), copy to clipboard, and simulate email reply dispatch into the message thread.
* **AI Support Copilot**: Dedicated side-drawer chat for support agents to query policies, churn risk, or draft internal team handover notes.
* **Batch CSV Ingestion & Benchmarking**: Process bulk tickets from `sample_tickets.csv` or uploaded custom CSV files with live progress tracking.
* **Private Internal Staff Notes**: Confidential agent-only notes, call logs, escalation memos, custom tags, and pin-to-top highlighting completely shielded from customer view.
* **AI Shift Handover Briefing Generator**: 1-click LLM synthesis that analyzes full conversation histories and automatically drafts structured shift-transition handover notes for oncoming agents.
* **Immutable Audit Trail & Timeline**: Chronological lifecycle event tracking covering state transitions, reassignments, note updates, and reply dispatches with visual diff chips.
* **Intelligent Agent Routing & AI Auto-Assignment**: Automatic skill- and workload-balanced routing engine across IT, Billing, Customer Success, and Executive Escalations.
* **Team Workload & Capacity Center**: Real-time slide-out dashboard detailing active ticket counts per agent, capacity progress bars, online shift status, and quick filtering.
* **AI Quality Assurance (QA) Sentinel & Rubric Auditor**: Real-time 4-pillar evaluation of outbound draft responses (Empathy, Policy Adherence, Actionability, Professionalism) with radial score gauge, compliance checklist, and 1-click AI Polish.
* **Customer Satisfaction (CSAT) Survey Engine**: 5-star customer feedback simulator, tag categorization, and satisfaction analytics tracking team CSAT averages.
* **Enterprise Smart Macros Library**: Pre-configured and custom support macro templates with automated dynamic placeholder interpolation (`{{customer_name}}`, `{{ticket_id}}`, `{{agent_name}}`) and AI ticket recommendations.
* **Executive SLA & Intelligence Center (`/analytics`)**: Full-screen executive mission control tracking SLA compliance rates by priority, breach risks, CSAT distributions, department velocities, and agent leaderboards with CSV export.
* **Customer Self-Service Portal with AI Deflection (`/portal`)**: Inbound customer helpdesk with live real-time knowledge base deflection that suggests solutions as customers type to prevent unnecessary ticket submissions.
* **Urgent Escalation System**: Automatically triggers Slack webhook alerts for high-priority frustrated customers.
* **Email Ingestion Simulation**: Real IMAP email polling with automated mock fallback.

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
