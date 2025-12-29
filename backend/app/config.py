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
