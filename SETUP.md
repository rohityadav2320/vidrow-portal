# Vidrow Portal - Setup Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (https://supabase.com)
- Resend account (https://resend.com)

## 1. Supabase Setup

### Create a new Supabase project:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Enter project details:
   - Name: `vidrow-portal`
   - Database Password: (generate secure password)
   - Region: Choose closest to you
4. Wait for project to initialize (5-10 minutes)

### Create database schema:

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire content from `lib/schema.sql`
4. Paste it into the SQL editor
5. Click **Run**
6. Verify all tables are created (you'll see them in **Table Editor**)

### Get your credentials:

1. Go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

3. Update `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## 2. Resend Setup

1. Go to [Resend Dashboard](https://dashboard.resend.com)
2. Get your **API Key**
3. Update `.env.local`:
   ```
   RESEND_API_KEY=your_resend_api_key
   ```

## 3. Create Admin User

### Option A: Via Supabase Dashboard (easiest)

1. In Supabase, go to **Authentication** → **Users**
2. Click **Add User**
3. Enter:
   - Email: your@email.com
   - Password: (secure password)
4. Click **Create User**

Now create the user profile:

1. Go to **SQL Editor**
2. Run this query (replace values):
   ```sql
   INSERT INTO public.users (id, email, role, full_name, status)
   VALUES (
     'USER_ID_FROM_AUTH',  -- Copy the user ID from Auth > Users
     'your@email.com',
     'admin',
     'Your Name',
     'active'
   );
   ```

### Option B: Create via signup (during testing)

For now, you can create test users by signing up, then manually updating their role to 'admin' via the database.

## 4. Start the Development Server

```bash
# Install dependencies (if not done)
npm install

# Start dev server
npm run dev
```

Navigate to: http://localhost:3000

## 5. Login

Use the admin credentials you created:
- Email: your@email.com
- Password: (the password you set)

You should now see the Admin Dashboard!

## 6. Test Data (Optional)

To populate some test data, run this SQL in Supabase:

```sql
-- Insert test creators
INSERT INTO public.users (email, role, full_name, status)
VALUES 
  ('creator1@test.com', 'creator', 'Creator One', 'active'),
  ('creator2@test.com', 'creator', 'Creator Two', 'active'),
  ('editor1@test.com', 'editor', 'Editor One', 'active');

-- Insert test scripts
INSERT INTO public.scripts (title, description, topic_category, status, created_by)
VALUES
  ('First Script', 'Test video script', 'Technology', 'pending', (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
  ('Second Script', 'Another test script', 'Tutorial', 'pending', (SELECT id FROM users WHERE role = 'admin' LIMIT 1));
```

## Folder Structure

```
vidrow-portal/
├── app/
│   ├── (admin)/              # Admin portal routes (protected)
│   │   ├── dashboard/        # Main dashboard
│   │   ├── scripts/          # Scripts management
│   │   ├── contracts/        # Contract management
│   │   ├── payments/         # Payment tracking
│   │   └── creators/         # Creators/editors list
│   ├── (creator)/            # Creator portal (future)
│   ├── (editor)/             # Editor portal (future)
│   ├── auth/                 # Auth pages (public)
│   ├── api/                  # API routes
│   └── layout.tsx
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── auth.ts              # Auth utilities
│   ├── AuthContext.tsx      # Auth context provider
│   ├── types.ts             # TypeScript types
│   └── schema.sql           # Database schema
├── components/              # Reusable components
├── middleware.ts            # Route protection middleware
├── .env.local              # Environment variables
└── package.json
```

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
- Run: `npm install`

### "NEXT_PUBLIC_SUPABASE_URL is undefined"
- Make sure `.env.local` file exists with correct values
- Restart dev server after updating `.env.local`

### "Invalid API key"
- Check that you copied the correct anon key from Supabase
- Make sure API is enabled in Supabase project settings

### Login not working
- Verify admin user exists in Supabase Auth
- Check user profile exists in `public.users` table with role='admin'
- Check browser console for errors

## Next Steps

1. ✅ Admin authentication working
2. ⬜ Build kanban board (Phase 1)
3. ⬜ Build script CRUD forms (Phase 1)
4. ⬜ Build API endpoints (Phase 1)
5. ⬜ Contract automation (Phase 2)
6. ⬜ Payment tracking (Phase 2)
7. ⬜ Creator portal (Phase 3)
8. ⬜ Editor PWA (Phase 4)
