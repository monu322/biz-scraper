from apify_client import ApifyClient
from app.config import get_settings
from app.models import ContactCreate
from typing import List, Dict


class ScraperService:
    """Service for scraping data using Apify."""
    
    def __init__(self):
        settings = get_settings()
        self.client = ApifyClient(settings.apify_api_token)
    
    async def scrape_google_maps(self, keyword: str, location: str) -> tuple[List[ContactCreate], str, Dict]:
        """
        Scrape Google Maps using Apify's Google Maps Scraper.
        Extracts business information including emails when available.
        Returns a tuple of (contacts list, run_id).
        """
        try:
            # Prepare the Actor input with email extraction enabled
            run_input = {
                "searchStringsArray": [keyword],
                "locationQuery": location,
                "maxCrawledPlacesPerSearch": 20,  # Limit results
                "language": "en",
                "scrapeEmailFromWebsites": True,  # Visit websites to find emails
                "scrapePeopleAlsoSearch": False,   # Skip related searches
                "exportPlaceUrls": False,
                "includeWebResults": False,
            }
            
            # Run the Actor and wait for it to finish
            run = self.client.actor("compass/crawler-google-places").call(run_input=run_input)
            
            # Fetch results from the run's dataset
            dataset_items = []
            for item in self.client.dataset(run["defaultDatasetId"]).iterate_items():
                dataset_items.append(item)
            
            # Transform Apify results to ContactCreate models
            contacts = []
            for item in dataset_items:
                contact = ContactCreate(
                    name=item.get("title", "Unknown"),
                    email=self._extract_email(item),
                    company=item.get("title", None),
                    phone=item.get("phone", None),
                    address=item.get("address", None),
                    website=item.get("website", None),
                    rating=float(item.get("totalScore", 0)) if item.get("totalScore") else None,
                    reviews_count=int(item.get("reviewsCount", 0)) if item.get("reviewsCount") else None,
                    category=item.get("categoryName", None),
                    status="Lead"
                )
                contacts.append(contact)
            
            stats = {
                "scraped_count": len(contacts),
                "apify_run_id": run["id"]
            }
            
            return contacts, run["id"], stats
        
        except Exception as e:
            print(f"Error scraping Google Maps: {e}")
            raise
    
    def _extract_email(self, item: dict) -> str | None:
        """Extract email from various possible fields in the Apify result."""
        # Check common email fields
        email = item.get("email") or item.get("emailAddress") or item.get("contactEmail")
        
        # Check if emails is an array and get the first one
        if not email and item.get("emails"):
            emails = item.get("emails")
            if isinstance(emails, list) and len(emails) > 0:
                email = emails[0]
        
        # Check nested people data
        if not email and item.get("people"):
            people = item.get("people")
            if isinstance(people, list) and len(people) > 0:
                email = people[0].get("email")
        
        return email
