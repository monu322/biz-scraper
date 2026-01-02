from apify_client import ApifyClient
from app.config import get_settings
from app.models import ContactCreate
from typing import List, Dict


class ScraperService:
    """Service for scraping data using Apify."""
    
    def __init__(self):
        settings = get_settings()
        self.client = ApifyClient(settings.apify_api_token)
    
    async def scrape_google_maps(self, keyword: str, location: str, limit: int = 20) -> tuple[List[ContactCreate], str, Dict]:
        """
        Scrape Google Maps using Apify's Google Maps Scraper.
        Extracts business information including emails when available.
        Returns a tuple of (contacts list, run_id, stats).
        
        Args:
            keyword: Search keyword (e.g., "hvac", "restaurants")
            location: Location to search in (e.g., "London", "New York")
            limit: Maximum number of results to scrape (default: 20, max: 50)
        """
        try:
            # Ensure limit is within bounds
            limit = max(1, min(limit, 50))
            
            # Prepare the Actor input with email extraction and reviews enabled
            run_input = {
                "searchStringsArray": [keyword],
                "locationQuery": location,
                "maxCrawledPlacesPerSearch": limit,  # Use provided limit
                "language": "en",
                "scrapeEmailFromWebsites": True,  # Visit websites to find emails
                "scrapePeopleAlsoSearch": False,   # Skip related searches
                "exportPlaceUrls": False,
                "includeWebResults": False,
                "scrapeReviewsPersonalData": True,  # Get reviewer info
                "maxReviews": 50,  # Get first 50 reviews per business
                "reviewsSort": "mostRelevant",  # Sort by most relevant
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
                # Extract coordinates from location object
                location = item.get("location", {})
                lat = location.get("lat") if isinstance(location, dict) else None
                lng = location.get("lng") if isinstance(location, dict) else None
                
                # Extract opening hours
                opening_hours = self._extract_opening_hours(item)
                
                # Extract services and products from additionalInfo or categories
                services = self._extract_list_field(item, ["categories", "additionalCategories"])
                
                # Extract reviews (first 50)
                reviews = self._extract_reviews(item)
                
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
                    status="Lead",
                    latitude=float(lat) if lat else None,
                    longitude=float(lng) if lng else None,
                    # Additional business details
                    description=item.get("description", None),
                    opening_hours=opening_hours,
                    services=services,
                    products=None,  # Will be filled if available
                    price_range=item.get("price", None) or item.get("priceLevel", None),
                    google_maps_url=item.get("url", None),
                    place_id=item.get("placeId", None),
                    reviews=reviews,  # First 50 reviews
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
    
    def _extract_opening_hours(self, item: dict) -> dict | None:
        """Extract opening hours from various possible fields."""
        # Try different field names used by different scrapers
        hours = item.get("openingHours") or item.get("hours") or item.get("workingHours")
        
        if hours:
            # If it's already a dict, return it
            if isinstance(hours, dict):
                return hours
            # If it's a list of strings, convert to dict
            if isinstance(hours, list):
                return {"schedule": hours}
        
        return None
    
    def _extract_list_field(self, item: dict, field_names: list) -> list | None:
        """Extract a list field from various possible field names."""
        for field_name in field_names:
            value = item.get(field_name)
            if value:
                if isinstance(value, list):
                    return value
                if isinstance(value, str):
                    return [value]
        return None
    
    def _extract_reviews(self, item: dict) -> list | None:
        """Extract reviews from the Apify result (first 50)."""
        raw_reviews = item.get("reviews") or item.get("reviewsData") or []
        
        if not isinstance(raw_reviews, list) or len(raw_reviews) == 0:
            return None
        
        # Limit to first 50 reviews
        raw_reviews = raw_reviews[:50]
        
        reviews = []
        for review in raw_reviews:
            if not isinstance(review, dict):
                continue
            
            # Extract review data with different possible field names
            extracted = {
                "author": review.get("name") or review.get("author") or review.get("reviewerName") or "Anonymous",
                "rating": review.get("stars") or review.get("rating") or review.get("score"),
                "text": review.get("text") or review.get("reviewText") or review.get("comment") or "",
                "date": review.get("publishedAtDate") or review.get("date") or review.get("time") or review.get("publishAt"),
                "response": review.get("responseFromOwnerText") or review.get("ownerResponse") or review.get("response"),
                "likes": review.get("likesCount") or review.get("likes") or 0,
            }
            reviews.append(extracted)
        
        return reviews if reviews else None
