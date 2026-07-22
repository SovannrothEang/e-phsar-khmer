export type ReportPost = {
    ReportPostID: string;
    postId: number;
    userId: string;
    ReportReasonID: string;
    ReportPostDescription: string;
    Status: 'Pending' | 'Approved' | 'Rejected';
    CreatedAt: string;
    ReviewdBy?: string;
}