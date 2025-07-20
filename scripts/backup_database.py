#!/usr/bin/env python3
"""
FlightSimSpot Data Backup Script
Run this before any deployment to export all data
"""
import os
import json
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def backup_database():
    """Export all collections to JSON files"""
    # Connect to database
    MONGO_URL = os.environ.get('MONGO_URL')
    if not MONGO_URL:
        print("❌ MONGO_URL not found in environment")
        return False
    
    try:
        client = MongoClient(MONGO_URL)
        db = client.aircraft_reviews
        
        # Create backup directory with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = f"backups/backup_{timestamp}"
        os.makedirs(backup_dir, exist_ok=True)
        
        # Collections to backup
        collections = ['aircraft', 'reviews', 'users']
        
        for collection_name in collections:
            collection = db[collection_name]
            documents = list(collection.find({}))
            
            # Convert ObjectId to string for JSON serialization
            for doc in documents:
                if '_id' in doc:
                    doc['_id'] = str(doc['_id'])
            
            # Save to JSON file
            filename = f"{backup_dir}/{collection_name}.json"
            with open(filename, 'w') as f:
                json.dump(documents, f, indent=2, default=str)
            
            print(f"✅ Backed up {len(documents)} documents from {collection_name}")
        
        # Create summary file
        summary = {
            "backup_date": timestamp,
            "collections": collections,
            "total_files": len(collections),
            "backup_directory": backup_dir
        }
        
        with open(f"{backup_dir}/backup_info.json", 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"✅ Backup completed successfully!")
        print(f"📁 Backup saved to: {backup_dir}")
        return True
        
    except Exception as e:
        print(f"❌ Backup failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting FlightSimSpot database backup...")
    success = backup_database()
    
    if success:
        print("✅ Backup completed! Safe to deploy.")
    else:
        print("❌ Backup failed! Do not deploy.")