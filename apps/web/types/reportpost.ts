export type ReportPost = {
  ReportPostID: string;
  postId: string;
  userId: string;
  ReportReasonID: string;
  ReportPostDescription: string;
  Status: "Pending" | "Approved" | "Rejected";
  CreatedAt: string;
  ReviewedBy?: string;
};
