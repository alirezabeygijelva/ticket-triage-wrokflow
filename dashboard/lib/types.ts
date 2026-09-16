export type TicketStatus =
  | "auto_resolved"
  | "pending_staff"
  | "resolved"
  | "booking_pending"
  | "booking_confirmed"
  | "spam"
  | "pending_review";

export type TicketIntent = "question" | "booking" | "spam";
export type AnswerSource = "faq" | "staff_needed" | "not_applicable";
export type TicketChannel = "website" | "email" | "telegram";

export type TicketMessageRole = "customer" | "bot" | "staff";

export type TicketMessage = {
  id: string;
  ticket_id: string;
  role: TicketMessageRole;
  body: string;
  created_at: string | null;
};

export type Ticket = {
  id: string;
  message: string;
  customer_email: string | null;
  contact_id: string | null;
  channel: string | null;
  intent: string | null;
  answer_source: string | null;
  extracted_datetime: string | null;
  suggested_reply: string | null;
  staff_reply: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed: boolean;
  /** @deprecated kept for legacy rows */
  category: string | null;
  /** @deprecated kept for legacy rows */
  urgency: string | null;
  /** @deprecated kept for legacy rows */
  source: string | null;
};

export type BookingStatus =
  | "requested"
  | "confirmed"
  | "suggested"
  | "cancelled";

export type Booking = {
  id: string;
  ticket_id: string | null;
  requested_start: string | null;
  confirmed_start: string | null;
  duration_minutes: number;
  status: string;
  calendar_event_id: string | null;
  suggested_slots: string[] | null;
  created_at: string | null;
};
