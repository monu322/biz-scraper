from supabase import create_client, Client
from app.config import get_settings
from app.models import ContactCreate
from typing import List, Optional


class Database:
    """Database service for Supabase operations."""
    
    def __init__(self):
        settings = get_settings()
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
    
    async def create_contact(self, contact: ContactCreate) -> dict:
        """Create a new contact in the database."""
        try:
            response = self.client.table("contacts").insert({
                "name": contact.name,
                "email": contact.email,
                "company": contact.company,
                "phone": contact.phone,
                "address": contact.address,
                "website": contact.website,
                "rating": contact.rating,
                "reviews_count": contact.reviews_count,
                "category": contact.category,
                "status": contact.status,
            }).execute()
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error creating contact: {e}")
            raise
    
    async def create_contacts_batch(self, contacts: List[ContactCreate]) -> List[dict]:
        """Create multiple contacts in batch."""
        try:
            contacts_data = [
                {
                    "name": contact.name,
                    "email": contact.email,
                    "company": contact.company,
                    "phone": contact.phone,
                    "address": contact.address,
                    "website": contact.website,
                    "rating": contact.rating,
                    "reviews_count": contact.reviews_count,
                    "category": contact.category,
                    "status": contact.status,
                }
                for contact in contacts
            ]
            
            response = self.client.table("contacts").insert(contacts_data).execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"Error creating contacts batch: {e}")
            raise
    
    async def upsert_contacts_batch(self, contacts: List[ContactCreate]) -> dict:
        """
        Upsert multiple contacts - insert new, update existing.
        Returns dict with counts of new and updated contacts.
        """
        try:
            new_contacts = []
            updated_contacts = []
            
            # Get all existing contacts to check for duplicates
            existing_response = self.client.table("contacts").select("*").execute()
            existing_contacts = existing_response.data if existing_response.data else []
            
            # Create lookup maps for fast matching
            existing_by_phone = {c["phone"]: c for c in existing_contacts if c.get("phone")}
            existing_by_name_address = {
                (c["name"], c.get("address")): c 
                for c in existing_contacts 
                if c.get("name") and c.get("address")
            }
            
            for contact in contacts:
                # Check if contact exists by phone or name+address
                existing = None
                if contact.phone and contact.phone in existing_by_phone:
                    existing = existing_by_phone[contact.phone]
                elif contact.name and contact.address:
                    existing = existing_by_name_address.get((contact.name, contact.address))
                
                contact_data = {
                    "name": contact.name,
                    "email": contact.email,
                    "company": contact.company,
                    "phone": contact.phone,
                    "address": contact.address,
                    "website": contact.website,
                    "rating": contact.rating,
                    "reviews_count": contact.reviews_count,
                    "category": contact.category,
                    "status": contact.status,
                }
                
                if existing:
                    # Update existing contact
                    self.client.table("contacts") \
                        .update(contact_data) \
                        .eq("id", existing["id"]) \
                        .execute()
                    updated_contacts.append(existing["id"])
                else:
                    # Insert new contact
                    result = self.client.table("contacts").insert(contact_data).execute()
                    if result.data:
                        new_contacts.append(result.data[0]["id"])
            
            return {
                "new_count": len(new_contacts),
                "updated_count": len(updated_contacts),
                "total_processed": len(contacts)
            }
        except Exception as e:
            print(f"Error upserting contacts batch: {e}")
            raise
    
    async def get_contacts(self, limit: int = 100, offset: int = 0) -> List[dict]:
        """Get all contacts with pagination."""
        try:
            response = self.client.table("contacts") \
                .select("*") \
                .order("created_at", desc=True) \
                .range(offset, offset + limit - 1) \
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            print(f"Error getting contacts: {e}")
            raise
    
    async def get_contact_by_id(self, contact_id: int) -> Optional[dict]:
        """Get a specific contact by ID."""
        try:
            response = self.client.table("contacts") \
                .select("*") \
                .eq("id", contact_id) \
                .execute()
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error getting contact: {e}")
            raise
    
    async def update_contact_email(self, contact_id: int, email: str) -> Optional[dict]:
        """Update a contact's email address."""
        try:
            response = self.client.table("contacts") \
                .update({"email": email}) \
                .eq("id", contact_id) \
                .execute()
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error updating contact email: {e}")
            raise
    
    async def reset_na_emails_to_null(self) -> int:
        """Reset all emails with value 'N/A' to null."""
        try:
            response = self.client.table("contacts") \
                .update({"email": None}) \
                .eq("email", "N/A") \
                .execute()
            
            return len(response.data) if response.data else 0
        except Exception as e:
            print(f"Error resetting N/A emails: {e}")
            raise
    
    async def delete_all_contacts(self) -> int:
        """Delete all contacts from the database."""
        try:
            # First get count
            count_response = self.client.table("contacts").select("id").execute()
            count = len(count_response.data) if count_response.data else 0
            
            # Delete all contacts
            if count > 0:
                self.client.table("contacts").delete().neq("id", -1).execute()
            
            return count
        except Exception as e:
            print(f"Error deleting all contacts: {e}")
            raise


# Singleton instance
db = Database()
