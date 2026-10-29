export interface ArtistIdentity { key: string; appearances: readonly { eventId: string; artistRowId: string }[] }
// Appearances under the same name are one artist without an entry here (model.ts). An entry names
// the artist's file (its URL) or, by mapping rows to different keys, keeps two artists of one name apart.
export const artistIdentities: readonly ArtistIdentity[] = [
  {
    key: 'stann-lumo',
    appearances: [
      { eventId: 'TRM-01', artistRowId: '01-A' },
      { eventId: 'TRM-02', artistRowId: '02-A' },
      { eventId: 'TRM-03', artistRowId: '03-A' },
    ],
  },
  { key: 'marcus-l', appearances: [{ eventId: 'TRM-01', artistRowId: '01-B' }] },
  { key: 'nusnoom', appearances: [{ eventId: 'TRM-01', artistRowId: '01-C' }] },
];
