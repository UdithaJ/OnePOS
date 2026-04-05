# OnePOS

## Overview
OnePOS is a full-stack desktop application for service record management, built with Electron, Node.js/Express, Vue 3 (Vite), and MongoDB. It features a modular architecture for easy expansion and maintainability.

---

## Project Architecture

- **Electron**: Provides the desktop shell and launches the backend server.
- **Backend (main/)**: Node.js/Express server, REST API, business logic, and Mongoose models for MongoDB.
- **Frontend (client/)**: Vue 3 SPA (Single Page Application) built with Vite, using Pinia for state management.
- **Database**: MongoDB, accessed via Mongoose models.

---

## Folder Structure

```
OnePOS/
│
├── main/                # Backend (Node.js/Express)
│   ├── models/          # Mongoose schemas (customer, user, order, status, etc.)
│   ├── controllers/     # Route controllers (business logic for each resource)
│   ├── routes/          # Express route handlers (use .route.js naming convention)
---

## API Structure & Conventions

- **Routes** are defined in `main/routes/` and use the `.route.js` suffix (e.g., `customer.route.js`).
- **Controllers** are in `main/controllers/` and contain the business logic for each resource (e.g., `customer.controller.js`).
- Each route file imports its controller and delegates request handling to controller functions.
- This separation improves maintainability and scalability as the project grows.

**Example:**

```
// main/routes/customer.route.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');

router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
```

---
│   ├── services/        # Service layer (e.g., auth)
│   ├── index.js         # App entry point
│   ├── preload.js       # Electron preload script
│   └── server.js        # Server startup
│
├── client/              # Frontend (Vue 3 + Vite)
│   ├── src/             # Source code (components, views, router, stores)
│   ├── public/          # Static assets
│   ├── package.json     # Frontend dependencies
│   └── ...
│
├── clear-electron-cache.js # Utility script
├── package.json         # Project dependencies and scripts
└── PROJECT_ARCHITECTURE.md # Detailed architecture and model connections
```

---


## Key Models & Relationships

- **Order**
  - `customerID` → references `Customer` (_id)
  - `createdUser` → references `User` (_id)
  - `status` → references `Status` (_id)
  - `paymentStatus` — enum: unpaid, partial, paid
  - `weight`, `createdDate`, `deliveryDate`, `totalAmount`, `dueAmount`, `rackNumber`

- **Customer**
  - `firstName`, `lastName`, `mobileNumber`, `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`

- **User**
  - `firstName`, `lastName`, `userName` (unique), `userRole`, `section` (optional, references Section), `referenceNo` (unique), `password` (hashed), `profileImage`

- **Status**
  - `name` (unique), `displayName`

- **CashBox**
  - `name`, `status` (enum: active, inactive)

- **CashBoxSession**
  - `openedAt`, `openedBy` (User), `openingAmount`, `closedAt`, `closedBy` (User), `closingAmount`

- **CashFlowEvent**
  - `event_type` (enum: PAYMENT, EXPENSE), `date`, `amount`, `userId` (User), `source_id`, `sessionId` (CashBoxSession)

- **Expense**
  - `amount`, `expenseType` (ExpenseCategory), `date`

- **ExpenseCategory**
  - `name` (unique), `displayName`

- **Payment**
  - `amount`, `orderId` (Order), `customerId` (Customer), `type` (enum: advance, full_payment, settlement), `paymentMethod` (enum: cash, card, bank, other), `date`

> All relationships use MongoDB ObjectId references. See each model file in `main/models/` for full details.

---

## How It Works

1. **Electron** starts the backend server and serves the Vue frontend.
2. **Frontend** communicates with the backend via HTTP (fetch/axios).
3. **Backend** exposes REST APIs for CRUD operations on all models.
4. **MongoDB** persists all data, with relationships managed via ObjectId references.

---

## Development

### Install dependencies
```sh
npm install
```

### Run in development mode
```sh
npm run dev
```

### Build for production
```sh
npm run build
```

---

## Notes
- Statuses are managed in a separate collection for flexibility.
- The architecture supports modular expansion (add new models, services, or frontend features as needed).
- See `PROJECT_ARCHITECTURE.md` for more details on model connections and data flow.
