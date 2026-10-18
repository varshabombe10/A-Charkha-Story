# A Charkha Story — Premium Handcrafted Clothing Store

A premium e-commerce web platform dedicated to highlighting authentic, handcrafted Indian clothing like khadi, silk, cotton, and chanderi textiles. Built with Node.js, Express, and SQLite.

## 🚀 Features

- **Storefront & Product Catalog**: Dynamic product pages with real-time filtering by category and fabric.
- **Cart System**: Persistent shopping cart saved in session state.
- **Order Management**: Order placement system with user order history.
- **User Authentication**: Secure user registration, login, and session management using `bcryptjs`.
- **Custom UI**: Beautiful, handcrafted vanilla HTML/CSS/JS frontend without relying on heavy frameworks.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (via `sql.js`)
- **Authentication**: `express-session`, `bcryptjs`
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## 📂 Project Structure

```text
├── database/          # Database connection, schemas, and initial seeding scripts
│   ├── init.js        # Core DB initialization and helpers
│   └── store.db       # SQLite database file
├── middleware/        # Express middleware (e.g., auth.js)
├── public/            # Static assets and frontend architecture
│   ├── css/           # Styling files
│   ├── js/            # Client-side vanila JS logic
│   └── *.html         # Web pages (index, products, cart, checkout, login, orders)
├── routes/            # REST API Routes
│   ├── auth.js        # /api/auth    (login, register, logout, profile)
│   ├── cart.js        # /api/cart    (add, remove, update actions)
│   ├── orders.js      # /api/orders  (place order, history)
│   └── products.js    # /api/products(catalog, filter APIs)
├── server.js          # Express entry point and application wrapper
├── package.json       # Project dependencies and details
└── README.md          # Technical documentation
```

## ⚙️ Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## 📦 Installation & Setup

1. **Install Dependencies**:
   Open your terminal in the project directory and run:
   ```bash
   npm install
   ```

2. **Run the Application**:
   Start the application in development or production mode:
   ```bash
   npm start
   ```
   **Alternative**: Use `npm run dev` to start in development mode.

3. **Access the Website**:
   Open your browser and navigate to:
   [http://localhost:3000](http://localhost:3000)

## 🔐 Demo Credentials

A seed user is configured automatically in the database for immediate testing:
- **Email**: `demo@charkha.in`
- **Password**: `demo1234`

## 🔗 API Documentation

### Product Routes
- `GET /api/products` - Fetch all products (supports query filters)
- `GET /api/products/:id` - Fetch single product details
- `GET /api/products/categories` - Fetch all distinct capabilities
- `GET /api/products/fabrics` - Fetch all distinct fabrics

### Authentication Routes
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Authenticate user and create session
- `POST /api/auth/logout` - Destroy existing user session
- `GET /api/auth/me` - Fetch authenticated user details

### Cart Routes (Requires Session state)
- `GET /api/cart` - Retrieve current cart items
- `POST /api/cart` - Add an item to the cart
- `PUT /api/cart/:id` - Update cart item quantity
- `DELETE /api/cart/:id` - Remove cart item
- `POST /api/cart/clear` - Empty the current cart

### Order Routes (Requires Authentication)
- `POST /api/orders` - Complete checkout and place order
- `GET /api/orders` - Retrieve list of past orders for the authenticated user

## 🛡️ License & Copyright

Proprietary Software - Developed for A Charkha Story. All Rights Reserved.
