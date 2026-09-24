export interface ArtistIdentity { key: string; appearances: readonly { eventId: string; artistRowId: string }[] }
// Only explicitly reviewed identities belong here. Unmapped appearances remain independent.
export const artistIdentities: readonly ArtistIdentity[] = [
  {
    key: 'stann-lumo',
    appearances: [
      { eventId: 'TRM-01', artistRowId: '01-A' },
      { eventId: 'TRM-02', artistRowId: '02-A' },
    ],
  },
  { key: 'marcus-l', appearances: [{ eventId: 'TRM-01', artistRowId: '01-B' }] },
  { key: 'nusnoom', appearances: [{ eventId: 'TRM-01', artistRowId: '01-C' }] },
];
