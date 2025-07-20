#!/bin/bash
# FlightSimSpot Quick Backup Script
# Usage: Run before any deployment

echo "🚀 FlightSimSpot Pre-Deployment Backup"
echo "======================================"

cd /app/backend

python -c "
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import json
from datetime import datetime

# Load environment
load_dotenv()
MONGO_URL = os.environ.get('MONGO_URL')

if MONGO_URL:
    client = MongoClient(MONGO_URL)
    db = client.aircraft_reviews
    
    # Create backup directory
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = f'../backups/backup_{timestamp}'
    os.makedirs(backup_dir, exist_ok=True)
    
    # Export aircraft collection
    aircraft_collection = db.aircraft
    documents = list(aircraft_collection.find({}))
    
    # Convert for JSON serialization
    for doc in documents:
        if '_id' in doc:
            doc['_id'] = str(doc['_id'])
    
    # Save to file
    with open(f'{backup_dir}/aircraft_backup.json', 'w') as f:
        json.dump(documents, f, indent=2, default=str)
    
    print(f'✅ Successfully backed up {len(documents)} aircraft!')
    print(f'📁 Backup location: {backup_dir}/aircraft_backup.json')
    print('')
    print('🛡️  Your data is safe! Proceed with deployment.')
else:
    print('❌ MongoDB connection failed!')
    print('🚨 DO NOT DEPLOY until backup succeeds!')
"

echo ""
echo "✅ Backup completed!"
echo "📋 Next steps:"
echo "   1. Verify backup file exists"
echo "   2. Make your code changes" 
echo "   3. Deploy safely"
echo ""