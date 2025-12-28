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


# Singleton instance
db = Database()
