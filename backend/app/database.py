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
        Handles duplicate phone numbers gracefully by skipping.
        """
        try:
            new_contacts = []
            updated_contacts = []
            skipped_contacts = []
            
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
            
            # Track phones we're inserting in this batch to avoid duplicates within batch
            phones_in_batch = set()
            
            for contact in contacts:
                # Check if contact exists by phone or name+address
                existing = None
                if contact.phone and contact.phone in existing_by_phone:
                    existing = existing_by_phone[contact.phone]
                elif contact.name and contact.address:
                    existing = existing_by_name_address.get((contact.name, contact.address))
                
                # Skip if phone already exists in this batch (duplicate in scraped data)
                if contact.phone and contact.phone in phones_in_batch:
                    skipped_contacts.append(contact.name)
                    continue
                
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
                    "niche_id": contact.niche_id,
                    "latitude": contact.latitude,
                    "longitude": contact.longitude,
                }
                
                if existing:
                    # Update existing contact (don't overwrite niche_id if already set)
                    if existing.get("niche_id") and contact.niche_id:
                        # Keep existing niche_id if different, or update to new one
                        pass  # Let it update with new niche_id
                    
                    try:
                        self.client.table("contacts") \
                            .update(contact_data) \
                            .eq("id", existing["id"]) \
                            .execute()
                        updated_contacts.append(existing["id"])
                    except Exception as e:
                        print(f"  → Skipping update for {contact.name}: {e}")
                        skipped_contacts.append(contact.name)
                else:
                    # Insert new contact
                    try:
                        result = self.client.table("contacts").insert(contact_data).execute()
                        if result.data:
                            new_contacts.append(result.data[0]["id"])
                            # Add to batch tracker
                            if contact.phone:
                                phones_in_batch.add(contact.phone)
                    except Exception as e:
                        # Handle duplicate key error gracefully
                        error_str = str(e)
                        if "duplicate key" in error_str or "23505" in error_str:
                            print(f"  → Skipping duplicate: {contact.name} (phone: {contact.phone})")
                            skipped_contacts.append(contact.name)
                        else:
                            print(f"  → Error inserting {contact.name}: {e}")
                            skipped_contacts.append(contact.name)
            
            if skipped_contacts:
                print(f"  → Skipped {len(skipped_contacts)} duplicate contact(s)")
            
            return {
                "new_count": len(new_contacts),
                "updated_count": len(updated_contacts),
                "skipped_count": len(skipped_contacts),
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
    
    # ============== NICHE METHODS ==============
    
    async def create_niche(self, name: str, description: str = None, locations: List[str] = None) -> dict:
        """Create a new niche."""
        try:
            response = self.client.table("niches").insert({
                "name": name,
                "description": description,
                "locations": locations or [],
            }).execute()
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error creating niche: {e}")
            raise
    
    async def get_niches(self) -> List[dict]:
        """Get all niches with contact counts."""
        try:
            # Get niches
            response = self.client.table("niches") \
                .select("*") \
                .order("created_at", desc=True) \
                .execute()
            
            niches = response.data if response.data else []
            
            # Get contact counts for each niche
            for niche in niches:
                count_response = self.client.table("contacts") \
                    .select("id") \
                    .eq("niche_id", niche["id"]) \
                    .execute()
                niche["contact_count"] = len(count_response.data) if count_response.data else 0
            
            return niches
        except Exception as e:
            print(f"Error getting niches: {e}")
            raise
    
    async def get_niche_by_id(self, niche_id: int) -> Optional[dict]:
        """Get a specific niche by ID with contact count."""
        try:
            response = self.client.table("niches") \
                .select("*") \
                .eq("id", niche_id) \
                .execute()
            
            if response.data:
                niche = response.data[0]
                # Get contact count
                count_response = self.client.table("contacts") \
                    .select("id") \
                    .eq("niche_id", niche_id) \
                    .execute()
                niche["contact_count"] = len(count_response.data) if count_response.data else 0
                return niche
            return None
        except Exception as e:
            print(f"Error getting niche: {e}")
            raise
    
    async def update_niche(self, niche_id: int, data: dict) -> Optional[dict]:
        """Update a niche."""
        try:
            response = self.client.table("niches") \
                .update(data) \
                .eq("id", niche_id) \
                .execute()
            
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error updating niche: {e}")
            raise
    
    async def delete_niche(self, niche_id: int) -> bool:
        """Delete a niche."""
        try:
            self.client.table("niches").delete().eq("id", niche_id).execute()
            return True
        except Exception as e:
            print(f"Error deleting niche: {e}")
            raise
    
    async def get_contacts_by_niche(self, niche_id: int, limit: int = 100, offset: int = 0) -> List[dict]:
        """Get contacts for a specific niche."""
        try:
            response = self.client.table("contacts") \
                .select("*") \
                .eq("niche_id", niche_id) \
                .order("created_at", desc=True) \
                .range(offset, offset + limit - 1) \
                .execute()
            
            return response.data if response.data else []
        except Exception as e:
            print(f"Error getting contacts by niche: {e}")
            raise
    
    async def delete_contacts_by_niche(self, niche_id: int) -> int:
        """Delete all contacts for a specific niche."""
        try:
            # First get count
            count_response = self.client.table("contacts") \
                .select("id") \
                .eq("niche_id", niche_id) \
                .execute()
            count = len(count_response.data) if count_response.data else 0
            
            # Delete contacts
            if count > 0:
                self.client.table("contacts").delete().eq("niche_id", niche_id).execute()
            
            return count
        except Exception as e:
            print(f"Error deleting contacts by niche: {e}")
            raise
    
    async def clear_emails_by_niche(self, niche_id: int) -> int:
        """Clear all emails for contacts in a specific niche."""
        try:
            # First get count
            count_response = self.client.table("contacts") \
                .select("id") \
                .eq("niche_id", niche_id) \
                .execute()
            count = len(count_response.data) if count_response.data else 0
            
            # Clear all emails to null
            if count > 0:
                self.client.table("contacts") \
                    .update({"email": None}) \
                    .eq("niche_id", niche_id) \
                    .execute()
            
            return count
        except Exception as e:
            print(f"Error clearing emails by niche: {e}")
            raise
    
    async def add_contact_status(self, contact_id: int, new_status: str) -> Optional[dict]:
        """Add a status to a contact (appends to existing status, comma-separated)."""
        try:
            # Get current contact
            response = self.client.table("contacts") \
                .select("status") \
                .eq("id", contact_id) \
                .execute()
            
            if not response.data:
                return None
            
            current_status = response.data[0].get("status") or ""
            
            # Parse existing statuses
            existing_statuses = [s.strip() for s in current_status.split(",") if s.strip()]
            
            # Add new status if not already present
            if new_status not in existing_statuses:
                existing_statuses.append(new_status)
            
            # Join back to comma-separated string
            updated_status = ", ".join(existing_statuses)
            
            # Update contact
            update_response = self.client.table("contacts") \
                .update({"status": updated_status}) \
                .eq("id", contact_id) \
                .execute()
            
            return update_response.data[0] if update_response.data else None
        except Exception as e:
            print(f"Error adding contact status: {e}")
            raise


# Singleton instance
db = Database()
