import { SubscriptionCategory } from "@/types/subscription";

const MOCK_NOW = new Date("2024-01-01");

export const subscriptioncategories: SubscriptionCategory[] = [
    {
        subscriptionCateId: "1",
        subscriptioncatename: "Auto",
        subscriptioncateslug: "auto",
        desc: "Increase your listing up to 30 Ads, 10 renew & 20 auto-renew in category cars, motor, bike & rental.",
        createdAt: MOCK_NOW,
        updatedAt: MOCK_NOW,
        subscriptionplans: [
            {
                subscriptionPlanId: "1",
                subscriptionplanname: "Bronze",
                subscriptionplanslug: "bronze",
                subscriptionplandesc: "Start From 60 $ For 6 Months",
                createdAt: MOCK_NOW,
                updatedAt: MOCK_NOW,
                subscriptionpackage: [
                    {
                        SubscriptionPackageId: "1",
                        subscriptionPackagename: "Bronze",
                        subscriptionPackagephoto: "PhotosPhotos 24",
                        subscriptionPackageads: "Ads 30",
                        subscriptionPackagerenews: "Renews 10",
                        subscriptionPackageautorenews: "Auto-Renews 20",
                        subscriptionPackagevideos: "Videos 10",
                        createdAt: MOCK_NOW,
                        updatedAt: MOCK_NOW,
                        subscriptionterm: [
                            {
                                SubscriptionTermId: "1",
                                subscriptiontermname: "6 Months",
                                subscriptiontermdurationvalue: 6,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 60,
                                subscriptiontermdiscount: 0,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "2",
                                subscriptiontermname: "1 Year",
                                subscriptiontermdurationvalue: 1,
                                subscriptiontermdurationunit: "year",
                                subscriptiontermprice: 100,
                                subscriptiontermdiscount: 20,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            }
                        ],
                    }
                ]
            },
        ]
    },
    {
        subscriptionCateId: "2",
        subscriptioncatename: "Food",
        subscriptioncateslug: "food",
        desc: "Increase your listing up to 200 Ads, 20 renew & 20 auto-renew in food category.",
        createdAt: MOCK_NOW,
        updatedAt: MOCK_NOW,
        subscriptionplans: [
            {
                subscriptionPlanId: "2",
                subscriptionplanname: "Bronze",
                subscriptionplanslug: "bronze",
                subscriptionplandesc: "Start From 60 $ For 6 Months",
                subscriptionpackage: [
                    {
                        SubscriptionPackageId: "2",
                        subscriptionPackagename: "Bronze",
                        subscriptionPackagephoto: "PhotosPhotos 24",
                        subscriptionPackageads: "Ads 200",
                        subscriptionPackagerenews: "Renews 20",
                        subscriptionPackageautorenews: "Auto-Renews 20",
                        subscriptionPackagevideos: "Videos 20",
                        createdAt: MOCK_NOW,
                        updatedAt: MOCK_NOW,
                        subscriptionterm: [
                            {
                                SubscriptionTermId: "1",
                                subscriptiontermname: "6 Months",
                                subscriptiontermdurationvalue: 6,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 60,
                                subscriptiontermdiscount: 0,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "2",
                                subscriptiontermname: "1 Year",
                                subscriptiontermdurationvalue: 1,
                                subscriptiontermdurationunit: "year",
                                subscriptiontermprice: 100,
                                subscriptiontermdiscount: 20,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            }
                        ],
                    }
                ],
                createdAt: MOCK_NOW,
                updatedAt: MOCK_NOW,
            },
        ]
    },
    {
        subscriptionCateId: "3",
        subscriptioncatename: "General",
        subscriptioncateslug: "general",
        desc: "Increase your listing up to 200 Ads, 20 renew & 20 auto-renew in category phone, tablet, computer, electronic, furniture, decor & fashion.",
        createdAt: MOCK_NOW,
        updatedAt: MOCK_NOW,
        subscriptionplans: [
            {
                subscriptionPlanId: "3",
                subscriptionplanname: "Bronze",
                subscriptionplanslug: "bronze",
                subscriptionplandesc: "Start From 60 $ For 6 Months",
                subscriptionpackage: [
                    {
                        SubscriptionPackageId: "3",
                        subscriptionPackagename: "Bronze",
                        subscriptionPackagephoto: "PhotosPhotos 24",
                        subscriptionPackageads: "Ads 200",
                        subscriptionPackagerenews: "Renews 20",
                        subscriptionPackageautorenews: "Auto-Renews 20",
                        subscriptionPackagevideos: "Videos 20",
                        createdAt: MOCK_NOW,
                        updatedAt: MOCK_NOW,
                        subscriptionterm: [
                            {
                                SubscriptionTermId: "1",
                                subscriptiontermname: "6 Months",
                                subscriptiontermdurationvalue: 6,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 60,
                                subscriptiontermdiscount: 0,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "2",
                                subscriptiontermname: "1 Year",
                                subscriptiontermdurationvalue: 1,
                                subscriptiontermdurationunit: "year",
                                subscriptiontermprice: 100,
                                subscriptiontermdiscount: 20,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            }
                        ],
                    }
                ],
                createdAt: MOCK_NOW,
                updatedAt: MOCK_NOW,
            },
        ]
    },
    {
        subscriptionCateId: "4",
        subscriptioncatename: "Property",
        subscriptioncateslug: "property",
        desc: "Increase your listing up to 1000 Ads, 75 renew, 75 auto-renew, 2 featured Ads & 1 top Ads in category house, land, condo, apartment & rental.",
        createdAt: MOCK_NOW,
        updatedAt: MOCK_NOW,
        subscriptionplans: [
            {
                subscriptionPlanId: "4",
                subscriptionplanname: "Bronze",
                subscriptionplanslug: "bronze",
                subscriptionplandesc: "Start From 90 $ For 3 Months",
                subscriptionpackage: [
                    {
                        SubscriptionPackageId: "4",
                        subscriptionPackagename: "Bronze",
                        subscriptionPackagephoto: "PhotosPhotos 24",
                        subscriptionPackageads: "Ads 200",
                        subscriptionPackagerenews: "Renews 20",
                        subscriptionPackageautorenews: "Auto-Renews 20",
                        subscriptionPackagevideos: "Videos 20",
                        createdAt: MOCK_NOW,
                        updatedAt: MOCK_NOW,
                        subscriptionterm: [
                            {
                                SubscriptionTermId: "3",
                                subscriptiontermname: "3 Months",
                                subscriptiontermdurationvalue: 3,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 90,
                                subscriptiontermdiscount: 0,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "4",
                                subscriptiontermname: "6 Months",
                                subscriptiontermdurationvalue: 6,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 180,
                                subscriptiontermdiscount: 5,
                                subscriptiontermdiscounttype: "percent",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "5",
                                subscriptiontermname: "1 Year",
                                subscriptiontermdurationvalue: 1,
                                subscriptiontermdurationunit: "year",
                                subscriptiontermprice: 360,
                                subscriptiontermdiscount: 15,
                                subscriptiontermdiscounttype: "percent",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            }
                        ],
                    }
                ],
                createdAt: MOCK_NOW,
                updatedAt: MOCK_NOW,
            },
            {
                subscriptionPlanId: "5",
                subscriptionplanname: "Siliver",
                subscriptionplanslug: "siliver",
                subscriptionplandesc: "Start From 210 $ For 3 Months",
                subscriptionpackage: [
                    {
                        SubscriptionPackageId: "5",
                        subscriptionPackagename: "Siliver",
                        subscriptionPackagephoto: "PhotosPhotos 24",
                        subscriptionPackageads: "Ads 800",
                        subscriptionPackagerenews: "Renews 50",
                        subscriptionPackageautorenews: "Auto-Renews 50",
                        subscriptionPackagevideos: "Videos 50",
                        createdAt: MOCK_NOW,
                        updatedAt: MOCK_NOW,
                        subscriptionterm: [
                            {
                                SubscriptionTermId: "6",
                                subscriptiontermname: "3 Months",
                                subscriptiontermdurationvalue: 3,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 210,
                                subscriptiontermdiscount: 0,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "7",
                                subscriptiontermname: "6 Months",
                                subscriptiontermdurationvalue: 6,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 420,
                                subscriptiontermdiscount: 5,
                                subscriptiontermdiscounttype: "percent",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "8",
                                subscriptiontermname: "1 Year",
                                subscriptiontermdurationvalue: 1,
                                subscriptiontermdurationunit: "year",
                                subscriptiontermprice: 840,
                                subscriptiontermdiscount: 15,
                                subscriptiontermdiscounttype: "percent",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            }
                        ],
                    }
                ],
                createdAt: MOCK_NOW,
                updatedAt: MOCK_NOW,
            },
            {
                subscriptionPlanId: "6",
                subscriptionplanname: "Gold",
                subscriptionplanslug: "gold",
                subscriptionplandesc: "Start From 450 $ For 3 Months",
                subscriptionpackage: [
                    {
                        SubscriptionPackageId: "6",
                        subscriptionPackagename: "Gold",
                        subscriptionPackagephoto: "PhotosPhotos 24",
                        subscriptionPackageads: "Ads 1000",
                        subscriptionPackagerenews: "Renews 75",
                        subscriptionPackageautorenews: "Auto-Renews 75",
                        subscriptionPackagevideos: "Videos 75",
                        createdAt: MOCK_NOW,
                        updatedAt: MOCK_NOW,
                        subscriptionterm: [
                            {
                                SubscriptionTermId: "9",
                                subscriptiontermname: "3 Months",
                                subscriptiontermdurationvalue: 3,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 450,
                                subscriptiontermdiscount: 0,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "10",
                                subscriptiontermname: "6 Months",
                                subscriptiontermdurationvalue: 6,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 900,
                                subscriptiontermdiscount: 5,
                                subscriptiontermdiscounttype: "percent",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "11",
                                subscriptiontermname: "1 Year",
                                subscriptiontermdurationvalue: 1,
                                subscriptiontermdurationunit: "year",
                                subscriptiontermprice: 1800,
                                subscriptiontermdiscount: 15,
                                subscriptiontermdiscounttype: "percent",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            }
                        ],
                    }
                ],
                createdAt: MOCK_NOW,
                updatedAt: MOCK_NOW,
            },
        ]
    },
    {
        subscriptionCateId: "5",
        subscriptioncatename: "Services",
        subscriptioncateslug: "services",
        desc: "Increase your listing up to 30 Ads, 10 renew & 20 auto-renew in service category.",
        createdAt: MOCK_NOW,
        updatedAt: MOCK_NOW,
        subscriptionplans: [
            {
                subscriptionPlanId: "7",
                subscriptionplanname: "Bronze",
                subscriptionplanslug: "bronze",
                subscriptionplandesc: "Start From 60 $ For 6 Months",
                subscriptionpackage: [
                    {
                        SubscriptionPackageId: "7",
                        subscriptionPackagename: "Bronze",
                        subscriptionPackagephoto: "PhotosPhotos 24",
                        subscriptionPackageads: "Ads 30",
                        subscriptionPackagerenews: "Renews 10",
                        subscriptionPackageautorenews: "Auto-Renews 20",
                        subscriptionPackagevideos: "videos 10",
                        createdAt: MOCK_NOW,
                        updatedAt: MOCK_NOW,
                        subscriptionterm: [
                            {
                                SubscriptionTermId: "12",
                                subscriptiontermname: "6 Months",
                                subscriptiontermdurationvalue: 6,
                                subscriptiontermdurationunit: "month",
                                subscriptiontermprice: 60,
                                subscriptiontermdiscount: 0,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            },
                            {
                                SubscriptionTermId: "13",
                                subscriptiontermname: "1 Year",
                                subscriptiontermdurationvalue: 1,
                                subscriptiontermdurationunit: "year",
                                subscriptiontermprice: 100,
                                subscriptiontermdiscount: 20,
                                subscriptiontermdiscounttype: "amount",
                                createdAt: MOCK_NOW,
                                updatedAt: MOCK_NOW,
                            }
                        ],
                    }
                ],
                createdAt: MOCK_NOW,
                updatedAt: MOCK_NOW,
            },
        ]
    },
]