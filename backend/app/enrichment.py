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
    
    def get_domain_from_url(self, url: str) -> str:
        """Extract domain from URL (e.g., uniflair.co.uk from http://www.uniflair.co.uk/)"""
        try:
            # Remove protocol
            if '://' in url:
                url = url.split('://')[1]
            # Remove www.
            if url.startswith('www.'):
                url = url[4:]
            # Remove path
            domain = url.split('/')[0]
            return domain.lower()
        except:
            return ""
    
    def decode_cloudflare_email(self, encoded: str) -> str:
        """
        Decode Cloudflare email protection.
        The data-cfemail attribute contains hex-encoded email where first 2 chars are XOR key.
        """
        try:
            # First 2 hex chars are the XOR key
            key = int(encoded[:2], 16)
            # Rest are the encoded email characters
            decoded = ""
            for i in range(2, len(encoded), 2):
                char_code = int(encoded[i:i+2], 16) ^ key
                decoded += chr(char_code)
            return decoded.lower()
        except Exception as e:
            print(f"  → Error decoding Cloudflare email: {e}")
            return ""
    
    def extract_emails_from_html(self, soup: BeautifulSoup, page_url: str = "", domain: str = "") -> list[str]:
        """
        Extract emails directly from HTML:
        1. Decode Cloudflare protected emails
        2. From mailto: links
        3. Search for @domain pattern in raw HTML
        4. General email regex on raw HTML
        """
        emails = []
        
        try:
            # Get raw HTML as string
            raw_html = str(soup)
            
            # 1. CLOUDFLARE EMAIL PROTECTION - Decode data-cfemail attributes
            for cf_element in soup.find_all(attrs={"data-cfemail": True}):
                encoded = cf_element.get("data-cfemail", "")
                if encoded:
                    decoded_email = self.decode_cloudflare_email(encoded)
                    if decoded_email and '@' in decoded_email:
                        if decoded_email not in emails:
                            emails.append(decoded_email)
                            print(f"  → Found Cloudflare protected email: {decoded_email}")
            
            # Also check for data-cfemail in raw HTML with regex (backup method)
            cf_pattern = r'data-cfemail="([a-f0-9]+)"'
            cf_matches = re.findall(cf_pattern, raw_html, re.IGNORECASE)
            for encoded in cf_matches:
                decoded_email = self.decode_cloudflare_email(encoded)
                if decoded_email and '@' in decoded_email:
                    if decoded_email not in emails:
                        emails.append(decoded_email)
                        print(f"  → Found Cloudflare protected email (regex): {decoded_email}")
            
            # 2. Extract from mailto: links
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                if 'mailto:' in href.lower():
                    # Extract email from mailto:email@example.com
                    start = href.lower().find('mailto:') + 7
                    email = href[start:].split('?')[0].strip()
                    if email and '@' in email:
                        if email.lower() not in emails:
                            emails.append(email.lower())
                            print(f"  → Found mailto email: {email}")
            
            # 3. Search for @domain pattern specifically (most reliable)
            if domain:
                domain_pattern = rf'[a-zA-Z0-9._%+-]+@{re.escape(domain)}'
                found_domain_emails = re.findall(domain_pattern, raw_html, re.IGNORECASE)
                for email in found_domain_emails:
                    email_lower = email.lower()
                    if email_lower not in emails:
                        emails.append(email_lower)
                        print(f"  → Found @{domain} email: {email}")
            
            # 4. General email pattern search
            email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
            found_in_html = re.findall(email_pattern, raw_html, re.IGNORECASE)
            for email in found_in_html:
                email_lower = email.lower()
                if email_lower not in emails:
                    emails.append(email_lower)
                    print(f"  → Found general email: {email}")
            
            # Filter out common false positives
            filtered_emails = [e for e in emails if not any(
                x in e.lower() for x in ['example.com', 'email.com', 'domain.com', 'yoursite.com', 'wixpress.com', 'sentry.io', '.png', '.jpg', '.gif']
            )]
            
            if filtered_emails:
                print(f"  → Emails found: {filtered_emails}")
            
            return filtered_emails
            
        except Exception as e:
            print(f"Error extracting emails from HTML: {e}")
            return []
    
    async def fetch_multiple_pages(self, website: str) -> list[str]:
        """
        Fetch homepage and potential contact/about pages.
        Returns list of directly found emails.
        """
        direct_emails = []
        
        try:
            # Ensure URL has protocol
            if not website.startswith(('http://', 'https://')):
                website = 'https://' + website
            
            base_url = website
            
            # Extract domain from URL for targeted email search
            domain = self.get_domain_from_url(website)
            print(f"  → Looking for emails @{domain}")
            
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                # 1. Fetch homepage
                print(f"  → Fetching homepage: {website}")
                try:
                    response = await client.get(website)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, 'html.parser')
                    
                    # Extract emails directly from HTML
                    homepage_emails = self.extract_emails_from_html(soup, website, domain)
                    direct_emails.extend(homepage_emails)
                    
                    # If email found on homepage, no need to check contact pages
                    if direct_emails:
                        print(f"  → Email found on homepage, skipping contact pages")
                        return direct_emails
                    
                    # Find potential contact pages (only if no email found on homepage)
                    contact_urls = self.find_contact_page_urls(soup, base_url)
                    
                    # 2. Fetch contact/about pages only if no email found yet
                    for url in contact_urls[:3]:  # Limit to 3 additional pages
                        print(f"  → Fetching contact page: {url}")
                        try:
                            contact_response = await client.get(url, timeout=10.0)
                            contact_response.raise_for_status()
                            contact_soup = BeautifulSoup(contact_response.text, 'html.parser')
                            
                            # Extract emails from this page too
                            page_emails = self.extract_emails_from_html(contact_soup, url, domain)
                            for email in page_emails:
                                if email not in direct_emails:
                                    direct_emails.append(email)
                            
                        except Exception as e:
                            print(f"  → Could not fetch {url}: {e}")
                            continue
                    
                except Exception as e:
                    print(f"  → Error fetching homepage: {e}")
                    return ["WEBSITE_ERROR"]  # Special marker for website errors
            
            return direct_emails
            
        except Exception as e:
            print(f"Error in fetch_multiple_pages: {e}")
            return ["WEBSITE_ERROR"]  # Special marker for website errors
    
    async def extract_email_from_website(self, website: str, business_name: str) -> Optional[str]:
        """
        Fetch website content (homepage + contact pages) and extract email.
        Uses direct extraction from HTML using mailto links and @domain regex.
        Returns the email if found, "N/A" if not found, "website error" if website is broken.
        """
        try:
            # Fetch multiple pages and extract emails directly
            direct_emails = await self.fetch_multiple_pages(website)
            
            # Check for website error marker
            if direct_emails and direct_emails[0] == "WEBSITE_ERROR":
                print(f"  → Website error - could not load website")
                return "website error"
            
            # If we found emails directly from mailto links or regex, use the first one
            if direct_emails:
                print(f"  → Using extracted email: {direct_emails[0]}")
                return direct_emails[0]
            
            print(f"  → No email found on website")
            return "N/A"
            
        except Exception as e:
            print(f"Error extracting email for {business_name}: {e}")
            return "website error"
    
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
