# TaskFlow

TaskFlow is a modern Kanban-style project management application inspired by Trello, Notion, and Linear.

The application includes authentication, realtime synchronization, task management, boards, drag-and-drop functionality, and a modern responsive interface.

---

# Features

## Authentication

- Register with email and password
- Login with email and password
- Google authentication
- Password recovery
- Persistent sessions
- Secure logout

## Boards and Tasks

- Create boards
- Edit and delete boards
- Create columns/lists
- Create task cards
- Drag and drop tasks between columns
- Edit task details
- Delete tasks
- Realtime synchronization

## Task Features

Each task supports:

- Title
- Description
- Due date
- Priority
- Labels/tags
- Checklist
- Completion state

## UI/UX

- Responsive design
- Dark/light mode
- Modern SaaS-style interface
- Smooth animations
- Hover effects
- Toast notifications
- Loading states
- Empty states

---

# Tech Stack

## Frontend

- HTML
- CSS
- JavaScript
- React or Next.js

## Backend

- Firebase Authentication
- Firebase Realtime Database

## Deployment

- Vercel
- Firebase Hosting

---

# Project Structure

```bash
TaskFlow/
│
├── public/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── context/
│   ├── styles/
│   ├── utils/
│   └── firebase/
│
├── package.json
├── README.md
└── .env
```

---

# Installation

## Clone the repository

```bash
git clone https://github.com/yourusername/taskflow.git
cd taskflow
```

## Install dependencies

```bash
npm install
```

## Run development server

```bash
npm run dev
```

---

# Firebase Setup

## 1. Create a Firebase project

Go to:

https://console.firebase.google.com/

Create a new Firebase project.

---

## 2. Enable Authentication

Inside Firebase:

Authentication → Sign-in method

Enable:

- Email/Password
- Google

---

## 3. Create Realtime Database

Realtime Database → Create Database

Start in test mode during development.

---

## 4. Add Firebase Config

Create a `.env` file:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

# Firebase Realtime Database Structure

```json
{
  "users": {
    "uid": {
      "boards": {
        "boardId": {
          "title": "Development",
          "columns": {
            "columnId": {
              "title": "To Do",
              "tasks": {
                "taskId": {
                  "title": "Create login page",
                  "description": "Build authentication UI",
                  "priority": "high"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

# Firebase Security Rules

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

---

# Available Scripts

```bash
npm run dev
```
Starts development server.

```bash
npm run build
```
Builds the application for production.

```bash
npm run preview
```
Previews production build locally.

---

# Deployment

## Deploy to Vercel

Install Vercel CLI:

```bash
npm install -g vercel
```

Deploy:

```bash
vercel
```

---

## Deploy to Firebase Hosting

Install Firebase CLI:

```bash
npm install -g firebase-tools
```

Login:

```bash
firebase login
```

Initialize:

```bash
firebase init
```

Deploy:

```bash
firebase deploy
```

---

# Future Improvements

- Team collaboration
- Invite system
- Comments on tasks
- File uploads
- Notifications
- Activity history
- Workspace system
- Mobile app
- AI task assistant

---

# Contributing

Contributions are welcome.

1. Fork the repository
2. Create a new branch
3. Commit changes
4. Push the branch
5. Open a Pull Request

---

# License

This project is licensed under the MIT License

# Permissions

This project is private, if you want to tale a file or something, you have to contact with me, the creator.
Discord: Iker Santana
