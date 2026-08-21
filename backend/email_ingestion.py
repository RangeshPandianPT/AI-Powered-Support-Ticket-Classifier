import time

def check_new_emails():
    """
    Mock function to simulate checking an IMAP server for new support emails.
    In a real implementation, this would connect using imaplib to fetch unread emails.
    """
    print("[IMAP] Connecting to mail server...")
    time.sleep(1)
    
    # Simulate finding 2 new emails
    mock_emails = [
        {
            "id": "email_101",
            "subject": "Missing items in my delivery!",
            "body": "Hi, I received my order #4459 today but it's missing the wireless mouse I paid for. This is completely unacceptable, I need this for work tomorrow! Send it immediately.",
            "sender": "angry_customer@example.com"
        },
        {
            "id": "email_102",
            "subject": "Question about pricing",
            "body": "Hello, I am wondering if you offer any discounts for non-profits? We are a small charity looking to use your software.",
            "sender": "charity_admin@example.org"
        }
    ]
    
    print(f"[IMAP] Found {len(mock_emails)} new emails.")
    return mock_emails
