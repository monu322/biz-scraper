# Business Dashboard Backend API

FastAPI backend for the Business Dashboard CRM application with Apify integration for scraping Google Maps data and Supabase for data storage.

## Features

- 🔍 **Google Maps Scraping**: Scrape business contacts using Apify's Google Maps API
- 💾 **Supabase Integration**: Store and manage contacts in PostgreSQL via Supabase
- 🚀 **FastAPI**: Modern, fast web framework with automatic API documentation
- 🔒 **Environment Variables**: Secure configuration management
- 📊 **RESTful API**: Clean API endpoints for frontend integration

## Prerequisites

- Python 3.10 or higher
- Apify account and API token
- Supabase project and credentials

## Setup Instructions

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and add your credentials:

```env
# Apify API Configuration
APIFY_API_TOKEN=your_apify_api_token_here

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_KEY=your_supabase_anon_key_here

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
```

### 4. Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL schema from `database/schema.sql` to create the `contacts` table

### 5. Get Apify API Token

1. Sign up for Apify at https://apify.com
2. Go to Settings > Integrations > API token
3. Copy your API token and add it to `.env`

### 6. Run the Server

```bash
# Development mode with auto-reload
python -m app.main

# Or using uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### Scraping

**POST /api/scrape**
```json
{
  "keyword": "restaurants",
  "location": "New York, NY"
}
```

Response:
```json
{
  "message": "Successfully scraped and stored 20 contacts",
  "total_contacts": 20,
  "run_id": "apify_run_id"
}
```

### Contacts

**GET /api/contacts**

Query Parameters:
- `limit` (default: 100) - Number of contacts to return
- `offset` (default: 0) - Number of contacts to skip

**GET /api/contacts/{contact_id}**

Get a specific contact by ID.

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application and routes
│   ├── config.py        # Configuration and settings
│   ├── models.py        # Pydantic models
│   ├── database.py      # Supabase database service
│   └── scraper.py       # Apify scraping service
├── database/
│   └── schema.sql       # Supabase table schema
├── .env.example         # Example environment variables
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## Development

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black app/
```

### Type Checking

```bash
mypy app/
```

## Deployment

### Using Docker

```bash
docker build -t business-dashboard-api .
docker run -p 8000:8000 --env-file .env business-dashboard-api
```

### Using Railway/Render/Heroku

1. Connect your repository
2. Set environment variables in the dashboard
3. Deploy!

## Troubleshooting

### Apify API Errors

- Verify your API token is correct
- Check your Apify account credits
- Review the Actor documentation: https://apify.com/compass/crawler-google-places

### Supabase Connection Errors

- Verify your SUPABASE_URL and SUPABASE_KEY
- Ensure the `contacts` table exists
- Check Row Level Security (RLS) policies

### CORS Errors

- Update `allowed_origins` in `app/config.py` to include your frontend URL

## License

MIT
