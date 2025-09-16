//
// MongoDB initialization script for users and onboarding collections
// This script creates collections with JSON schema validation, sets up indexes,
// and prepares the database for authentication and step-wise onboarding.
//
// Usage:
//   1) Ensure MongoDB is running and users are created (see startup.sh).
//   2) Run this script:
//      mongosh "$MONGODB_URL/$MONGODB_DB" --file init_mongo.js
//
// Environment variables required (set in runtime env or db_visualizer/mongodb.env):
//   - MONGODB_URL: mongodb://<user>:<password>@<host>:<port>/?authSource=admin
//   - MONGODB_DB: database name (e.g., myapp)
//

(function () {
  // PUBLIC_INTERFACE
  function ensureCollectionWithValidator(db, name, validator, options = {}) {
    /**
     * Ensure a collection exists with a validator. If it exists, update the validator using collMod.
     * Options may include: validationLevel, validationAction, and any createCollection options.
     */
    const existing = db.getCollectionNames().includes(name);
    if (!existing) {
      const createOpts = Object.assign(
        {
          validator: { $jsonSchema: validator },
          validationLevel: "moderate",
          validationAction: "error",
        },
        options
      );
      db.createCollection(name, createOpts);
      print(`✓ Created collection '${name}' with schema validation`);
    } else {
      // Try to update validator using collMod
      db.runCommand({
        collMod: name,
        validator: { $jsonSchema: validator },
        validationLevel: "moderate",
        validationAction: "error",
      });
      print(`✓ Updated validator for existing collection '${name}'`);
    }
  }

  // PUBLIC_INTERFACE
  function ensureIndexes(db, name, indexSpecs) {
    /**
     * Ensure indexes defined in indexSpecs exist.
     * indexSpecs: Array of { key: {field: 1}, name: "index_name", unique: true/false, partialFilterExpression?: {} }
     */
    const coll = db.getCollection(name);
    const existing = coll.getIndexes().map((i) => i.name);
    indexSpecs.forEach((idx) => {
      if (!existing.includes(idx.name)) {
        coll.createIndex(idx.key, idx);
        print(`✓ Created index '${idx.name}' on collection '${name}'`);
      } else {
        print(`• Index '${idx.name}' already exists on '${name}'`);
      }
    });
  }

  const currentDB = db.getName();

  // Users collection schema
  const usersSchema = {
    bsonType: "object",
    required: ["email", "passwordHash", "onboarding"],
    additionalProperties: true,
    properties: {
      _id: { bsonType: ["objectId"] },
      email: {
        bsonType: "string",
        description: "User's email; unique, lowercased",
      },
      username: {
        bsonType: ["string", "null"],
        description: "Optional username; unique if present",
      },
      passwordHash: {
        bsonType: ["string", "null"],
        description: "BCrypt/Argon2 hashed password; null when OAuth-only",
      },
      oauthProvider: {
        bsonType: ["string", "null"],
        enum: [null, "google", "apple"],
        description: "OAuth provider name if used",
      },
      oauthProviderId: {
        bsonType: ["string", "null"],
        description: "Provider's unique user ID if OAuth used",
      },
      emailVerified: {
        bsonType: "bool",
        description: "Has the user verified their email",
        default: false,
      },
      onboarding: {
        bsonType: "object",
        required: ["currentStep", "completedSteps"],
        properties: {
          currentStep: {
            bsonType: "int",
            minimum: 0,
            description: "Current onboarding step index",
          },
          completedSteps: {
            bsonType: "array",
            items: { bsonType: "string" },
            description: "List of completed step identifiers",
          },
          startedAt: { bsonType: ["date", "null"] },
          completedAt: { bsonType: ["date", "null"] },
        },
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
      lastLoginAt: { bsonType: ["date", "null"] },
      // Optional additional profile fields that might be captured during onboarding
      profile: {
        bsonType: ["object", "null"],
        additionalProperties: true,
        properties: {
          firstName: { bsonType: ["string", "null"] },
          lastName: { bsonType: ["string", "null"] },
          country: { bsonType: ["string", "null"] },
          timezone: { bsonType: ["string", "null"] },
          marketingOptIn: { bsonType: ["bool", "null"] },
        },
      },
    },
  };

  // Onboarding steps collection schema (metadata for steps definitions)
  const onboardingStepsSchema = {
    bsonType: "object",
    required: ["key", "order", "title"],
    additionalProperties: true,
    properties: {
      _id: { bsonType: ["objectId"] },
      key: {
        bsonType: "string",
        description: "Unique step identifier (e.g., 'account', 'profile', 'preferences')",
      },
      order: {
        bsonType: "int",
        minimum: 0,
        description: "Display order for the step",
      },
      title: { bsonType: "string" },
      description: { bsonType: ["string", "null"] },
      isRequired: { bsonType: "bool" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  };

  // Create collections or update validators
  ensureCollectionWithValidator(db, "users", usersSchema);
  ensureCollectionWithValidator(db, "onboarding_steps", onboardingStepsSchema);

  // Ensure indexes
  ensureIndexes(db, "users", [
    { key: { email: 1 }, name: "uniq_email", unique: true },
    { key: { username: 1 }, name: "uniq_username", unique: true, partialFilterExpression: { username: { $type: "string" } } },
    { key: { oauthProvider: 1, oauthProviderId: 1 }, name: "oauth_provider_id", unique: true, partialFilterExpression: { oauthProvider: { $type: "string" }, oauthProviderId: { $type: "string" } } },
    { key: { "onboarding.currentStep": 1 }, name: "onboarding_currentStep" },
    { key: { createdAt: -1 }, name: "createdAt_desc" },
    { key: { updatedAt: -1 }, name: "updatedAt_desc" },
  ]);

  ensureIndexes(db, "onboarding_steps", [
    { key: { key: 1 }, name: "uniq_key", unique: true },
    { key: { order: 1 }, name: "order_asc" },
  ]);

  // Seed default onboarding steps if not present
  const stepsColl = db.getCollection("onboarding_steps");
  const existingCount = stepsColl.estimatedDocumentCount();
  if (existingCount === 0) {
    const now = new Date();
    stepsColl.insertMany([
      {
        key: "account",
        order: 0,
        title: "Create Account",
        description: "Set your email and password or use an OAuth provider.",
        isRequired: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "profile",
        order: 1,
        title: "Complete Profile",
        description: "Tell us about yourself to personalize your experience.",
        isRequired: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "preferences",
        order: 2,
        title: "Preferences",
        description: "Choose your interests and notification settings.",
        isRequired: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "summary",
        order: 3,
        title: "Summary",
        description: "Review and confirm your details.",
        isRequired: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    print("✓ Seeded onboarding_steps with default steps");
  } else {
    print(`• onboarding_steps already contains ${existingCount} documents`);
  }

  print(`Initialization complete on database '${currentDB}'`);
})();
