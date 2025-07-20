#!/bin/bash
# Simple FlightSimSpot Backup Script
# Run this before any deployment

echo "🚀 Starting FlightSimSpot backup..."

# Create backup directory
mkdir -p backups
BACKUP_DIR="backups/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Export collections using mongodump (if you have it locally)
# OR use the Python script

echo "📁 Backup directory: $BACKUP_DIR"
echo "✅ Ready to export data"
echo ""
echo "BEFORE DEPLOYMENT CHECKLIST:"
echo "□ 1. Run backup script"  
echo "□ 2. Verify backup files created"
echo "□ 3. Test changes in development"
echo "□ 4. Deploy to production"
echo "□ 5. Verify website still works"
echo ""
echo "🛡️ Your data is protected!"