from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# Niche Models
class NicheCreate(BaseModel):
    name: str
    description: Optional[str] = None
    locations: Optional[List[str]] = []


class NicheResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    locations: Optional[List[str]] = []
    created_at: datetime
    updated_at: datetime
    contact_count: Optional[int] = 0


class NicheUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    locations: Optional[List[str]] = None


class ScrapeRequest(BaseModel):
    """Request model for scraping data."""
    keyword: str
    location: str
    limit: int = 20  # Default to 20, max 50
    niche_id: Optional[int] = None  # Associate contacts with a niche


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
    niche_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Additional business details
    description: Optional[str] = None
    opening_hours: Optional[dict] = None  # JSON object with days/hours
    services: Optional[List[str]] = None
    products: Optional[List[str]] = None
    price_range: Optional[str] = None
    google_maps_url: Optional[str] = None
    place_id: Optional[str] = None


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
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Additional business details
    description: Optional[str] = None
    opening_hours: Optional[dict] = None
    services: Optional[List[str]] = None
    products: Optional[List[str]] = None
    price_range: Optional[str] = None
    google_maps_url: Optional[str] = None
    place_id: Optional[str] = None


class SMSRequest(BaseModel):
    """Request model for sending SMS."""
    contact_id: int
    message: str


class SMSResponse(BaseModel):
    """Response model for SMS."""
    success: bool
    message: str
    sid: Optional[str] = None


class ScrapeResponse(BaseModel):
    """Response model for scraping operation."""
    message: str
    total_contacts: int
    run_id: str
