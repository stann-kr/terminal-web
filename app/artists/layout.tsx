import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Artist Archive', description: 'Explore TERMINAL artists and their event appearance records.' };
export default function ArtistsLayout({ children }: { children: React.ReactNode }) { return children; }
