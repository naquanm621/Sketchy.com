# Sketchy.com MVP Backend

This is a Minimum Viable Product (MVP) backend for an Etsy-like marketplace, built with Node.js, Express, TypeScript, and Prisma.

## Core Features
1. **User Authentication:** Registration and Login with JWT and Role-Based Access Control (Buyers and Sellers).
2. **Shop & Product Management:** Sellers can create a shop and manage product listings.
3. **Product Discovery:** Public search and filtering for all product listings.
4. **Order Processing:** Atomic checkout process with automatic stock decrementing and order history.
5. **Image Support:** Local file uploads for product images using Multer.

## Technical Stack
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT & Bcryptjs
- **Testing:** Jest

## Getting Started

### 1. Prerequisites
- Node.js (v16 or higher)
- PostgreSQL database

### 2. Setup Environment
Create a `.env` file in the root directory (or update the existing one) with the following:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/etsy_mvp?schema=public"
PORT=3000
JWT_SECRET="your-super-secret-key"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Migration
Sync the Prisma schema with your local database:
```bash
npx prisma migrate dev --name init
```

### 5. Running the Application
- **Development mode (with reload):** `npm run dev`
- **Production build:** `npm run build && npm start`

### 6. Running Tests
```bash
npm test
```

## API Structure
- `/api/auth`: Register and Login
- `/api/shops`: Shop management (Sellers only)
- `/api/products`: Product management (Sellers) and Discovery (Public)
- `/api/orders`: Checkout and Order history (Buyers)

## License
ISC
