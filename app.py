import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import os
import json
from dotenv import load_dotenv

from schema import IssueCategory, AssignedTeam, IssuePriority, UserSentiment
from classifier import classify_ticket
import database as db

# Load environment variables
load_dotenv()

# Initialize DB on load
db.init_db()

# Streamlit Page Config
st.set_page_config(
    page_title="AI Ticket Intelligence Suite",
    page_icon="🎫",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for polished, modern UI styling
st.markdown("""
    <style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        color: #1E293B;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1rem;
        color: #64748B;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 15px;
        text-align: center;
    }
    .escalation-badge {
        background-color: #FEF2F2;
        border: 1px solid #FCA5A5;
        color: #991B1B;
        padding: 10px 15px;
        border-radius: 8px;
        font-weight: 600;
        margin-bottom: 15px;
    }
    .stProgress > div > div > div > div {
        background-color: #3B82F6;
    }
    </style>
""", unsafe_allow_html=True)

# Sidebar Configuration
with st.sidebar:
    st.image("https://img.icons8.com/duotone/96/customer-support.png", width=64)
    st.title("Settings & Control")
    
    st.subheader("🤖 AI Provider")
    provider_choice = st.selectbox(
        "Select LLM Engine",
        ["Auto", "OpenAI", "Google Gemini"],
        help="Auto will try OpenAI first, then fallback to Google Gemini if configured."
    )

    st.markdown("---")
    st.subheader("🔑 API Key Override")
    openai_key_input = st.text_input("OpenAI API Key", type="password", help="Overrides OPENAI_API_KEY in .env")
    gemini_key_input = st.text_input("Gemini API Key", type="password", help="Overrides GEMINI_API_KEY in .env")

    st.markdown("---")
    st.subheader("📊 System Stats")
    stats = db.get_analytics_summary()
    st.metric("Total Classified", stats["total_tickets"])
    st.metric("Open Tickets", stats["total_open"])
    st.metric("Urgent Escalations", stats["total_escalations"])
    st.metric("Avg AI Confidence", f"{stats['avg_confidence'] * 100:.1f}%")

# App Header
st.markdown("<div class='main-header'>🎫 AI Support Ticket Intelligence Suite</div>", unsafe_allow_html=True)
st.markdown("<div class='sub-header'>Automatic Ticket Classification, AI Auto-Response Drafting, Urgency Escalation & Analytics</div>", unsafe_allow_html=True)

# Main Application Tabs
tab1, tab2, tab3, tab4 = st.tabs([
    "🎯 Single Ticket Classifier", 
    "📁 Batch CSV Processing", 
    "🗄️ Ticket History & Management", 
    "📈 Analytics Dashboard"
])

# ----------------------------------------------------
# TAB 1: SINGLE TICKET CLASSIFIER
# ----------------------------------------------------
with tab1:
    st.subheader("Classify & Respond to Support Ticket")
    
    # Presets helper
    col_p1, col_p2, col_p3 = st.columns(3)
    preset_text = ""
    if col_p1.button("📋 Sample: Shipping Issue"):
        preset_text = "I ordered a laptop 2 weeks ago and the tracking status still says 'Pending Shipment'. I am very angry!"
    if col_p2.button("💳 Sample: Billing Duplicate"):
        preset_text = "My credit card was charged twice for invoice #8841. Please issue a refund immediately."
    if col_p3.button("⚙️ Sample: Technical Bug"):
        preset_text = "The application keeps throwing a 500 error when clicking the Export PDF button on Chrome."

    ticket_text_input = st.text_area(
        "Enter Customer Support Ticket",
        value=preset_text,
        height=140,
        placeholder="Paste customer ticket text here..."
    )

    if st.button("🚀 Classify Ticket & Generate Response", type="primary"):
        if not ticket_text_input.strip():
            st.warning("Please enter a ticket text to analyze.")
        else:
            with st.spinner("Analyzing ticket & drafting response..."):
                try:
                    classification, provider_used = classify_ticket(
                        ticket_text_input, 
                        provider=provider_choice,
                        openai_key=openai_key_input,
                        gemini_key=gemini_key_input
                    )
                    
                    st.success(f"Classification Completed via **{provider_used}**!")
                    
                    # Immediate Escalation Alert Banner
                    if classification.requires_immediate_escalation:
                        st.markdown(
                            "<div class='escalation-badge'>🚨 <b>URGENT ESCALATION REQUIRED:</b> High Priority ticket with distressed customer sentiment!</div>",
                            unsafe_allow_html=True
                        )

                    # Summary & Key Metrics
                    st.markdown(f"**Summary:** *{classification.summary}*")
                    
                    col1, col2, col3, col4 = st.columns(4)
                    col1.metric("Category", classification.category.value)
                    col2.metric("Assigned Team", classification.assigned_team.value)
                    col3.metric("Priority", classification.priority.value)
                    col4.metric("Sentiment", classification.sentiment.value)
                    
                    st.progress(
                        float(classification.confidence_score), 
                        text=f"AI Confidence Score: {classification.confidence_score * 100:.1f}%"
                    )

                    st.markdown("---")
                    res_col1, res_col2 = st.columns(2)

                    with res_col1:
                        st.subheader("✉️ AI Drafted Customer Response")
                        st.text_area("Suggested Response", value=classification.draft_response, height=180)

                    with res_col2:
                        st.subheader("📋 Action Items for Support Agent")
                        for item in classification.key_action_items:
                            st.markdown(f"- ✅ {item}")

                    st.markdown("---")
                    # Save to Database Section
                    save_col1, save_col2 = st.columns([3, 1])
                    with save_col1:
                        initial_status = st.selectbox("Assign Initial Ticket Status", ["Open", "In Progress", "Resolved"])
                    with save_col2:
                        st.write("") # spacing
                        st.write("")
                        if st.button("💾 Save Ticket to Database", type="secondary"):
                            db_id = db.save_ticket(ticket_text_input, classification, provider_used=provider_used, status=initial_status)
                            st.success(f"Ticket #{db_id} saved to SQLite database successfully!")
                            st.rerun()

                except Exception as e:
                    st.error(f"Error classifying ticket: {str(e)}")

# ----------------------------------------------------
# TAB 2: BATCH CSV PROCESSING
# ----------------------------------------------------
with tab2:
    st.subheader("📁 Bulk Batch Ticket Classification")
    st.markdown("Upload a CSV or Excel file containing customer support tickets to classify them in bulk.")

    sample_csv_path = os.path.join(os.path.dirname(__file__), "sample_tickets.csv")
    
    col_file1, col_file2 = st.columns([3, 1])
    with col_file1:
        uploaded_file = st.file_uploader("Upload CSV or Excel file", type=["csv", "xlsx"])
    with col_file2:
        st.write("")
        st.write("")
        if st.button("📄 Load Sample CSV"):
            if os.path.exists(sample_csv_path):
                st.session_state['batch_df'] = pd.read_csv(sample_csv_path)
                st.success("Sample CSV loaded!")

    if 'batch_df' in st.session_state and uploaded_file is None:
        df = st.session_state['batch_df']
    elif uploaded_file is not None:
        if uploaded_file.name.endswith('.csv'):
            df = pd.read_csv(uploaded_file)
        else:
            df = pd.read_excel(uploaded_file)
    else:
        df = None

    if df is not None:
        st.write("### Data Preview", df.head())
        text_column = st.selectbox("Select Ticket Text Column", options=df.columns.tolist())

        if st.button("⚡ Start Bulk Classification", type="primary"):
            results = []
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            total_rows = len(df)
            for idx, row in df.iterrows():
                ticket_str = str(row[text_column])
                status_text.text(f"Processing ticket {idx+1}/{total_rows}...")
                try:
                    classification, p_used = classify_ticket(
                        ticket_str, 
                        provider=provider_choice,
                        openai_key=openai_key_input,
                        gemini_key=gemini_key_input
                    )
                    results.append({
                        "Original Text": ticket_str,
                        "Summary": classification.summary,
                        "Category": classification.category.value,
                        "Assigned Team": classification.assigned_team.value,
                        "Priority": classification.priority.value,
                        "Sentiment": classification.sentiment.value,
                        "Confidence Score": classification.confidence_score,
                        "Requires Escalation": classification.requires_immediate_escalation,
                        "Draft Response": classification.draft_response,
                        "Action Items": ", ".join(classification.key_action_items),
                        "Classification": classification, # internal store
                        "Provider": p_used
                    })
                except Exception as e:
                    results.append({
                        "Original Text": ticket_str,
                        "Summary": "ERROR",
                        "Category": "Error",
                        "Assigned Team": "Error",
                        "Priority": "Low",
                        "Sentiment": "Neutral",
                        "Confidence Score": 0.0,
                        "Requires Escalation": False,
                        "Draft Response": f"Error: {str(e)}",
                        "Action Items": "",
                        "Classification": None,
                        "Provider": provider_choice
                    })
                progress_bar.progress((idx + 1) / total_rows)

            status_text.success("Bulk classification completed!")
            res_df = pd.DataFrame(results)
            st.session_state['processed_df'] = res_df

    if 'processed_df' in st.session_state:
        res_df = st.session_state['processed_df']
        st.markdown("### Classified Results")
        
        display_df = res_df.drop(columns=["Classification"], errors="ignore")
        st.dataframe(display_df, use_container_width=True)

        col_save, col_down = st.columns(2)
        with col_save:
            if st.button("💾 Bulk Save All Results to Database"):
                saved_count = 0
                for idx, row in res_df.iterrows():
                    cls_obj = row.get("Classification")
                    if cls_obj:
                        db.save_ticket(row["Original Text"], cls_obj, provider_used=row["Provider"])
                        saved_count += 1
                st.success(f"Saved {saved_count} tickets into the SQLite database!")
                st.rerun()

        with col_down:
            csv_data = display_df.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="📥 Download Classified CSV Report",
                data=csv_data,
                file_name="classified_support_tickets.csv",
                mime="text/csv"
            )

# ----------------------------------------------------
# TAB 3: TICKET HISTORY & MANAGEMENT
# ----------------------------------------------------
with tab3:
    st.subheader("🗄️ Ticket History & Resolution Workflow")
    
    # Filter Bar
    f_col1, f_col2, f_col3, f_col4 = st.columns(4)
    with f_col1:
        status_f = st.selectbox("Status Filter", ["All", "Open", "In Progress", "Resolved"])
    with f_col2:
        team_f = st.selectbox("Team Filter", ["All"] + [t.value for t in AssignedTeam])
    with f_col3:
        priority_f = st.selectbox("Priority Filter", ["All"] + [p.value for p in IssuePriority])
    with f_col4:
        search_q = st.text_input("Search Text", placeholder="Keyword...")

    tickets_list = db.get_all_tickets(
        status_filter=status_f,
        team_filter=team_f,
        priority_filter=priority_f,
        search_query=search_q
    )

    st.markdown(f"**Found {len(tickets_list)} stored tickets**")

    if not tickets_list:
        st.info("No tickets found matching the specified criteria.")
    else:
        for t in tickets_list:
            t_id = t["id"]
            escalation_tag = "🚨 [URGENT ESCALATION]" if t["requires_immediate_escalation"] else ""
            status_color = "🟢" if t["status"] == "Resolved" else ("🟡" if t["status"] == "In Progress" else "🔴")
            
            expander_title = f"{status_color} Ticket #{t_id} | {t['category']} | {t['priority']} Priority | Team: {t['assigned_team']} {escalation_tag}"
            
            with st.expander(expander_title):
                st.markdown(f"**Created At:** `{t['created_at']}` | **Provider:** `{t['provider_used']}` | **Confidence:** `{t['confidence_score']*100:.1f}%`")
                st.markdown(f"**Ticket Text:**\n> {t['ticket_text']}")
                st.markdown(f"**Summary:** *{t['summary']}*")
                
                c_a, c_b = st.columns(2)
                with c_a:
                    st.markdown("**✉️ Draft Response:**")
                    st.info(t["draft_response"])
                with c_b:
                    st.markdown("**📋 Action Items:**")
                    if isinstance(t["key_action_items"], list):
                        for act in t["key_action_items"]:
                            st.markdown(f"- {act}")

                st.markdown("---")
                # Management actions
                act_col1, act_col2, act_col3 = st.columns([2, 1, 1])
                with act_col1:
                    new_st = st.selectbox(
                        "Update Status", 
                        ["Open", "In Progress", "Resolved"], 
                        index=["Open", "In Progress", "Resolved"].index(t["status"]),
                        key=f"status_select_{t_id}"
                    )
                with act_col2:
                    st.write("")
                    st.write("")
                    if st.button("Update Status", key=f"update_btn_{t_id}"):
                        db.update_ticket_status(t_id, new_st)
                        st.success(f"Status for Ticket #{t_id} updated to {new_st}!")
                        st.rerun()
                with act_col3:
                    st.write("")
                    st.write("")
                    if st.button("🗑️ Delete", key=f"delete_btn_{t_id}"):
                        db.delete_ticket(t_id)
                        st.warning(f"Ticket #{t_id} deleted!")
                        st.rerun()

# ----------------------------------------------------
# TAB 4: ANALYTICS DASHBOARD
# ----------------------------------------------------
with tab4:
    st.subheader("📈 Ticket Intelligence & Analytics Dashboard")
    
    all_db_tickets = db.get_all_tickets(status_filter="All")
    
    if not all_db_tickets:
        st.warning("No data in the database yet. Classify and save tickets to see analytics!")
    else:
        analytics_df = pd.DataFrame(all_db_tickets)

        # Overview Metrics Row
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Total Database Tickets", len(analytics_df))
        escalations_count = len(analytics_df[analytics_df["requires_immediate_escalation"] == 1])
        m2.metric("Urgent Escalations", escalations_count, delta=f"{escalations_count/len(analytics_df)*100:.1f}% rate" if len(analytics_df)>0 else None)
        open_count = len(analytics_df[analytics_df["status"] == "Open"])
        m3.metric("Open Tickets", open_count)
        avg_conf = analytics_df["confidence_score"].mean()
        m4.metric("Average AI Confidence", f"{avg_conf * 100:.1f}%")

        st.markdown("---")
        
        # Charts Row 1
        chart_col1, chart_col2 = st.columns(2)

        with chart_col1:
            st.markdown("#### Tickets by Category & Team")
            cat_team_fig = px.histogram(
                analytics_df, 
                x="category", 
                color="assigned_team", 
                barmode="group",
                title="Category vs Assigned Routing Team",
                labels={"category": "Category", "assigned_team": "Team"},
                color_discrete_sequence=px.colors.qualitative.Set2
            )
            st.plotly_chart(cat_team_fig, use_container_width=True)

        with chart_col2:
            st.markdown("#### User Sentiment Breakdown")
            sentiment_counts = analytics_df["sentiment"].value_counts().reset_index()
            sentiment_counts.columns = ["Sentiment", "Count"]
            sentiment_fig = px.pie(
                sentiment_counts, 
                names="Sentiment", 
                values="Count", 
                hole=0.4,
                title="Customer Sentiment Distribution",
                color="Sentiment",
                color_discrete_map={
                    "Angry": "#EF4444",
                    "Frustrated": "#F59E0B",
                    "Neutral": "#94A3B8",
                    "Happy": "#10B981"
                }
            )
            st.plotly_chart(sentiment_fig, use_container_width=True)

        # Charts Row 2
        chart_col3, chart_col4 = st.columns(2)

        with chart_col3:
            st.markdown("#### Priority Distribution")
            prio_counts = analytics_df["priority"].value_counts().reset_index()
            prio_counts.columns = ["Priority", "Count"]
            prio_fig = px.bar(
                prio_counts,
                x="Priority",
                y="Count",
                color="Priority",
                title="Ticket Priority Breakdown",
                color_discrete_map={"High": "#DC2626", "Medium": "#F59E0B", "Low": "#10B981"}
            )
            st.plotly_chart(prio_fig, use_container_width=True)

        with chart_col4:
            st.markdown("#### Resolution Status Overview")
            status_counts = analytics_df["status"].value_counts().reset_index()
            status_counts.columns = ["Status", "Count"]
            status_fig = px.pie(
                status_counts,
                names="Status",
                values="Count",
                title="Resolution Workflow Status",
                color_discrete_sequence=px.colors.qualitative.Pastel
            )
            st.plotly_chart(status_fig, use_container_width=True)
