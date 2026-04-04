# Project Architecture & Model Connections

## Overview
This project is a full-stack application using Electron for the desktop shell, a Node.js/Express backend, and a Vue 3 frontend (with Vite). MongoDB is used for data persistence via Mongoose models.

## Folder Structure
- `main/` — Node.js/Express backend (API, models, routes, services)
- `client/` — Vue 3 frontend (SPA, components, views, assets)
- `clear-electron-cache.js` — Utility script
- `package.json` — Project dependencies and scripts

## Backend (main/)
- `models/` — Mongoose schemas for MongoDB
  - `customer.js` — Customer data
  - `user.js` — User data (system users)
  - `order.js` — Order data (references customer, user, status)
  - `status.js` — Status definitions (name, displayName)
- `routes/` — Express route handlers (e.g., auth)
- `services/` — Business logic (e.g., auth.service.js)
- `index.js` — App entry point
- `preload.js` — Electron preload script
- `server.js` — Server startup

## Frontend (client/)
- Vue 3 + Vite SPA
- Components, views, router, and state management (Pinia)

## Model Connections
- **Order**
  - `customerID` → references `Customer` (_id)
  - `createdUser` → references `User` (_id)
  - `status` → references `Status` (_id)
  - `paymentStatus` — enum: unpaid, partial, paid
  - `weight`, `createdDate`, `deliveryDate`
- **Status**
  - `name` — unique identifier (e.g., 'pending')
  - `displayName` — user-friendly label (e.g., 'Pending')
- **Customer**
  - Customer details (fields as defined in customer.js)
- **User**
  - User details (fields as defined in user.js)

## Context
- Electron provides the desktop shell and launches the backend server.
- The backend exposes REST APIs for CRUD operations on models.
- The frontend communicates with the backend via HTTP (fetch/axios).
- All data is persisted in MongoDB using Mongoose models.

## Notes
- All model relationships use MongoDB ObjectId references.
- Statuses are managed in a separate collection for flexibility (e.g., adding new statuses without code changes).
- The architecture supports modular expansion (add new models, services, or frontend features as needed).
