import time
import os
import imaplib
import email
from email.header import decode_header
from dotenv import load_dotenv

load_dotenv()

def get_real_emails():
    imap_server = os.getenv("IMAP_SERVER")
    imap_user = os.getenv("IMAP_USER")
    imap_pass = os.getenv("IMAP_PASSWORD")
    
    if not (imap_server and imap_user and imap_pass):
        return None
        
    try:
        # connect to the server
        mail = imaplib.IMAP4_SSL(imap_server)
        mail.login(imap_user, imap_pass)
        mail.select("inbox")
        
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            return []
            
        email_ids = messages[0].split()
        emails_list = []
        
        for e_id in email_ids[:10]: # Process max 10 unseen emails at a time
            status, msg_data = mail.fetch(e_id, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding if encoding else "utf-8")
                    sender = msg.get("From")
                    
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get("Content-Disposition"))
                            if content_type == "text/plain" and "attachment" not in content_disposition:
                                body = part.get_payload(decode=True).decode(errors="replace")
                                break
                    else:
                        body = msg.get_payload(decode=True).decode(errors="replace")
                    
                    emails_list.append({
                        "id": str(e_id.decode()),
                        "subject": subject,
                        "body": body,
                        "sender": sender
                    })
        return emails_list
    except Exception as e:
        print(f"[IMAP] Error: {e}")
        return None

def check_new_emails():
    """
    Checks an IMAP server for new support emails.
    Falls back to mock emails if IMAP credentials are not set in .env.
    """
    real_emails = get_real_emails()
    
    if real_emails is not None:
        print(f"[IMAP] Fetched {len(real_emails)} real emails.")
        return real_emails
        
    print("[IMAP] Credentials missing. Falling back to mock emails...")
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
    
    print(f"[IMAP] Found {len(mock_emails)} mock emails.")
    return mock_emails
