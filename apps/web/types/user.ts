export interface User {
    userId: string;
    username: string;
    name: string;
    password: string;
    profileImage: string;
    coverImage?: string;
    networks: string[];
    email: string;
    role: string;
    otp?: string;
    accountType: "Premium" | "Normal";
    isVerified: boolean;
    following: string[];
    followers: string[];
    status: "Online" | "Offline";
    createdAt: string;
    updatedAt: string;
}
