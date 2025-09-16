# Backend Integration Notes

- Users are uniquely identified by `email`. Backend must lowercase and trim emails before persistence.
- Use strong password hashing (bcrypt/argon2). Store the result in `passwordHash`. Set to null for OAuth-only users.
- For OAuth:
  - Set `oauthProvider` to "google" or "apple".
  - Set `oauthProviderId` to provider user ID. The compound unique index prevents duplicates.
  - `passwordHash` can be null.
- Onboarding:
  - Initialize on registration: 
    onboarding.currentStep = 0
    onboarding.completedSteps = []
    onboarding.startedAt = new Date()
  - Update `completedSteps` as steps are done; increment `currentStep`.
  - Set `completedAt` when onboarding finishes.
- Timestamps:
  - Backend should set `createdAt` on insert, and update `updatedAt` on each modification.
  - Update `lastLoginAt` when user authenticates.
- Optional profile data captured across steps can be stored in `profile` object.

Indexes (users):
- uniq_email on email
- uniq_username on username (when present)
- oauth_provider_id on (oauthProvider, oauthProviderId)
- onboarding_currentStep for querying step queues
- createdAt_desc, updatedAt_desc for sorting

Collections created with JSON schema validators to ensure shape and fail fast on malformed data.
