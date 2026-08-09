from pydantic import BaseModel, Field
from enum import Enum

class IssueCategory(str, Enum):
    SHIPPING = "Shipping"
    BILLING = "Billing"
    TECHNICAL_SUPPORT = "Technical Support"
    PRODUCT_INQUIRY = "Product Inquiry"
    OTHER = "Other"

class AssignedTeam(str, Enum):
    LOGISTICS = "Logistics"
    CUSTOMER_SUCCESS = "Customer Success"
    IT = "IT"
    SALES = "Sales"
    GENERAL = "General Support"

class IssuePriority(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"

class UserSentiment(str, Enum):
    ANGRY = "Angry"
    FRUSTRATED = "Frustrated"
    NEUTRAL = "Neutral"
    HAPPY = "Happy"

class TicketClassification(BaseModel):
    """
    This is the core schema that defines exactly what data structure we want 
    the LLM to return. Pydantic will ensure the LLM's JSON matches this perfectly.
    """
    category: IssueCategory = Field(
        description="The category of the customer's issue."
    )
    assigned_team: AssignedTeam = Field(
        description="The internal team this ticket should be routed to based on the category."
    )
    priority: IssuePriority = Field(
        description="The priority level of the issue based on urgency and user frustration."
    )
    sentiment: UserSentiment = Field(
        description="The overall emotional sentiment of the user in the ticket."
    )
    confidence_score: float = Field(
        ge=0.0, le=1.0, 
        description="Confidence score of the classification between 0.0 and 1.0."
    )
