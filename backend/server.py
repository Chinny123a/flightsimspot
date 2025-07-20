from fastapi import FastAPI, HTTPException, Depends, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime, timedelta, timedelta
import httpx
from authlib.integrations.starlette_client import OAuth
import json
import secrets
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Aircraft Review Platform", version="1.0.0")

# Add session middleware with production-ready configuration
SECRET_KEY = os.environ.get('SESSION_SECRET_KEY', 'your-super-secret-key-change-in-production-12345')
app.add_middleware(
    SessionMiddleware, 
    secret_key=SECRET_KEY, 
    max_age=86400,
    same_site='none',  # Required for cross-origin requests
    https_only=True    # Required for production HTTPS
)

# Enable CORS with specific settings for authentication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://7268f3ac-9f43-409d-901e-f3b4c6052145.preview.emergentagent.com",  # Development
        "https://flightsimspot.com",  # Production domain
        "https://www.flightsimspot.com",  # Production with www
        "https://flightsimspot.vercel.app",  # Vercel deployment URL
        "https://flightsimspot-*.vercel.app",  # Any Vercel preview URLs
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017').strip('"')
client = MongoClient(MONGO_URL)
db = client.aircraft_reviews

# Collections
aircraft_collection = db.aircraft
reviews_collection = db.reviews
users_collection = db.users

# Admin emails
ADMIN_EMAILS = ["chinny12345@gmail.com"]

# OAuth configuration
oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID'),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# Pydantic models
class Aircraft(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    developer: str  # PMDG, Fenix, FlyByWire (simulation developer)
    aircraft_manufacturer: str  # Boeing, Airbus, Cessna (real aircraft manufacturer)
    aircraft_model: str  # 737-800, A320, Citation CJ4 (specific aircraft model)
    variant: str  # Specific variant name (e.g., "737-800", "A320neo")
    category: str  # Commercial, General Aviation, Military, Helicopters, Cargo
    price_type: str  # Paid, Freeware
    price: Optional[str] = None
    description: str
    image_url: Optional[str] = None
    cockpit_image_url: Optional[str] = None
    additional_images: List[str] = []  # Support for multiple screenshots
    release_date: Optional[str] = None
    compatibility: List[str] = []  # MS2024, MS2020
    download_url: Optional[str] = None
    developer_website: Optional[str] = None
    features: List[str] = []
    created_at: datetime = Field(default_factory=datetime.now)
    average_rating: float = 0.0
    total_reviews: int = 0
    is_archived: bool = False  # For archive functionality
    view_count: int = 0  # Track page views
    last_viewed: Optional[datetime] = None  # Track when last viewed

class AircraftUpdate(BaseModel):
    name: Optional[str] = None
    developer: Optional[str] = None
    aircraft_manufacturer: Optional[str] = None
    aircraft_model: Optional[str] = None
    variant: Optional[str] = None
    category: Optional[str] = None
    price_type: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    cockpit_image_url: Optional[str] = None
    additional_images: Optional[List[str]] = None
    release_date: Optional[str] = None
    compatibility: Optional[List[str]] = None
    download_url: Optional[str] = None
    developer_website: Optional[str] = None
    features: Optional[List[str]] = None
    is_archived: Optional[bool] = None

class AircraftCreate(BaseModel):
    name: str
    developer: str
    aircraft_manufacturer: str
    aircraft_model: str
    variant: str
    category: str
    price_type: str
    price: Optional[str] = None
    description: str
    image_url: Optional[str] = None
    cockpit_image_url: Optional[str] = None
    additional_images: List[str] = []
    release_date: Optional[str] = None
    compatibility: List[str] = []
    download_url: Optional[str] = None
    developer_website: Optional[str] = None
    features: List[str] = []

class ReviewRatings(BaseModel):
    overall: int = Field(ge=1, le=5)
    performance: int = Field(ge=1, le=5)
    visual_quality: int = Field(ge=1, le=5)
    flight_model: int = Field(ge=1, le=5)
    systems_accuracy: int = Field(ge=1, le=5)

class Review(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    aircraft_id: str
    user_id: str
    user_name: str
    user_avatar: Optional[str] = None
    title: str
    content: str
    ratings: ReviewRatings
    created_at: datetime = Field(default_factory=datetime.now)
    helpful_count: int = 0

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    avatar_url: Optional[str] = None
    provider: str
    provider_id: str
    is_admin: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    review_count: int = 0

class ReviewCreate(BaseModel):
    title: str
    content: str
    ratings: ReviewRatings

# Helper functions
async def get_current_user(request: Request) -> Optional[Dict]:
    user_data = request.session.get('user')
    if user_data:
        return user_data
    return None

async def require_auth(request: Request) -> Dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

async def require_admin(request: Request) -> Dict:
    user = await require_auth(request)
    if not user.get('is_admin', False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# Sample data initialization with new structure - RESET RATINGS TO 0
def initialize_sample_data():
    # ONLY initialize if database is empty (to prevent data loss in production)
    existing_count = aircraft_collection.count_documents({})
    if existing_count > 0:
        print(f"Database already has {existing_count} aircraft - skipping initialization to preserve existing data")
        return
    
    print("Database is empty - initializing with sample data")
    
    sample_aircraft = [
        # Boeing 737-800 variants
        {
            "id": str(uuid.uuid4()),
            "name": "737-800",
            "developer": "PMDG",
            "aircraft_manufacturer": "Boeing",
            "aircraft_model": "737-800",
            "variant": "737-800",
            "category": "Commercial",
            "price_type": "Paid",
            "price": "$69.99",
            "description": "The most advanced 737-800 simulation with study-level systems depth and exceptional flight model accuracy.",
            "image_url": "https://images.unsplash.com/photo-1742014266134-3e30284ba2af?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxhdmlhdGlvbiUyMGFpcmNyYWZ0fGVufDB8fHx8MTc1MjkyOTg1NXww&ixlib=rb-4.1.0&q=85",
            "cockpit_image_url": "https://images.unsplash.com/photo-1741160450767-7eaeb9ac53d5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxhaXJjcmFmdCUyMGNvY2twaXR8ZW58MHx8fHwxNzUyOTI5ODQ3fDA&ixlib=rb-4.1.0&q=85",
            "additional_images": [],
            "release_date": "2024-01-15",
            "compatibility": ["MS2024"],
            "download_url": "https://pmdg.com",
            "developer_website": "https://pmdg.com",
            "features": ["Study Level Systems", "Custom EFB", "Realistic Failures", "Advanced Weather Radar"],
            "created_at": datetime.now(),
            "average_rating": 0.0,  # Reset to 0
            "total_reviews": 0,     # Reset to 0
            "is_archived": False
        },
        # Airbus A320 variants
        {
            "id": str(uuid.uuid4()),
            "name": "A320",
            "developer": "Fenix",
            "aircraft_manufacturer": "Airbus",
            "aircraft_model": "A320",
            "variant": "A320-200",
            "category": "Commercial",
            "price_type": "Paid",
            "price": "$59.99",
            "description": "Ultra-realistic A320 with custom EFB, detailed systems simulation, and authentic flight procedures.",
            "image_url": "https://images.unsplash.com/photo-1568554318297-2aad1e9b5f37?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwyfHxhdmlhdGlvbiUyMGFpcmNyYWZ0fGVufDB8fHx8MTc1MjkyOTg1NXww&ixlib=rb-4.1.0&q=85",
            "cockpit_image_url": "https://images.unsplash.com/photo-1518566107615-f7267099eced?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxhaXJjcmFmdCUyMGNvY2twaXR8ZW58MHx8fHwxNzUyOTI5ODQ3fDA&ixlib=rb-4.1.0&q=85",
            "additional_images": [],
            "release_date": "2023-12-10",
            "compatibility": ["MS2024", "MS2020"],
            "download_url": "https://fenixsim.com",
            "developer_website": "https://fenixsim.com",
            "features": ["Custom EFB", "Real-time Weather", "Detailed Systems", "MCDU Integration"],
            "created_at": datetime.now(),
            "average_rating": 0.0,  # Reset to 0
            "total_reviews": 0,     # Reset to 0
            "is_archived": False
        },
        {
            "id": str(uuid.uuid4()),
            "name": "A32NX",
            "developer": "FlyByWire",
            "aircraft_manufacturer": "Airbus",
            "aircraft_model": "A320",
            "variant": "A320neo",
            "category": "Commercial",
            "price_type": "Freeware",
            "price": "Free",
            "description": "Community-driven A320neo with modern avionics, realistic systems, and continuous updates.",
            "image_url": "https://images.unsplash.com/photo-1568554318297-2aad1e9b5f37?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwyfHxhdmlhdGlvbiUyMGFpcmNyYWZ0fGVufDB8fHx8MTc1MjkyOTg1NXww&ixlib=rb-4.1.0&q=85",
            "cockpit_image_url": "https://images.unsplash.com/photo-1518566107615-f7267099eced?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxhaXJjcmFmdCUyMGNvY2twaXR8ZW58MHx8fHwxNzUyOTI5ODQ3fDA&ixlib=rb-4.1.0&q=85",
            "additional_images": [],
            "release_date": "2024-02-20",
            "compatibility": ["MS2024", "MS2020"],
            "download_url": "https://flybywiresim.com",
            "developer_website": "https://flybywiresim.com",
            "features": ["Modern Avionics", "Community Support", "Regular Updates", "Realistic Flight Model"],
            "created_at": datetime.now(),
            "average_rating": 0.0,  # Reset to 0
            "total_reviews": 0,     # Reset to 0
            "is_archived": False
        },
        # Citation CJ4 variants
        {
            "id": str(uuid.uuid4()),
            "name": "Citation CJ4",
            "developer": "Working Title",
            "aircraft_manufacturer": "Cessna",
            "aircraft_model": "Citation CJ4",
            "variant": "CJ4",
            "category": "General Aviation",
            "price_type": "Freeware",
            "price": "Free",
            "description": "Enhanced CJ4 with improved avionics, flight management system, and realistic performance.",
            "image_url": "https://images.unsplash.com/photo-1742014266134-3e30284ba2af?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxhdmlhdGlvbiUyMGFpcmNyYWZ0fGVufDB8fHx8MTc1MjkyOTg1NXww&ixlib=rb-4.1.0&q=85",
            "cockpit_image_url": "https://images.unsplash.com/photo-1518566107615-f7267099eced?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxhaXJjcmFmdCUyMGNvY2twaXR8ZW58MHx8fHwxNzUyOTI5ODQ3fDA&ixlib=rb-4.1.0&q=85",
            "additional_images": [],
            "release_date": "2023-11-30",
            "compatibility": ["MS2024", "MS2020"],
            "download_url": "https://workingtitle.aero",
            "developer_website": "https://workingtitle.aero",
            "features": ["Enhanced Avionics", "Realistic FMS", "Accurate Performance", "Modern UI"],
            "created_at": datetime.now(),
            "average_rating": 0.0,  # Reset to 0
            "total_reviews": 0,     # Reset to 0
            "is_archived": False
        },
        # Quest Kodiak variants
        {
            "id": str(uuid.uuid4()),
            "name": "Kodiak 100",
            "developer": "SWS",
            "aircraft_manufacturer": "Quest",
            "aircraft_model": "Kodiak 100",
            "variant": "Kodiak 100",
            "category": "General Aviation",
            "price_type": "Paid",
            "price": "$29.99",
            "description": "Highly detailed turboprop with authentic systems, beautiful exterior modeling, and realistic flight characteristics.",
            "image_url": "https://images.unsplash.com/photo-1742014266134-3e30284ba2af?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxhdmlhdGlvbiUyMGFpcmNyYWZ0fGVufDB8fHx8MTc1MjkyOTg1NXww&ixlib=rb-4.1.0&q=85",
            "cockpit_image_url": "https://images.unsplash.com/photo-1518566107615-f7267099eced?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwxfHxhaXJjcmFmdCUyMGNvY2twaXR8ZW58MHx8fHwxNzUyOTI5ODQ3fDA&ixlib=rb-4.1.0&q=85",
            "additional_images": [],
            "release_date": "2024-01-05",
            "compatibility": ["MS2024"],
            "download_url": "https://swsim.com",
            "developer_website": "https://swsim.com",
            "features": ["Detailed Systems", "Realistic Physics", "Beautiful Modeling", "Authentic Sounds"],
            "created_at": datetime.now(),
            "average_rating": 0.0,  # Reset to 0
            "total_reviews": 0,     # Reset to 0
            "is_archived": False
        },
        # TBM 930 variants
        {
            "id": str(uuid.uuid4()),
            "name": "TBM 930",
            "developer": "Carenado",
            "aircraft_manufacturer": "Daher",
            "aircraft_model": "TBM 930",
            "variant": "TBM 930",
            "category": "General Aviation",
            "price_type": "Paid",
            "price": "$34.99",
            "description": "Premium single-engine turboprop with detailed cockpit, realistic avionics, and excellent performance modeling.",
            "image_url": "https://images.unsplash.com/photo-1558285549-c610fbd0b8b8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwzfHxhdmlhdGlvbiUyMGFpcmNyYWZ0fGVufDB8fHx8MTc1MjkyOTg1NXww&ixlib=rb-4.1.0&q=85",
            "cockpit_image_url": "https://images.unsplash.com/photo-1518566107615-f7267099eced?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxhaXJjcmFmdCUyMGNvY2twaXR8ZW58MHx8fHwxNzUyOTI5ODQ3fDA&ixlib=rb-4.1.0&q=85",
            "additional_images": [],
            "release_date": "2023-10-12",
            "compatibility": ["MS2024", "MS2020"],
            "download_url": "https://carenado.com",
            "developer_website": "https://carenado.com",
            "features": ["G1000 NXi", "Realistic Turboprop", "High Quality Textures", "Accurate Performance"],
            "created_at": datetime.now(),
            "average_rating": 0.0,  # Reset to 0
            "total_reviews": 0,     # Reset to 0
            "is_archived": False
        },
        # F/A-18 Super Hornet variants
        {
            "id": str(uuid.uuid4()),
            "name": "F/A-18 Super Hornet",
            "developer": "Asobo",
            "aircraft_manufacturer": "Boeing",
            "aircraft_model": "F/A-18 Super Hornet",
            "variant": "F/A-18F",
            "category": "Military",
            "price_type": "Paid",
            "price": "$19.99",
            "description": "Official military fighter jet with carrier operations, weapon systems, and authentic naval procedures.",
            "image_url": "https://images.unsplash.com/photo-1558285549-c610fbd0b8b8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwzfHxhdmlhdGlvbiUyMGFpcmNyYWZ0fGVufDB8fHx8MTc1MjkyOTg1NXww&ixlib=rb-4.1.0&q=85",
            "cockpit_image_url": "https://images.unsplash.com/photo-1741160450767-7eaeb9ac53d5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxhaXJjcmFmdCUyMGNvY2twaXR8ZW58MHx8fHwxNzUyOTI5ODQ3fDA&ixlib=rb-4.1.0&q=85",
            "additional_images": [],
            "release_date": "2024-03-01",
            "compatibility": ["MS2024"],
            "download_url": "https://flightsimulator.com",
            "developer_website": "https://flightsimulator.com",
            "features": ["Carrier Operations", "Weapon Systems", "Military Procedures", "Authentic Cockpit"],
            "created_at": datetime.now(),
            "average_rating": 0.0,  # Reset to 0
            "total_reviews": 0,     # Reset to 0
            "is_archived": False
        },
        # Airbus H145 variants
        {
            "id": str(uuid.uuid4()),
            "name": "H145",
            "developer": "Hype Performance Group",
            "aircraft_manufacturer": "Airbus",
            "aircraft_model": "H145",
            "variant": "H145",
            "category": "Helicopters",
            "price_type": "Paid",
            "price": "$39.99",
            "description": "Study-level helicopter simulation with advanced flight model, authentic systems, and detailed cockpit.",
            "image_url": "https://images.unsplash.com/photo-1558285549-c610fbd0b8b8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwzfHxhdmlhdGlvbiUyMGFpcmNyYWZ0fGVufDB8fHx8MTc1MjkyOTg1NXww&ixlib=rb-4.1.0&q=85",
            "cockpit_image_url": "https://images.unsplash.com/photo-1698073176073-2259484c87b4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwyfHxhaXJjcmFmdCUyMGNvY2twaXR8ZW58MHx8fHwxNzUyOTI5ODQ3fDA&ixlib=rb-4.1.0&q=85",
            "additional_images": [],
            "release_date": "2024-02-14",
            "compatibility": ["MS2024"],
            "download_url": "https://hpg.aero",
            "developer_website": "https://hpg.aero",
            "features": ["Study Level Systems", "Advanced Flight Model", "Authentic Procedures", "Detailed Cockpit"],
            "created_at": datetime.now(),
            "average_rating": 0.0,  # Reset to 0
            "total_reviews": 0,     # Reset to 0
            "is_archived": False
        }
    ]
    
    for aircraft in sample_aircraft:
        aircraft_collection.insert_one(aircraft)
    
    # Update all aircraft to ensure they have view_count and last_viewed fields
    aircraft_collection.update_many(
        {},
        {
            "$set": {
                "view_count": 0,
                "last_viewed": None
            }
        }
    )
    print("Sample aircraft data initialized with proper structure and reset ratings")

# Initialize sample data on startup
initialize_sample_data()

# Authentication Routes

@app.post("/api/auth/google/verify")
async def verify_google_token(request: Request):
    """Verify Google OAuth token from frontend"""
    try:
        data = await request.json()
        credential = data.get('credential')
        
        if not credential:
            raise HTTPException(status_code=400, detail="No credential provided")
        
        # Debug logging
        expected_client_id = os.environ.get('GOOGLE_CLIENT_ID')
        print(f"Expected Google Client ID: {expected_client_id}")
        
        # Verify the token with Google
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
            )
            
            if response.status_code != 200:
                print(f"Google token verification failed: {response.status_code}")
                print(f"Response: {response.text}")
                raise HTTPException(status_code=400, detail="Invalid token")
            
            user_info = response.json()
            print(f"Google user info: {user_info}")
            print(f"Token audience (aud): {user_info.get('aud')}")
            print(f"Expected client ID: {expected_client_id}")
            
            # Verify the client ID matches
            if user_info.get('aud') != expected_client_id:
                print(f"Client ID mismatch: {user_info.get('aud')} vs {expected_client_id}")
                raise HTTPException(status_code=400, detail=f"Invalid client ID. Expected: {expected_client_id}, Got: {user_info.get('aud')}")
            
            # Check if user exists
            existing_user = users_collection.find_one({"email": user_info['email']})
            
            if existing_user:
                user_data = {
                    "id": existing_user['id'],
                    "email": existing_user['email'],
                    "name": existing_user['name'],
                    "avatar_url": existing_user.get('avatar_url'),
                    "provider": existing_user['provider'],
                    "is_admin": existing_user.get('is_admin', False)
                }
                print(f"Existing user found: {user_data}")
            else:
                # Create new user
                is_admin = user_info['email'] in ADMIN_EMAILS
                new_user = User(
                    email=user_info['email'],
                    name=user_info['name'],
                    avatar_url=user_info.get('picture'),
                    provider='google',
                    provider_id=user_info['sub'],
                    is_admin=is_admin
                )
                user_dict = new_user.dict()
                users_collection.insert_one(user_dict)
                
                user_data = {
                    "id": new_user.id,
                    "email": new_user.email,
                    "name": new_user.name,
                    "avatar_url": new_user.avatar_url,
                    "provider": new_user.provider,
                    "is_admin": new_user.is_admin
                }
                print(f"New user created: {user_data}")
            
            # Store user in session
            request.session['user'] = user_data
            print(f"User stored in session")
            
            return {"status": "success", "user": user_data}
            
    except Exception as e:
        print(f"Token verification error: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Token verification failed: {str(e)}")

@app.get("/api/admin/stats")
async def get_admin_stats(request: Request):
    """Get admin dashboard statistics"""
    user = await get_current_user(request)
    if not user or not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get database reference
        db = client.aircraft_reviews
        
        # List all collections to debug
        collections = db.list_collection_names()
        print(f"Available collections: {collections}")
        
        # Get user count (users might be stored as 'users' or similar)
        try:
            total_users = db.users.count_documents({})
        except:
            total_users = 0
        
        # Get aircraft count (should be 'aircraft')
        try:
            total_aircraft = db.aircraft.count_documents({"is_archived": {"$ne": True}})
            archived_aircraft = db.aircraft.count_documents({"is_archived": True})
        except:
            total_aircraft = 0
            archived_aircraft = 0
        
        # Get review count
        try:
            total_reviews = db.reviews.count_documents({})
        except:
            total_reviews = 0
        
        # Get recent activity (only if collections exist)
        from datetime import datetime, timedelta
        seven_days_ago = datetime.now() - timedelta(days=7)
        
        try:
            recent_users = db.users.count_documents({"created_at": {"$gte": seven_days_ago}})
        except:
            recent_users = 0
            
        try:
            recent_reviews = db.reviews.count_documents({"created_at": {"$gte": seven_days_ago}})
        except:
            recent_reviews = 0
        
        return {
            "total_users": total_users,
            "total_aircraft": total_aircraft,
            "archived_aircraft": archived_aircraft,
            "total_reviews": total_reviews,
            "recent_users_7_days": recent_users,
            "recent_reviews_7_days": recent_reviews,
            "debug_collections": collections  # For debugging
        }
        
    except Exception as e:
        print(f"Admin stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching admin stats: {str(e)}")

@app.delete("/api/reviews/{review_id}")
async def delete_review(review_id: str, request: Request):
    """Delete a review (admin only)"""
    user = get_current_user(request)
    if not user or not user.get('is_admin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Delete the review
        result = reviews_collection.delete_one({"id": review_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Review not found")
        
        return {"status": "success", "message": "Review deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting review: {str(e)}")

@app.get("/api/auth/me")
async def get_current_user_info(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    print(f"Auth check - user in session: {user}")
    if user:
        return {"user": user}
    return {"user": None}

@app.post("/api/auth/logout")
async def logout(request: Request):
    """Logout user"""
    request.session.clear()
    return {"status": "success", "message": "Logged out successfully"}

# Aircraft Routes - NEW 3-LEVEL HIERARCHY

@app.get("/api/categories-with-counts")
async def get_categories_with_counts():
    """Get categories with aircraft counts for the homepage (exclude archived)"""
    pipeline = [
        {"$match": {"is_archived": {"$ne": True}}},  # Exclude archived aircraft
        {"$group": {
            "_id": "$category", 
            "count": {"$sum": 1},
            "avg_rating": {"$avg": "$average_rating"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = list(aircraft_collection.aggregate(pipeline))
    categories = {}
    
    for result in results:
        categories[result["_id"]] = {
            "category": result["_id"],
            "count": result["count"],
            "avg_rating": round(result["avg_rating"], 1)
        }
    
    return categories

@app.get("/api/aircraft-manufacturers/{category}")
async def get_aircraft_manufacturers_by_category(category: str):
    """Get real aircraft manufacturers for a specific category (exclude archived)"""
    pipeline = [
        {"$match": {"category": category, "is_archived": {"$ne": True}}},  # Exclude archived
        {"$group": {
            "_id": "$aircraft_manufacturer",
            "count": {"$sum": 1},
            "models": {"$addToSet": "$aircraft_model"},
            "avg_rating": {"$avg": "$average_rating"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = list(aircraft_collection.aggregate(pipeline))
    manufacturers = {}
    
    for result in results:
        manufacturers[result["_id"]] = {
            "manufacturer": result["_id"],
            "count": result["count"],
            "models": result["models"],
            "avg_rating": round(result["avg_rating"], 1)
        }
    
    return manufacturers

@app.get("/api/simulations/{category}/{aircraft_manufacturer}")
async def get_simulations_by_manufacturer(category: str, aircraft_manufacturer: str, sort_by: str = "rating"):
    """Get all simulation versions for a specific aircraft manufacturer (exclude archived)"""
    filter_query = {
        "category": category,
        "aircraft_manufacturer": aircraft_manufacturer,
        "is_archived": {"$ne": True}  # Exclude archived
    }
    
    aircraft = list(aircraft_collection.find(filter_query, {"_id": 0}))
    
    # Sort by requested criteria
    if sort_by == "rating":
        aircraft.sort(key=lambda x: x.get('average_rating', 0), reverse=True)
    elif sort_by == "price_low":
        def price_key(x):
            price = x.get('price', 'Free')
            if price == 'Free' or price == '$0':
                return 0
            return float(price.replace('$', '').replace(',', '')) if price.replace('$', '').replace('.', '').replace(',', '').isdigit() else 999
        aircraft.sort(key=price_key)
    elif sort_by == "price_high":
        def price_key(x):
            price = x.get('price', 'Free')
            if price == 'Free' or price == '$0':
                return 0
            return float(price.replace('$', '').replace(',', '')) if price.replace('$', '').replace('.', '').replace(',', '').isdigit() else 999
        aircraft.sort(key=price_key, reverse=True)
    elif sort_by == "reviews":
        aircraft.sort(key=lambda x: x.get('total_reviews', 0), reverse=True)
    elif sort_by == "newest":
        aircraft.sort(key=lambda x: x.get('release_date', ''), reverse=True)
    
    return aircraft

@app.get("/api/aircraft")
async def get_aircraft(
    category: Optional[str] = None,
    developer: Optional[str] = None,
    aircraft_manufacturer: Optional[str] = None,
    price_type: Optional[str] = None,
    compatibility: Optional[str] = None,
    search: Optional[str] = None,
    include_archived: bool = False
):
    """Get all aircraft with optional filtering"""
    filter_query = {}
    
    # Only include archived aircraft if explicitly requested (for admin)
    if not include_archived:
        filter_query["is_archived"] = {"$ne": True}
    
    if category:
        filter_query["category"] = category
    if developer:
        filter_query["developer"] = developer
    if aircraft_manufacturer:
        filter_query["aircraft_manufacturer"] = aircraft_manufacturer
    if price_type:
        filter_query["price_type"] = price_type
    if compatibility:
        filter_query["compatibility"] = {"$in": [compatibility]}
    if search:
        filter_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"developer": {"$regex": search, "$options": "i"}},
            {"aircraft_manufacturer": {"$regex": search, "$options": "i"}},
            {"aircraft_model": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    aircraft = list(aircraft_collection.find(filter_query, {"_id": 0}))
    return aircraft

@app.get("/api/aircraft/{aircraft_id}")
async def get_aircraft_by_id(aircraft_id: str):
    """Get specific aircraft by ID"""
    aircraft = aircraft_collection.find_one({"id": aircraft_id}, {"_id": 0})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    return aircraft

@app.post("/api/aircraft/{aircraft_id}/view")
async def track_aircraft_view(aircraft_id: str):
    """Track page view for an aircraft"""
    try:
        # Increment view count and update last_viewed timestamp
        result = aircraft_collection.update_one(
            {"id": aircraft_id},
            {
                "$inc": {"view_count": 1},
                "$set": {"last_viewed": datetime.now()}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Aircraft not found")
        
        # Get updated view count
        aircraft = aircraft_collection.find_one({"id": aircraft_id}, {"view_count": 1, "_id": 0})
        return {"status": "success", "view_count": aircraft.get("view_count", 0)}
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking view: {str(e)}")

@app.get("/api/aircraft-analytics")
async def get_aircraft_analytics():
    """Get analytics data for aircraft (most viewed, trending, etc.)"""
    try:
        # Most viewed aircraft (all time)
        most_viewed = list(aircraft_collection.find(
            {"is_archived": {"$ne": True}},
            {"_id": 0}
        ).sort("view_count", -1).limit(10))
        
        # Recently trending (viewed in last 7 days)
        seven_days_ago = datetime.now() - timedelta(days=7)
        trending = list(aircraft_collection.find(
            {
                "is_archived": {"$ne": True},
                "last_viewed": {"$gte": seven_days_ago}
            },
            {"_id": 0}
        ).sort("view_count", -1).limit(10))
        
        # Most viewed by category
        pipeline = [
            {"$match": {"is_archived": {"$ne": True}}},
            {"$group": {
                "_id": "$category",
                "total_views": {"$sum": "$view_count"},
                "aircraft_count": {"$sum": 1},
                "avg_views_per_aircraft": {"$avg": "$view_count"}
            }},
            {"$sort": {"total_views": -1}}
        ]
        category_stats = list(aircraft_collection.aggregate(pipeline))
        
        return {
            "most_viewed": most_viewed,
            "trending": trending,
            "category_analytics": category_stats,
            "total_views": sum(aircraft.get("view_count", 0) for aircraft in aircraft_collection.find({"is_archived": {"$ne": True}}, {"view_count": 1}))
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analytics: {str(e)}")

@app.post("/api/aircraft")
async def create_aircraft(aircraft_data: AircraftCreate, request: Request):
    """Create new aircraft (admin only)"""
    user = await require_admin(request)
    
    aircraft = Aircraft(**aircraft_data.dict())
    aircraft_dict = aircraft.dict()
    aircraft_collection.insert_one(aircraft_dict)
    
    return {"status": "success", "message": "Aircraft created successfully", "aircraft_id": aircraft.id}

@app.put("/api/aircraft/{aircraft_id}")
async def update_aircraft(aircraft_id: str, aircraft_data: AircraftUpdate, request: Request):
    """Update aircraft (admin only)"""
    user = await require_admin(request)
    
    # Check if aircraft exists
    existing_aircraft = aircraft_collection.find_one({"id": aircraft_id})
    if not existing_aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Update aircraft with only provided fields
    update_data = {}
    for field, value in aircraft_data.dict(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value
    
    if update_data:
        update_data["updated_at"] = datetime.now()
        aircraft_collection.update_one(
            {"id": aircraft_id},
            {"$set": update_data}
        )
    
    return {"status": "success", "message": "Aircraft updated successfully"}

@app.post("/api/aircraft/{aircraft_id}/archive")
async def archive_aircraft(aircraft_id: str, request: Request):
    """Archive aircraft (admin only) - hide from users but keep data"""
    user = await require_admin(request)
    
    # Check if aircraft exists
    existing_aircraft = aircraft_collection.find_one({"id": aircraft_id})
    if not existing_aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Archive the aircraft
    aircraft_collection.update_one(
        {"id": aircraft_id},
        {"$set": {"is_archived": True, "archived_at": datetime.now()}}
    )
    
    return {"status": "success", "message": "Aircraft archived successfully"}

@app.post("/api/aircraft/{aircraft_id}/restore")
async def restore_aircraft(aircraft_id: str, request: Request):
    """Restore archived aircraft (admin only)"""
    user = await require_admin(request)
    
    # Check if aircraft exists
    existing_aircraft = aircraft_collection.find_one({"id": aircraft_id})
    if not existing_aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Restore the aircraft
    aircraft_collection.update_one(
        {"id": aircraft_id},
        {"$set": {"is_archived": False}, "$unset": {"archived_at": ""}}
    )
    
    return {"status": "success", "message": "Aircraft restored successfully"}

@app.get("/api/admin/archived-aircraft")
async def get_archived_aircraft(request: Request):
    """Get all archived aircraft (admin only)"""
    user = await require_admin(request)
    
    aircraft = list(aircraft_collection.find({"is_archived": True}, {"_id": 0}))
    return aircraft

# Review Routes

@app.get("/api/aircraft/{aircraft_id}/reviews")
async def get_aircraft_reviews(aircraft_id: str):
    """Get reviews for specific aircraft"""
    reviews = list(reviews_collection.find({"aircraft_id": aircraft_id}, {"_id": 0}))
    reviews.sort(key=lambda x: x['created_at'], reverse=True)
    return reviews

@app.post("/api/aircraft/{aircraft_id}/reviews")
async def create_review(aircraft_id: str, review_data: ReviewCreate, request: Request):
    """Create a new review (requires authentication)"""
    user = await require_auth(request)
    
    # Verify aircraft exists
    aircraft = aircraft_collection.find_one({"id": aircraft_id})
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    # Check if user already reviewed this aircraft
    existing_review = reviews_collection.find_one({
        "aircraft_id": aircraft_id,
        "user_id": user['id']
    })
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this aircraft")
    
    # Create review
    review = Review(
        aircraft_id=aircraft_id,
        user_id=user['id'],
        user_name=user['name'],
        user_avatar=user.get('avatar_url'),
        title=review_data.title,
        content=review_data.content,
        ratings=review_data.ratings
    )
    
    review_dict = review.dict()
    reviews_collection.insert_one(review_dict)
    
    # Update aircraft rating
    await update_aircraft_rating(aircraft_id)
    
    # Update user review count
    users_collection.update_one(
        {"id": user['id']},
        {"$inc": {"review_count": 1}}
    )
    
    return {"status": "success", "message": "Review created successfully", "review_id": review.id}

async def update_aircraft_rating(aircraft_id: str):
    """Update aircraft average rating and review count"""
    reviews = list(reviews_collection.find({"aircraft_id": aircraft_id}))
    
    if reviews:
        total_rating = sum(review["ratings"]["overall"] for review in reviews)
        average_rating = total_rating / len(reviews)
        
        aircraft_collection.update_one(
            {"id": aircraft_id},
            {
                "$set": {
                    "average_rating": round(average_rating, 1),
                    "total_reviews": len(reviews)
                }
            }
        )
    else:
        # No reviews - reset to 0
        aircraft_collection.update_one(
            {"id": aircraft_id},
            {
                "$set": {
                    "average_rating": 0.0,
                    "total_reviews": 0
                }
            }
        )

# Utility Routes

@app.get("/api/developers")
async def get_developers():
    """Get all unique developers"""
    developers = aircraft_collection.distinct("developer")
    return sorted(developers)

@app.get("/api/aircraft-manufacturers")
async def get_aircraft_manufacturers():
    """Get all unique aircraft manufacturers"""
    manufacturers = aircraft_collection.distinct("aircraft_manufacturer")
    return sorted(manufacturers)

@app.get("/api/categories")
async def get_categories():
    """Get all unique categories"""
    categories = aircraft_collection.distinct("category")
    return sorted(categories)

@app.get("/api/stats")
async def get_stats():
    """Get platform statistics (exclude archived)"""
    total_aircraft = aircraft_collection.count_documents({"is_archived": {"$ne": True}})
    total_reviews = reviews_collection.count_documents({})
    total_users = users_collection.count_documents({})
    paid_count = aircraft_collection.count_documents({"price_type": "Paid", "is_archived": {"$ne": True}})
    free_count = aircraft_collection.count_documents({"price_type": "Freeware", "is_archived": {"$ne": True}})
    
    return {
        "total_aircraft": total_aircraft,
        "total_reviews": total_reviews,
        "total_users": total_users,
        "paid_aircraft": paid_count,
        "free_aircraft": free_count
    }

# User Routes

@app.get("/api/users/{user_id}")
async def get_user_profile(user_id: str):
    """Get user profile"""
    user = users_collection.find_one({"id": user_id}, {"_id": 0, "provider_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/api/users/{user_id}/reviews")
async def get_user_reviews(user_id: str):
    """Get all reviews by a specific user"""
    reviews = list(reviews_collection.find({"user_id": user_id}, {"_id": 0}))
    reviews.sort(key=lambda x: x['created_at'], reverse=True)
    
    # Add aircraft info to each review
    for review in reviews:
        aircraft = aircraft_collection.find_one({"id": review["aircraft_id"]}, {"_id": 0, "name": 1, "developer": 1, "aircraft_manufacturer": 1, "aircraft_model": 1})
        if aircraft:
            review["aircraft"] = aircraft
    
    return reviews

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)