from openai import OpenAI
from app.config import get_settings
from app.database import db
import re
from typing import Optional


class EnrichmentService:
    """Service for enriching contact data using OpenAI."""
    
    def __init__(self):
        settings = get_settings()
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    async def extract_email_from_website(self, website: str, business_name: str) -> Optional[str]:
        """
        Use OpenAI to extract email from a business website.
        Returns the email if found, "N/A" if not found, or None if error.
        """
        try:
            prompt = f"Find the contact email address from this website: {website}. Only output the email address. If no email is found, return exactly 'N/A'."
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert at finding contact information from websites. Only return email addresses or 'N/A' if none found."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=50,
                temperature=0.1
            )
            
            result = response.choices[0].message.content.strip()
            
            # Validate it's an email or N/A
            if result == "N/A":
                return "N/A"
            
            # Basic email validation
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if re.match(email_pattern, result):
                return result
            
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
