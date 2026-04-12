
# KickOff Futsal - MERN Setup Guide

## 1. Prerequisites
- **Node.js**: v18+ 
- **MongoDB**: Community Edition running locally on port 27017.

## 2. Installation
1. Create a folder `futsal-system`.
2. Save `server.js`, `package.json`, and all `.tsx` files into it.
3. Open terminal in the folder and run:
   ```bash
   npm install
   ```

## 3. Configuration
1. Create a `.env` file in the root:
   ```env
   MONGO_URI=mongodb://localhost:27017/kickoff
   JWT_SECRET=your_secret_key
   PORT=5000
   ```
2. Open `services/api.ts` and change `USE_REAL_BACKEND` to `true`.

## 4. Running the App
Execute the following to start the backend and frontend simultaneously:
```bash
npm run dev
```

## 5. Engineering Notes
- **Authentication**: Uses Bearer Tokens (JWT). The frontend automatically sends this in the `Authorization` header after login.
- **Data Safety**: All passwords are encrypted using `bcrypt`. Even if your database is hacked, user passwords remain secure.
- **Concurrency**: The backend handles multiple booking requests and prevents double-booking using the database logic in `server.js`.
