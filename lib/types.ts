export type UserRole = 'admin' | 'creator' | 'editor';
export type UserStatus = 'active' | 'inactive';
export type PaymentMethod = 'bank_transfer' | 'upi';

export type Pod = 'Pod 1' | 'Pod 2' | 'Pod 3';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  phone?: string;
  payment_method?: PaymentMethod;
  upi_id?: string;
  account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
  profile_pic_url?: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Editor {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  editor_type?: 'contract' | 'freelancer';
  ai_videos?: boolean;
  unavailable?: boolean;
  unavailable_reason?: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  user_id: string;
  contract_type: 'creator' | 'editor';
  video_topic?: string;
  rate_per_video?: number;
  deadline_days?: number;
  payment_terms?: string;
  contract_text?: string;
  status: 'sent' | 'accepted' | 'rejected';
  signature_token?: string;
  sent_at?: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Script {
  id: string;
  title: string;
  description?: string;
  content?: string;
  topic_category?: string;
  length_seconds?: number;
  pod?: Pod;
  client?: string;
  deadline?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'received';
  created_by?: string;
  created_at: string;
  assigned_at?: string;
  assigned_deadline?: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  script_id: string;
  creator_id: string;
  editor_name?: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  deadline?: string;
  submitted_at?: string;
  approved_at?: string;
  rejection_reason?: string;
  video_url?: string;
  created_at: string;
  updated_at: string;
  script?: Script;
  creator?: User;
}

export interface Edit {
  id: string;
  assignment_id?: string;
  editor_id: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'delivered';
  deadline?: string;
  input_video_url?: string;
  output_video_url?: string;
  submitted_at?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  assignment?: Assignment;
  editor?: User;
}

export interface Payment {
  id: string;
  user_id: string;
  related_to?: string;
  related_type?: 'creator_video' | 'editor_video';
  amount: number;
  status: 'pending' | 'paid' | 'failed';
  due_date?: string;
  paid_at?: string;
  payment_method?: PaymentMethod;
  notes?: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Delivery {
  id: string;
  edit_id?: string;
  client_name?: string;
  delivery_status: 'pending' | 'delivered' | 'failed';
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export const POD_COLORS: Record<string, string> = {
  'Pod 1': 'bg-blue-100 text-blue-800 border-blue-300',
  'Pod 2': 'bg-purple-100 text-purple-800 border-purple-300',
  'Pod 3': 'bg-orange-100 text-orange-800 border-orange-300',
};

export const POD_BORDER: Record<string, string> = {
  'Pod 1': 'border-l-blue-500',
  'Pod 2': 'border-l-purple-500',
  'Pod 3': 'border-l-orange-500',
};
