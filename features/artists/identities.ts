export interface ArtistIdentity { key: string; appearances: readonly { eventId: string; artistRowId: string }[] }
// Only explicitly reviewed identities belong here. Unmapped appearances remain independent.
export const artistIdentities: readonly ArtistIdentity[] = [];
