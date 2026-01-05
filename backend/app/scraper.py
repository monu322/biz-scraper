import asyncio
import re
from apify_client import ApifyClient
from app.config import get_settings
from app.models import ContactCreate
from typing import List, Dict, AsyncGenerator


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
            limit: Maximum number of results to scrape (default: 20, max: 500)
        """
        try:
            # Ensure limit is within bounds
            limit = max(1, min(limit, 500))
            
            # Prepare the Actor input with email extraction (reviews disabled to save API credits)
            run_input = {
                "searchStringsArray": [keyword],
                "locationQuery": location,
                "maxCrawledPlacesPerSearch": limit,  # Use provided limit
                "language": "en",
                "scrapeEmailFromWebsites": True,  # Visit websites to find emails
                "scrapePeopleAlsoSearch": False,   # Skip related searches
                "exportPlaceUrls": False,
                "includeWebResults": False,
                "scrapeReviewsPersonalData": False,  # Disabled to save API credits
                "maxReviews": 0,  # Disabled to save API credits
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
        """Extract reviews from the Apify result (first 20)."""
        raw_reviews = item.get("reviews") or item.get("reviewsData") or []
        
        if not isinstance(raw_reviews, list) or len(raw_reviews) == 0:
            return None
        
        # Limit to first 20 reviews
        raw_reviews = raw_reviews[:20]
        
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

    def _item_to_contact(self, item: dict) -> ContactCreate:
        """Convert a single Apify item to a ContactCreate model."""
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
        return contact

    def _parse_progress_from_status(self, status_message: str, limit: int) -> tuple[int, str]:
        """Parse progress count from Apify status message."""
        if not status_message:
            return 0, "Starting..."
        
        # Try to match patterns like "📊 5 places scraped" or "📌 Place scraped"
        # Pattern: "📊 X places scraped"
        match = re.search(r'📊\s*(\d+)\s*places?\s*scraped', status_message)
        if match:
            return int(match.group(1)), status_message
        
        # Pattern: Looking for "unique: X" in the status
        match = re.search(r'unique:\s*(\d+)', status_message)
        if match:
            return int(match.group(1)), status_message
        
        # Pattern: "X/Y" anywhere
        match = re.search(r'(\d+)/(\d+)', status_message)
        if match:
            return int(match.group(1)), status_message
        
        return 0, status_message

    async def scrape_google_maps_streaming(
        self, keyword: str, location: str, limit: int = 20
    ) -> AsyncGenerator[Dict, None]:
        """
        Scrape Google Maps with REAL-TIME streaming progress updates.
        Uses polling to get live status from Apify as each place is scraped.
        
        Args:
            keyword: Search keyword (e.g., "hvac", "restaurants")
            location: Location to search in (e.g., "London", "New York")
            limit: Maximum number of results to scrape (default: 20, max: 500)
        """
        try:
            # Ensure limit is within bounds
            limit = max(1, min(limit, 500))
            
            # Yield start event
            yield {
                "type": "start",
                "message": f"🚀 Starting scrape for '{keyword}' in '{location}'...",
                "total": limit,
                "processed": 0,
                "current": None
            }
            
            # Prepare the Actor input (reviews disabled to save API credits)
            run_input = {
                "searchStringsArray": [keyword],
                "locationQuery": location,
                "maxCrawledPlacesPerSearch": limit,
                "language": "en",
                "scrapeEmailFromWebsites": True,
                "scrapePeopleAlsoSearch": False,
                "exportPlaceUrls": False,
                "includeWebResults": False,
                "scrapeReviewsPersonalData": False,  # Disabled to save API credits
                "maxReviews": 0,  # Disabled to save API credits
            }
            
            # Start the Actor (non-blocking) - returns immediately
            print(f"🔍 Starting Apify actor for '{keyword}' in '{location}'...")
            run = self.client.actor("compass/crawler-google-places").start(run_input=run_input)
            run_id = run["id"]
            print(f"✅ Apify run started: {run_id}")
            
            # Yield initial scraping event
            yield {
                "type": "scraping",
                "message": f"🔍 Scraping Google Maps for '{keyword}' in '{location}'...",
                "total": limit,
                "processed": 0,
                "current": None
            }
            
            # Poll for real-time progress updates
            last_processed = 0
            last_status = ""
            poll_count = 0
            max_polls = 300  # Max 5 minutes (300 * 1 second)
            
            while poll_count < max_polls:
                poll_count += 1
                
                # Get current run status
                run_info = self.client.run(run_id).get()
                status = run_info.get("status", "RUNNING")
                status_message = run_info.get("statusMessage", "")
                
                # Parse progress from status message
                processed, display_message = self._parse_progress_from_status(status_message, limit)
                
                # Only yield if something changed
                if processed != last_processed or status_message != last_status:
                    last_processed = processed
                    last_status = status_message
                    
                    # Extract current place name if available (from status like "📌 Place scraped successfully")
                    current_place = None
                    place_match = re.search(r'"placeUrl"[^}]*"([^"]+)"', status_message)
                    if place_match:
                        # Extract business name from URL if possible
                        url_match = re.search(r'query=([^&]+)', place_match.group(1))
                        if url_match:
                            current_place = url_match.group(1).replace('+', ' ').replace('%20', ' ')
                    
                    yield {
                        "type": "scraping",
                        "message": f"📊 {processed}/{limit} places found..." if processed > 0 else display_message,
                        "total": limit,
                        "processed": processed,
                        "current": current_place
                    }
                
                # Check if run completed
                if status in ["SUCCEEDED", "FINISHED"]:
                    print(f"✅ Apify run completed: {status}")
                    break
                elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                    raise Exception(f"Apify run failed with status: {status}. Message: {status_message}")
                
                # Wait before next poll
                await asyncio.sleep(1)
            
            # Fetch results from the run's dataset
            print("📥 Fetching results from Apify dataset...")
            dataset_items = []
            for item in self.client.dataset(run_info["defaultDatasetId"]).iterate_items():
                dataset_items.append(item)
            
            total = len(dataset_items)
            print(f"📊 Retrieved {total} contacts from Apify")
            
            # Yield processing event
            yield {
                "type": "processing",
                "message": f"✅ Found {total} contacts! Saving to database...",
                "total": total,
                "processed": 0,
                "current": None
            }
            
            # Convert items to contacts and yield each one
            contacts = []
            for i, item in enumerate(dataset_items):
                contact = self._item_to_contact(item)
                contacts.append(contact)
                
                # Yield progress for each contact being saved
                yield {
                    "type": "saving",
                    "message": f"💾 Saving {i + 1}/{total}: {contact.name}",
                    "total": total,
                    "processed": i + 1,
                    "current": contact.name,
                    "contact": {
                        "name": contact.name,
                        "email": contact.email,
                        "phone": contact.phone,
                        "website": contact.website
                    }
                }
            
            # Yield complete event with all contacts
            yield {
                "type": "complete",
                "message": f"🎉 Scraped {total} contacts successfully!",
                "total": total,
                "processed": total,
                "current": None,
                "contacts": contacts,
                "run_id": run_id
            }
        
        except Exception as e:
            print(f"❌ Error scraping Google Maps: {e}")
            yield {
                "type": "error",
                "message": str(e),
                "total": 0,
                "processed": 0,
                "current": None
            }
