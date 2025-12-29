from openai import OpenAI
from app.config import get_settings
from app.database import db
import re
import httpx
from typing import Optional
from bs4 import BeautifulSoup


class EnrichmentService:
    """Service for enriching contact data using OpenAI."""
    
    def __init__(self):
        settings = get_settings()
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    def find_contact_page_urls(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """
        Find URLs that likely contain contact information.
        Returns list of potential contact page URLs.
        """
        contact_keywords = ['contact', 'about', 'reach', 'get-in-touch', 'connect']
        potential_urls = []
        
        try:
            # Find all links
            for link in soup.find_all('a', href=True):
                href = link.get('href', '').lower()
                link_text = link.get_text('', strip=True).lower()
                
                # Check if link or text contains contact keywords
                if any(keyword in href or keyword in link_text for keyword in contact_keywords):
                    # Make URL absolute
                    if href.startswith('/'):
                        full_url = base_url.rstrip('/') + href
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        full_url = base_url.rstrip('/') + '/' + href
                    
                    potential_urls.append(full_url)
            
            # Remove duplicates and limit to first 3 URLs
            seen = set()
            unique_urls = []
            for url in potential_urls:
                if url not in seen:
                    seen.add(url)
                    unique_urls.append(url)
                    if len(unique_urls) >= 3:
                        break
            
            return unique_urls
            
        except Exception as e:
            print(f"Error finding contact pages: {e}")
            return []
    
    async def fetch_website_content(self, website: str) -> Optional[str]:
        """
        Fetch and extract text content from a website.
        Returns cleaned text or None if error.
        """
        try:
            # Ensure URL has protocol
            if not website.startswith(('http://', 'https://')):
                website = 'https://' + website
            
            # Fetch website with timeout
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(website)
                response.raise_for_status()
                
                # Parse HTML
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Remove script and style elements
                for script in soup(["script", "style", "nav", "footer"]):
                    script.decompose()
                
                # Get text and clean it
                text = soup.get_text(separator=' ', strip=True)
                
                # Limit to first 3000 characters (to stay within token limits)
                text = text[:3000]
                
                return text
                
        except Exception as e:
            print(f"Error fetching website {website}: {e}")
            return None
    
    async def fetch_multiple_pages(self, website: str) -> str:
        """
        Fetch homepage and potential contact/about pages.
        Returns combined text from all pages.
        """
        all_text = []
        
        try:
            # Ensure URL has protocol
            if not website.startswith(('http://', 'https://')):
                website = 'https://' + website
            
            base_url = website
            
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                # 1. Fetch homepage
                print(f"  → Fetching homepage: {website}")
                try:
                    response = await client.get(website)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Find potential contact pages
                    contact_urls = self.find_contact_page_urls(soup, base_url)
                    
                    # Remove scripts/styles and get text
                    for script in soup(["script", "style", "nav", "footer"]):
                        script.decompose()
                    homepage_text = soup.get_text(separator=' ', strip=True)[:3000]
                    all_text.append(homepage_text)
                    
                    # 2. Fetch contact/about pages
                    for url in contact_urls[:2]:  # Limit to 2 additional pages
                        print(f"  → Fetching contact page: {url}")
                        try:
                            contact_response = await client.get(url, timeout=5.0)
                            contact_response.raise_for_status()
                            contact_soup = BeautifulSoup(contact_response.text, 'html.parser')
                            
                            for script in contact_soup(["script", "style", "nav", "footer"]):
                                script.decompose()
                            contact_text = contact_soup.get_text(separator=' ', strip=True)[:2000]
                            all_text.append(contact_text)
                            
                        except Exception as e:
                            print(f"  → Could not fetch {url}: {e}")
                            continue
                    
                except Exception as e:
                    print(f"  → Error fetching homepage: {e}")
                    return ""
            
            # Combine all text
            combined_text = ' '.join(all_text)
            return combined_text[:5000]  # Limit total to 5000 chars
            
        except Exception as e:
            print(f"Error in fetch_multiple_pages: {e}")
            return ""
    
    async def extract_email_from_website(self, website: str, business_name: str) -> Optional[str]:
        """
        Fetch website content (homepage + contact pages) and use OpenAI to extract email.
        Returns the email if found, "N/A" if not found, or None if error.
        """
        try:
            # Fetch multiple pages (homepage + contact/about pages)
            website_text = await self.fetch_multiple_pages(website)
            
            if not website_text:
                print(f"  → Could not fetch any website content")
                return "N/A"
            
            # Ask OpenAI to find email in the text
            prompt = f"Find the contact email address from this website text (from homepage and contact pages). Only output the email address. If no email is found, return exactly 'N/A'.\n\nWebsite text:\n{website_text}"
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert at finding contact email addresses from website text. Only return a single email address or 'N/A' if none found. Do not include any explanation."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=100,
                temperature=0.1
            )
            
            result = response.choices[0].message.content.strip()
            
            # Clean up the result (remove any extra text)
            # Try to extract email if it's mixed with text
            email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', result)
            if email_match:
                return email_match.group(0)
            
            # Check if it's exactly N/A
            if result.upper() == "N/A" or "no email" in result.lower():
                return "N/A"
            
            return "N/A"
            
        except Exception as e:
            print(f"Error extracting email for {business_name}: {e}")
            return None
    
    async def enrich_all_contacts(self) -> dict:
        """
        Enrich all contacts that don't have emails or have N/A.
        Returns stats about the enrichment process.
        """
        try:
            # Get all contacts
            contacts = await db.get_contacts(limit=1000)
            
            enriched_count = 0
            skipped_count = 0
            failed_count = 0
            
            for contact in contacts:
                # Skip if:
                # 1. Already has email (not null and not N/A)
                # 2. No website available
                # 3. Email is already N/A (already tried)
                if contact.get("email") == "N/A":
                    skipped_count += 1
                    continue
                
                if contact.get("email"):  # Has a real email
                    skipped_count += 1
                    continue
                
                if not contact.get("website"):  # No website to check
                    skipped_count += 1
                    continue
                
                # Try to find email
                print(f"Enriching {contact['name']}...")
                email = await self.extract_email_from_website(
                    contact["website"],
                    contact["name"]
                )
                
                if email:
                    # Update contact with found email or N/A
                    await db.update_contact_email(contact["id"], email)
                    enriched_count += 1
                    print(f"  → Found: {email}")
                else:
                    failed_count += 1
                    print(f"  → Failed to enrich")
            
            return {
                "enriched_count": enriched_count,
                "skipped_count": skipped_count,
                "failed_count": failed_count,
                "total_processed": len(contacts)
            }
            
        except Exception as e:
            print(f"Error in enrich_all_contacts: {e}")
            raise


# Singleton instance
enrichment_service = EnrichmentService()
