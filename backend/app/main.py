from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.models import ScrapeRequest, ScrapeResponse, ContactResponse
from app.database import db
from app.scraper import ScraperService
from app.enrichment import enrichment_service
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
    3. Upserts contacts in Supabase database (inserts new, updates existing)
    4. Returns counts of new and updated contacts
    """
    try:
        # Scrape data from Google Maps
        contacts, run_id, scrape_stats = await scraper.scrape_google_maps(
            keyword=request.keyword,
            location=request.location,
            limit=request.limit
        )
        
        if not contacts:
            return ScrapeResponse(
                message="No contacts found for the given search criteria",
                total_contacts=0,
                run_id=run_id
            )
        
        # Upsert contacts in database (insert new, update existing)
        upsert_result = await db.upsert_contacts_batch(contacts)
        
        new_count = upsert_result["new_count"]
        updated_count = upsert_result["updated_count"]
        
        # Build detailed message
        if new_count > 0 and updated_count > 0:
            message = f"Added {new_count} new contact(s) and updated {updated_count} existing contact(s)"
        elif new_count > 0:
            message = f"Added {new_count} new contact(s)"
        elif updated_count > 0:
            message = f"Updated {updated_count} existing contact(s) with latest data"
        else:
            message = "No changes - all contacts already exist with current data"
        
        return ScrapeResponse(
            message=message,
            total_contacts=new_count + updated_count,
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


@app.post("/api/enrich-emails")
async def enrich_emails():
    """
    Enrich all contacts with missing emails using OpenAI.
    
    This endpoint:
    1. Finds all contacts without emails (null or N/A)
    2. Uses OpenAI to extract emails from business websites
    3. Updates contacts with found emails or marks as N/A if not found
    4. Returns statistics about the enrichment process
    """
    try:
        result = await enrichment_service.enrich_all_contacts()
        
        return {
            "message": f"Enriched {result['enriched_count']} contact(s)",
            "enriched_count": result["enriched_count"],
            "skipped_count": result["skipped_count"],
            "failed_count": result["failed_count"],
            "total_processed": result["total_processed"]
        }
    
    except Exception as e:
        print(f"Error in enrich_emails: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while enriching emails: {str(e)}"
        )


@app.post("/api/reset-na-emails")
async def reset_na_emails():
    """
    Reset all emails marked as 'N/A' back to null.
    
    This allows re-trying email enrichment on contacts that were previously
    marked as having no email found.
    """
    try:
        count = await db.reset_na_emails_to_null()
        
        return {
            "message": f"Reset {count} email(s) from N/A to null",
            "reset_count": count
        }
    
    except Exception as e:
        print(f"Error in reset_na_emails: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while resetting emails: {str(e)}"
        )


@app.delete("/api/contacts")
async def delete_all_contacts():
    """
    Delete all contacts from the database.
    This is a destructive operation and cannot be undone.
    """
    try:
        count = await db.delete_all_contacts()
        
        return {
            "message": f"Deleted {count} contact(s)",
            "deleted_count": count
        }
    
    except Exception as e:
        print(f"Error in delete_all_contacts: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while deleting contacts: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
