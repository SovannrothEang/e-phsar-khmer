export type ReportPost = {
    reportId: string;
    reportName: string;
    postId: string;
    reportPostReason: ReportPostOption[];
    reportPostDescription: string;
    reportPostCreatedAt: Date;
}
export type ReportUser = {
    reportId: string;
    reportName: string;
    userId: string;
    reportUserReason: ReportUserOption[];
    reportUserDescription: string;
    reportUserCreatedAt: Date;
}
export type ReportPostOption = {
    reportReasonId: string;
    reportPostReason: string;
}
export type ReportUserOption = {
    reportReasonId: string;
    reportUserReason: string;
}
