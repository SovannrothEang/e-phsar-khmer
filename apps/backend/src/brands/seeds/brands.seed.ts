import { eq, inArray } from 'drizzle-orm';
import type { DbClient } from '../../db/drizzle.provider';
import {
  brands,
  brandSubcategoryLinks,
  models,
  modelSubcategoryLinks,
} from '../../db/schema/brands.schema';
import { subcategories } from '../../db/schema/categories.schema';

interface BrandSeed {
  slug: string;
  name: string;
  icon?: string;
  subcategories: string[];
  sortOrder: number;
}

/**
 * Starter models, **grouped by the subcategory each model belongs to** — the
 * grouping IS the classification, and it is what `model_subcategory_links` is
 * seeded from.
 *
 * Before this the list was flat (`Record<brandSlug, string[]>`) and models had
 * no subcategory at all, so `GET /brands/:id/models` returned a brand's whole
 * catalogue for every subcategory: Tablets under Apple listed iPhones, and
 * Xiaomi's phones showed under Cars For Sale.
 *
 * A model may appear under more than one subcategory (Surface Pro is a tablet
 * *and* a laptop). A model whose kind genuinely does not fit any subcategory
 * its brand is linked to is left out of the seed's groups entirely — see the
 * stragglers noted at the bottom of this block.
 *
 * Insert-only, like the rest of this seed: existing rows are never updated, and
 * the links are added by a second pass in `seedModels`.
 */
const MODEL_SEEDS: Record<string, Record<string, string[]>> = {
  apple: {
    phones: [
      'iPhone 16 Pro Max',
      'iPhone 16 Pro',
      'iPhone 16 Plus',
      'iPhone 16',
      'iPhone 15 Pro Max',
      'iPhone 15 Pro',
      'iPhone 15 Plus',
      'iPhone 15',
      'iPhone 14 Pro Max',
      'iPhone 14 Pro',
      'iPhone 14',
      'iPhone 13 Pro Max',
      'iPhone 13 Pro',
      'iPhone 13',
      'iPhone 12 Pro Max',
      'iPhone 12 Pro',
      'iPhone 12',
      'iPhone SE (3rd gen)',
    ],
    tablets: ['iPad Pro', 'iPad Air', 'iPad', 'iPad mini'],
    laptops: ['MacBook Pro', 'MacBook Air'],
    desktops: ['Mac mini'],
    'all-in-one': ['iMac'],
    'smart-watches': ['Apple Watch Ultra 2', 'Apple Watch Series 9'],
  },
  samsung: {
    phones: [
      'Galaxy S25 Ultra',
      'Galaxy S25+',
      'Galaxy S25',
      'Galaxy S24 Ultra',
      'Galaxy S24+',
      'Galaxy S24',
      'Galaxy S23 Ultra',
      'Galaxy S23+',
      'Galaxy S23',
      'Galaxy S22 Ultra',
      'Galaxy S22+',
      'Galaxy S22',
      'Galaxy S21 Ultra',
      'Galaxy S21+',
      'Galaxy S21',
      'Galaxy Z Fold 6',
      'Galaxy Z Flip 6',
      'Galaxy A55',
      'Galaxy A35',
      'Galaxy A15',
    ],
    tablets: ['Galaxy Tab S9', 'Galaxy Tab S8'],
    'smart-watches': ['Galaxy Watch 6'],
  },
  xiaomi: {
    phones: [
      'Xiaomi 15',
      'Xiaomi 14',
      'Xiaomi 14 Ultra',
      'Xiaomi 13',
      'Xiaomi 13T',
      'Xiaomi 12',
      'Redmi Note 13 Pro',
      'Redmi Note 13',
      'Redmi Note 12',
      'Redmi 13C',
      'Redmi 12',
      'Poco X6 Pro',
      'Poco X6',
      'Poco F5',
    ],
    tablets: ['Xiaomi Pad 6'],
    'smart-watches': ['Xiaomi Smart Band 8'],
  },
  huawei: {
    phones: ['Huawei Mate 60 Pro', 'Huawei P60 Pro', 'Huawei Nova 12'],
    tablets: ['Huawei MatePad 11'],
  },
  oppo: {
    phones: [
      'Oppo Find X8',
      'Oppo Find X7 Ultra',
      'Oppo Reno 12',
      'Oppo Reno 11',
      'Oppo A78',
    ],
  },
  vivo: {
    phones: ['Vivo X200', 'Vivo X100', 'Vivo V40', 'Vivo V30', 'Vivo Y36'],
  },
  nokia: { phones: ['Nokia X30', 'Nokia G42', 'Nokia C32'] },
  motorola: {
    phones: [
      'Motorola Edge 50 Pro',
      'Motorola Edge 40',
      'Motorola G84',
      'Moto G54',
    ],
  },
  oneplus: {
    phones: ['OnePlus 12', 'OnePlus 12R', 'OnePlus Nord 4', 'OnePlus 11'],
  },
  google: {
    phones: ['Pixel 9 Pro', 'Pixel 9', 'Pixel 8a', 'Pixel 8', 'Pixel 7a'],
  },
  realme: {
    phones: ['Realme 12 Pro+', 'Realme 12', 'Realme C67', 'Realme Narzo 70'],
  },
  honor: {
    phones: ['Honor 200 Pro', 'Honor 200', 'Honor Magic6 Pro', 'Honor X8b'],
  },
  tecno: {
    phones: ['Tecno Camon 30', 'Tecno Spark 20', 'Tecno Phantom V2'],
  },
  infinix: {
    phones: ['Infinix Note 40', 'Infinix Hot 40', 'Infinix Zero 30'],
  },
  sony: { phones: ['Xperia 1 V', 'Xperia 5 V', 'Xperia 10 V'] },
  lg: { phones: ['LG G4', 'LG V60'] },
  // ASUS's seeded models are all phones, but the brand is not linked to the
  // `phones` subcategory — see the stragglers note below.
  alldocube: { tablets: ['Alldocube iPlay 60', 'Alldocube iPlay 50'] },
  // BV9300 / A90 are rugged phones and Blackview is linked to `tablets` only;
  // the Tab 16 is the one that belongs here.
  blackview: { tablets: ['Blackview Tab 16'] },
  amazfit: {
    'smart-watches': ['Amazfit GTR 4', 'Amazfit Bip 5', 'Amazfit Band 7'],
  },
  coros: {
    'smart-watches': ['COROS PACE 3', 'COROS VERTIX 2', 'COROS APEX 2'],
  },
  fitbit: {
    'smart-watches': ['Fitbit Charge 6', 'Fitbit Versa 4', 'Fitbit Sense 2'],
  },
  garmin: {
    'smart-watches': [
      'Garmin Forerunner 265',
      'Garmin Fenix 7',
      'Garmin Venu 3',
      'Garmin Instinct 2',
    ],
  },
  kieslect: { 'smart-watches': ['Kieslect K10 Pro', 'Kieslect K9'] },
  dell: {
    laptops: [
      'Dell XPS 15',
      'Dell XPS 13',
      'Dell Inspiron 15',
      'Dell Latitude 7440',
    ],
  },
  hp: {
    laptops: [
      'HP Spectre x360',
      'HP Envy 16',
      'HP Pavilion 15',
      'HP EliteBook 840',
    ],
  },
  lenovo: {
    laptops: [
      'Lenovo ThinkPad X1 Carbon',
      'Lenovo ThinkPad T14',
      'Lenovo IdeaPad 5',
      'Lenovo Legion 5',
    ],
  },
  msi: {
    laptops: [
      'MSI Katana 15',
      'MSI Stealth 14',
      'MSI Prestige 14',
      'MSI Modern 14',
    ],
  },
  // Surface Pro and Surface Go are detachables, so each carries TWO links —
  // the case the link table exists for. Surface Pro is a 2-in-1 (laptop and
  // tablet); Surface Go is a tablet first.
  microsoft: {
    laptops: ['Surface Laptop 6', 'Surface Pro 10', 'Surface Book 3'],
    tablets: ['Surface Pro 10', 'Surface Go 4'],
  },
  toshiba: { laptops: ['Toshiba Satellite Pro', 'Toshiba Portege X30'] },
  fujitsu: { laptops: ['Fujitsu Lifebook U7', 'Fujitsu Lifebook E5'] },
  gateway: { laptops: ['Gateway 15.6', 'Gateway 14.1'] },
  averatec: { laptops: ['Averatec N4500', 'Averatec N2300'] },
  viewsonic: { monitors: ['ViewSonic VA2432', 'ViewSonic VX2758'] },
  aoc: { monitors: ['AOC 24G2', 'AOC 27B2H', 'AOC U27V4'] },
  // The two EOS bodies are cameras and Canon is not linked to
  // `cameras-and-camcorders`; only the printer belongs to a linked subcategory.
  canon: { 'printers-and-scanners': ['Canon PIXMA TS3320'] },
  epson: {
    'printers-and-scanners': ['Epson EcoTank L3250', 'Epson WorkForce WF-110'],
  },
  // Panasonic is linked to `laptops` only; the Lumix is a camera.
  panasonic: { laptops: ['Panasonic Toughbook 55'] },
  itronix: { laptops: ['Itronix IX270', 'Itronix GD8000'] },
  cardpressp: {
    'printers-and-scanners': ['CardPresso CP150', 'CardPresso CP350'],
  },
  evolvis: { 'printers-and-scanners': ['Evolis Primacy 2', 'Evolis Zenius'] },
  hid: {
    'printers-and-scanners': ['HID FARGO DTC4500e', 'HID FARGO DTC1250e'],
  },
  inkanto: { 'printers-and-scanners': ['Inkanto X20', 'Inkanto S1'] },
  kyocera: {
    'printers-and-scanners': ['Kyocera Ecosys M2040', 'Kyocera TASKalfa 2020'],
  },
  soppos: { 'printers-and-scanners': ['Soppos D-4500', 'Soppos F-3000'] },
  zebra: {
    'printers-and-scanners': ['Zebra ZD421', 'Zebra GC420', 'Zebra ZQ521'],
  },
  brother: {
    'printers-and-scanners': [
      'Brother DCP-L2550DW',
      'Brother HL-L2460DW',
      'Brother QL-820NWB',
    ],
  },
  hmd: { phones: ['HMD Fusion', 'HMD Skyline'] },
  meizu: { phones: ['Meizu 21', 'Meizu 20'] },
  redmi: {
    phones: ['Redmi Note 13 Pro', 'Redmi Note 13', 'Redmi 13C', 'Redmi A3'],
  },
  poco: { phones: ['Poco X6 Pro', 'Poco X6', 'Poco F5'] },
  zte: { phones: ['ZTE Blade V60', 'ZTE Axon 40'] },
  blu: { phones: ['BLU Bold N1', 'BLU G91'] },
  camfone: { phones: ['Camfone CF2024'] },
  iqoo: { phones: ['iQOO 12', 'iQOO Z9', 'iQOO Neo9'] },
  meitu: { phones: ['Meitu 8', 'Meitu V7'] },
  myteb: { phones: ['MYTEB MT101', 'MYTEB MT2024'] },
  // Philips is linked to `phones` and `smart-watches`, but its seeded models
  // are all monitors — see the stragglers note below.
  singtech: { phones: ['SingTech S100', 'SingTech S200'] },
  htc: { phones: ['HTC U23 Pro', 'HTC Desire 22'] },
  ulefone: { phones: ['Ulefone Armor 26', 'Ulefone Power Armor 18'] },
  // Yealink's models are VoIP desk phones and a headset; the `phones`
  // subcategory is a consumer mobile category, so they are left unlinked.
  // Car-brand models per the mock design (insert-only; the mock's "Pirus"
  // typo is seeded verbatim)
  mg: {
    'cars-for-sale': [
      '3',
      '6',
      '7',
      'D60',
      'GS',
      'GT',
      'HS',
      'Marvel R',
      'RX5',
      'RX8',
      'RX9',
      'T60',
      'ZS',
      'Other',
    ],
  },
  leapmotor: { 'cars-for-sale': ['B10', 'C10'] },
  toyota: { 'cars-for-sale': ['Camry', 'Pirus'] },
};

/**
 * Seeded models deliberately left OUT of the groups above, because the brand is
 * not linked to the subcategory that model would belong to (so it could never
 * be reached there anyway). Listed here so they are a recorded decision rather
 * than an omission — fixing any of them is a `brands.seed.ts` link decision,
 * not a model one:
 *
 *   asus        ZenFone 11 Ultra, ZenFone 10, ROG Phone 8, ROG Phone 7  (phones — brand not linked)
 *   blackview   BV9300, A90                                             (phones — brand linked to tablets only)
 *   canon       EOS R50, EOS 250D                                       (cameras — brand not linked)
 *   panasonic   Lumix GH6                                               (cameras — brand linked to laptops only)
 *   philips     27E1N, 242V8, 32M1                                      (monitors — brand not linked)
 *   vertu       Signature, Aster P                                      (phones — brand linked to smart-watches only)
 *   yealink     SIP-T31G, WH62                                          (desk phones/headset — no fitting subcategory)
 *
 * They stay in the `models` table (insert-only seeding never deletes) and are
 * simply unlinked, which under the API's filter rule means they still show for
 * every subcategory of their brand — i.e. unchanged from today.
 */

/**
 * Motorcycle model starter baseline (insert-only; admins add the rest via the
 * Models page). Like the cars, the spec never enumerates a model list, so this
 * is a curated set of Khmer-market models keyed by the MOTO_BRANDS slugs.
 */
const MOTO_MODEL_SEEDS: Record<string, string[]> = {
  'honda-moto': [
    'Dream 125',
    'Wave 110',
    'Click 125',
    'Click 160',
    'PCX 125',
    'PCX 160',
    'Scoopy 125',
    'Dio 150',
    'CBR 150R',
    'Winner X',
    'CB 150R',
    'Supra X 125',
    'Blade 110',
    'XR 150L',
  ],
  yamaha: [
    'Jupiter 125',
    'Jupiter Z1 125',
    'Exciter 150',
    'NMAX 155',
    'NVX 155',
    'Aerox 155',
    'MT-15',
    'Yamaha R15 V3',
    'XSR 155',
    'Fazzio 125',
  ],
  'suzuki-moto': [
    'Raider 150',
    'Gixxer 150',
    'GSX-R 150',
    'GSX-R 250',
    'Access 125',
    'Skydrive 125',
  ],
  kawasaki: [
    'Ninja 250',
    'Ninja 400',
    'Z250',
    'Z400',
    'KLX 150',
    'KLX 250',
    'Versys X 300',
    'W175',
    'Eliminator 125',
  ],
  ktm: [
    'Duke 200',
    'Duke 250',
    'Duke 390',
    'RC 200',
    'RC 390',
    'Adventure 390',
    '790 Duke',
  ],
  ducati: [
    'Scrambler 800',
    'Monster 821',
    'Monster 937',
    'Panigale V4',
    'SuperSport 950',
    'Diavel 1260',
  ],
  bajaj: [
    'Pulsar 150',
    'Pulsar NS 200',
    'Pulsar RS 200',
    'Dominar 400',
    'Boxer 100',
    'Platina 110',
  ],
  'kr-motor': ['KR Motard 150', 'KR Motard 250', 'KR 370D'],
  gpx: ['Demon 150', 'Demon 250', 'Legend 150', 'Legend 200', 'Bolt 150'],
  keewey: ['Keeway K-Light 150', 'Keeway K-Light 250', 'Keeway Superlight 125'],
  benelli: [
    'TNT 150',
    'TNT 250',
    '302R',
    'BN 251',
    'Leoncino 250',
    'TRK 251',
    'TRK 502',
  ],
  'bmw-moto': [
    'S 1000 RR',
    'R 1250 GS',
    'F 850 GS',
    'R nineT',
    'C 400 GT',
    'R 18',
  ],
  cfmoto: ['250SR', '300SR', '300NK', '450SR', '650MT', '800MT'],
  'harley-davidson': [
    'Street 750',
    'Iron 883',
    'Forty-Eight',
    'Sportster S',
    'Road King',
    'Pan America 1250',
  ],
  husqvarna: [
    'Svartpilen 200',
    'Vitpilen 200',
    'Svartpilen 250',
    'Svartpilen 401',
  ],
  hyosung: ['GT 125', 'GT 250', 'GT 300', 'GV 250'],
  'italijet-dragster': ['Dragster 125', 'Dragster 200'],
  lambretta: ['Lambretta V125', 'Lambretta V200', 'Lambretta X300'],
  peugeot: ['Peugeot Django 125', 'Peugeot Kisbee 50', 'Peugeot Geopolis 300'],
  piaggio: [
    'Piaggio Liberty 125',
    'Piaggio Medley 150',
    'Piaggio Beverly 300',
    'Piaggio Zip 50',
  ],
  'royal-enfield': [
    'Classic 350',
    'Hunter 350',
    'Meteor 350',
    'Himalayan 450',
    'Interceptor 650',
  ],
  triumph: [
    'Bonneville T100',
    'Bonneville T120',
    'Street Twin',
    'Trident 660',
    'Tiger 900',
  ],
  tvs: ['Apache 160', 'Apache 200', 'Raider 125', 'Ntorq 125'],
  yadea: ['Yadea G5', 'Yadea G5 Pro'],
  vespa: [
    'Primavera 125',
    'Primavera 150',
    'Sprint 125',
    'Sprint 150',
    'GTS 300',
  ],
  zontes: ['ZT310R', 'ZT310X', 'ZT310T'],
};

export const BRANDS: BrandSeed[] = [
  {
    slug: 'apple',
    name: 'Apple',
    subcategories: [
      'phones',
      'tablets',
      'smart-watches',
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 0,
  },
  {
    slug: 'samsung',
    name: 'Samsung',
    subcategories: [
      'phones',
      'tablets',
      'smart-watches',
      'laptops',
      'desktops',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 1,
  },
  {
    slug: 'huawei',
    name: 'Huawei',
    subcategories: ['phones', 'tablets', 'smart-watches'],
    sortOrder: 2,
  },
  {
    slug: 'sony',
    name: 'Sony',
    subcategories: [
      'phones',
      'tablets',
      'laptops',
      'all-in-one',
      'printers-and-scanners',
    ],
    sortOrder: 3,
  },
  {
    slug: 'oppo',
    name: 'Oppo',
    subcategories: ['phones', 'tablets', 'smart-watches'],
    sortOrder: 4,
  },
  {
    slug: 'lg',
    name: 'LG',
    subcategories: ['phones', 'smart-watches', 'laptops', 'monitors'],
    sortOrder: 5,
  },
  {
    slug: 'vivo',
    name: 'Vivo',
    subcategories: ['phones', 'tablets'],
    sortOrder: 6,
  },
  { slug: 'nokia', name: 'Nokia', subcategories: ['phones'], sortOrder: 7 },
  {
    slug: 'meizu',
    name: 'Meizu',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 8,
  },
  {
    slug: 'oneplus',
    name: 'OnePlus',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 9,
  },
  {
    slug: 'blackberry',
    name: 'Blackberry',
    subcategories: ['phones'],
    sortOrder: 10,
  },
  {
    slug: 'htc',
    name: 'HTC',
    subcategories: ['phones', 'tablets'],
    sortOrder: 11,
  },
  {
    slug: 'acer',
    name: 'Acer',
    subcategories: [
      'phones',
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 12,
  },
  {
    slug: 'google',
    name: 'Google',
    subcategories: ['phones', 'tablets', 'smart-watches'],
    sortOrder: 13,
  },
  {
    slug: 'xiaomi',
    name: 'Xiaomi',
    subcategories: ['phones', 'tablets', 'smart-watches'],
    sortOrder: 14,
  },
  {
    slug: 'motorola',
    name: 'Motorola',
    subcategories: ['phones'],
    sortOrder: 15,
  },
  {
    slug: 'alcatel',
    name: 'Alcatel',
    subcategories: ['phones', 'tablets'],
    sortOrder: 16,
  },
  {
    slug: 'philips',
    name: 'Philips',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 17,
  },
  {
    slug: 'singtech',
    name: 'SingTech',
    subcategories: ['phones', 'tablets', 'laptops'],
    sortOrder: 18,
  },
  { slug: 'blu', name: 'BLU', subcategories: ['phones'], sortOrder: 19 },
  {
    slug: 'zte',
    name: 'ZTE',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 20,
  },
  {
    slug: 'camfone',
    name: 'Camfone',
    subcategories: ['phones'],
    sortOrder: 21,
  },
  { slug: 'hmd', name: 'HMD', subcategories: ['phones'], sortOrder: 22 },
  { slug: 'honor', name: 'Honor', subcategories: ['phones'], sortOrder: 23 },
  {
    slug: 'infinix',
    name: 'Infinix',
    subcategories: ['phones'],
    sortOrder: 24,
  },
  { slug: 'iqoo', name: 'IQoo', subcategories: ['phones'], sortOrder: 25 },
  { slug: 'meitu', name: 'Meitu', subcategories: ['phones'], sortOrder: 26 },
  {
    slug: 'myteb',
    name: 'MYTEB',
    subcategories: ['phones', 'smart-watches'],
    sortOrder: 27,
  },
  { slug: 'poco', name: 'POCO', subcategories: ['phones'], sortOrder: 28 },
  { slug: 'realme', name: 'Realme', subcategories: ['phones'], sortOrder: 29 },
  { slug: 'redmi', name: 'Redmi', subcategories: ['phones'], sortOrder: 30 },
  { slug: 'tecno', name: 'Tecno', subcategories: ['phones'], sortOrder: 31 },
  {
    slug: 'ulefone',
    name: 'Ulefone',
    subcategories: ['phones'],
    sortOrder: 32,
  },
  {
    slug: 'yealink',
    name: 'Yealink',
    subcategories: ['phones'],
    sortOrder: 33,
  },
  {
    slug: 'alldocube',
    name: 'Alldocube',
    subcategories: ['tablets'],
    sortOrder: 34,
  },
  {
    slug: 'asus',
    name: 'ASUS',
    subcategories: [
      'tablets',
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 35,
  },
  {
    slug: 'blackview',
    name: 'Blackview',
    subcategories: ['tablets'],
    sortOrder: 36,
  },
  {
    slug: 'vertu',
    name: 'Vertu',
    subcategories: ['smart-watches'],
    sortOrder: 37,
  },
  {
    slug: 'amazfit',
    name: 'Amazfit',
    subcategories: ['smart-watches'],
    sortOrder: 38,
  },
  {
    slug: 'coros',
    name: 'COROS',
    subcategories: ['smart-watches'],
    sortOrder: 39,
  },
  {
    slug: 'fitbit',
    name: 'Fitbit',
    subcategories: ['smart-watches'],
    sortOrder: 40,
  },
  {
    slug: 'garmin',
    name: 'Garmin',
    subcategories: ['smart-watches'],
    sortOrder: 41,
  },
  {
    slug: 'kieslect',
    name: 'Kieslect',
    subcategories: ['smart-watches'],
    sortOrder: 42,
  },
  {
    slug: 'dell',
    name: 'Dell',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 43,
  },
  {
    slug: 'hp',
    name: 'HP',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 44,
  },
  {
    slug: 'lenovo',
    name: 'Lenovo',
    subcategories: ['laptops', 'desktops', 'all-in-one', 'monitors'],
    sortOrder: 45,
  },
  {
    slug: 'msi',
    name: 'MSI',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 46,
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    // `tablets` added 2026-09-22 (captain): the Surface Pro and Surface Go are
    // detachables, so Microsoft belongs in the Tablets brand grid and those
    // models can finally carry a tablet link.
    subcategories: ['laptops', 'desktops', 'all-in-one', 'monitors', 'tablets'],
    sortOrder: 47,
  },
  {
    slug: 'toshiba',
    name: 'Toshiba',
    subcategories: ['laptops', 'all-in-one', 'printers-and-scanners'],
    sortOrder: 48,
  },
  {
    slug: 'fujitsu',
    name: 'Fujitsu',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 49,
  },
  {
    slug: 'gateway',
    name: 'Gateway',
    subcategories: ['laptops', 'desktops'],
    sortOrder: 50,
  },
  {
    slug: 'averatec',
    name: 'Averatec',
    subcategories: [
      'laptops',
      'desktops',
      'all-in-one',
      'printers-and-scanners',
    ],
    sortOrder: 51,
  },
  {
    slug: 'viewsonic',
    name: 'ViewSonic',
    subcategories: ['laptops', 'monitors'],
    sortOrder: 52,
  },
  {
    slug: 'aoc',
    name: 'AOC',
    subcategories: ['laptops', 'desktops', 'monitors'],
    sortOrder: 53,
  },
  {
    slug: 'canon',
    name: 'Canon',
    subcategories: ['laptops', 'monitors', 'printers-and-scanners'],
    sortOrder: 54,
  },
  {
    slug: 'epson',
    name: 'Epson',
    subcategories: ['laptops', 'all-in-one', 'printers-and-scanners'],
    sortOrder: 55,
  },
  {
    slug: 'panasonic',
    name: 'Panasonic',
    subcategories: ['laptops'],
    sortOrder: 56,
  },
  {
    slug: 'itronix',
    name: 'Itronix',
    subcategories: ['laptops'],
    sortOrder: 57,
  },
  {
    slug: 'cardpressp',
    name: 'Cardpressp',
    subcategories: ['printers-and-scanners'],
    sortOrder: 58,
  },
  {
    slug: 'evolis',
    name: 'Evolis',
    subcategories: ['printers-and-scanners'],
    sortOrder: 59,
  },
  {
    slug: 'hid',
    name: 'HID',
    subcategories: ['printers-and-scanners'],
    sortOrder: 60,
  },
  {
    slug: 'inkanto',
    name: 'Inkanto',
    subcategories: ['printers-and-scanners'],
    sortOrder: 61,
  },
  {
    slug: 'kyocera',
    name: 'Kyocera',
    subcategories: ['printers-and-scanners'],
    sortOrder: 62,
  },
  {
    slug: 'soppos',
    name: 'Soppos',
    subcategories: ['printers-and-scanners'],
    sortOrder: 63,
  },
  {
    slug: 'zebra',
    name: 'Zebra',
    subcategories: ['printers-and-scanners'],
    sortOrder: 64,
  },
  {
    slug: 'brother',
    name: 'Brother',
    subcategories: ['printers-and-scanners'],
    sortOrder: 65,
  },
  {
    slug: 'other',
    name: 'Other',
    subcategories: [
      'phones',
      'tablets',
      'smart-watches',
      'laptops',
      'desktops',
      'all-in-one',
      'monitors',
      'printers-and-scanners',
    ],
    sortOrder: 999,
  },
];

/**
 * Car brands per the mock design (91, order is the design order — MG first).
 * Icon paths are the web app's local /sub-img design assets — interim until
 * these logos move to Supabase storage (admins replace icons via the UI; the
 * seed's onConflictDoUpdate never overwrites existing icons).
 */
export const CAR_BRANDS: BrandSeed[] = [
  {
    slug: 'mg',
    name: 'MG',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/mg.png',
    sortOrder: 0,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'leapmotor',
    name: 'Leapmotor',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/leapmotor.png',
    sortOrder: 1,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'toyota',
    name: 'Toyota',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/toyota.png',
    sortOrder: 2,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'lexus',
    name: 'Lexus',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/lexus.png',
    sortOrder: 3,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'kia',
    name: 'Kia',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/kia.png',
    sortOrder: 4,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'ford',
    name: 'Ford',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/ford.png',
    sortOrder: 5,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'land-rover',
    name: 'Land Rover',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/land-rover.png',
    sortOrder: 6,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'mercedes-benz',
    name: 'Mercedes-Benz',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/mercedes-benz.png',
    sortOrder: 7,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'audi',
    name: 'Audi',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/audi.png',
    sortOrder: 8,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'bmw',
    name: 'BMW',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/bmw.png',
    sortOrder: 9,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'byd',
    name: 'BYD',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/byd.png',
    sortOrder: 10,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'chevrolet',
    name: 'Chevrolet',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/chevrolet.png',
    sortOrder: 11,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'gac',
    name: 'GAC',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/gac.png',
    sortOrder: 12,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'honda',
    name: 'Honda',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/honda.png',
    sortOrder: 13,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'hyundai',
    name: 'Hyundai',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/hyundai.png',
    sortOrder: 14,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'mazda',
    name: 'Mazda',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/mazda.png',
    sortOrder: 15,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'nissan',
    name: 'Nissan',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/nissan.png',
    sortOrder: 16,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'porsche',
    name: 'Porsche',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/porsche.png',
    sortOrder: 17,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'denza',
    name: 'Denza',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/denza.png',
    sortOrder: 18,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'mitsubishi',
    name: 'Mitsubishi',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/mitsubishi.png',
    sortOrder: 19,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'ssang-yong',
    name: 'SsangYong',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/ssang-yong.png',
    sortOrder: 20,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'avatar',
    name: 'Avatar',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/avatar.png',
    sortOrder: 21,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'cadillac',
    name: 'Cadillac',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/cadillac.png',
    sortOrder: 22,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'changan',
    name: 'Changan',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/changan.png',
    sortOrder: 23,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'jeep',
    name: 'Jeep',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/jeep.png',
    sortOrder: 24,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'tesla',
    name: 'Tesla',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/tesla.png',
    sortOrder: 25,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'volkswagen',
    name: 'Volkswagen',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/volkswagen.png',
    sortOrder: 26,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: '212',
    name: '212',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/212.png',
    sortOrder: 27,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'aeolus',
    name: 'AEOLUS',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/aeolus.png',
    sortOrder: 28,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'aion',
    name: 'AION',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/aion.png',
    sortOrder: 29,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'aiqar',
    name: 'AIQAR',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/aiqar.png',
    sortOrder: 30,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'aito',
    name: 'AITO',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/aito.png',
    sortOrder: 31,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'alfa-romeo',
    name: 'Alfa Romeo',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/alfa-romeo.png',
    sortOrder: 32,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'aston-martin',
    name: 'Aston Martin',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/aston-martin.png',
    sortOrder: 33,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'baic',
    name: 'BAIC',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/baic.png',
    sortOrder: 34,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'baw',
    name: 'BAW',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/baw.png',
    sortOrder: 35,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'bentley',
    name: 'Bentley',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/bentley.png',
    sortOrder: 36,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'bestune',
    name: 'BESTUNE',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/bestune.png',
    sortOrder: 37,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'buick',
    name: 'Buick',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/buick.png',
    sortOrder: 38,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'changhe',
    name: 'Changhe',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/changhe.png',
    sortOrder: 39,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'chery',
    name: 'CHERY',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/chery.png',
    sortOrder: 40,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'chrysler',
    name: 'Chrysler',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/chrysler.png',
    sortOrder: 41,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'daewoo',
    name: 'Daewoo',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/daewoo.png',
    sortOrder: 42,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'daihatsu',
    name: 'Daihatsu',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/daihatsu.png',
    sortOrder: 43,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'dfsk',
    name: 'DFSK',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/dfsk.png',
    sortOrder: 44,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'dodge',
    name: 'Dodge',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/dodge.png',
    sortOrder: 45,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'ferrari',
    name: 'Ferrari',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/ferrari.png',
    sortOrder: 46,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'forthing',
    name: 'FORTHING',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/forthing.png',
    sortOrder: 47,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'foton',
    name: 'foton',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/foton.png',
    sortOrder: 48,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'geely',
    name: 'GEELY',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/geely.png',
    sortOrder: 49,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'gmc',
    name: 'GMC',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/gmc.png',
    sortOrder: 50,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'great-wall',
    name: 'Great Wall',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/great-wall.png',
    sortOrder: 51,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'gtv',
    name: 'GTV',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/gtv.png',
    sortOrder: 52,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'gwm',
    name: 'GWM',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/gwm.png',
    sortOrder: 53,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'hawtai-motor',
    name: 'Hawtai Motor',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/hawtai-motor.png',
    sortOrder: 54,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'hongqi',
    name: 'HONGQI',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/hongqi.png',
    sortOrder: 55,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'hummer',
    name: 'HUMMER',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/hummer.png',
    sortOrder: 56,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'icar',
    name: 'ICAR',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/icar.png',
    sortOrder: 57,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'im',
    name: 'IM',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/im.png',
    sortOrder: 58,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'infiniti',
    name: 'Infiniti',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/infiniti.png',
    sortOrder: 59,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'isuzu',
    name: 'Isuzu',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/isuzu.png',
    sortOrder: 60,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'jac',
    name: 'JAC',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/jac.png',
    sortOrder: 61,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'jaguar',
    name: 'Jaguar',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/jaguar.png',
    sortOrder: 62,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'jetour',
    name: 'JETOUR',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/jetour.png',
    sortOrder: 63,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'jmc',
    name: 'JMC',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/jmc.png',
    sortOrder: 64,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'lamborghini',
    name: 'Lamborghini',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/lamborghini.png',
    sortOrder: 65,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'li',
    name: 'Li',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/li.png',
    sortOrder: 66,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'lotus',
    name: 'Lotus',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/lotus.png',
    sortOrder: 67,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'maserati',
    name: 'Maserati',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/maserati.png',
    sortOrder: 68,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'maxus',
    name: 'MAXUS',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/maxus.png',
    sortOrder: 69,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'mclaren',
    name: 'Mclaren',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/mclaren.png',
    sortOrder: 70,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'mini',
    name: 'MINI',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/mini.png',
    sortOrder: 71,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'ora',
    name: 'ORA',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/ora.png',
    sortOrder: 72,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'peugeot',
    name: 'Peugeot',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/peugeot.png',
    sortOrder: 73,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'ram',
    name: 'Ram',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/ram.png',
    sortOrder: 74,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'renault',
    name: 'Renault',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/renault.png',
    sortOrder: 75,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'rivian',
    name: 'Rivian',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/rivian.png',
    sortOrder: 76,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'rolls-royce',
    name: 'Rolls-Royce',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/rolls-royce.png',
    sortOrder: 77,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'soueast',
    name: 'Soueast',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/soueast.png',
    sortOrder: 78,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'subaru',
    name: 'Subaru',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/subaru.png',
    sortOrder: 79,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'suzuki',
    name: 'Suzuki',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/suzuki.png',
    sortOrder: 80,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'venucia',
    name: 'VENUCIA',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/venucia.png',
    sortOrder: 81,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'volvo',
    name: 'Volvo',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/volvo.png',
    sortOrder: 82,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'voyah',
    name: 'VOYAH',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/voyah.png',
    sortOrder: 83,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'wuling',
    name: 'WULING',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/wuling.png',
    sortOrder: 84,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'xiaomi',
    name: 'Xiaomi',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/xiaomi.png',
    sortOrder: 85,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'xpeng',
    name: 'XPENG',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/xpeng.png',
    sortOrder: 86,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'zeekr',
    name: 'ZEEKR',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/zeekr.png',
    sortOrder: 87,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'zotye',
    name: 'ZOTYE',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/zotye.png',
    sortOrder: 88,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'zx-auto',
    name: 'ZX AUTO',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/zx-auto.png',
    sortOrder: 89,
    subcategories: ['cars-for-sale'],
  },
  {
    slug: 'other-car-brand',
    name: 'Other',
    icon: '/sub-img/car_vehicles/cars-for-sale/brands/other-car-brand.png',
    sortOrder: 90,
    subcategories: ['cars-for-sale'],
  },
];

/**
 * Motorcycle brands (design order from the web mock, Honda first; the app's
 * local /sub-img/car_vehicles/motorcycles-for-sale/brands/*.png assets are the
 * interim icon source, like the cars set — admins replace via the UI). Slugs
 * derive from the asset filenames: the mock's `royal-enfeild` / `others`
 * entries map to royal-enfield.png / other.png. Names are mock-verbatim,
 * including the "Royal Enfeild" spelling. `bmw`, `honda`, and `suzuki` share
 * a display name with cars but have a different logo asset — the slugs here
 * take a `-moto` suffix so each branch keeps its own row, icon, and design
 * position (the bare slugs stay cars-only; both render the same name).
 */
export const MOTO_BRANDS: BrandSeed[] = [
  {
    slug: 'honda-moto',
    name: 'Honda',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/honda.png',
    sortOrder: 0,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'yamaha',
    name: 'Yamaha',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/yamaha.png',
    sortOrder: 1,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'suzuki-moto',
    name: 'Suzuki',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/suzuki.png',
    sortOrder: 2,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'kawasaki',
    name: 'Kawasaki',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/kawasaki.png',
    sortOrder: 3,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'ktm',
    name: 'KTM',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/ktm.png',
    sortOrder: 4,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'ducati',
    name: 'Ducati',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/ducati.png',
    sortOrder: 5,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'bajaj',
    name: 'Bajaj',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/bajaj.png',
    sortOrder: 6,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'kr-motor',
    name: 'Kr Motor',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/kr-motor.png',
    sortOrder: 7,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'gpx',
    name: 'GPX',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/gpx.png',
    sortOrder: 8,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'keewey',
    name: 'Keewey',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/keewey.png',
    sortOrder: 9,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'benelli',
    name: 'Benelli',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/benelli.png',
    sortOrder: 10,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'stallion',
    name: 'Stallion',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/stallion.png',
    sortOrder: 11,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'bmw-moto',
    name: 'BMW',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/bmw.png',
    sortOrder: 12,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'umg',
    name: 'UMG',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/umg.png',
    sortOrder: 13,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'calypso',
    name: 'Calypso',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/calypso.png',
    sortOrder: 14,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'cfmoto',
    name: 'CFMOTO',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/cfmoto.png',
    sortOrder: 15,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'harley-davidson',
    name: 'Harley Davidson',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/harley-davidson.png',
    sortOrder: 16,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'husqvarna',
    name: 'Husqvarna',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/husqvarna.png',
    sortOrder: 17,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'hyosung',
    name: 'HYOSUNG',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/hyosung.png',
    sortOrder: 18,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'italijet-dragster',
    name: 'Italijet Dragster',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/italijet-dragster.png',
    sortOrder: 19,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'lambretta',
    name: 'Lambretta',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/lambretta.png',
    sortOrder: 20,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'miku',
    name: 'MIKU',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/miku.png',
    sortOrder: 21,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'peugeot',
    name: 'PEUGEOT',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/peugeot.png',
    sortOrder: 22,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'piaggio',
    name: 'PIAGGIO',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/piaggio.png',
    sortOrder: 23,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'royal-enfield',
    name: 'Royal Enfeild',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/royal-enfield.png',
    sortOrder: 24,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'triumph',
    name: 'Triumph',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/triumph.png',
    sortOrder: 25,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'tvs',
    name: 'TVS',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/tvs.png',
    sortOrder: 26,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'yadea',
    name: 'Yadea',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/yadea.png',
    sortOrder: 27,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'vespa',
    name: 'Vespa',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/vespa.png',
    sortOrder: 28,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'zontes',
    name: 'Zontes',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/zontes.png',
    sortOrder: 29,
    subcategories: ['motorcycles-for-sale'],
  },
  {
    slug: 'other',
    name: 'Others',
    icon: '/sub-img/car_vehicles/motorcycles-for-sale/brands/other.png',
    sortOrder: 30,
    subcategories: ['motorcycles-for-sale'],
  },
];

export async function seedBrands(db: DbClient): Promise<void> {
  const slugs = [
    ...new Set(
      [...BRANDS, ...CAR_BRANDS, ...MOTO_BRANDS].flatMap(
        (b) => b.subcategories,
      ),
    ),
  ];
  const subRows = await db
    .select({ id: subcategories.id, slug: subcategories.slug })
    .from(subcategories)
    .where(inArray(subcategories.slug, slugs));
  const subSlugToId = new Map(subRows.map((r) => [r.slug, r.id]));

  const seenSlugs = new Set<string>();

  for (const brand of [...BRANDS, ...CAR_BRANDS, ...MOTO_BRANDS]) {
    // brands.slug is globally unique. xiaomi appears in both the phones and
    // the cars sets: the first occurrence creates/upserts the row; later
    // occurrences must NOT re-upsert (their sortOrder would clobber the
    // earlier set's ordering) — they only wire links + backfill a null icon.
    let brandId: string;
    if (seenSlugs.has(brand.slug)) {
      const [existing] = await db
        .select({ id: brands.id, icon: brands.icon })
        .from(brands)
        .where(eq(brands.slug, brand.slug))
        .limit(1);
      if (!existing) {
        throw new Error(
          `expected existing brand row for duplicate slug: ${brand.slug}`,
        );
      }
      brandId = existing.id;
      if (!existing.icon && brand.icon) {
        await db
          .update(brands)
          .set({ icon: brand.icon })
          .where(eq(brands.id, brandId));
      }
    } else {
      const [{ id }] = await db
        .insert(brands)
        .values({
          slug: brand.slug,
          name: brand.name,
          sortOrder: brand.sortOrder,
          ...(brand.icon ? { icon: brand.icon } : {}),
        })
        .onConflictDoUpdate({
          target: brands.slug,
          set: { name: brand.name, sortOrder: brand.sortOrder, isActive: true },
        })
        .returning({ id: brands.id });
      brandId = id;
      seenSlugs.add(brand.slug);
    }

    for (const subcategorySlug of brand.subcategories) {
      const subcategoryId = subSlugToId.get(subcategorySlug);
      if (!subcategoryId) continue;
      await db
        .insert(brandSubcategoryLinks)
        .values({ brandId, subcategoryId })
        .onConflictDoNothing();
    }
  }

  console.log(
    `  ✓ seeded ${BRANDS.length + CAR_BRANDS.length + MOTO_BRANDS.length} brands`,
  );
}

/**
 * Seed starter models (insert-only — admin-created models survive re-seeds).
 * The spec never enumerates models, so this is a curated baseline of common
 * devices per brand; admins add the rest via the Models admin page.
 */
/**
 * Slug-collision guard.
 *
 * `onConflictDoNothing` discards a colliding model without a word, so a seeded
 * name whose slug is already taken by a DIFFERENT name vanishes silently. That
 * is exactly how `Galaxy S25+` and `Galaxy S25` — which both slugified to
 * `galaxy-s25` — cost the database the plain Galaxy S21…S25 until it was found
 * by hand (see migration `0020_fix_plus_model_slugs`).
 *
 * Comparing the stored **name** against the seeded one is what separates a
 * genuine collision from an ordinary idempotent re-run, where every model
 * "conflicts" because it is already there. A guard that warned on every
 * conflict would fire ~390 times per seed and be ignored within a day.
 *
 * Pure, and exported so it can be unit-tested without running the seed.
 */
export function findSlugCollisions(
  wanted: { brandSlug: string; modelSlug: string; name: string }[],
  stored: Map<string, { slug: string; name: string }>,
  brandSlugToId: Map<string, string>,
): string[] {
  const collisions: string[] = [];
  const seen = new Set<string>();
  for (const { brandSlug, modelSlug, name } of wanted) {
    const brandId = brandSlugToId.get(brandSlug);
    const existing = brandId
      ? stored.get(`${brandId}:${modelSlug}`)
      : undefined;
    if (!existing || existing.name === name) continue;
    const key = `${brandSlug}:${modelSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    collisions.push(
      `${brandSlug}: "${name}" collides with "${existing.name}" on slug "${modelSlug}"`,
    );
  }
  return collisions;
}

export async function seedModels(db: DbClient): Promise<void> {
  const brandRows = await db
    .select({ id: brands.id, slug: brands.slug })
    .from(brands);
  const brandSlugToId = new Map(brandRows.map((r) => [r.slug, r.id]));

  // Every motorcycle model belongs to `motorcycles-for-sale`, so that list
  // stays flat and is wrapped here rather than nested 26 times over.
  const grouped: Record<string, Record<string, string[]>> = {
    ...MODEL_SEEDS,
    ...Object.fromEntries(
      Object.entries(MOTO_MODEL_SEEDS).map(([brandSlug, names]) => [
        brandSlug,
        { 'motorcycles-for-sale': names },
      ]),
    ),
  };

  const subcategoryRows = await db
    .select({ id: subcategories.id, slug: subcategories.slug })
    .from(subcategories);
  const subSlugToId = new Map(subcategoryRows.map((r) => [r.slug, r.id]));

  // Which subcategories each brand is actually linked to — a model linked to a
  // subcategory its brand is not in could never be reached there, so that is
  // warned about rather than silently written.
  const brandSubRows = await db
    .select({
      brandId: brandSubcategoryLinks.brandId,
      subcategoryId: brandSubcategoryLinks.subcategoryId,
    })
    .from(brandSubcategoryLinks);
  const brandSubKeys = new Set(
    brandSubRows.map((r) => `${r.brandId}:${r.subcategoryId}`),
  );

  // A trailing "+" is meaningful — "Galaxy S25+" is a different phone from
  // "Galaxy S25" — but "+" is outside the admin DTO's slug charset, so spell it
  // out. Before this both collapsed to `galaxy-s25`: the "+" entry won the slug
  // and the PLAIN Galaxy S21…S25 were silently dropped by onConflictDoNothing,
  // so the database was missing the base models entirely.
  const slugify = (name: string) =>
    name
      .toLowerCase()
      .replace(/\+/g, '-plus')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  let total = 0;
  // name → subcategory slugs, remembered so pass 2 can write the links.
  const linksWanted: {
    brandSlug: string;
    modelSlug: string;
    subSlug: string;
    name: string;
  }[] = [];

  // Pass 1 — insert the models themselves (insert-only, as before). The
  // sortOrder runs across the whole brand, so the design order survives the
  // regrouping by subcategory.
  const modelValues: {
    brandId: string;
    slug: string;
    name: string;
    sortOrder: number;
  }[] = [];

  for (const [brandSlug, groups] of Object.entries(grouped)) {
    const brandId = brandSlugToId.get(brandSlug);
    if (!brandId) continue;
    let order = 0;
    for (const [subSlug, modelNames] of Object.entries(groups)) {
      for (const raw of modelNames) {
        const name = raw.trim();
        const slug = slugify(name);
        modelValues.push({ brandId, slug, name, sortOrder: order });
        linksWanted.push({ brandSlug, modelSlug: slug, subSlug, name });
        order++;
        total++;
      }
    }
  }

  // Batched, for the same reason as the links below: one INSERT round-trip per
  // row made this seed take ~6 minutes against the remote database.
  const CHUNK = 200;
  for (let i = 0; i < modelValues.length; i += CHUNK) {
    await db
      .insert(models)
      .values(modelValues.slice(i, i + CHUNK))
      .onConflictDoNothing();
  }

  // Pass 2 — the links. This is what makes the change apply to the models that
  // already exist: pass 1 is insert-only and never touches those rows, but the
  // links are additive and resolve against whatever is in the table.
  const modelRows = await db
    .select({
      id: models.id,
      brandId: models.brandId,
      slug: models.slug,
      name: models.name,
    })
    .from(models);
  const modelKey = new Map(modelRows.map((r) => [`${r.brandId}:${r.slug}`, r]));

  const collisions = findSlugCollisions(linksWanted, modelKey, brandSlugToId);
  for (const c of collisions) console.warn(`  ⚠ ${c} — not seeded`);

  let linked = 0;
  const warned = new Set<string>();
  const pending: { modelId: string; subcategoryId: string }[] = [];
  for (const { brandSlug, modelSlug, subSlug } of linksWanted) {
    const brandId = brandSlugToId.get(brandSlug);
    const modelId = brandId
      ? modelKey.get(`${brandId}:${modelSlug}`)?.id
      : undefined;
    const subcategoryId = subSlugToId.get(subSlug);
    // No row means a collision was reported above, or the brand is unknown.
    if (!modelId) continue;
    if (!subcategoryId) {
      if (!warned.has(subSlug)) {
        warned.add(subSlug);
        console.warn(
          `  ⚠ unknown subcategory slug "${subSlug}" — links skipped`,
        );
      }
      continue;
    }
    if (brandId && !brandSubKeys.has(`${brandId}:${subcategoryId}`)) {
      if (!warned.has(`${brandSlug}:${subSlug}`)) {
        warned.add(`${brandSlug}:${subSlug}`);
        console.warn(
          `  ⚠ ${brandSlug} is not linked to ${subSlug} — model links skipped`,
        );
      }
      continue;
    }
    pending.push({ modelId, subcategoryId });
    linked++;
    // Batched: one round-trip per row made this seed take minutes against a
    // remote database.
    if (pending.length >= 200) {
      await db
        .insert(modelSubcategoryLinks)
        .values(pending.splice(0, pending.length))
        .onConflictDoNothing();
    }
  }

  if (pending.length > 0) {
    await db
      .insert(modelSubcategoryLinks)
      .values(pending)
      .onConflictDoNothing();
  }

  console.log(
    `  ✓ seeded ${total} models, ${linked} model→subcategory links` +
      (collisions.length > 0
        ? ` — ${collisions.length} slug collision(s), see warnings above`
        : ''),
  );
}
