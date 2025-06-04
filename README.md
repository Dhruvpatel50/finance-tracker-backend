# 💰 TrackIT

A full-stack personal finance manager that helps users track income and expenses, visualize financial trends, and manage their budget effectively — with a secure, responsive UI.

---

## 🔍 Features

- 🧾 Add, view, and delete income/expense transactions
- 📊 Visual charts (bar/pie) showing financial patterns
- 💼 Secure user authentication with JWT
- 🧮 Live balance, income, and expense calculations
- 🔍 Filter transactions by category and date
- 📱 Responsive design for mobile and desktop
- 📤 Export data to CSV/PDF

---

## 🛠 Tech Stack

| Layer      | Technology                     | Description                                |
|-----------|---------------------------------|--------------------------------------------|
| Frontend  | React + Vite + Tailwind CSS     | Modern UI, fast builds, responsive design  |
| Backend   | Node.js + Express.js            | RESTful APIs with secure routes            |
| Database  | MongoDB + Mongoose              | User & transaction data storage            |
| Charts    | Recharts or Chart.js            | Interactive data visualization             |
| Auth      | JWT (or Clerk/Auth0)            | Token-based login system                   |
| Deploy    | Vercel, Render                  | Real-world deployment experience           |

---

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/personal-finance-tracker.git
cd personal-finance-tracker
```

### 2. Set up backend
```bash
cd server
npm install
# Create a .env file with:
# PORT=5000
# MONGO_URI=your_mongodb_connection_string
# JWT_SECRET=your_jwt_secret
npm start
```

### 3. Set up frontend
```bash
cd ../client
npm install
npm run dev
```

### Happy Coding
