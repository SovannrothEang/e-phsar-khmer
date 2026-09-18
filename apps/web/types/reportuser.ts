export type ReportUser = {
  ReportUserID: string;
  TargetUserID: string;
  ReportedByUserID: string;
  ReportImage: string[];
  ReportReasonID: string;
  ReportUserDescription: string;
  Status: "Pending" | "Approved" | "Rejected";
  CreatedAt: string;
  ReviewedBy?: string;
};
