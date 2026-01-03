from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Apify Configuration
    apify_api_token: str
    
    # OpenAI Configuration
    openai_api_key: str
    
    # Supabase Configuration
    supabase_url: str
    supabase_key: str
    
    # WhatsApp Business API (Meta Cloud API) Configuration
    whatsapp_phone_number_id: str = ""  # Your WhatsApp Business phone number ID from Meta
    whatsapp_access_token: str = ""  # Permanent access token from Meta Developer Portal
    whatsapp_api_version: str = "v21.0"  # Meta Graph API version
    
    # Twilio Configuration (legacy - kept for backward compatibility)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""  # Legacy SMS number (optional)
    twilio_whatsapp_number: str = "+14155238886"  # Default Twilio WhatsApp Sandbox number
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # CORS Configuration
    allowed_origins: list[str] = ["http://localhost:3001", "http://localhost:5173"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
