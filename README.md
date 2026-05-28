# ShieldAuth 🛡️

ShieldAuth is a secure, modern, and visually stunning user authentication service built using **Node.js, Express, SQLite, and JSON Web Tokens (JWT)**. It features a persistent local database and includes an interactive, high-fidelity glassmorphism Single Page Application (SPA) dashboard client. 

The dashboard provides a real-time **JWT Decoder & Inspector** panel, making it an excellent educational showcase for demonstrating modern web authentication flows.

---

## Key Features

- **Robust REST API**: Full auth pipeline including registration, secure login, profile inspection, profile updates, and account destruction.
- **Cryptographic Security**: Salted password hashing with `bcryptjs` and session tokens signed using `jsonwebtoken` (HMAC-SHA256).
- **Persistent Storage**: SQLite database persistent store (`auth.db`) with relational schema mapping and timestamps.
- **Glassmorphic UI**: High-end front-end dashboard using outfit/inter typography, backdrop filter overlays, floating background orbs, and neon glows.
- **Educational JWT Inspector**: Displays raw JWT session tokens and automatically decodes metadata (Headers) and claim parameters (Payloads) as they change.
- **Procedural SVG Avatars**: Procedural abstract SVG avatar generator that renders customizable avatars dynamically hashed from usernames.
- **Interactive Security Indicators**: Real-time password strength analyzer (Weak, Moderate, Strong) and alphanumeric username validators.
- **Toast Alerts**: Seamless, slide-in toaster notifications for real-time success, warning, error, and connection states.

---

## API Endpoints

All endpoints are prefixed with `/api/auth`.

| Method | Endpoint | Description | Auth Required | Body parameters |
| :--- | :--- | :--- | :---: | :--- |
| **POST** | `/register` | Registers a new user and returns a session JWT | No | `username`, `email`, `password` |
| **POST** | `/login` | Authenticates credentials and returns a session JWT | No | `identity` (username or email), `password` |
| **GET** | `/profile` | Fetches active profile details from database | **Yes** | None (Header: `Authorization: Bearer <token>`) |
| **PUT** | `/profile` | Modifies username, email, or sets a new password | **Yes** | `username`, `email`, `password` (current), `newPassword` (optional) |
| **DELETE**| `/profile` | Deletes user account and wipes records from database | **Yes** | `password` (current verification) |

---

## File Structure

```
auth-service/
├── middleware/
│   └── auth.js         # JWT Token verification middleware
├── routes/
│   └── auth.js         # Express router for API endpoints
├── public/             # Glassmorphic client app files
│   ├── index.html      # SPA structure
│   ├── style.css       # Design system, variables, and styles
│   └── app.js          # Forms, toasts, and JWT decoder logic
├── database.js         # Persistent SQLite configuration
├── index.js            # Express app entrypoint & middleware mounting
├── test.js             # End-to-end integration test harness
├── package.json        # Dependencies list
└── README.md           # Documentation
```

---

## Running Locally

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (Node 18+ recommended).

### 1. Install Dependencies
Initialize package dependencies:
```bash
npm install
```

### 2. Configure Environment variables
Create a `.env` file in the root directory (one is configured automatically with defaults):
```env
PORT=3000
JWT_SECRET=your_super_secret_signing_key
```

### 3. Run the Server
Start the Express application:
```bash
node index.js
```
The application will launch on **[http://localhost:3000](http://localhost:3000)**.

---

## Running Verification Tests

An automated, dependency-free test script is included to programmatically assert API endpoint behaviors. To execute the tests, ensure your server is running, then run:

```bash
node test.js
```

### Test Coverage:
1. Registers a new test account successfully.
2. Asserts unique constraint validations (duplicate usernames/emails fail registration).
3. Logins in using correct user credentials and receives JWT.
4. Asserts protected route access (successfully fetches profile details).
5. Modifies credentials (changes username, email, and password).
6. Authenticates with newly modified credentials.
7. Deletes the test account.
8. Asserts that profile access is correctly blocked (404/401) after account deletion.
