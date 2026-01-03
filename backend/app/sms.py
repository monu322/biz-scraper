import httpx
from app.config import get_settings


# SANDBOX MODE: Override recipient number for testing
# Set to None to send to actual business numbers
SANDBOX_NUMBER = "+447539080583"  # Your test number


class WhatsAppService:
    """Service for sending WhatsApp messages using Meta Cloud API (WhatsApp Business API)."""
    
    def __init__(self):
        settings = get_settings()
        self.phone_number_id = settings.whatsapp_phone_number_id
        self.access_token = settings.whatsapp_access_token
        self.api_version = settings.whatsapp_api_version or "v21.0"
        self.sandbox_number = SANDBOX_NUMBER
        
        # Meta Cloud API endpoint
        self.api_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        
        print(f"  📱 WhatsApp Service initialized (Meta Cloud API):")
        print(f"     Phone Number ID: {self.phone_number_id}")
        print(f"     API Version: {self.api_version}")
        print(f"     SANDBOX TO: {self.sandbox_number}")
    
    async def send_whatsapp(self, to_number: str, message: str) -> dict:
        """
        Send a WhatsApp message using Meta Cloud API.
        
        Args:
            to_number: The recipient's phone number (E.164 format, e.g., +14155551234)
            message: The message content
            
        Returns:
            dict with success status, message, and message ID
        """
        try:
            # Clean up phone number - ensure E.164 format
            original_number = self._format_phone_number(to_number)
            
            if not original_number:
                return {
                    "success": False,
                    "message": "Invalid phone number format",
                    "sid": None
                }
            
            # SANDBOX MODE: Override recipient for testing
            if self.sandbox_number:
                actual_recipient = self.sandbox_number
                print(f"  🧪 SANDBOX MODE: Sending to {actual_recipient} instead of {original_number}")
            else:
                actual_recipient = original_number
            
            # Remove the + from the phone number for Meta API
            recipient_without_plus = actual_recipient.lstrip('+')
            
            # Prepare the request payload
            # Using text message template for now
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": recipient_without_plus,
                "type": "text",
                "text": {
                    "preview_url": True,  # Enable link previews
                    "body": message
                }
            }
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            # Send the message using httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )
                
                response_data = response.json()
                
                if response.status_code == 200:
                    message_id = response_data.get("messages", [{}])[0].get("id", "unknown")
                    return {
                        "success": True,
                        "message": f"WhatsApp message sent successfully to {actual_recipient} (original: {original_number})",
                        "sid": message_id
                    }
                else:
                    error_message = response_data.get("error", {}).get("message", str(response_data))
                    return {
                        "success": False,
                        "message": f"Failed to send WhatsApp message: {error_message}",
                        "sid": None
                    }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to send WhatsApp message: {str(e)}",
                "sid": None
            }
    
    async def send_template_message(self, to_number: str, template_name: str, language_code: str = "en_US", components: list = None) -> dict:
        """
        Send a WhatsApp template message.
        
        Template messages are pre-approved messages that can be sent to users
        who haven't messaged you in the last 24 hours.
        
        Args:
            to_number: The recipient's phone number (E.164 format)
            template_name: The name of the approved template
            language_code: The language code (default: en_US)
            components: Template components for variable substitution
            
        Returns:
            dict with success status, message, and message ID
        """
        try:
            original_number = self._format_phone_number(to_number)
            
            if not original_number:
                return {
                    "success": False,
                    "message": "Invalid phone number format",
                    "sid": None
                }
            
            # SANDBOX MODE
            if self.sandbox_number:
                actual_recipient = self.sandbox_number
                print(f"  🧪 SANDBOX MODE: Sending to {actual_recipient} instead of {original_number}")
            else:
                actual_recipient = original_number
            
            recipient_without_plus = actual_recipient.lstrip('+')
            
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": recipient_without_plus,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": language_code
                    }
                }
            }
            
            if components:
                payload["template"]["components"] = components
            
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )
                
                response_data = response.json()
                
                if response.status_code == 200:
                    message_id = response_data.get("messages", [{}])[0].get("id", "unknown")
                    return {
                        "success": True,
                        "message": f"Template message sent successfully to {actual_recipient}",
                        "sid": message_id
                    }
                else:
                    error_message = response_data.get("error", {}).get("message", str(response_data))
                    return {
                        "success": False,
                        "message": f"Failed to send template message: {error_message}",
                        "sid": None
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to send template message: {str(e)}",
                "sid": None
            }
    
    def _format_phone_number(self, phone: str) -> str | None:
        """Format phone number to E.164 format."""
        if not phone:
            return None
            
        # Remove all non-digit characters except +
        cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
        
        # If already in E.164 format
        if cleaned.startswith('+'):
            return cleaned
        
        # If UK number (starts with 0)
        if cleaned.startswith('0') and len(cleaned) == 11:
            return '+44' + cleaned[1:]
        
        # If US number (10 digits)
        if len(cleaned) == 10:
            return '+1' + cleaned
        
        # If 11 digits starting with 1 (US with country code)
        if len(cleaned) == 11 and cleaned.startswith('1'):
            return '+' + cleaned
        
        # For other numbers, try adding + prefix
        if len(cleaned) >= 10:
            return '+' + cleaned
        
        return None


# Keep SMSService as an alias for backward compatibility
SMSService = WhatsAppService
