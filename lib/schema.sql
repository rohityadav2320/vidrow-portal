-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'creator', 'editor')),
  full_name VARCHAR(255),
  phone VARCHAR(20),
  payment_method VARCHAR(50) CHECK (payment_method IN ('bank_transfer', 'upi')),
  upi_id VARCHAR(255),
  account_number VARCHAR(255),
  ifsc_code VARCHAR(20),
  bank_name VARCHAR(255),
  profile_pic_url TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

-- Contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('creator', 'editor')),
  video_topic VARCHAR(500),
  rate_per_video DECIMAL(10, 2),
  deadline_days INTEGER,
  payment_terms TEXT,
  contract_text TEXT,
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'rejected')),
  signature_token VARCHAR(255) UNIQUE,
  sent_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scripts table
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  content TEXT,
  topic_category VARCHAR(255),
  length_seconds INTEGER,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'received')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_at TIMESTAMP WITH TIME ZONE,
  assigned_deadline TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments table (Creator assignments)
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'submitted', 'approved', 'rejected')),
  deadline TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Edits table (Editor assignments)
CREATE TABLE IF NOT EXISTS public.edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  editor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'submitted', 'approved', 'delivered')),
  deadline TIMESTAMP WITH TIME ZONE,
  input_video_url TEXT,
  output_video_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deliveries table (Client delivery tracking)
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edit_id UUID REFERENCES public.edits(id) ON DELETE CASCADE,
  client_name VARCHAR(255),
  delivery_status VARCHAR(50) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  related_to UUID,
  related_type VARCHAR(50) CHECK (related_type IN ('creator_video', 'editor_video')),
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method VARCHAR(50) CHECK (payment_method IN ('bank_transfer', 'upi')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_scripts_status ON public.scripts(status);
CREATE INDEX idx_scripts_created_by ON public.scripts(created_by);
CREATE INDEX idx_assignments_script_id ON public.assignments(script_id);
CREATE INDEX idx_assignments_creator_id ON public.assignments(creator_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_assignments_deadline ON public.assignments(deadline);
CREATE INDEX idx_edits_assignment_id ON public.edits(assignment_id);
CREATE INDEX idx_edits_editor_id ON public.edits(editor_id);
CREATE INDEX idx_edits_status ON public.edits(status);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_due_date ON public.payments(due_date);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin can read all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for contracts table
CREATE POLICY "Users can read their own contracts"
  ON public.contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can read all contracts"
  ON public.contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can insert contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update contracts"
  ON public.contracts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for scripts table
CREATE POLICY "Admin can read scripts"
  ON public.scripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can create scripts"
  ON public.scripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update scripts"
  ON public.scripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for assignments table
CREATE POLICY "Creators can read their own assignments"
  ON public.assignments FOR SELECT
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own assignments"
  ON public.assignments FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Admin can read all assignments"
  ON public.assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can create assignments"
  ON public.assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update assignments"
  ON public.assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for edits table
CREATE POLICY "Editors can read their own edits"
  ON public.edits FOR SELECT
  USING (auth.uid() = editor_id);

CREATE POLICY "Editors can update their own edits"
  ON public.edits FOR UPDATE
  USING (auth.uid() = editor_id);

CREATE POLICY "Admin can read all edits"
  ON public.edits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can create edits"
  ON public.edits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update edits"
  ON public.edits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for payments table
CREATE POLICY "Users can read their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can read all payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update payments"
  ON public.payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for deliveries table (admin only)
CREATE POLICY "Admin can read all deliveries"
  ON public.deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can create deliveries"
  ON public.deliveries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update deliveries"
  ON public.deliveries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    )
  );
