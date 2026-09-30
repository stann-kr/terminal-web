import { describe,expect,it } from 'vitest';
import type { Artist,TerminalEvent } from '../lib/events/types';
import { buildArtistArchive } from '../features/artists/model';
import { accessAvailability, paragraphs } from '../features/events/model';
const artist=(id:string,status:Artist['status']='CONFIRMED'):Artist=>({id,name:'SAME NAME',origin:'KR',dock:'1',time:'TBA',status});
const event=(id:string,artists:Artist[],date='2026-10-01'):TerminalEvent=>({id,session:id,subtitle:'',date,time:'23:00',venue:'Venue',district:'Seoul',coords:'',capacity:'',sound:'',status:'UPCOMING',artists});
describe('public artist archive',()=>{
  it('groups the confirmed identities into three people and four public appearances',()=>{
    const profiles=buildArtistArchive([
      event('TRM-01',[artist('01-A'),artist('01-B'),artist('01-C')]),
      event('TRM-02',[artist('02-A'),artist('02-B','CLASSIFIED')]),
    ]);
    expect(profiles.map(profile=>profile.key).sort()).toEqual(['marcus-l','nusnoom','stann-lumo']);
    expect(profiles.every(profile=>profile.verified)).toBe(true);
    expect(profiles.find(profile=>profile.key==='stann-lumo')).toMatchObject({eventCount:2});
    expect(profiles.reduce((count,profile)=>count+profile.appearances.length,0)).toBe(4);
  });
  it('keeps names independent until appearances have an explicit reviewed mapping',()=>{
    const events=[event('A',[artist('1')]),event('B',[artist('2')])];
    expect(buildArtistArchive(events)).toHaveLength(2);
    const profiles=buildArtistArchive(events,[{key:'reviewed',appearances:[{eventId:'A',artistRowId:'1'},{eventId:'B',artistRowId:'2'}]}]);
    expect(profiles).toHaveLength(1);expect(profiles[0]).toMatchObject({key:'reviewed',eventCount:2,verified:true});
  });
  it('excludes private and disappeared appearances, without counting multiple slots as multiple events',()=>{
    const rows=buildArtistArchive([event('A',[artist('1'),artist('2'),artist('3','CLASSIFIED')])],[{key:'reviewed',appearances:[{eventId:'A',artistRowId:'1'},{eventId:'A',artistRowId:'2'},{eventId:'A',artistRowId:'3'},{eventId:'B',artistRowId:'4'}]}]);
    expect(rows).toHaveLength(1);expect(rows[0].eventCount).toBe(1);expect(rows[0].appearances.map(row=>row.artist.id)).toEqual(['1','2']);
  });
  it('rejects conflicting mapping and does not invent translations',()=>{
    expect(()=>buildArtistArchive([],[{key:'one',appearances:[{eventId:'A',artistRowId:'1'}]},{key:'two',appearances:[{eventId:'A',artistRowId:'1'}]}])).toThrow();
    expect(paragraphs({ko:['한국어','두 번째'],en:'English'},'ko')).toEqual(['한국어','두 번째']);
    expect(paragraphs({en:'English'},'ko')).toEqual([]);
  });
  it('keeps event and row identifiers with delimiters distinct',()=>{
    const profiles=buildArtistArchive([event('A:B',[artist('C')]),event('A',[artist('B:C')]),event('A%3AB',[artist('C')])]);
    expect(profiles).toHaveLength(3);expect(new Set(profiles.map(profile=>profile.key)).size).toBe(3);
  });
});
describe('event access availability',()=>{
  it('only opens the server-selected nearest future event within its 30-day window',()=>{
    const early=event('A',[],'2026-10-01'),later=event('B',[],'2026-10-02');
    expect(accessAvailability(early,[later,early],new Date('2026-09-01T14:00:00Z')).canRequest).toBe(true);
    expect(accessAvailability(later,[later,early],new Date('2026-09-24T00:00:00Z')).canRequest).toBe(false);
    expect(accessAvailability(early,[early],new Date('2026-09-01T13:59:59Z')).canRequest).toBe(false);
    expect(accessAvailability({...early,status:'ARCHIVED'},[early],new Date('2026-10-01T14:00:00Z')).canRequest).toBe(false);
  });
});
