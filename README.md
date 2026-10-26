# Customer Inquiry Management System

React (Vite) + Node/Express + PostgreSQL.

## Setup
Requirements: Node 20.6+ (uses `node --env-file`), PostgreSQL running locally.

```bash
createdb inquiries

# Backend
cd backend
cp .env.example .env        # edit DATABASE_URL / JWT_SECRET (JWT_SECRET is required)
npm install
npm run migrate             # creates tables + seeds users
npm start                   # API on http://localhost:4000

# Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

## Test accounts (password: `password123`)
- staff1@example.com (staff)
- staff2@example.com (staff)
- manager@example.com (manager, sees all inquiries)

## Tests
Backend tests cover validation and status transition rules, authentication enforcement, ownership/access control, invalid inquiry IDs, stale-version conflicts, and invalid status transitions.
Frontend tests cover inquiry form validation and stale-data handling in the inquiry detail view.
```bash
cd backend && npm test      
cd frontend && npm test    
```
 

## API summary
| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/login, /api/auth/logout | httpOnly cookie session |
| GET | /api/auth/me | |
| GET | /api/inquiries?status=&q= | scoped by access rule |
| POST | /api/inquiries | validated, duplicate check |
| GET | /api/inquiries/:id | 400 bad id, 404 missing/no access |
| PATCH | /api/inquiries/:id/status | body `{status, version}`; 409 stale, 422 invalid transition |

## Testing gaps
The automated tests cover key business, security, validation, and UI-state behaviour. Full end-to-end browser testing is not included.
