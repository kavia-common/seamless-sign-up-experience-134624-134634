# signup_database (MongoDB)

This database container stores user credentials and onboarding data for the seamless sign-up experience.

## Collections

- users
  - email (unique, required)
  - username (unique when present)
  - passwordHash (nullable for OAuth-only users)
  - oauthProvider ("google" | "apple" | null)
  - oauthProviderId (string | null)
  - emailVerified (bool)
  - onboarding
    - currentStep (int)
    - completedSteps (string[])
    - startedAt, completedAt
  - profile (optional object with user info collected during onboarding)
  - createdAt, updatedAt, lastLoginAt

- onboarding_steps
  - key (unique)
  - order (int)
  - title
  - description
  - isRequired
  - createdAt, updatedAt

Both collections are created with JSON schema validation and indexes.

## Initialization

1. Ensure MongoDB is running and credentials exist. The provided `startup.sh` can start a local mongod and create users.

2. Set environment variables (or source from db_visualizer/mongodb.env if you used startup.sh):
   - MONGODB_URL (e.g., mongodb://appuser:dbuser123@localhost:5000/?authSource=admin)
   - MONGODB_DB (e.g., myapp)

3. Initialize schema and seed onboarding steps:
   - Using mongosh directly:
     mongosh "$MONGODB_URL/$MONGODB_DB" --file init_mongo.js
   - Or via Node helper:
     node init_db.js

The initializer:
- Creates/updates schema validation for `users` and `onboarding_steps`.
- Ensures essential indexes (unique email, username, oauth provider+id).
- Seeds default onboarding steps if the collection is empty.

## Environment

See .env.example for required variables. Do not commit real secrets. The backend should read these variables from its own .env and connect using:
- MONGODB_URL
- MONGODB_DB
