import streamlit as st
from classifier import classify_ticket
import os
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="AI Ticket Classifier", page_icon="🎫", layout="centered")

st.title("🎫 AI Powered Support Ticket Classifier")
st.markdown("Enter a customer support ticket below and let the AI classify it automatically.")

ticket_input = st.text_area(
    "Customer Ticket", 
    height=150, 
    placeholder="E.g., I have been waiting for my package for 3 weeks and I am very angry!"
)

if st.button("Classify Ticket", type="primary"):
    if not ticket_input.strip():
        st.warning("Please enter a ticket to classify.")
    elif not os.getenv("OPENAI_API_KEY"):
        st.error("Missing OpenAI API Key! Please create a `.env` file and add `OPENAI_API_KEY=your_key`.")
    else:
        with st.spinner("Analyzing ticket..."):
            try:
                result = classify_ticket(ticket_input)
                
                st.success("Classification Complete!")
                
                # Display Results using Streamlit metrics and columns
                col1, col2 = st.columns(2)
                
                with col1:
                    st.metric("Category", result.category.value)
                    st.metric("Priority", result.priority.value)
                
                with col2:
                    st.metric("Assigned Team", result.assigned_team.value)
                    st.metric("User Sentiment", result.sentiment.value)
                    
                # Progress bar for confidence score
                st.write("---")
                st.progress(
                    result.confidence_score, 
                    text=f"AI Confidence Score: {result.confidence_score:.2f} / 1.0"
                )
                
            except Exception as e:
                st.error(f"An error occurred: {str(e)}")
