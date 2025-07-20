# FlightSimSpot Staging Environment Guide

## Option 1: Railway Staging (Recommended)
1. Create a new Railway project called "flightsimspot-staging"
2. Connect the same GitHub repo but use a different branch "staging"
3. Use a separate MongoDB database for staging data
4. Set environment variables with "staging" prefix

## Option 2: Vercel Preview Deployments
Vercel automatically creates staging URLs for every branch:
- Production: main branch → flightsimspot.com
- Staging: staging branch → flightsimspot-git-staging.vercel.app

## Environment Setup:

### Production (.env.prod):
```
MONGO_URL=mongodb+srv://...@flightsimspot-prod.../aircraft_reviews
GOOGLE_CLIENT_ID=your_prod_client_id
GOOGLE_CLIENT_SECRET=your_prod_secret
```

### Staging (.env.staging):
```
MONGO_URL=mongodb+srv://...@flightsimspot-staging.../aircraft_reviews_staging
GOOGLE_CLIENT_ID=your_staging_client_id
GOOGLE_CLIENT_SECRET=your_staging_secret
```

## Testing Workflow:
1. Make changes in development
2. Deploy to staging environment
3. Test thoroughly on staging
4. Deploy to production when confident

## URLs:
- Production: https://flightsimspot.com
- Staging: https://flightsimspot-staging.up.railway.app
- Development: Local environment