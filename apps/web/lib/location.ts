export type Province = {
    proId: string
    name: string
    slug: string
    districts: District[]
}
export type District = {
    disId: string
    name: string
    slug: string
    communes: Commune[]
}
export type Commune = {
    comId: string
    name: string
    slug: string
}
export const locations: Province[] = [
    {
        proId: "1",
        name: "Phnom Penh",
        slug: "phnom-penh",
        districts: [
            {
                disId: "1",
                name: "Boeng Keng Kang",
                slug: "boeng-keng-kang",
                communes: [
                    { comId: "1", name: "Boeng Keng Kang Bei", slug: "boeng-keng-kang-bei" },
                    { comId: "2", name: "Boeng Keng Kang Muoy", slug: "boeng-keng-kang-muoy" },
                    { comId: "3", name: "Boeng Keng Kang Pir", slug: "boeng-keng-kang-pir" },
                    { comId: "4", name: "Olympic", slug: "olympic" },
                    { comId: "5", name: "Tumnob Tuek", slug: "tumnob-tuek" },
                    { comId: "6", name: "Tuol Svay Prey Muoy", slug: "tuol-svay-prey-muoy" },
                    { comId: "7", name: "Tuol Svay Prey Pir", slug: "tuol-svay-prey-pir" },
                ],
            },
            {
                disId: "2",
                name: "Chamkar Mon",
                slug: "chamkar-mon",
                communes: [
                    {
                        comId: "8",
                        name: "Boeng Trabaek",
                        slug: "boeng-trabaek",
                    },
                    {
                        comId: "9",
                        name: "Phsar Daeum Thkov",
                        slug: "phsar-daeum-thkov",
                    },
                    {
                        comId: "10",
                        name: "Tonle Basak",
                        slug: "tonle-basak",
                    },
                    {
                        comId: "11",
                        name: "Tuol Tumpung Muoy",
                        slug: "tuol-tumpung-muoy",
                    },
                    {
                        comId: "12",
                        name: "Tuol Tumpung Pir",
                        slug: "tuol-tumpung-pir",
                    },

                ],
            },
            {
                disId: "3",
                name: "Chbar Ampov",
                slug: "chbar-ampov",
                communes: [
                    {
                        comId: "13",
                        name: "Chbar Ampov Muoy",
                        slug: "chbar-ampov-muoy",
                    },
                    {
                        comId: "14",
                        name: "Chbar Ampov Pir",
                        slug: "chbar-ampov-pir",
                    },
                    {
                        comId: "15",
                        name: "Kbal Kaoh",
                        slug: "kbal-kaoh",
                    },
                    {
                        comId: "16",
                        name: "Nirouth",
                        slug: "nirouth",
                    },
                    {
                        comId: "17",
                        name: "Preaek Aeng",
                        slug: "preaek-aeng",
                    },
                    {
                        comId: "18",
                        name: "Preaek Pra",
                        slug: "preaek-pra",
                    },
                    {
                        comId: "19",
                        name: "Preaek Thmei",
                        slug: "preaek-thmei",
                    },
                    {
                        comId: "20",
                        name: "Veal Sbov",
                        slug: "veal-sbov",
                    },
                ],
            },
            {
                disId: "4",
                name: "Chrouy Changva",
                slug: "chrouy-changva",
                communes: [
                    {
                        comId: "21",
                        name: "Bak Khaeng",
                        slug: "bak-khaeng",
                    },
                    {
                        comId: "22",
                        name: "Chrouy Changva",
                        slug: "chrouy-changva",
                    },
                    {
                        comId: "23",
                        name: "Kaoh Dach",
                        slug: "kaoh-dach",
                    },
                    {
                        comId: "24",
                        name: "Preaek Lieb",
                        slug: "preaek-lieb",
                    },
                    {
                        comId: "25",
                        name: "Preaek Ta Sek",
                        slug: "preaek-ta-sek",
                    },

                ],
            },
            {
                disId: "5",
                name: "Dangkao",
                slug: "dangkao",
                communes: [
                    {
                        comId: "26",
                        name: "Cheung Aek",
                        slug: "cheung-aek",
                    },
                    {
                        comId: "27",
                        name: "Dangkao",
                        slug: "dangkao",
                    },
                    {
                        comId: "28",
                        name: "Kong Noy",
                        slug: "kong-noy",
                    },
                    {
                        comId: "29",
                        name: "Krang Pongro",
                        slug: "krang-pongro",
                    },
                    {
                        comId: "30",
                        name: "Pong Tuek",
                        slug: "pong-tuek",
                    },
                    {
                        comId: "31",
                        name: "Preaek Kampis",
                        slug: "preaek-kampis",
                    },
                    {
                        comId: "32",
                        name: "Prey Sa",
                        slug: "prey-sa",
                    },
                    {
                        comId: "33",
                        name: "Prey Veaeng",
                        slug: "prey-veaeng",
                    },
                    {
                        comId: "34",
                        name: "Roluos",
                        slug: "roluos",
                    },
                    {
                        comId: "35",
                        name: "Sak Sampov",
                        slug: "sak-sampov",
                    },
                    {
                        comId: "36",
                        name: "Spean Thma",
                        slug: "spean-thma",
                    },
                    {
                        comId: "37",
                        name: "Tien",
                        slug: "tien",
                    },
                ],
            },
            {
                disId: "6",
                name: "Doun Penh",
                slug: "doun-penh",
                communes: [
                    {
                        comId: "38",
                        name: "Boeng Reang",
                        slug: "boeng-reang",
                    },
                    {
                        comId: "39",
                        name: "Chakto Mukh",
                        slug: "chakto-mukh",
                    },
                    {
                        comId: "40",
                        name: "Chey Chumneah",
                        slug: "chey-chumneah",
                    },
                    {
                        comId: "41",
                        name: "Phsar Chas",
                        slug: "phsar-chas",
                    },
                    {
                        comId: "42",
                        name: "Phsar Kandal Muoy",
                        slug: "phsar-kandal-muoy",
                    },
                    {
                        comId: "43",
                        name: "Phsar Kandal Pir",
                        slug: "phsar-kandal-pir",
                    },
                    {
                        comId: "44",
                        name: "Phsar Thmei Bei",
                        slug: "phsar-thmei-bei",
                    },
                    {
                        comId: "45",
                        name: "Phsar Thmei Muoy",
                        slug: "phsar-thmei-muoy",
                    },
                    {
                        comId: "46",
                        name: "Phsar Thmei Pir",
                        slug: "phsar-thmei-pir",
                    },
                    {
                        comId: "47",
                        name: "Srah Chak",
                        slug: "srah-chak",
                    },
                    {
                        comId: "48",
                        name: "Voat Phnum",
                        slug: "voat-phnum",
                    },

                ],
            },
            {
                disId: "7",
                name: "Kamboul",
                slug: "kamboul",
                communes: [
                    {
                        comId: "49",
                        name: "Boeng Thum",
                        slug: "boeng-thum",
                    },
                    {
                        comId: "50",
                        name: "Kamboul",
                        slug: "kamboul",
                    },
                    {
                        comId: "51",
                        name: "Kantaok",
                        slug: "kantaok",
                    },
                    {
                        comId: "52",
                        name: "Ovlaok",
                        slug: "ovlaok",
                    },
                    {
                        comId: "53",
                        name: "Phleung Chheh Roteh",
                        slug: "phleung-chheh-roteh",
                    },
                    {
                        comId: "54",
                        name: "Prateah Lang",
                        slug: "prateah-lang",
                    },
                    {
                        comId: "55",
                        name: "Snao",
                        slug: "snao",
                    },

                ],
            },
            {
                disId: "8",
                name: "Mean Chey",
                slug: "mean-chey",
                communes: [
                    {
                        comId: "56",
                        name: "Boeung Tumpun 1",
                        slug: "boeng-tumpun-1",
                    },
                    {
                        comId: "57",
                        name: "Boeung Tumpun 2",
                        slug: "boeng-tumpun-2",
                    },
                    {
                        comId: "58",
                        name: "Chak Angrae Kraom",
                        slug: "chak-angrae-kraom",
                    },
                    {
                        comId: "59",
                        name: "Chak Angrae Leu",
                        slug: "chak-angrae-leu",
                    },
                    {
                        comId: "60",
                        name: "Steung Mean Chey 1",
                        slug: "steung-mean-chey-1",
                    },
                    {
                        comId: "61",
                        name: "Steung Mean Chey 2",
                        slug: "steung-mean-chey-2",
                    },
                    {
                        comId: "62",
                        name: "Steung Mean Chey 3",
                        slug: "steung-mean-chey-3",
                    },
                ],
            },
            {
                disId: "9",
                name: "Por Senchey",
                slug: "por-senchey",
                communes: [
                    {
                        comId: "63",
                        name: "Chaom Chau 1",
                        slug: "chaom-chau-1",
                    },
                    {
                        comId: "64",
                        name: "Chaom Chau 2",
                        slug: "chaom-chau-2",
                    },
                    {
                        comId: "65",
                        name: "Chaom Chau 3",
                        slug: "chaom-chau-3",
                    },
                    {
                        comId: "66",
                        name: "Kakab 1",
                        slug: "kakab-1",
                    },
                    {
                        comId: "67",
                        name: "Kakab 2",
                        slug: "kakab-2",
                    },
                    {
                        comId: "68",
                        name: "Samraong Kraom",
                        slug: "samraong-kraom",
                    },
                    {
                        comId: "69",
                        name: "Trapeang Krasang",
                        slug: "trapeang-krasang",
                    },

                ],
            },
            {
                disId: "10",
                name: "Prampir Meakkakra",
                slug: "prampir-meakkakra",
                communes: [
                    {
                        comId: "70",
                        name: "Boeng Prolit",
                        slug: "boeng-prolit",
                    },
                    {
                        comId: "71",
                        name: "Mittakpheap",
                        slug: "mittakpheap",
                    },
                    {
                        comId: "72",
                        name: "Monourom",
                        slug: "monourom",
                    },
                    {
                        comId: "73",
                        name: "Ou Ruessei Bei",
                        slug: "ou-ruessei-bei",
                    },
                    {
                        comId: "74",
                        name: "Ou Ruessei Buon",
                        slug: "ou-ruessei-buon",
                    },
                    {
                        comId: "75",
                        name: "Ou Ruessei Muoy",
                        slug: "ou-ruessei-muoy",
                    },
                    {
                        comId: "76",
                        name: "Ou Ruessei Pir",
                        slug: "ou-ruessei-pir",
                    },
                    {
                        comId: "77",
                        name: "Veal Vong",
                        slug: "veal-vong",
                    },

                ],
            },
            {
                disId: "11",
                name: "Preaek Pnov",
                slug: "preaek-pnov",
                communes: [
                    {
                        comId: "78",
                        name: "Kouk Roka",
                        slug: "kouk-roka",
                    },
                    {
                        comId: "79",
                        name: "Ponhea Pon",
                        slug: "ponhea-pon",
                    },
                    {
                        comId: "80",
                        name: "Ponsang",
                        slug: "ponsang",
                    },
                    {
                        comId: "81",
                        name: "Preaek Pnov",
                        slug: "preaek-pnov",
                    },
                    {
                        comId: "82",
                        name: "Samraong",
                        slug: "samraong",
                    },

                ],
            },
            {
                disId: "12",
                name: "Ruessei Kaev",
                slug: "ruessei-kaev",
                communes: [
                    {
                        comId: "83",
                        name: "Chrang Chamreh Muoy",
                        slug: "chrang-chamreh-muoy",
                    },
                    {
                        comId: "84",
                        name: "Chrang Chamreh Pir",
                        slug: "chrang-chamreh-pir",
                    },
                    {
                        comId: "85",
                        name: "Kiloumaetr Lekh Prammuoy",
                        slug: "kiloumaetr-lekh-prammuoy",
                    },
                    {
                        comId: "86",
                        name: "Ruessei Kaev",
                        slug: "ruessei-kaev",
                    },
                    {
                        comId: "87",
                        name: "Svay Pak",
                        slug: "svay-pak",
                    },
                    {
                        comId: "88",
                        name: "Tuol Sangkae 1",
                        slug: "tuol-sangkae-1",
                    },
                    {
                        comId: "89",
                        name: "Tuol Sangkae 2",
                        slug: "tuol-sangkae-2",
                    },
                ],
            },
            {
                disId: "13",
                name: "Saensokh",
                slug: "saensokh",
                communes: [
                    {
                        comId: "90",
                        name: "Khmuonh",
                        slug: "khmuonh",
                    },
                    {
                        comId: "91",
                        name: "Kouk Khleang",
                        slug: "kouk-khleang",
                    },
                    {
                        comId: "92",
                        name: "Krang Thnong",
                        slug: "krang-thnong",
                    },
                    {
                        comId: "93",
                        name: "Ou Baek K'am",
                        slug: "ou-baek-kam",
                    },
                    {
                        comId: "94",
                        name: "Phnom Penh Thmei",
                        slug: "phnom-penh-thmei",
                    },
                    {
                        comId: "95",
                        name: "Tuek Thla",
                        slug: "tuek-thla",
                    },
                ],
            },
            {
                disId: "14",
                name: "Tuol Kouk",
                slug: "tuol-kouk",
                communes: [
                    {
                        comId: "96",
                        name: "Boeng Kak Muoy",
                        slug: "boeng-kak-muoy",
                    },
                    {
                        comId: "97",
                        name: "Boeng Kak Pir",
                        slug: "boeng-kak-pir",
                    },
                    {
                        comId: "98",
                        name: "Boeng Salang",
                        slug: "boeng-salang",
                    },
                    {
                        comId: "99",
                        name: "Phsar Daeum Kor",
                        slug: "phsar-daeum-kor",
                    },
                    {
                        comId: "100",
                        name: "Phsar Depou Bei",
                        slug: "phsar-depou-bei",
                    },
                    {
                        comId: "101",
                        name: "Phsar Depou Muoy",
                        slug: "phsar-depou-muoy",
                    },
                    {
                        comId: "102",
                        name: "Phsar Depou Pir",
                        slug: "phsar-depou-pir",
                    },
                    {
                        comId: "103",
                        name: "Tuek L'ak Bei",
                        slug: "tuek-lak-bei",
                    },
                    {
                        comId: "104",
                        name: "Tuek L'ak Muoy",
                        slug: "tuek-lak-muoy",
                    },
                    {
                        comId: "105",
                        name: "Tuek L'ak Pir",
                        slug: "tuek-lak-pir",
                    },
                ],
            },
        ],
    },
    {
        proId: "2",
        slug: "preah-sihanouk",
        name: "Preah Sihanouk",
        districts: [
            {
                disId: "15",
                name: "Kampong Seila",
                slug: "kampong-seila",
                communes: [
                    {
                        comId: "106",
                        name: "Chamkar Luong",
                        slug: "chamkar-luong",
                    },
                    {
                        comId: "107",
                        name: "Kampong Seila",
                        slug: "kampong-seila",
                    },
                    {
                        comId: "108",
                        name: "Ou Bak Roteh",
                        slug: "ou-bak-roteh",
                    },
                    {
                        comId: "109",
                        name: "Stueng Chhay",
                        slug: "stueng-chhay",
                    },
                ],
            },
            {
                disId: "16",
                name: "Krong Kampong Saom",
                slug: "krong-kampong-saom",
                communes: [
                    {
                        comId: "110",
                        name: "Bet Trang",
                        slug: "bet-trang",
                    },
                    {
                        comId: "111",
                        name: "Boeng Ta Prum",
                        slug: "boeng-ta-prum",
                    },
                    {
                        comId: "112",
                        name: "Ou Chrov",
                        slug: "ou-chrov",
                    },
                    {
                        comId: "113",
                        name: "Ou Oknha Heng",
                        slug: "ou-oknha-heng",
                    },
                    {
                        comId: "114",
                        name: "Ream",
                        slug: "ream",
                    },
                ],
            },
            {
                disId: "17",
                name: "Krong Preah Sihanouk",
                slug: "krong-preah-sihanouk",
                communes: [
                    {
                        comId: "115",
                        name: "Kaoh Rung",
                        slug: "kaoh-rung",
                    },
                    {
                        comId: "116",
                        name: "Sangkat Bei",
                        slug: "sangkat-bei",
                    },
                    {
                        comId: "117",
                        name: "Sangkat Buon",
                        slug: "sangkat-buon",
                    },
                    {
                        comId: "118",
                        name: "Sangkat Muoy",
                        slug: "sangkat-muoy",
                    },
                    {
                        comId: "119",
                        name: "Sangkat Pir",
                        slug: "sangkat-pir",
                    },
                ],
            },
            {
                disId: "18",
                name: "Prey Nob",
                slug: "prey-nob",
                communes: [
                    {
                        comId: "120",
                        name: "Andoung Thma",
                        slug: "andoung-thma",
                    },
                    {
                        comId: "121",
                        name: "Cheung Kou",
                        slug: "cheung-kou",
                    },
                    {
                        comId: "122",
                        name: "Prey Nob",
                        slug: "prey-nob",
                    },
                    {
                        comId: "123",
                        name: "Sameakki",
                        slug: "sameakki",
                    },
                    {
                        comId: "124",
                        name: "Samrong",
                        slug: "samrong",
                    },
                    {
                        comId: "125",
                        name: "Tuek L'ak",
                        slug: "tuek-lak",
                    },
                    {
                        comId: "126",
                        name: "Tuek Thla",
                        slug: "tuek-thla",
                    },
                    {
                        comId: "127",
                        name: "Tuol Toetueng",
                        slug: "tuol-toetueng",
                    },
                    {
                        comId: "128",
                        name: "Veal Renh",
                        slug: "veal-renh",
                    },
                ],
            },
            {
                disId: "19",
                name: "Stueng Hav",
                slug: "stueng-hav",
                communes: [
                    {
                        comId: "129",
                        name: "Kampenh",
                        slug: "kampenh",
                    },
                    {
                        comId: "130",
                        name: "Ou Treh",
                        slug: "ou-treh",
                    },
                    {
                        comId: "131",
                        name: "Tunob Rolok",
                        slug: "tunob-rolok",
                    },
                ],
            },
        ],
    },
    {
        proId: "3",
        slug: "kampong-cham",
        name: "Kampong Cham",
        districts: [
            {
                disId: "20",
                name: "Batheay",
                slug: "batheay",
                communes: [
                    {
                        comId: "132",
                        name: "Batheay",
                        slug: "batheay",
                    },
                    {
                        comId: "133",
                        name: "Chbar Ampov",
                        slug: "chbar-ampov",
                    },
                    {
                        comId: "134",
                        name: "Chealea",
                        slug: "chealea",
                    },
                    {
                        comId: "135",
                        name: "Cheung Prey",
                        slug: "cheung-prey",
                    },
                    {
                        comId: "136",
                        name: "Me Pring",
                        slug: "me-pring",
                    },
                    {
                        comId: "137",
                        name: "Ph'av",
                        slug: "ph-av",
                    },
                    {
                        comId: "138",
                        name: "Sambour",
                        slug: "sambour",
                    },
                    {
                        comId: "139",
                        name: "Sandaek",
                        slug: "sandaek",
                    },
                    {
                        comId: "140",
                        name: "Tang Krang",
                        slug: "tang-krang",
                    },
                    {
                        comId: "141",
                        name: "Tang Krasang",
                        slug: "tang-krasang",
                    },
                    {
                        comId: "142",
                        name: "Trab",
                        slug: "trab",
                    },
                    {
                        comId: "143",
                        name: "Tumnob",
                        slug: "tumnob",
                    },
                ],
            },
            {
                disId: "21",
                name: "Chamkar Leu",
                slug: "chamkar-leu",
                communes: [
                    {
                        comId: "144",
                        name: "Bos Khnaor",
                        slug: "bos-khnaor",
                    },
                    {
                        comId: "145",
                        name: "Chamkar Andoung",
                        slug: "chamkar-andoung",
                    },
                    {
                        comId: "146",
                        name: "Cheyyou",
                        slug: "cheyyou",
                    },
                    {
                        comId: "147",
                        name: "Lvea Leu",
                        slug: "lvea-leu",
                    },
                    {
                        comId: "148",
                        name: "Spueu",
                        slug: "spueu",
                    },
                    {
                        comId: "149",
                        name: "Svay Teab",
                        slug: "svay-teab",
                    },
                    {
                        comId: "150",
                        name: "Ta Ong",
                        slug: "ta-ong",
                    },
                    {
                        comId: "151",
                        name: "Ta Prok",
                        slug: "ta-prok",
                    },
                ],
            },
            {
                disId: "22",
                name: "Cheung Prey",
                slug: "cheung-prey",
                communes: [
                    {
                        comId: "152",
                        name: "Khnaor Dambang",
                        slug: "khnaor-dambang",
                    },
                    {
                        comId: "153",
                        name: "Kouk Rovieng",
                        slug: "kouk-rovieng",
                    },
                    {
                        comId: "154",
                        name: "Phdau Chum",
                        slug: "phdau-chum",
                    },
                    {
                        comId: "155",
                        name: "Prey Char",
                        slug: "prey-char",
                    },
                    {
                        comId: "156",
                        name: "Pring Chrum",
                        slug: "pring-chrum",
                    },
                    {
                        comId: "157",
                        name: "Sampong Chey",
                        slug: "sampong-chey",
                    },
                    {
                        comId: "158",
                        name: "Sdaeung Chey",
                        slug: "sdaeung-chey",
                    },
                    {
                        comId: "159",
                        name: "Soutip",
                        slug: "soutip",
                    },
                    {
                        comId: "160",
                        name: "Srama",
                        slug: "srama",
                    },
                    {
                        comId: "161",
                        name: "Trapeang Kor",
                        slug: "trapeang-kor",
                    },
                ],
            },
            {
                disId: "23",
                name: "Kampong Siem",
                slug: "kampong-siem",
                communes: [
                    {
                        comId: "162",
                        name: "Ampil",
                        slug: "ampil",
                    },
                    {
                        comId: "163",
                        name: "Han Chey",
                        slug: "han-chey",
                    },
                    {
                        comId: "164",
                        name: "Kaoh Mitt",
                        slug: "kaoh-mitt",
                    },
                    {
                        comId: "165",
                        name: "Kaoh Roka",
                        slug: "kaoh-roka",
                    },
                    {
                        comId: "166",
                        name: "Kaoh Samraong",
                        slug: "kaoh-samraong",
                    },
                    {
                        comId: "167",
                        name: "Kaoh Tontuem",
                        slug: "kaoh-tontuem",
                    },
                    {
                        comId: "168",
                        name: "Kien Chrey",
                        slug: "kien-chrey",
                    },
                    {
                        comId: "169",
                        name: "Kokor",
                        slug: "kokor",
                    },
                    {
                        comId: "170",
                        name: "Krala",
                        slug: "krala",
                    },
                    {
                        comId: "171",
                        name: "Ou Svay",
                        slug: "ou-svay",
                    },
                    {
                        comId: "172",
                        name: "Ro'ang",
                        slug: "ro-ang",
                    },
                    {
                        comId: "173",
                        name: "Rumchek",
                        slug: "rumchek",
                    },
                    {
                        comId: "174",
                        name: "Srak",
                        slug: "srak",
                    },
                    {
                        comId: "175",
                        name: "Trean",
                        slug: "trean",
                    },
                    {
                        comId: "176",
                        name: "Vihear Thum",
                        slug: "vihear-thum",
                    },
                ],
            },
            {
                disId: "24",
                name: "Kang Meas",
                slug: "kang-meas",
                communes: [
                    {
                        comId: "177",
                        name: "Angkor Ban",
                        slug: "angkor-ban",
                    },
                    {
                        comId: "178",
                        name: "Kang Ta Noeng",
                        slug: "kang-ta-noeng",
                    },
                    {
                        comId: "179",
                        name: "Khchau",
                        slug: "khchau",
                    },
                    {
                        comId: "180",
                        name: "Peam Chi Kang",
                        slug: "peam-chi-kang",
                    },
                    {
                        comId: "181",
                        name: "Preaek Koy",
                        slug: "preaek-koy",
                    },
                    {
                        comId: "182",
                        name: "Preaek Krabau",
                        slug: "preaek-krabau",
                    },
                    {
                        comId: "183",
                        name: "Reay Pay",
                        slug: "reay-pay",
                    },
                    {
                        comId: "184",
                        name: "Roka Ar",
                        slug: "roka-ar",
                    },
                    {
                        comId: "185",
                        name: "Roka Koy",
                        slug: "roka-koy",
                    },
                    {
                        comId: "186",
                        name: "Sdau",
                        slug: "sdau",
                    },
                    {
                        comId: "187",
                        name: "Sour Kong",
                        slug: "sour-kong",
                    },
                ],
            },
            {
                disId: "25",
                name: "Kaoh Soutin",
                slug: "kaoh-soutin",
                communes: [
                    {
                        comId: "188",
                        name: "Kampong Reab",
                        slug: "kampong-reab",
                    },
                    {
                        comId: "189",
                        name: "Kaoh Soutin",
                        slug: "kaoh-soutin",
                    },
                    {
                        comId: "190",
                        name: "Lve",
                        slug: "lve",
                    },
                    {
                        comId: "191",
                        name: "Moha Khnhoung",
                        slug: "moha-khnhoung",
                    },
                    {
                        comId: "192",
                        name: "Moha Leaph",
                        slug: "moha-leaph",
                    },
                    {
                        comId: "193",
                        name: "Peam Prathnuoh",
                        slug: "peam-prathnuoh",
                    },
                    {
                        comId: "194",
                        name: "Pongro",
                        slug: "pongro",
                    },
                    {
                        comId: "195",
                        name: "Preaek Ta Nong",
                        slug: "preaek-ta-nong",
                    },
                ],
            },
            {
                disId: "26",
                name: "Krong Kampong Cham",
                slug: "krong-kampong-cham",
                communes: [
                    {
                        comId: "196",
                        name: "Boeng Kok",
                        slug: "boeng-kok",
                    },
                    {
                        comId: "197",
                        name: "Kampong Cham",
                        slug: "kampong-cham",
                    },
                    {
                        comId: "198",
                        name: "Sambuor Meas",
                        slug: "sambuor-meas",
                    },
                    {
                        comId: "199",
                        name: "Veal Vong",
                        slug: "veal-vong",
                    },
                ],
            },
            {
                disId: "27",
                name: "Prey Chhor",
                slug: "prey-chhor",
                communes: [
                    {
                        comId: "200",
                        name: "Baray",
                        slug: "baray",
                    },
                    {
                        comId: "201",
                        name: "Boeng Nay",
                        slug: "boeng-nay",
                    },
                    {
                        comId: "202",
                        name: "Chrey Vien",
                        slug: "chrey-vien",
                    },
                    {
                        comId: "203",
                        name: "Khvet Thum",
                        slug: "khvet-thum",
                    },
                    {
                        comId: "204",
                        name: "Kor",
                        slug: "kor",
                    },
                    {
                        comId: "205",
                        name: "Krouch",
                        slug: "krouch",
                    },
                    {
                        comId: "206",
                        name: "Lvea",
                        slug: "lvea",
                    },
                    {
                        comId: "207",
                        name: "Mien",
                        slug: "mien",
                    },
                    {
                        comId: "208",
                        name: "Prey Chhor",
                        slug: "prey-chhor",
                    },
                    {
                        comId: "209",
                        name: "Samraong",
                        slug: "samraong",
                    },
                    {
                        comId: "210",
                        name: "Sour Saen",
                        slug: "sour-saen",
                    },
                    {
                        comId: "211",
                        name: "Srangae",
                        slug: "srangae",
                    },
                    {
                        comId: "212",
                        name: "Thma Pun",
                        slug: "thma-pun",
                    },
                    {
                        comId: "213",
                        name: "Tong Rong",
                        slug: "tong-rong",
                    },
                    {
                        comId: "214",
                        name: "Trapeang Preah",
                        slug: "trapeang-preah",
                    },
                ],
            },
            {
                disId: "28",
                name: "Srei Santhor",
                slug: "srei-santhor",
                communes: [
                    {
                        comId: "215",
                        name: "Baray",
                        slug: "baray",
                    },
                    {
                        comId: "216",
                        name: "Chi Bal",
                        slug: "chi-bal",
                    },
                    {
                        comId: "217",
                        name: "Kaoh Andaet",
                        slug: "kaoh-andaet",
                    },
                    {
                        comId: "218",
                        name: "Khnar Sa",
                        slug: "khnar-sa",
                    },
                    {
                        comId: "219",
                        name: "Mean Chey",
                        slug: "mean-chey",
                    },
                    {
                        comId: "220",
                        name: "Pram Yam",
                        slug: "pram-yam",
                    },
                    {
                        comId: "221",
                        name: "Preaek Dambouk",
                        slug: "preaek-dambouk",
                    },
                    {
                        comId: "222",
                        name: "Preaek Pou",
                        slug: "preaek-pou",
                    },
                    {
                        comId: "223",
                        name: "Preaek Rumdeng",
                        slug: "preaek-rumdeng",
                    },
                    {
                        comId: "224",
                        name: "Pteah Kandal",
                        slug: "pteah-kandal",
                    },
                    {
                        comId: "225",
                        name: "Ruessei Srok",
                        slug: "ruessei-srok",
                    },
                    {
                        comId: "226",
                        name: "Svay Pou",
                        slug: "svay-pou",
                    },
                    {
                        comId: "227",
                        name: "Svay Sach Phnum",
                        slug: "svay-sach-phnum",
                    },
                    {
                        comId: "228",
                        name: "Tong Tralach",
                        slug: "tong-tralach",
                    },
                ],
            },
            {
                disId: "29",
                name: "Stueng Trang",
                slug: "stueng-trang",
                communes: [
                    {
                        comId: "229",
                        name: "Areaks Tnaot",
                        slug: "areaks-tnaot",
                    },
                    {
                        comId: "230",
                        name: "Dang Kdar",
                        slug: "dang-kdar",
                    },
                    {
                        comId: "231",
                        name: "Khpob Ta Nguon",
                        slug: "khpob-ta-nguon",
                    },
                    {
                        comId: "232",
                        name: "Me Sar Chrey",
                        slug: "me-sar-chrey",
                    },
                    {
                        comId: "233",
                        name: "Ou Mlu",
                        slug: "ou-mlu",
                    },
                    {
                        comId: "234",
                        name: "Peam Kaoh Sna",
                        slug: "peam-kaoh-sna",
                    },
                    {
                        comId: "235",
                        name: "Preaek Bak",
                        slug: "preaek-bak",
                    },
                    {
                        comId: "236",
                        name: "Preaek Kak",
                        slug: "preaek-kak",
                    },
                    {
                        comId: "237",
                        name: "Preah Andoung",
                        slug: "preah-andoung",
                    },
                    {
                        comId: "238",
                        name: "Soupheas",
                        slug: "soupheas",
                    },
                    {
                        comId: "239",
                        name: "Tuol Preah Khleang",
                        slug: "tuol-preah-khleang",
                    },
                    {
                        comId: "240",
                        name: "Tuol Sambuor",
                        slug: "tuol-sambuor",
                    },
                ],
            },
        ],
    },
    {
        proId: "4",
        slug: "siem-reap",
        name: "Siem Reap",
        districts: [
            {
                disId: "30",
                name: "Angkor Chum",
                slug: "angkor-chum",
                communes: [
                    {
                        comId: "241",
                        name: "Char Chhuk",
                        slug: "char-chhuk",
                    },
                    {
                        comId: "242",
                        name: "Doun Peaeng",
                        slug: "doun-peaeng",
                    },
                    {
                        comId: "243",
                        name: "Kouk Doung",
                        slug: "kouk-doung",
                    },
                    {
                        comId: "244",
                        name: "Koul",
                        slug: "koul",
                    },
                    {
                        comId: "245",
                        name: "Nokor Pheas",
                        slug: "nokor-pheas",
                    },
                    {
                        comId: "246",
                        name: "Srae Khvav",
                        slug: "srae-khvav",
                    },
                    {
                        comId: "247",
                        name: "Ta Saom",
                        slug: "ta-saom",
                    },
                ],
            },
            {
                disId: "31",
                name: "Angkor Thum",
                slug: "angkor-thum",
                communes: [
                    {
                        comId: "248",
                        name: "Chob Ta Trav",
                        slug: "chob-ta-trav",
                    },
                    {
                        comId: "249",
                        name: "Leang Dai",
                        slug: "leang-dai",
                    },
                    {
                        comId: "250",
                        name: "Peak Snaeng",
                        slug: "peak-snaeng",
                    },
                    {
                        comId: "251",
                        name: "Svay Chek",
                        slug: "svay-chek",
                    },
                ],
            },
            {
                disId: "32",
                name: "Banteay Srei",
                slug: "banteay-srei",
                communes: [
                    {
                        comId: "252",
                        name: "Khnar Sanday",
                        slug: "khnar-sanday",
                    },
                    {
                        comId: "253",
                        name: "Khun Ream",
                        slug: "khun-ream",
                    },
                    {
                        comId: "254",
                        name: "Preak Dak",
                        slug: "preak-dak",
                    },
                    {
                        comId: "255",
                        name: "Rumchek",
                        slug: "rumchek",
                    },
                    {
                        comId: "256",
                        name: "Run Ta Aek",
                        slug: "run-ta-aek",
                    },
                    {
                        comId: "257",
                        name: "Tbaeng",
                        slug: "tbaeng",
                    },
                ],
            },
            {
                disId: "33",
                name: "Chi Kraeng",
                slug: "chi-kraeng",
                communes: [
                    {
                        comId: "258",
                        name: "Anlong Samnar",
                        slug: "anlong-samnar",
                    },
                    {
                        comId: "259",
                        name: "Chi Kraeng",
                        slug: "chi-kraeng",
                    },
                    {
                        comId: "260",
                        name: "Kampong Kdei",
                        slug: "kampong-kdei",
                    },
                    {
                        comId: "261",
                        name: "Khvav",
                        slug: "khvav",
                    },
                    {
                        comId: "262",
                        name: "Kouk Thlok Kraom",
                        slug: "kouk-thlok-kraom",
                    },
                    {
                        comId: "263",
                        name: "Kouk Thlok Leu",
                        slug: "kouk-thlok-leu",
                    },
                    {
                        comId: "264",
                        name: "Lveaeng Ruessei",
                        slug: "lveaeng-ruessei",
                    },
                    {
                        comId: "265",
                        name: "Pongro Kraom",
                        slug: "pongro-kraom",
                    },
                    {
                        comId: "266",
                        name: "Pongro Leu",
                        slug: "pongro-leu",
                    },
                    {
                        comId: "267",
                        name: "Ruessei Lok",
                        slug: "ruessei-lok",
                    },
                    {
                        comId: "268",
                        name: "Sangvaeuy",
                        slug: "sangvaeuy",
                    },
                    {
                        comId: "269",
                        name: "Spean Tnaot",
                        slug: "spean-tnaot",
                    },
                ],
            },
            {
                disId: "34",
                name: "Kralanh",
                slug: "kralanh",
                communes: [
                    {
                        comId: "270",
                        name: "Chonloas Dai",
                        slug: "chonloas-dai",
                    },
                    {
                        comId: "271",
                        name: "Kampong Thkov",
                        slug: "kampong-thkov",
                    },
                    {
                        comId: "272",
                        name: "Kralanh",
                        slug: "kralanh",
                    },
                    {
                        comId: "273",
                        name: "Krouch Kor",
                        slug: "krouch-kor",
                    },
                    {
                        comId: "274",
                        name: "Roung Kou",
                        slug: "roung-kou",
                    },
                    {
                        comId: "275",
                        name: "Saen Sokh",
                        slug: "saen-sokh",
                    },
                    {
                        comId: "276",
                        name: "Sambuor",
                        slug: "sambuor",
                    },
                    {
                        comId: "277",
                        name: "Snuol",
                        slug: "snuol",
                    },
                    {
                        comId: "278",
                        name: "Sranal",
                        slug: "sranal",
                    },
                    {
                        comId: "279",
                        name: "Ta an",
                        slug: "ta-an",
                    },
                ],
            },
            {
                disId: "35",
                name: "Krong Siem Reab",
                slug: "krong-siem-reab",
                communes: [
                    {
                        comId: "280",
                        name: "Ampil",
                        slug: "ampil",
                    },
                    {
                        comId: "281",
                        name: "Chong Knies",
                        slug: "chong-knies",
                    },
                    {
                        comId: "282",
                        name: "Chreav",
                        slug: "chreav",
                    },
                    {
                        comId: "283",
                        name: "Kouk Chak",
                        slug: "kouk-chak",
                    },
                    {
                        comId: "284",
                        name: "Krabei Riel",
                        slug: "krabei-riel",
                    },
                    {
                        comId: "285",
                        name: "Nokor Thum",
                        slug: "nokor-thum",
                    },
                    {
                        comId: "286",
                        name: "Sala Kamraeuk",
                        slug: "sala-kamraeuk",
                    },
                    {
                        comId: "287",
                        name: "Sambuor",
                        slug: "sambuor",
                    },
                    {
                        comId: "288",
                        name: "Siem Reab",
                        slug: "siem-reab",
                    },
                    {
                        comId: "289",
                        name: "Sla Kram",
                        slug: "sla-kram",
                    },
                    {
                        comId: "290",
                        name: "Srangae",
                        slug: "srangae",
                    },
                    {
                        comId: "291",
                        name: "Svay Dangkum",
                        slug: "svay-dangkum",
                    },
                    {
                        comId: "292",
                        name: "Tuek Vil",
                        slug: "tuek-vil",
                    },
                ],
            },
            {
                disId: "36",
                name: "Prasat Bakong",
                slug: "prasat-bakong",
                communes: [
                    {
                        comId: "293",
                        name: "Bakong",
                        slug: "bakong",
                    },
                    {
                        comId: "294",
                        name: "Ballangk",
                        slug: "ballangk",
                    },
                    {
                        comId: "295",
                        name: "Kampong Phluk",
                        slug: "kampong-phluk",
                    },
                    {
                        comId: "296",
                        name: "Kandaek",
                        slug: "kandaek",
                    },
                    {
                        comId: "297",
                        name: "Kantreang",
                        slug: "kantreang",
                    },
                    {
                        comId: "298",
                        name: "Mean Chey",
                        slug: "mean-chey",
                    },
                    {
                        comId: "299",
                        name: "Roluos",
                        slug: "roluos",
                    },
                    {
                        comId: "300",
                        name: "Trapeang Thum",
                        slug: "trapeang-thum",
                    },
                ],
            },
            {
                disId: "37",
                name: "Puok",
                slug: "puok",
                communes: [
                    {
                        comId: "301",
                        name: "Doun Kaev",
                        slug: "doun-kaev",
                    },
                    {
                        comId: "302",
                        name: "Kaev Poar",
                        slug: "kaev-poar",
                    },
                    {
                        comId: "303",
                        name: "Kdei Run",
                        slug: "kdei-run",
                    },
                    {
                        comId: "304",
                        name: "Khnat",
                        slug: "khnat",
                    },
                    {
                        comId: "305",
                        name: "Lvea",
                        slug: "lvea",
                    },
                    {
                        comId: "306",
                        name: "Mukh Paen",
                        slug: "mukh-paen",
                    },
                    {
                        comId: "307",
                        name: "Pou Treay",
                        slug: "pou-treay",
                    },
                    {
                        comId: "308",
                        name: "Prey Chruk",
                        slug: "prey-chruk",
                    },
                    {
                        comId: "309",
                        name: "Puok",
                        slug: "puok",
                    },
                    {
                        comId: "310",
                        name: "Reul",
                        slug: "reul",
                    },
                    {
                        comId: "311",
                        name: "Samraong Yea",
                        slug: "samraong-yea",
                    },
                    {
                        comId: "312",
                        name: "Sasar Sdam",
                        slug: "sasar-sdam",
                    },
                    {
                        comId: "313",
                        name: "Trei Nhoar",
                        slug: "trei-nhoar",
                    },
                    {
                        comId: "314",
                        name: "Yeang",
                        slug: "yeang",
                    },
                ],
            },
            {
                disId: "38",
                name: "Soutr Nikom",
                slug: "soutr-nikom",
                communes: [
                    {
                        comId: "315",
                        name: "Chan Sar",
                        slug: "chan-sar",
                    },
                    {
                        comId: "316",
                        name: "Dam Daek",
                        slug: "dam-daek",
                    },
                    {
                        comId: "317",
                        name: "Dan Run",
                        slug: "dan-run",
                    },
                    {
                        comId: "318",
                        name: "Kampong Khleang",
                        slug: "kampong-khleang",
                    },
                    {
                        comId: "319",
                        name: "Khchas",
                        slug: "khchas",
                    },
                    {
                        comId: "320",
                        name: "Khnar Pou",
                        slug: "khnar-pou",
                    },
                    {
                        comId: "321",
                        name: "Kien Sangkae",
                        slug: "kien-sangkae",
                    },
                    {
                        comId: "322",
                        name: "Popel",
                        slug: "popel",
                    },
                    {
                        comId: "323",
                        name: "Samraong",
                        slug: "samraong",
                    },
                    {
                        comId: "324",
                        name: "Ta Yaek",
                        slug: "ta-yaek",
                    },
                ],
            },
            {
                disId: "39",
                name: "Srei Snam",
                slug: "srei-snam",
                communes: [
                    {
                        comId: "325",
                        name: "Chrouy Neang Nguon",
                        slug: "chrouy-neang-nguon",
                    },
                    {
                        comId: "326",
                        name: "Klang Hay",
                        slug: "klang-hay",
                    },
                    {
                        comId: "327",
                        name: "Moung",
                        slug: "moung",
                    },
                    {
                        comId: "328",
                        name: "Prei",
                        slug: "prei",
                    },
                    {
                        comId: "329",
                        name: "Slaeng Spean",
                        slug: "slaeng-spean",
                    },
                    {
                        comId: "330",
                        name: "Tram Sasar",
                        slug: "tram-sasar",
                    },
                ],
            },
            {
                disId: "40",
                name: "Svay Leu",
                slug: "svay-leu",
                communes: [
                    {
                        comId: "331",
                        name: "Boeng Mealea",
                        slug: "boeng-mealea",
                    },
                    {
                        comId: "332",
                        name: "Kantuot",
                        slug: "kantuot",
                    },
                    {
                        comId: "333",
                        name: "Khnang Phnum",
                        slug: "khnang-phnum",
                    },
                    {
                        comId: "334",
                        name: "Svay Leu",
                        slug: "svay-leu",
                    },
                    {
                        comId: "335",
                        name: "Ta Siem",
                        slug: "ta-siem",
                    },
                ],
            },
            {
                disId: "41",
                name: "Varin",
                slug: "varin",
                communes: [
                    {
                        comId: "336",
                        name: "Lvea Krang",
                        slug: "lvea-krang",
                    },
                    {
                        comId: "337",
                        name: "Prasat",
                        slug: "prasat",
                    },
                    {
                        comId: "338",
                        name: "Srae Nouy",
                        slug: "srae-nouy",
                    },
                    {
                        comId: "339",
                        name: "Svay Sa",
                        slug: "svay-sa",
                    },
                    {
                        comId: "340",
                        name: "Varin",
                        slug: "varin",
                    },
                ],
            },
        ],
    },
    {
        proId: "5",
        slug: "battambang",
        name: "Battambang",
        districts: [
            {
                disId: "42",
                name: "Aek Phnum",
                slug: "aek-phnum",
                communes: [],
            },
            {
                disId: "43",
                name: "Banan",
                slug: "banan",
                communes: [],
            },
            {
                disId: "44",
                name: "Bavel",
                slug: "bavel",
                communes: [],
            },
            {
                disId: "45",
                name: "Kamrieng",
                slug: "kamrieng",
                communes: [],
            },
            {
                disId: "46",
                name: "Koas Krala",
                slug: "koas-krala",
                communes: [],
            },
            {
                disId: "47",
                name: "Krong Battambang",
                slug: "krong-battambang",
                communes: [],
            },
            {
                disId: "48",
                name: "Moung Ruessei",
                slug: "moung-ruessei",
                communes: [],
            },
            {
                disId: "49",
                name: "Phnom Proek",
                slug: "phnom-proek",
                communes: [],
            },
            {
                disId: "50",
                name: "Rotonak Mondol",
                slug: "rotonak-mondol",
                communes: [],
            },
            {
                disId: "51",
                name: "Rukhak Kiri",
                slug: "rukhak-kiri",
                communes: [],
            },
            {
                disId: "52",
                name: "Samlout",
                slug: "samlout",
                communes: [],
            },
            {
                disId: "53",
                name: "Sampov Lun",
                slug: "sampov-lun",
                communes: [],
            },
            {
                disId: "54",
                name: "Sangkae",
                slug: "sangkae",
                communes: [],
            },
            {
                disId: "55",
                name: "Thma Koul",
                slug: "thma-koul",
                communes: [],
            },
        ],
    },
    {
        proId: "6",
        slug: "kandal",
        name: "Kandal",
        districts: [
            {
                disId: "56",
                name: "Angk Snuol",
                slug: "angk-snuol",
                communes: [],
            },
            {
                disId: "57",
                name: "Kandal Stueng",
                slug: "kandal-stueng",
                communes: [],
            },
            {
                disId: "58",
                name: "Kaoh Thum",
                slug: "kaoh-thum",
                communes: [],
            },
            {
                disId: "59",
                name: "Khsach Kandal",
                slug: "khsach-kandal",
                communes: [],
            },
            {
                disId: "60",
                name: "Kien Svay",
                slug: "kien-svay",
                communes: [],
            },
            {
                disId: "61",
                name: "Krong Akreiy Ksatr",
                slug: "krong-akreiy-ksatr",
                communes: [],
            },
            {
                disId: "62",
                name: "Krong Sampeou Poun",
                slug: "krong-sampeou-poun",
                communes: [],
            },
            {
                disId: "63",
                name: "Krong Ta Khmau",
                slug: "krong-ta-khmau",
                communes: [],
            },
            {
                disId: "64",
                name: "Leuk Daek",
                slug: "leuk-daek",
                communes: [],
            },
            {
                disId: "65",
                name: "Lvea Aem",
                slug: "lvea-aem",
                communes: [],
            },
            {
                disId: "66",
                name: "Mukh Kampul",
                slug: "mukh-kampul",
                communes: [],
            },
            {
                disId: "67",
                name: "Popnhea Lueu",
                slug: "popnhea-lueu",
                communes: [],
            },
            {
                disId: "68",
                name: "S'ang",
                slug: "s-ang",
                communes: [],
            },
        ],
    },
    {
        proId: "7",
        slug: "banteay-meanchey",
        name: "Banteay Meanchey",
        districts: [
            {
                disId: "69",
                name: "Krong Paoy Paet",
                slug: "krong-paoy-paet",
                communes: [],
            },
            {
                disId: "70",
                name: "Krong Serei Saophoan",
                slug: "krong-serei-saophoan",
                communes: [],
            },
            {
                disId: "71",
                name: "Malai",
                slug: "malai",
                communes: [],
            },
            {
                disId: "72",
                name: "Mongkol Borei",
                slug: "mongkol-borei",
                communes: [],
            },
            {
                disId: "73",
                name: "Ou Chrov",
                slug: "ou-chrov",
                communes: [],
            },
            {
                disId: "74",
                name: "Phnum Srok",
                slug: "phnum-srok",
                communes: [],
            },
            {
                disId: "75",
                name: "Preah Netr Preah",
                slug: "preah-netr-preah",
                communes: [],
            },
            {
                disId: "76",
                name: "Svay Chek",
                slug: "svay-chek",
                communes: [],
            },
            {
                disId: "77",
                name: "Thma Puok",
                slug: "thma-puok",
                communes: [],
            },
        ],
    },
    {
        proId: "8",
        slug: "kampong-chhnang",
        name: "Kampong Chhnang",
        districts: [
            {
                disId: "78",
                name: "Baribour",
                slug: "baribour",
                communes: [],
            },
            {
                disId: "79",
                name: "Chol Kiri",
                slug: "chol-kiri",
                communes: [],
            },
            {
                disId: "80",
                name: "Kampong Leaeng",
                slug: "kampong-leaeng",
                communes: [],
            },
            {
                disId: "81",
                name: "Kampong Tralach",
                slug: "kampong-tralach",
                communes: [],
            },
            {
                disId: "82",
                name: "Krong Kampong Chhnang",
                slug: "krong-kampong-chhnang",
                communes: [],
            },
            {
                disId: "83",
                name: "Rolea B'ier",
                slug: "rolea-bier",
                communes: [],
            },
            {
                disId: "84",
                name: "Sameakki Mean Chey",
                slug: "sameakki-mean-chey",
                communes: [],
            },
            {
                disId: "85",
                name: "Tuek Phos",
                slug: "tuek-phos",
                communes: [],
            },
        ],
    },
    {
        proId: "9",
        slug: "kampong-speu",
        name: "Kampong Speu",
        districts: [
            {
                disId: "86",
                name: "Aoral",
                slug: "aoral",
                communes: [],
            },
            {
                disId: "87",
                name: "Basedth",
                slug: "basedth",
                communes: [],
            },
            {
                disId: "88",
                name: "Kong Pisei",
                slug: "kong-pisei",
                communes: [],
            },
            {
                disId: "89",
                name: "Krong Chbar Mon",
                slug: "krong-chbar-mon",
                communes: [],
            },
            {
                disId: "90",
                name: "Krong Odongk Maechay",
                slug: "krong-odongk-maechay",
                communes: [],
            },
            {
                disId: "91",
                name: "Phnum Sruoch",
                slug: "phnum-sruoch",
                communes: [],
            },
            {
                disId: "92",
                name: "Samkkei Munichay",
                slug: "samkkei-munichay",
                communes: [],
            },
            {
                disId: "93",
                name: "Samraong Tong",
                slug: "samraong-tong",
                communes: [],
            },
            {
                disId: "94",
                name: "Thpong",
                slug: "thpong",
                communes: [],
            },
        ],
    },
    {
        proId: "10",
        slug: "kampong-thom",
        name: "Kampong Thom",
        districts: [
            {
                disId: "95",
                name: "Baray",
                slug: "baray",
                communes: [],
            },
            {
                disId: "96",
                name: "Kampong Svay",
                slug: "kampong-svay",
                communes: [],
            },
            {
                disId: "97",
                name: "Krong Stueng Saen",
                slug: "krong-stueng-saen",
                communes: [],
            },
            {
                disId: "98",
                name: "Prasat Ballangk",
                slug: "prasat-ballangk",
                communes: [],
            },
            {
                disId: "99",
                name: "Prasat Sambour",
                slug: "prasat-sambour",
                communes: [],
            },
            {
                disId: "100",
                name: "Sandan",
                slug: "sandan",
                communes: [],
            },
            {
                disId: "101",
                name: "Santuk",
                slug: "santuk",
                communes: [],
            },
            {
                disId: "102",
                name: "Stoung",
                slug: "stoung",
                communes: [],
            },
        ],
    },
    {
        proId: "11",
        slug: "kampot",
        name: "Kampot",
        districts: [

            {
                disId: "103",
                name: "Angkor Chey",
                slug: "angkor-chey",
                communes: [],
            },
            {
                disId: "104",
                name: "Banteay Meas",
                slug: "banteay-meas",
                communes: [],
            },
            {
                disId: "105",
                name: "Chhuk",
                slug: "chhuk",
                communes: [],
            },
            {
                disId: "106",
                name: "Chum Kiri",
                slug: "chum-kiri",
                communes: [],
            },
            {
                disId: "107",
                name: "Dang Tong",
                slug: "dang-tong",
                communes: [],
            },
            {
                disId: "108",
                name: "Kampong Trach",
                slug: "kampong-trach",
                communes: [],
            },
            {
                disId: "109",
                name: "Krong Kampot",
                slug: "krong-kampot",
                communes: [],
            },
            {
                disId: "110",
                name: "Tuek Chhou",
                slug: "tuek-chhou",
                communes: [],
            },

        ],
    },
    {
        proId: "12",
        slug: "kep",
        name: "Kep",
        districts: [
            {
                disId: "111",
                name: "Damnak Chang'aeur",
                slug: "damnak-chang-aeur",
                communes: [],
            },
            {
                disId: "112",
                name: "Krong Kaeb",
                slug: "krong-kaeb",
                communes: [],
            },

        ],
    },
    {
        proId: "13",
        slug: "koh-kong",
        name: "Koh Kong",
        districts: [
            {
                disId: "113",
                name: "Botum Sakor",
                slug: "botum-sakor",
                communes: [],
            },
            {
                disId: "114",
                name: "Kiri Sakor",
                slug: "kiri-sakor",
                communes: [],
            },
            {
                disId: "115",
                name: "Koh Kong",
                slug: "koh-kong",
                communes: [],
            },
            {
                disId: "116",
                name: "Krong Khemarak Phoumin",
                slug: "krong-khemarak-phoumin",
                communes: [],
            },
            {
                disId: "117",
                name: "Mondol Seima",
                slug: "mondol-seima",
                communes: [],
            },
            {
                disId: "118",
                name: "Srae Ambel",
                slug: "srae-ambel",
                communes: [],
            },
            {
                disId: "119",
                name: "Thma Bang",
                slug: "thma-bang",
                communes: [],
            },

        ],
    },
    {
        proId: "14",
        slug: "kratie",
        name: "Kratie",
        districts: [
            {
                disId: "120",
                name: "Chhloung",
                slug: "chhloung",
                communes: [],
            },
            {
                disId: "121",
                name: "Chitr Borie",
                slug: "chitr-borie",
                communes: [],
            },
            {
                disId: "122",
                name: "Krong Kracheh",
                slug: "krong-kracheh",
                communes: [],
            },
            {
                disId: "123",
                name: "Ou Krieng Sen Chey",
                slug: "ou-krieng-sen-chey",
                communes: [],
            },
            {
                disId: "124",
                name: "Preaek Prasab",
                slug: "preaek-prasab",
                communes: [],
            },
            {
                disId: "125",
                name: "Sambour",
                slug: "sambour",
                communes: [],
            },
            {
                disId: "126",
                name: "Snuol",
                slug: "snuol",
                communes: [],
            },

        ],
    },
    {
        proId: "15",
        slug: "mondulkiri",
        name: "Mondulkiri",
        districts: [
            {
                disId: "127",
                name: "Kaev Seima",
                slug: "kaev-seima",
                communes: [],
            },
            {
                disId: "128",
                name: "Kaoh Nheaek",
                slug: "kaoh-nheaek",
                communes: [],
            },
            {
                disId: "129",
                name: "Krong Saen Monourom",
                slug: "krong-saen-monourom",
                communes: [],
            },
            {
                disId: "130",
                name: "Ou Reang",
                slug: "ou-reang",
                communes: [],
            },
            {
                disId: "131",
                name: "Pech Chreada",
                slug: "pech-chreada",
                communes: [],
            },

        ],
    },
    {
        proId:"16",
        slug: "oddar-meanchey",
        name: "Oddar Meanchey",
        districts: [
            {
                disId: "132",
                name: "Anlong Veaeng",
                slug: "anlong-veaeng",
                communes: [],
            },
            {
                disId: "133",
                name: "Banteay Ampil",
                slug: "banteay-ampil",
                communes: [],
            },
            {
                disId: "134",
                name: "Chong Kal",
                slug: "chong-kal",
                communes: [],
            },
            {
                disId: "135",
                name: "Krong Samraong",
                slug: "krong-samraong",
                communes: [],
            },
            {
                disId: "136",
                name: "Trapeang Prasat",
                slug: "trapeang-prasat",
                communes: [],
            },

        ],
    },
    {
        proId:"17",
        slug: "pailin",
        name: "Pailin",
        districts: [
            {
                disId: "137",
                name: "Krong Pailin",
                slug: "krong-pailin",
                communes: [],
            },
            {
                disId: "138",
                name: "Sala Krao",
                slug: "sala-kraou",
                communes: [],
            },
        ],
    },
    {
        proId: "18",
        slug: "preah-vihear",
        name: "Preah Vihear",
        districts: [
            {
                disId: "139",
                name: "Chey Saen",
                slug: "chey-saen",
                communes: [],
            },
            {
                disId: "140",
                name: "Chhaeb",
                slug: "chhaeb",
                communes: [],
            },
            {
                disId: "141",
                name: "Choam Khsant",
                slug: "choam-khsant",
                communes: [],
            },
            {
                disId: "142",
                name: "Krong Preah Vihear",
                slug: "krong-preah-vihear",
                communes: [],
            },
            {
                disId: "143",
                name: "Kuleaen",
                slug: "kuleaen",
                communes: [],
            },
            {
                disId: "144",
                name: "Rovieng",
                slug: "rovieng",
                communes: [],
            },
            {
                disId: "145",
                name: "Sangkum Thmei",
                slug: "sangkum-thmei",
                communes: [],
            },
            {
                disId:"146",
                name: "Tbaeng Mean Chey",
                slug: "tbaeng-mean-chey",
                communes: [],
            },

        ],
    },
    {
        proId: "19",
        slug: "prey-veng",
        name: "Prey Veng",
        districts: [
            {
                disId: "147",
                name: "Ba Phnum",
                slug: "ba-phnum",
                communes: [],
            },
            {
                disId: "148",
                name: "Kamchay Mear",
                slug: "kamchay-mear",
                communes: [],
            },
            {
                disId: "149",
                name: "Kampong Trabaek",
                slug: "kampong-trabaek",
                communes: [],
            },
            {
                disId: "150",
                name: "Kanhchriech",
                slug: "kanhchriech",
                communes: [],
            },
            {
                disId: "151",
                name: "Krong Prey Veng",
                slug: "krong-prey-veng",
                communes: [],
            },
            {
                disId: "152",
                name: "Me Sang",
                slug: "me-sang",
                communes: [],
            },
            {
                disId: "153",
                name: "Pea Reang",
                slug: "pea-reang",
                communes: [],
            },
            {
                disId: "154",
                name: "Peam Chor",
                slug: "peam-chor",
                communes: [],
            },
            {
                disId: "155",
                name: "Peam Ro",
                slug: "peam-ro",
                communes: [],
            },
            {
                disId: "156",
                name: "Preah Sdach",
                slug: "preah-sdach",
                communes: [],
            },
            {
                disId: "157",
                name: "Pur Rieng",
                slug: "pur-rieng",
                communes: [],
            },
            {
                disId: "158",
                name: "Sithor Kandal",
                slug: "sithor-kandal",
                communes: [],
            },
            {
                disId: "159",
                name: "Svay Antor",
                slug: "svay-antor",
                communes: [],
            },

        ],
    },
    {
        proId: "20",
        slug: "pursat",
        name: "Pursat",
        districts: [
            {
                disId: "160",
                name: "Bakan",
                slug: "bakan",
                communes: [],
            },
            {
                disId: "161",
                name: "Kandieng",
                slug: "kandieng",
                communes: [],
            },
            {
                disId: "162",
                name: "Krakor",
                slug: "krakor",
                communes: [],
            },
            {
                disId: "163",
                name: "Krong Pursat",
                slug: "krong-pursat",
                communes: [],
            },
            {
                disId: "164",
                name: "Phnum Kravanh",
                slug: "phnum-kravanh",
                communes: [],
            },
            {
                disId: "165",
                name: "Veal Veaeng",
                slug: "veal-veaeng",
                communes: [],
            },

        ],
    },
    {
        proId: "21",
        slug: "ratanakiri",
        name: "Ratanakiri",
        districts: [
            {
                disId: "166",
                name: "Andoung Meas",
                slug: "andoung-meas",
                communes: [],
            },
            {
                disId: "167",
                name: "Bar Kaev",
                slug: "bar-kaev",
                communes: [],
            },
            {
                disId: "168",
                name: "Koun Mom",
                slug: "koun-mom",
                communes: [],
            },
            {
                disId: "169",
                name: "Krong Ban Lung",
                slug: "krong-ban-lung",
                communes: [],
            },
            {
                disId: "170",
                name: "Lumphat",
                slug: "lumphat",
                communes: [],
            },
            {
                disId: "171",
                name: "Ou Chum",
                slug: "ou-chum",
                communes: [],
            },
            {
                disId: "172",
                name: "Ou Ya Dav",
                slug: "ou-ya-dav",
                communes: [],
            },
            {
                disId: "173",
                name: "Ta Veaeng",
                slug: "ta-veaeng",
                communes: [],
            },
            {
                disId: "174",
                name: "Veun Sai",
                slug: "veun-sai",
                communes: [],
            },

        ],
    },
    {
        proId: "22",
        slug: "stung-treng",
        name: "Stung Treng",
        districts: [
            {
                disId: "175",
                name: "Krong Stueng Traeng",
                slug: "krong-stueng-traeng",
                communes: [],
            },
            {
                disId: "176",
                name: "Sesan",
                slug: "sesan",
                communes: [],
            },
            {
                disId: "177",
                name: "Siem Bouk",
                slug: "siem-bouk",
                communes: [],
            },
            {
                disId: "178",
                name: "Siem Pang",
                slug: "siem-pang",
                communes: [],
            },
            {
                disId: "179",
                name: "Thala Barivat",
                slug: "thala-barivat",
                communes: [],
            },

        ],
    },
    {
        proId: "23",
        slug: "svay-rieng",
        name: "Svay Rieng",
        districts: [
            {
                disId: "180",
                name: "Chantrea",
                slug: "chantrea",
                communes: [],
            },
            {
                disId: "181",
                name: "Kampong Rou",
                slug: "kampong-rou",
                communes: [],
            },
            {
                disId: "182",
                name: "Krong Bavet",
                slug: "krong-bavet",
                communes: [],
            },
            {
                disId: "183",
                name: "Krong Svay Rieng",
                slug: "krong-svay-rieng",
                communes: [],
            },
            {
                disId: "184",
                name: "Romeas Haek",
                slug: "romeas-haek",
                communes: [],
            },
            {
                disId: "185",
                name: "Rumduol",
                slug: "rumduol",
                communes: [],
            },
            {
                disId: "186",
                name: "Svay Chrum",
                slug: "svay-chrum",
                communes: [],
            },
            {
                disId: "187",
                name: "Svay Teab",
                slug: "svay-teab",
                communes: [],
            },

        ],
    },
    {
        proId: "24",
        slug: "takeo",
        name: "Takeo",
        districts: [
            {
                disId: "188",
                name: "Angkor Borei",
                slug: "angkor-borei",
                communes: [],
            },
            {
                disId: "189",
                name: "Bati",
                slug: "bati",
                communes: [],
            },
            {
                disId: "190",
                name: "Borei Cholsar",
                slug: "borei-cholsar",
                communes: [],
            },
            {
                disId: "191",
                name: "Kaoh Andaet",
                slug: "kaoh-andaet",
                communes: [],
            },
            {
                disId: "192",
                name: "Kiri Vong",
                slug: "kiri-vong",
                communes: [],
            },
            {
                disId: "193",
                name: "Krong Doun Kaev",
                slug: "krong-doun-kaev",
                communes: [],
            },
            {
                disId: "194",
                name: "Prey Kabbas",
                slug: "prey-kabbas",
                communes: [],
            },
            {
                disId: "195",
                name: "Samraong",
                slug: "samraong",
                communes: [],
            },
            {
                disId: "196",
                name: "Tram Kak",
                slug: "tram-kak",
                communes: [],
            },
            {
                disId: "197",
                name: "Treang",
                slug: "treang",
                communes: [],
            },

        ],
    },
    {
        proId: "25",
        slug: "tboung-khmum",
        name: "Tboung Khmum",
        districts: [
            {
                disId: "198",
                name: "Dambae",
                slug: "dambae",
                communes: [],
            },
            {
                disId: "199",
                name: "Krong Suong",
                slug: "krong-suong",
                communes: [],
            },
            {
                disId: "200",
                name: "Krouch Chhmar",
                slug: "krouch-chhmar",
                communes: [],
            },
            {
                disId: "201",
                name: "Memot",
                slug: "memot",
                communes: [],
            },
            {
                disId: "202",
                name: "Ou Reang Ov",
                slug: "ou-reang-ov",
                communes: [],
            },
            {
                disId: "203",
                name: "Ponhea Kraek",
                slug: "ponhea-kraek",
                communes: [],
            },
            {
                disId: "204",
                name: "Tboung Khmum",
                slug: "tboung-khmum",
                communes: [],
            },

        ],
    },
]
