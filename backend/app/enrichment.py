from openai import OpenAI
from app.config import get_settings
from app.database import db
import re
import httpx
import asyncio
import signal
from typing import Optional
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError


# Thread pool for running regex operations with timeout
_executor = ThreadPoolExecutor(max_workers=4)

# Timeout for regex operations (seconds)
REGEX_TIMEOUT = 5

# Timeout for processing a single contact (seconds)
CONTACT_TIMEOUT = 30


def _run_regex_findall(pattern: str, text: str, flags: int = 0) -> list:
    """Run regex findall in a way that can be interrupted."""
    try:
        return re.findall(pattern, text, flags)
    except Exception:
        return []


class EnrichmentService:
    """Service for enriching contact data using OpenAI."""
    
    def __init__(self):
        settings = get_settings()
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    async def safe_regex_findall(self, pattern: str, text: str, flags: int = 0) -> list:
        """
        Run regex findall with timeout protection.
        Returns empty list if timeout or error.
        """
        try:
            loop = asyncio.get_event_loop()
            # Run regex in thread pool with timeout
            result = await asyncio.wait_for(
                loop.run_in_executor(_executor, _run_regex_findall, pattern, text, flags),
                timeout=REGEX_TIMEOUT
            )
            return result or []
        except asyncio.TimeoutError:
            print(f"  → Regex timeout (pattern took >{REGEX_TIMEOUT}s), skipping")
            return []
        except Exception as e:
            print(f"  → Regex error: {e}")
            return []
    
    def find_contact_page_urls(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """
        Find URLs that likely contain contact information.
        Returns list of potential contact page URLs.
        """
        contact_keywords = ['contact', 'about', 'reach', 'get-in-touch', 'connect', 'book', 'enquir', 'email']
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
            
            # Remove duplicates and limit to first 5 URLs
            seen = set()
            unique_urls = []
            for url in potential_urls:
                if url not in seen:
                    seen.add(url)
                    unique_urls.append(url)
                    if len(unique_urls) >= 5:
                        break
            
            return unique_urls
            
        except Exception as e:
            print(f"Error finding contact pages: {e}")
            return []
    
    def find_all_navigation_links(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """
        Find ALL internal navigation links on the page.
        Used as a fallback when contact page search fails.
        Looks for links in nav, header, menu elements and main menu links.
        """
        nav_urls = []
        base_domain = self.get_domain_from_url(base_url)
        
        try:
            # Look in common navigation containers
            nav_containers = soup.find_all(['nav', 'header'])
            
            # Also look for elements with common menu class names
            menu_classes = ['menu', 'nav', 'navigation', 'main-menu', 'primary-menu', 'site-nav']
            for cls in menu_classes:
                nav_containers.extend(soup.find_all(class_=lambda x: x and cls in x.lower() if x else False))
            
            # If no nav containers found, just use all links
            if not nav_containers:
                nav_containers = [soup]
            
            seen = set()
            for container in nav_containers:
                for link in container.find_all('a', href=True):
                    href = link.get('href', '')
                    href_lower = href.lower()
                    
                    # Skip non-page links
                    skip_patterns = ['#', 'javascript:', 'tel:', 'mailto:', '.pdf', '.jpg', '.png', 
                                   'twitter.com', 'facebook.com', 'instagram.com', 'linkedin.com',
                                   'youtube.com', 'tiktok.com']
                    if any(skip in href_lower for skip in skip_patterns):
                        continue
                    
                    # Make URL absolute
                    if href.startswith('/'):
                        full_url = base_url.rstrip('/') + href
                    elif href.startswith('http'):
                        # Only include if same domain
                        link_domain = self.get_domain_from_url(href)
                        if link_domain != base_domain:
                            continue
                        full_url = href
                    elif href and not href.startswith(('#', 'javascript:')):
                        full_url = base_url.rstrip('/') + '/' + href
                    else:
                        continue
                    
                    # Normalize and dedupe
                    full_url = full_url.split('?')[0].split('#')[0].rstrip('/')
                    if full_url not in seen and full_url != base_url.rstrip('/'):
                        seen.add(full_url)
                        nav_urls.append(full_url)
            
            print(f"  → Found {len(nav_urls)} navigation links to check")
            return nav_urls[:10]  # Limit to 10 links
            
        except Exception as e:
            print(f"Error finding navigation links: {e}")
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
    
    async def extract_emails_from_html(self, soup: BeautifulSoup, page_url: str = "", domain: str = "") -> list[str]:
        """
        Extract emails directly from HTML using multiple methods with timeout protection.
        1. Decode Cloudflare protected emails
        2. From mailto: links (BeautifulSoup)
        3. mailto: regex on raw HTML (backup)
        4. Search for @domain pattern in raw HTML
        5. General email regex on raw HTML
        """
        emails = []
        
        try:
            # Get raw HTML as string (preserve original case for email extraction)
            # Limit HTML size to prevent regex catastrophic backtracking
            raw_html = str(soup)
            if len(raw_html) > 500000:  # 500KB limit
                print(f"  → HTML too large ({len(raw_html)} chars), truncating")
                raw_html = raw_html[:500000]
            
            # 1. CLOUDFLARE EMAIL PROTECTION - Decode data-cfemail attributes
            for cf_element in soup.find_all(attrs={"data-cfemail": True}):
                encoded = cf_element.get("data-cfemail", "")
                if encoded:
                    decoded_email = self.decode_cloudflare_email(encoded)
                    if decoded_email and '@' in decoded_email:
                        if decoded_email not in emails:
                            emails.append(decoded_email)
                            print(f"  → Found Cloudflare protected email: {decoded_email}")
            
            # Also check for data-cfemail in raw HTML with regex (backup method) - with timeout
            cf_pattern = r'data-cfemail="([a-f0-9]+)"'
            cf_matches = await self.safe_regex_findall(cf_pattern, raw_html, re.IGNORECASE)
            for encoded in cf_matches:
                decoded_email = self.decode_cloudflare_email(encoded)
                if decoded_email and '@' in decoded_email:
                    if decoded_email not in emails:
                        emails.append(decoded_email)
                        print(f"  → Found Cloudflare protected email (regex): {decoded_email}")
            
            # 2. Extract from mailto: links using BeautifulSoup (no timeout needed, fast)
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                href_lower = href.lower()
                if 'mailto:' in href_lower:
                    mailto_idx = href_lower.find('mailto:')
                    email_part = href[mailto_idx + 7:]
                    email = email_part.split('?')[0].split('#')[0].strip()
                    email = email.strip().replace('%20', '').replace(' ', '')
                    if email and '@' in email and '.' in email.split('@')[-1]:
                        email_lower = email.lower()
                        # Filter out obvious false positives
                        if not any(fp in email_lower for fp in ['example.com', 'email.com', 'wixpress.com', 'sentry.io', '.png', '.jpg']):
                            if email_lower not in emails:
                                emails.append(email_lower)
                                print(f"  → Found mailto email (BeautifulSoup): {email_lower}")
            
            # EARLY RETURN: If we found valid mailto emails, return immediately (skip slow regex)
            if emails:
                print(f"  → Returning early with mailto emails: {emails}")
                return emails
            
            # 3. BACKUP: Search for mailto: in raw HTML with regex (with timeout) - only if no mailto found
            mailto_pattern = r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
            mailto_matches = await self.safe_regex_findall(mailto_pattern, raw_html, re.IGNORECASE)
            for email in mailto_matches:
                email_lower = email.lower()
                if email_lower not in emails:
                    emails.append(email_lower)
                    print(f"  → Found mailto email (regex): {email_lower}")
            
            # 4. Also check href attributes directly with regex (with timeout)
            href_mailto_pattern = r'href=["\']mailto:([^"\'?#]+)'
            href_mailto_matches = await self.safe_regex_findall(href_mailto_pattern, raw_html, re.IGNORECASE)
            for email in href_mailto_matches:
                email = email.strip().replace('%20', '').replace(' ', '')
                if '@' in email and '.' in email.split('@')[-1]:
                    email_lower = email.lower()
                    if email_lower not in emails:
                        emails.append(email_lower)
                        print(f"  → Found mailto email (href regex): {email_lower}")
            
            # 5. Search for @domain pattern specifically (with timeout)
            if domain:
                domain_pattern = rf'[a-zA-Z0-9._%+-]+@{re.escape(domain)}'
                found_domain_emails = await self.safe_regex_findall(domain_pattern, raw_html, re.IGNORECASE)
                for email in found_domain_emails:
                    email_lower = email.lower()
                    if email_lower not in emails:
                        emails.append(email_lower)
                        print(f"  → Found @{domain} email: {email_lower}")
            
            # 6. General email pattern search in raw HTML (with timeout)
            email_pattern = r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
            found_in_html = await self.safe_regex_findall(email_pattern, raw_html, re.IGNORECASE)
            for email in found_in_html:
                email_lower = email.lower()
                if email_lower not in emails:
                    emails.append(email_lower)
                    print(f"  → Found general email: {email_lower}")
            
            # 7. Search in visible text content too (limit text size)
            text_content = soup.get_text(separator=' ', strip=True)[:100000]  # Limit to 100KB
            text_emails = await self.safe_regex_findall(email_pattern, text_content, re.IGNORECASE)
            for email in text_emails:
                email_lower = email.lower()
                if email_lower not in emails:
                    emails.append(email_lower)
                    print(f"  → Found email in text: {email_lower}")
            
            # Filter out common false positives
            false_positive_patterns = [
                'example.com', 'email.com', 'domain.com', 'yoursite.com', 
                'wixpress.com', 'sentry.io', 'sentry-next.wixpress.com',
                '.png', '.jpg', '.gif', '.svg', '.webp', '.ico',
                'wordpress.com', 'squarespace.com', 'shopify.com',
                '@2x', '@3x',
                'noreply', 'no-reply', 'donotreply',
            ]
            
            filtered_emails = []
            for email in emails:
                email_lower = email.lower()
                if not any(fp in email_lower for fp in false_positive_patterns):
                    parts = email_lower.split('@')
                    if len(parts) == 2 and '.' in parts[1]:
                        tld = parts[1].split('.')[-1]
                        if len(tld) >= 2 and tld.isalpha():
                            filtered_emails.append(email_lower)
            
            if filtered_emails:
                print(f"  → Valid emails found: {filtered_emails}")
            
            return filtered_emails
            
        except Exception as e:
            print(f"Error extracting emails from HTML: {e}")
            return []
    
    def email_matches_domain(self, email: str, domain: str) -> bool:
        """Check if email domain matches the website domain."""
        try:
            if not email or not domain:
                return False
            email_domain = email.split('@')[-1].lower()
            website_domain = domain.lower()
            # Check if email domain matches or is a subdomain
            return email_domain == website_domain or email_domain.endswith('.' + website_domain)
        except:
            return False
    
    async def fetch_multiple_pages(self, website: str) -> list[str]:
        """
        Fetch homepage and potential contact/about pages.
        Returns list of directly found emails.
        Prioritizes emails matching the website domain.
        """
        all_emails = []
        domain_matched_emails = []
        
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
                    homepage_emails = await self.extract_emails_from_html(soup, website, domain)
                    
                    for email in homepage_emails:
                        if email not in all_emails:
                            all_emails.append(email)
                        if self.email_matches_domain(email, domain) and email not in domain_matched_emails:
                            domain_matched_emails.append(email)
                    
                    # If we found a domain-matched email on homepage, return it
                    if domain_matched_emails:
                        print(f"  → Domain-matched email found on homepage: {domain_matched_emails[0]}")
                        return domain_matched_emails
                    
                    # Find potential contact pages
                    contact_urls = self.find_contact_page_urls(soup, base_url)
                    
                    # 2. Fetch contact/about pages - always check if no domain match yet
                    for url in contact_urls[:5]:  # Limit to 5 contact pages
                        print(f"  → Fetching contact page: {url}")
                        try:
                            contact_response = await client.get(url, timeout=10.0)
                            contact_response.raise_for_status()
                            contact_soup = BeautifulSoup(contact_response.text, 'html.parser')
                            
                            # Extract emails from this page
                            page_emails = await self.extract_emails_from_html(contact_soup, url, domain)
                            for email in page_emails:
                                if email not in all_emails:
                                    all_emails.append(email)
                                if self.email_matches_domain(email, domain) and email not in domain_matched_emails:
                                    domain_matched_emails.append(email)
                            
                            # If we found a domain match, we can stop
                            if domain_matched_emails:
                                print(f"  → Domain-matched email found on {url}: {domain_matched_emails[0]}")
                                return domain_matched_emails
                                
                        except Exception as e:
                            print(f"  → Could not fetch {url}: {e}")
                            continue
                    
                    # 3. FALLBACK: If still no email found, check ALL navigation links
                    if not all_emails and not domain_matched_emails:
                        print(f"  → No email found yet, checking all navigation links...")
                        nav_urls = self.find_all_navigation_links(soup, base_url)
                        
                        # Filter out URLs we've already checked
                        checked_urls = set([website] + contact_urls)
                        nav_urls = [url for url in nav_urls if url not in checked_urls]
                        
                        for url in nav_urls[:8]:  # Check up to 8 more pages
                            print(f"  → Checking nav link: {url}")
                            try:
                                nav_response = await client.get(url, timeout=8.0)
                                nav_response.raise_for_status()
                                nav_soup = BeautifulSoup(nav_response.text, 'html.parser')
                                
                                # Extract emails from this page
                                page_emails = await self.extract_emails_from_html(nav_soup, url, domain)
                                for email in page_emails:
                                    if email not in all_emails:
                                        all_emails.append(email)
                                    if self.email_matches_domain(email, domain) and email not in domain_matched_emails:
                                        domain_matched_emails.append(email)
                                
                                # If we found a domain match, we can stop
                                if domain_matched_emails:
                                    print(f"  → Domain-matched email found on {url}: {domain_matched_emails[0]}")
                                    return domain_matched_emails
                                    
                            except Exception as e:
                                print(f"  → Could not fetch nav link {url}: {e}")
                                continue
                    
                except Exception as e:
                    print(f"  → Error fetching homepage: {e}")
                    return ["WEBSITE_ERROR"]  # Special marker for website errors
            
            # If no domain-matched email, return all emails (first one will be used)
            if all_emails:
                print(f"  → No domain-matched email, using: {all_emails[0]}")
            return all_emails
            
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
            return "no email found"
            
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
    
    async def enrich_contacts_by_niche(self, niche_id: int) -> dict:
        """
        Enrich contacts for a specific niche that don't have emails or have N/A.
        Returns stats about the enrichment process.
        """
        try:
            # Get contacts for this niche
            contacts = await db.get_contacts_by_niche(niche_id, limit=1000)
            
            enriched_count = 0
            skipped_count = 0
            failed_count = 0
            
            for contact in contacts:
                # Skip if email field has ANY value (already processed)
                email = contact.get("email")
                if email:
                    skipped_count += 1
                    continue
                
                # If no website, mark as "No website"
                if not contact.get("website"):
                    await db.update_contact_email(contact["id"], "No website")
                    enriched_count += 1
                    print(f"  → {contact['name']}: No website")
                    continue
                
                # Try to find email
                print(f"Enriching {contact['name']}...")
                email = await self.extract_email_from_website(
                    contact["website"],
                    contact["name"]
                )
                
                if email:
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
            print(f"Error in enrich_contacts_by_niche: {e}")
            raise
    
    async def enrich_contacts_by_niche_streaming(self, niche_id: int):
        """
        Enrich contacts for a specific niche with streaming progress updates.
        Yields progress updates as JSON strings for SSE.
        """
        try:
            # Get ALL contacts for this niche (no limit)
            contacts = await db.get_all_contacts_by_niche(niche_id)
            total = len(contacts)
            
            enriched_count = 0
            skipped_count = 0
            failed_count = 0
            processed = 0
            
            # Initial progress
            yield {
                "type": "start",
                "total": total,
                "processed": 0,
                "current": None,
                "message": f"Starting enrichment for {total} contacts..."
            }
            
            for contact in contacts:
                processed += 1
                
                # Skip if email field has ANY value (already processed)
                email = contact.get("email")
                if email:
                    skipped_count += 1
                    yield {
                        "type": "progress",
                        "total": total,
                        "processed": processed,
                        "current": contact["name"],
                        "result": "skipped",
                        "message": f"Skipped (already processed)"
                    }
                    continue
                
                # If no website, mark as "No website"
                if not contact.get("website"):
                    await db.update_contact_email(contact["id"], "No website")
                    enriched_count += 1
                    yield {
                        "type": "progress",
                        "total": total,
                        "processed": processed,
                        "current": contact["name"],
                        "result": "no_website",
                        "message": "No website"
                    }
                    continue
                
                # Progress update: starting to enrich
                yield {
                    "type": "progress",
                    "total": total,
                    "processed": processed,
                    "current": contact["name"],
                    "result": "processing",
                    "message": f"Checking {contact['website']}..."
                }
                
                # Try to find email with timeout protection
                try:
                    found_email = await asyncio.wait_for(
                        self.extract_email_from_website(
                            contact["website"],
                            contact["name"]
                        ),
                        timeout=CONTACT_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    print(f"  → TIMEOUT: Contact {contact['name']} took >{CONTACT_TIMEOUT}s, skipping")
                    found_email = "timeout"
                except asyncio.CancelledError:
                    print(f"  → CANCELLED: Enrichment was stopped by user")
                    raise  # Re-raise to stop the generator
                
                if found_email == "timeout":
                    # Mark as timeout so we don't retry forever
                    await db.update_contact_email(contact["id"], "timeout")
                    failed_count += 1
                    yield {
                        "type": "progress",
                        "total": total,
                        "processed": processed,
                        "current": contact["name"],
                        "result": "timeout",
                        "message": f"Timeout (>{CONTACT_TIMEOUT}s) - skipped"
                    }
                elif found_email:
                    await db.update_contact_email(contact["id"], found_email)
                    enriched_count += 1
                    yield {
                        "type": "progress",
                        "total": total,
                        "processed": processed,
                        "current": contact["name"],
                        "result": "found",
                        "email": found_email,
                        "message": f"Found: {found_email}"
                    }
                else:
                    failed_count += 1
                    yield {
                        "type": "progress",
                        "total": total,
                        "processed": processed,
                        "current": contact["name"],
                        "result": "not_found",
                        "message": "No email found"
                    }
            
            # Final summary
            yield {
                "type": "complete",
                "total": total,
                "processed": total,
                "enriched_count": enriched_count,
                "skipped_count": skipped_count,
                "failed_count": failed_count,
                "message": f"Complete! Found {enriched_count} emails."
            }
            
        except Exception as e:
            print(f"Error in enrich_contacts_by_niche_streaming: {e}")
            yield {
                "type": "error",
                "message": str(e)
            }


# Singleton instance
enrichment_service = EnrichmentService()
