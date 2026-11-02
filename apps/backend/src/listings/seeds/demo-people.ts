/**
 * The people who own the demo catalogue (2026-11-01). Real accounts — a name,
 * a unique username and a phone number they can sign in with (phone OTP; the
 * dev bypass token works for all of them) — so every seeded ad belongs to a
 * person and none to the admin, in UAT as much as in dev.
 *
 * Thirty people because the free plan holds 5 live ads per account and 2 in
 * cars-for-sale: 24 sellers carry the 48 catalogue cars two apiece, and the
 * remaining ads are spread so nobody goes over (over a cap the listing sweep
 * flips the extras to `restricted` and hides them from every feed).
 */
export interface DemoPerson {
  username: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  province: string;
  location: string;
}

const P = (
  firstName: string,
  lastName: string,
  gender: 'male' | 'female',
  province: string,
  location: string,
): DemoPerson => ({
  username: `${firstName}${lastName}`.toLowerCase().replace(/[^a-z]/g, ''),
  firstName,
  lastName,
  gender,
  province,
  location,
});

export const DEMO_PEOPLE: DemoPerson[] = [
  P('Dara', 'Sok', 'male', 'phnom-penh', 'Toul Kork'),
  P('Chantha', 'Keo', 'female', 'phnom-penh', 'Boeung Keng Kang'),
  P('Vannak', 'Chea', 'male', 'siem-reap', 'Svay Dangkum'),
  P('Sreyneang', 'Heng', 'female', 'phnom-penh', 'Sen Sok'),
  P('Kimhong', 'Lim', 'male', 'battambang', 'Battambang City'),
  P('Rithy', 'Pich', 'male', 'phnom-penh', 'Chroy Changvar'),
  P('Bopha', 'Meas', 'female', 'sihanoukville', 'Sihanoukville'),
  P('Samnang', 'Ouk', 'male', 'phnom-penh', 'Daun Penh'),
  P('Davy', 'Nhem', 'female', 'phnom-penh', 'Meanchey'),
  P('Piseth', 'Yim', 'male', 'phnom-penh', 'Russey Keo'),
  P('Lyda', 'Chhun', 'female', 'siem-reap', 'Svay Dangkum'),
  P('Sovann', 'Roeun', 'male', 'phnom-penh', 'Chbar Ampov'),
  P('Sophea', 'Tith', 'female', 'battambang', 'Battambang City'),
  P('Rotha', 'Vong', 'male', 'phnom-penh', 'Toul Kork'),
  P('Malis', 'Seng', 'female', 'phnom-penh', 'Sen Sok'),
  P('Visal', 'Noun', 'male', 'phnom-penh', 'Boeung Keng Kang'),
  P('Channary', 'Kong', 'female', 'sihanoukville', 'Sihanoukville'),
  P('Makara', 'Khun', 'male', 'phnom-penh', 'Chroy Changvar'),
  P('Sokha', 'Prak', 'female', 'siem-reap', 'Svay Dangkum'),
  P('Narith', 'Soeung', 'male', 'phnom-penh', 'Daun Penh'),
  P('Sreymom', 'Ly', 'female', 'phnom-penh', 'Meanchey'),
  P('Bunthoeun', 'Ek', 'male', 'battambang', 'Battambang City'),
  P('Kanha', 'Thy', 'female', 'phnom-penh', 'Russey Keo'),
  P('Veasna', 'Hout', 'male', 'phnom-penh', 'Chbar Ampov'),
  P('Pheakdey', 'Sam', 'male', 'phnom-penh', 'Toul Kork'),
  P('Sreypov', 'Nget', 'female', 'phnom-penh', 'Sen Sok'),
  P('Chanra', 'Oun', 'male', 'siem-reap', 'Svay Dangkum'),
  P('Monirith', 'Bin', 'male', 'phnom-penh', 'Daun Penh'),
  P('Sokunthea', 'Pen', 'female', 'phnom-penh', 'Boeung Keng Kang'),
  P('Rathana', 'Dy', 'male', 'sihanoukville', 'Sihanoukville'),
];

/** E.164 sign-in number for person `index` (a reserved range, one per person). */
export const demoPhone = (index: number): string =>
  `+85589700${String(index + 1).padStart(3, '0')}`;
