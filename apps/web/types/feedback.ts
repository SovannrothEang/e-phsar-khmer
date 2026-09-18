export type Feedback = {
  FeedbackID: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  description: string;
  images?: string[];
  CreatedAt: string;
};
