# BEFORE DEPLOYMENT: Manual Backup Process

## Quick Data Export (2 minutes)
1. Login to MongoDB Atlas
2. Go to your cluster → "Collections" 
3. For each collection (aircraft, reviews, users):
   - Click "Export Collection"
   - Select "JSON" format  
   - Download the file
4. Save files with date: aircraft_20240119.json

## Restore Process (if needed)
1. Go to Collections → "Insert Document"
2. Upload the JSON file
3. Select "Import JSON"

## Pre-Deployment Checklist
□ Export aircraft collection to JSON
□ Export reviews collection to JSON  
□ Export users collection to JSON
□ Verify JSON files downloaded
□ Now safe to deploy!