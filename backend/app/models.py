from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class ScrapeRequest(BaseModel):
    """Request model for scraping data."""
    keyword: str
    location: str


class ContactCreate(BaseModel):
    """Model for creating a new contact."""
    name: str
    email: Optional[EmailStr] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    category: Optional[str] = None
    status: str = "Lead"


class ContactResponse(BaseModel):
    """Model for contact response."""
    id: int
    name: str
    email: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    category: Optional[str] = None
    status: str
    created_at: datetime
    last_contact: Optional[datetime] = None


class ScrapeResponse(BaseModel):
    """Response model for scraping operation."""
    message: str
    total_contacts: int
    run_id: str
