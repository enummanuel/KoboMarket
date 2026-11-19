# KoboMarket Backend

A multi-vendor marketplace backend built with **Node.js, Express, MongoDB, and PostgreSQL**. KoboMarket is designed to support buyers, vendors, and administrators, with separate databases for application data and financial transactions.

> **Project status:** Core backend setup, database connections, authentication, email verification, session management, password reset, and initial PostgreSQL financial and order schemas have been implemented. Checkout, escrow operations, payouts, and other marketplace workflows are still under development.

## Table of Contents

- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Database Design](#database-design)
- [Why Two Databases?](#why-two-databases)
- [Consistency, Concurrency and Idempotency](#consistency-concurrency-and-idempotency)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Known Limitations and Future Improvements](#known-limitations-and-future-improvements)

## Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | REST API framework |
| MongoDB | Application and user-related data |
| Mongoose | MongoDB object modelling |
| PostgreSQL | Financial and relational data |
| Knex.js | PostgreSQL query builder and migrations |
| JWT | Access-token authentication |
| bcrypt | Password hashing |
| Joi | Request validation |
| Docker Compose | Local database services |
| Helmet | HTTP security headers |
| CORS | Cross-origin resource sharing |

## Architecture Overview

KoboMarket uses a layered backend architecture. Routes receive requests, middleware handles validation and authentication, controllers coordinate requests, and services contain business logic. Models and database configuration modules handle persistence.

```mermaid
flowchart TD
    Client[Client Application]
    API[Express REST API]

    Client --> API

    API --> MW[Middleware<br/>Authentication · Validation · Error Handling]
    MW --> Routes[Routes]
    Routes --> Controllers[Controllers]
    Controllers --> Services[Service Layer]

    Services --> MongoConfig[MongoDB Connection]
    Services --> PGConfig[PostgreSQL Connection]

    MongoConfig --> Mongo[(MongoDB)]
    PGConfig --> Postgres[(PostgreSQL)]

    Mongo --> Users[Users · Sessions · Verification]
    Postgres --> Finance[Accounts · Wallets · Ledger]
    Postgres --> Orders[Orders · Sub-orders · Escrow]
```

### Architectural responsibilities

- **Routes:** Define API endpoints and connect middleware to controllers.
- **Middleware:** Handle request validation, authentication, role authorization, and error responses.
- **Controllers:** Handle HTTP requests and responses.
- **Services:** Contain application and business logic.
- **Models:** Define MongoDB document structures.
- **Migrations:** Define and manage PostgreSQL database structures.
- **Config:** Manage database connections and application configuration.

## Database Design

KoboMarket uses MongoDB and PostgreSQL for different categories of data.

### 1. PostgreSQL ERD

PostgreSQL stores relational and financial records that require structured relationships, constraints, and transactional operations.

The current database schema includes the following tables:

```mermaid
erDiagram
    ACCOUNTS {
        uuid id PK
        varchar user_id
        varchar account_type
        varchar currency
        timestamp created_at
    }

    WALLET_TRANSACTIONS {
        uuid id PK
        uuid account_id FK
        varchar transaction_type
        bigint amount_kobo
        varchar status
        timestamp created_at
    }

    LEDGER_ENTRIES {
        uuid id PK
        uuid transaction_id FK
        uuid account_id FK
        varchar entry_type
        bigint amount_kobo
        timestamp created_at
    }

    ORDERS {
        uuid id PK
        varchar buyer_id
        varchar reference
        varchar idempotency_key
        bigint total_amount_kobo
        varchar status
        timestamp created_at
    }

    SUB_ORDERS {
        uuid id PK
        uuid order_id FK
        varchar vendor_id
        bigint subtotal_kobo
        bigint commission_kobo
        bigint vendor_amount_kobo
        varchar status
    }

    ESCROW_TRANSACTIONS {
        uuid id PK
        uuid sub_order_id FK
        bigint amount_kobo
        varchar status
        timestamp created_at
    }

    ACCOUNTS ||--o{ WALLET_TRANSACTIONS : records
    ACCOUNTS ||--o{ LEDGER_ENTRIES : receives
    WALLET_TRANSACTIONS ||--o{ LEDGER_ENTRIES : generates
    ORDERS ||--o{ SUB_ORDERS : contains
    SUB_ORDERS ||--o| ESCROW_TRANSACTIONS : has
```

**Table descriptions**

| Table | Responsibility |
|---|---|
| `accounts` | Represents financial accounts, including user and system accounts. |
| `wallet_transactions` | Records wallet-related financial transactions. |
| `ledger_entries` | Stores debit and credit entries associated with financial transactions. |
| `orders` | Stores the main buyer order and its total amount. |
| `sub_orders` | Separates a buyer's order into vendor-specific orders. |
| `escrow_transactions` | Tracks escrow amounts associated with vendor sub-orders. |

All monetary amounts are designed to be stored as integer **kobo**, rather than floating-point values, to avoid precision errors.

The ledger is protected against direct updates and deletions by a database trigger. Financial records are intended to be auditable and append-only.

### 2. MongoDB Collections

MongoDB stores flexible application data and identity-related documents.

| Collection | Responsibility |
|---|---|
| `users` | Stores user profiles, email addresses, password hashes, roles, and verification status. |
| `sessions` | Stores hashed refresh tokens, token history, expiry dates, and revocation information. |
| `verifications` | Stores hashed OTP challenges for email verification and password resets, including expiry and attempt counts. |

**Why MongoDB for these collections?**

User profiles, verification challenges, and session records are document-oriented data. MongoDB provides a flexible document structure that suits these records and works naturally with Mongoose.

## Why Two Databases?

The two databases were selected based on the different requirements of application data and financial data.

### MongoDB — Application and identity data

MongoDB is used for information such as:

- User profiles and account information.
- Email verification challenges.
- Refresh-token sessions.
- Other flexible marketplace application records as development progresses.

### PostgreSQL — Financial and transactional data

PostgreSQL is used for information such as:

- Wallet accounts and transactions.
- Debit and credit ledger entries.
- Buyer orders and vendor sub-orders.
- Escrow records.
- Future payment, refund, dispute, and payout records.

Financial operations require strong relational constraints, transactional guarantees, and consistent records. PostgreSQL is therefore used as the primary database for financial operations.

This separation keeps identity and application data independent from the financial record system while allowing the backend services to coordinate operations across both databases.

## Consistency, Concurrency and Idempotency

These are important design considerations for a marketplace involving payments and multiple vendors.

### Cross-database consistency

MongoDB and PostgreSQL do not share a single database transaction. A transaction in one database cannot automatically roll back a successful operation in the other.

The intended checkout design is therefore based on a **saga-style approach**:

1. Validate the buyer, cart, product information, prices, and stock.
2. Start a PostgreSQL transaction for the financial and order records.
3. Lock and validate the relevant financial records before applying wallet and order changes.
4. Coordinate product stock updates in MongoDB.
5. If a cross-database operation fails, execute an appropriate compensating action to reverse or release the changes already made.

The complete checkout orchestration and compensation workflow is not yet implemented in the current submission.

### Concurrency

Concurrent requests can cause problems such as two buyers attempting to purchase the last available item or multiple requests spending the same wallet balance.

The intended implementation uses:

- PostgreSQL transactions to group related financial operations.
- Row-level locking when modifying balances.
- Database constraints to prevent duplicate records and invalid relationships.
- Atomic stock updates in MongoDB.
- Compensating operations when a cross-database workflow fails.

The complete concurrency-safe checkout implementation and its stress tests are still pending.

### Idempotency

Idempotency prevents a repeated request from creating duplicate financial or order operations.

The current `orders` schema includes an `idempotency_key` and a uniqueness constraint for the buyer and idempotency key combination.

The intended checkout endpoint will require an `Idempotency-Key` header. Repeated requests using the same key should return the original result instead of creating another order or processing another payment.

The database constraint is in place, but complete request-level idempotency handling is still under development.

## Getting Started

### Prerequisites

Install the following:

- Node.js (LTS recommended)
- npm
- Docker Desktop with Docker Compose
- Git

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd KoboMarket
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

```env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb://localhost:27017/kobomarket

DATABASE_URL=postgresql://kobomarket_user:kobomarket_dev_password@localhost:5432/kobomarket

OTP_SECRET=your_random_secret
ACCESS_TOKEN_SECRET=your_random_secret
ACCESS_TOKEN_EXPIRES_IN=15m
```

Generate secure random secrets for `OTP_SECRET` and `ACCESS_TOKEN_SECRET`. Do not commit your `.env` file or share its secret values.

### 4. Start the databases

```bash
docker compose up -d
```

This starts the MongoDB and PostgreSQL containers in the background.

To check their status:

```bash
docker compose ps
```

### 5. Run PostgreSQL migrations

```bash
npm run migrate
```

This creates the required PostgreSQL tables.

### 6. Seed the database

```bash
npm run seed
```

The seed command runs the project's seed script. Make sure the seed implementation is present in `seeds/index.js` before running it.

### 7. Start the API

For development:

```bash
npm run dev
```

Or:

```bash
npm start
```

The API runs on:

```text
http://localhost:5000
```

### 8. Check the health endpoint

```http
GET http://localhost:5000/api/health
```

A successful response should look like:

```json
{
  "success": true,
  "message": "KoboMarket API is running",
  "timestamp": "..."
}
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Port used by the Express server. |
| `NODE_ENV` | Application environment. |
| `MONGO_URI` | MongoDB connection string. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `OTP_SECRET` | Secret used to hash OTP values. |
| `ACCESS_TOKEN_SECRET` | Secret used to sign JWT access tokens. |
| `ACCESS_TOKEN_EXPIRES_IN` | Access-token expiration period. |

## API Overview

The current authentication routes are mounted under `/api/auth`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register a new buyer account. |
| POST | `/verify-email` | Verify an email using an OTP. |
| POST | `/resend-otp` | Request another verification OTP. |
| POST | `/login` | Authenticate a user. |
| POST | `/refresh` | Rotate a refresh token and issue a new access token. |
| POST | `/logout` | Revoke a refresh-token session. |
| POST | `/forgot-password` | Request a password-reset OTP. |
| POST | `/reset-password` | Reset a password using an OTP. |
| GET | `/me` | Retrieve the authenticated user's basic information. |
| GET | `/admin-test` | Test admin-role authorization. |

The health endpoint is available at `/api/health`.

**Development note:** OTP delivery currently uses the development console output. A production email delivery provider has not yet been integrated.

## Known Limitations and Future Improvements

The current implementation establishes the backend foundation, but several marketplace features remain incomplete.

### Authentication and security

- Integrate a real email delivery provider.
- Add login and OTP rate limiting.
- Improve automated authentication and authorization tests.
- Add startup validation for required environment variables.
- Review production CORS and deployment configuration.

### Marketplace functionality

- Complete vendor application and approval workflows.
- Implement product management, search, filtering, and reviews.
- Implement shopping cart and multi-vendor checkout.
- Add order fulfilment and status transitions.

### Financial functionality

- Complete wallet funding and payment-provider webhook integration.
- Implement double-entry ledger balancing and automated auditing.
- Complete escrow release, refunds, disputes, and vendor payouts.
- Add transaction-level idempotency and concurrency protection.

### Reliability and testing

- Implement cross-database compensation workflows.
- Add automated tests for concurrent checkout and wallet operations.
- Add background jobs for order completion and payout processing.
- Improve structured logging and monitoring.
- Add API documentation with Swagger.
- Improve Docker deployment and production configuration.

## Conclusion

KoboMarket is being developed with a clear separation between application data and financial records. MongoDB handles identity and flexible application documents, while PostgreSQL provides the relational and transactional foundation for financial operations.

The current submission focuses on establishing this architecture, implementing the authentication foundation, and creating the initial financial and order database structures. Further marketplace and financial workflows will be developed incrementally.