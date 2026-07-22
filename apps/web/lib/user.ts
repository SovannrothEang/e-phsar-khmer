
export type ManageAds = {
    adsId: string
    title: string
    description: string
    price: number
    oldPrice?: number
    delivery?: boolean
    images: string[]
    postCategory: string
    postCateImage: string
    location: string
    createdAt: string
    like: number
    share: number
    totalAds: number
    status: "active" | "expired" | "pending" | "sold"
    userId: string
}

export type SaveAds = {
    savedAdsId: string
    postId: string
    title: string
    price: number
    location: string
    userId: string
}

export type LikeAds = {
    likedAdsId: string
    postId: string
    title: string
    price: number
    location: string
    userId: string
}

export type Post = {
    postId: string
    title: string
    description: string
    price: number
    oldPrice?: number
    delivery?: boolean
    images: string[]
    postCategory: string
    postCateImage: string
    province: string
    district: string
    commune: string
    createdAt: string
    like: number
    share: number
    userId: string
}

export type Notification = {
    id: string
    type: string
    title: string
    description: string
    createdAt: string
    receiverId: string
    senderId: string
    isRead: boolean
}
export type Chats = {
    chatId: string
    buyerId: BaseUser
    sellerId: BaseUser
    postId: string
    postCateImage: string
    postTitle: string
    postDescription: string
    postPrice: number
    postOldPrice?: number
    postDelivery?: boolean
    postImages: string[]
    postLocation: string
    postCreatedAt: string
    like: number
    share: number
    chatDate: string
}

export type BaseUser = {
    userId: string
    username: string
    name: string
    avatar: string
    cover: string
    locations: string
    following: number
    follower: number

    joinDate?: string
    phone?: string[]
    verified?: boolean

    userlink?: string

    email?: string
    google?: string
    facebook?: string
    telegram?: string

    userpost?: Post[]
    notifications?: Notification[]
}
export type User = BaseUser & {
    savedAds?: SaveAds[]
    likedAds?: LikeAds[]
    myAds?: ManageAds[]
    followingUsers?: BaseUser[]
    followerUsers?: BaseUser[]
}


export const currentUser: User = {
    userId: "1",
    username: "thouchsayi",
    name: "Thouch Sayi",
    avatar: "/avatar/sayi.png",
    cover: "/post-img/lamborghini.png",

    following: 1,
    follower: 2,

    joinDate: "2021-01-11",
    phone: ["0123456789", "0987654321"],
    verified: true,

    userlink: "@thouchsayi",

    email: "thuchsayi@gmail.com",
    google: "thuchsayi@gmail.com",
    facebook: "ThuchSayi",
    telegram: "",
    locations: "Phnom Penh",
    notifications: [],

    userpost: [
        {
            postId: "p1",
            title: "iPhone 13 Pro",
            description: "Like new",
            price: 900,
            images: ["/p1.jpg"],
            postCategory: "Phones",
            postCateImage: "/cat-phone.jpg",
            province: "Phnom Penh",
            district: "Phnom Penh",
            commune: "Phnom Penh",
            createdAt: "2025-01-01",
            like: 10,
            share: 2,
            userId: "1"
        }
    ],

    savedAds: [
        {
            savedAdsId: "s1",
            postId: "p2",
            title: "Honda Dream",
            price: 1200,
            location: "Phnom Penh",
            userId: "1"
        }
    ],

    likedAds: [],

    myAds: [
        {
            adsId: "a1",
            title: "iPhone 13 Pro",
            description: "Like new",
            price: 900,
            images: ["/p1.jpg"],
            postCategory: "Phones",
            postCateImage: "/cat-phone.jpg",
            location: "Phnom Penh",
            createdAt: "2025-01-01",
            like: 10,
            share: 2,
            totalAds: 1,
            status: "active",
            userId: "1"
        }
    ],

    followingUsers: [
        {
            userId: "2",
            username: "sokdara",
            name: "Sok Dara",
            avatar: "/avatar2.jpg",
            cover: "/cover2.jpg",
            following: 0,
            follower: 0,
            locations: "Phnom Penh",
        }
    ],

    followerUsers: []
}

export const users: User[] = [
    currentUser,
    {
        userId: "2",
        username: "nenneang",
        name: "Nen Neang",
        avatar: "/user-img/neang.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2026-01-11",
        phone: ["0123456789", "0987654321"],
        verified: true,
        email: "nenneang@gmail.com",
        google: "[EMAIL_ADDRESS]",
        facebook: "Nen Neang",
        telegram: "@nenneang",
        userlink: "@nenneang",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "3",
        username: "reahuhin",
        name: "ReaHu Hin",
        avatar: "/user-img/hin.png",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "@reahuhin",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "4",
        username: "sakuna",
        name: "Sakuna",
        avatar: "/user-img/sakuna.png",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "5",
        username: "limdararith",
        name: "Lim DaraRith",
        avatar: "/user-img/rith.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "6",
        username: "rinreaksmey",
        name: "Rin ReakSmey",
        avatar: "/user-img/pheary.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "7",
        username: "measmeakara",
        name: "Meas MeaKara",
        avatar: "/user-img/mk.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "8",
        username: "mankeang",
        name: "Man Keang",
        avatar: "/user-img/keang.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "9",
        username: "linary",
        name: "LinaRy",
        avatar: "/user-img/linary.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "10",
        username: "pheang",
        name: "Pheang",
        avatar: "/user-img/pheang.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "11",
        username: "pheap",
        name: "Pheap",
        avatar: "/user-img/pheap.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    },
    {
        userId: "12",
        username: "por",
        name: "Por",
        avatar: "/user-img/por.jpg",
        cover: "/user-img/newcover.jpg",
        following: 0,
        follower: 0,
        joinDate: "2020-01-11",
        phone: ["0123456789"],
        verified: true,
        email: "phat@gmail.com",
        userlink: "/public-profile/3",
        userpost: [],
        followingUsers: [],
        followerUsers: [],
        savedAds: [],
        likedAds: [],
        myAds: [],
        locations: "Phnom Penh",
    }

]