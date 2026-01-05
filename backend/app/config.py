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
    
    # Twilio Configuration
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""  # Legacy SMS number (optional)
    twilio_whatsapp_number: str = "+14155238886"  # Default Twilio WhatsApp Sandbox number
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # CORS Configuration
    # Can be set via ALLOWED_ORIGINS env var as comma-separated list
    # e.g., ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:5173
    allowed_origins: list[str] = [
        "http://localhost:3001", 
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
