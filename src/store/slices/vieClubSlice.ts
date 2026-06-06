import type {
  Announcement,
  ClubEvent,
  PhotoAlbum,
  Tournament,
} from '../../shared/types/domain.ts';
import type { StoreSlice, VieClubActions } from '../types.ts';
import { makeCrud } from '../crudFactory.ts';

/** Vie du club : agenda, annonces, tournois, galerie photo. */
export const createVieClubSlice: StoreSlice<VieClubActions> = set => {
  const clubEvent = makeCrud<ClubEvent>(set, {
    get: d => d.clubEvents,
    replace: (d, clubEvents) => ({ ...d, clubEvents }),
    auditAction: 'clubevent.create',
    auditTarget: 'clubevent',
    summary: e => `Événement « ${e.title} » ajouté à l'agenda.`,
    upsertOp: e => ({ kind: 'clubevent.upsert', clubEvent: e }),
    deleteOp: id => ({ kind: 'clubevent.delete', id }),
  });

  const announcement = makeCrud<Announcement>(set, {
    get: d => d.announcements,
    replace: (d, announcements) => ({ ...d, announcements }),
    auditAction: 'announcement.create',
    auditTarget: 'announcement',
    summary: a => `Annonce « ${a.title} » publiée.`,
    upsertOp: a => ({ kind: 'announcement.upsert', announcement: a }),
    deleteOp: id => ({ kind: 'announcement.delete', id }),
  });

  const tournament = makeCrud<Tournament>(set, {
    get: d => d.tournaments,
    replace: (d, tournaments) => ({ ...d, tournaments }),
    auditAction: 'tournament.create',
    auditTarget: 'tournament',
    summary: t => `Tournoi « ${t.name} » créé.`,
    upsertOp: t => ({ kind: 'tournament.upsert', tournament: t }),
    deleteOp: id => ({ kind: 'tournament.delete', id }),
  });

  const album = makeCrud<PhotoAlbum>(set, {
    get: d => d.photoAlbums,
    replace: (d, photoAlbums) => ({ ...d, photoAlbums }),
    auditAction: 'album.create',
    auditTarget: 'album',
    summary: a => `Album « ${a.title} » ajouté.`,
    upsertOp: a => ({ kind: 'album.upsert', album: a }),
    deleteOp: id => ({ kind: 'album.delete', id }),
  });

  return {
    addClubEvent: clubEvent.add,
    updateClubEvent: clubEvent.update,
    deleteClubEvent: clubEvent.remove,
    addAnnouncement: announcement.add,
    updateAnnouncement: announcement.update,
    deleteAnnouncement: announcement.remove,
    addTournament: tournament.add,
    updateTournament: tournament.update,
    deleteTournament: tournament.remove,
    addPhotoAlbum: album.add,
    updatePhotoAlbum: album.update,
    deletePhotoAlbum: album.remove,
  };
};
