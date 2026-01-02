from twilio.rest import Client
from app.config import get_settings


# SANDBOX MODE: Override recipient number for testing
# Set to None to send to actual business numbers
SANDBOX_NUMBER = "+447529080583"  # Your test number


class WhatsAppService:
    """Service for sending WhatsApp messages using Twilio."""
    
    def __init__(self):
        settings = get_settings()
        self.client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        self.from_number = settings.twilio_whatsapp_number  # WhatsApp number
        self.sandbox_number = SANDBOX_NUMBER  # Sandbox override
    
    async def send_whatsapp(self, to_number: str, message: str) -> dict:
        """
        Send a WhatsApp message.
        
        Args:
            to_number: The recipient's phone number (E.164 format, e.g., +14155551234)
            message: The message content
            
        Returns:
            dict with success status, message, and Twilio SID
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
            
            # Format for WhatsApp - prepend 'whatsapp:' to both numbers
            whatsapp_to = f"whatsapp:{actual_recipient}"
            whatsapp_from = f"whatsapp:{self.from_number}"
            
            # Send the WhatsApp message
            message_response = self.client.messages.create(
                body=message,
                from_=whatsapp_from,
                to=whatsapp_to
            )
            
            return {
                "success": True,
                "message": f"WhatsApp message sent successfully to {actual_recipient} (original: {original_number})",
                "sid": message_response.sid
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to send WhatsApp message: {str(e)}",
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
