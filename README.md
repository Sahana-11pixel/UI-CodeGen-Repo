# UI-CodeGen — AI-Powered Screenshot to Code Converter

A full-stack web application that lets users write, run, and get AI feedback on frontend code (React, Vue, Svelte, HTML) directly in the browser — with a live preview.

---

## 🚀 Features

- **Live Code Editor** — Monaco Editor with syntax highlighting and theme toggle (light/dark)
- **AI Assistant** — Chat with Google Gemini AI to get help, explanations, and code improvements
- **Live Preview** — See your code render instantly in an iframe
- **Image Upload** — Upload UI screenshots and get AI-generated code from them
- **Project Management** — Save, load, and manage your projects from a personal dashboard
- **Version History** — Track code changes over time
- **User Authentication** — Firebase-based sign up, login, email verification, and password reset
- **Admin Panel** — Manage users and projects (admin only)
- **Settings** — Update profile, change password, manage account

---

## 🧱 Tech Stack

### Frontend
- **React** (Create React App + CRACO)
- **Monaco Editor** — VS Code-like editor in the browser
- **Firebase Auth** — Authentication
- **PostHog** — Analytics
- **Tailwind CSS**
- Deployed on **Vercel**

### Backend
- **FastAPI** (Python)
- **MongoDB + Motor** — Database
- **Firebase Admin SDK** — Token verification
- **Google Gemini AI** — AI code assistant
- **Cloudinary / AWS S3** — Image storage
- **OpenCV + Pillow** — Image processing
- Deployed on **Render**

---

## 📁 Project Structure

```
ui5_full/
├── frontend/          # React app
│   ├── src/
│   │   ├── pages/     # All page components
│   │   ├── components/# Reusable UI components
│   │   └── index.js
│   └── package.json
├── backend/           # FastAPI server
│   ├── server.py      # Main backend file
│   └── requirements.txt
└── README.md
```

---

## ⚙️ Getting Started (Local Development)

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MongoDB Atlas account
- Firebase project
- Google Gemini API key

### 1. Clone the repo

```bash
git clone https://github.com/your-username/ui5_full.git
cd ui5_full
```

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:

```env
MONGO_URI=your_mongodb_connection_string
FIREBASE_CREDENTIALS=your_firebase_service_account_json
GEMINI_API_KEY=your_gemini_api_key
CLOUDINARY_URL=your_cloudinary_url
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```

Run the server:

```bash
uvicorn server:app --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` folder:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

Run the app:

```bash
npm start
```

---

## 🌐 Deployment

| Service | Platform |
|--------|----------|
| Frontend | [Vercel](https://vercel.com) |
| Backend | [Render](https://render.com) |
| Database | [MongoDB Atlas](https://www.mongodb.com/atlas) |
| Auth | [Firebase](https://firebase.google.com) |

---

## 📄 License

This project is for personal/educational use.
