from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.models import ScrapeRequest, ScrapeResponse, ContactResponse
from app.database import db
from app.scraper import ScraperService
from typing import List

# Initialize settings
settings = get_settings()

# Initialize FastAPI app
app = FastAPI(
    title="Business Dashboard API",
    description="API for scraping and managing business contacts",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize scraper service
scraper = ScraperService()


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Business Dashboard API", "status": "running"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/api/scrape", response_model=ScrapeResponse)
async def scrape_contacts(request: ScrapeRequest):
    """
    Scrape contacts from Google Maps using Apify.
    
    This endpoint:
    1. Calls Apify's Google Maps scraper with the provided keyword and location
    2. Processes the results
    3. Stores the contacts in Supabase database
    4. Returns the count of contacts scraped
    """
    try:
        # Scrape data from Google Maps
        contacts, run_id = await scraper.scrape_google_maps(
            keyword=request.keyword,
            location=request.location
        )
        
        if not contacts:
            return ScrapeResponse(
                message="No contacts found for the given search criteria",
                total_contacts=0,
                run_id=run_id
            )
        
        # Store contacts in database
        stored_contacts = await db.create_contacts_batch(contacts)
        
        return ScrapeResponse(
            message=f"Successfully scraped and stored {len(stored_contacts)} contacts",
            total_contacts=len(stored_contacts),
            run_id=run_id
        )
    
    except Exception as e:
        print(f"Error in scrape_contacts: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while scraping: {str(e)}"
        )


@app.get("/api/contacts", response_model=List[ContactResponse])
async def get_contacts(limit: int = 100, offset: int = 0):
    """
    Get all contacts from the database with pagination.
    
    Parameters:
    - limit: Number of contacts to return (default: 100)
    - offset: Number of contacts to skip (default: 0)
    """
    try:
        contacts = await db.get_contacts(limit=limit, offset=offset)
        return contacts
    except Exception as e:
        print(f"Error in get_contacts: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching contacts: {str(e)}"
        )


@app.get("/api/contacts/{contact_id}", response_model=ContactResponse)
async def get_contact(contact_id: int):
    """Get a specific contact by ID."""
    try:
        contact = await db.get_contact_by_id(contact_id)
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        return contact
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_contact: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching the contact: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
