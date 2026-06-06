import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore.ts';

/**
 * Tests de **caractérisation** des trios CRUD (add/update/delete) des
 * collections d'entités. Ils verrouillent le comportement EXACT avant la
 * factorisation par fabrique générique :
 *  - `add` journalise un audit `*.create` (catégorie `metier`) ;
 *  - `update` et `delete` ne journalisent PAS (comportement existant) ;
 *  - la suppression d'un adhérent met en cascade ses tuteurs.
 */
const get = () => useAppStore.getState();
const data = () => get().data;
const activeId = () => data().activeSeasonId;
const auditLen = () => data().audit.length;
const isUuid = (s: string) => /^[0-9a-f]{8}-/.test(s);

describe('store — trios CRUD (caractérisation)', () => {
  beforeEach(() => {
    get().resetAll('Club test', '2025-2026', 1000);
  });

  it('adhérents : add (UUID + audit create) / update (sans audit) / delete (cascade tuteurs, sans audit)', () => {
    const id = get().addAdherent({
      seasonId: activeId(),
      firstName: 'Marie',
      lastName: 'Plouf',
      category: 'adulte',
      amount: 60,
      paid: false,
    });
    expect(isUuid(id)).toBe(true);
    expect(data().adherents).toHaveLength(1);
    expect(
      data().audit.some(
        a => a.action === 'adherent.create' && a.category === 'metier'
      )
    ).toBe(true);

    // Tuteur rattaché à l'adhérent.
    const gid = get().addGuardian({
      memberId: id,
      relation: 'pere',
      name: 'Papa Plouf',
    });
    expect(data().guardians).toHaveLength(1);

    // update : muté sans nouvel audit.
    const before = auditLen();
    get().updateAdherent(id, { paid: true, amount: 75 });
    const a = data().adherents.find(x => x.id === id)!;
    expect(a.paid).toBe(true);
    expect(a.amount).toBe(75);
    expect(auditLen()).toBe(before);

    // delete : retire l'adhérent ET son tuteur, sans audit.
    get().deleteAdherent(id);
    expect(data().adherents).toHaveLength(0);
    expect(data().guardians.find(g => g.id === gid)).toBeUndefined();
    expect(auditLen()).toBe(before);
  });

  it('exercices (entraînement) : add audite, update/delete non', () => {
    const id = get().addExercise({
      seasonId: activeId(),
      name: 'Sprint apnée',
      category: 'technique',
    });
    expect(isUuid(id)).toBe(true);
    expect(data().audit.some(a => a.action === 'exercise.create')).toBe(true);

    const before = auditLen();
    get().updateExercise(id, { name: 'Sprint apnée v2' });
    expect(data().exercises.find(x => x.id === id)!.name).toBe(
      'Sprint apnée v2'
    );
    get().deleteExercise(id);
    expect(data().exercises).toHaveLength(0);
    expect(auditLen()).toBe(before);
  });

  it('annonces (vie du club) : add audite, update/delete non', () => {
    const id = get().addAnnouncement({
      seasonId: activeId(),
      date: '2025-09-10',
      title: 'Reprise',
      body: 'Mardi 19h',
    });
    expect(data().audit.some(a => a.action === 'announcement.create')).toBe(
      true
    );
    const before = auditLen();
    get().updateAnnouncement(id, { pinned: true });
    expect(data().announcements.find(x => x.id === id)!.pinned).toBe(true);
    get().deleteAnnouncement(id);
    expect(data().announcements).toHaveLength(0);
    expect(auditLen()).toBe(before);
  });

  it('tuteurs : update et delete d’un id inconnu sont des no-op', () => {
    const before = auditLen();
    get().updateGuardian('inconnu', { name: 'X' });
    get().deleteGuardian('inconnu');
    expect(data().guardians).toHaveLength(0);
    expect(auditLen()).toBe(before);
  });

  it('événements comptables : create audite, delete audite ET détache les écritures', () => {
    const evId = get().addEvent('Tournoi de Noël', 'tournoi');
    expect(data().audit.some(a => a.action === 'event.create')).toBe(true);
    const entryId = get().addEntry({
      seasonId: activeId(),
      categoryCode: 'R1',
      date: '2025-12-20',
      label: 'Buvette',
      sens: 'credit',
      amount: 200,
      method: 'especes',
      eventId: evId,
    })!;
    get().deleteEvent(evId);
    expect(data().events).toHaveLength(0);
    // L'écriture survit mais est détachée.
    expect(data().entries.find(e => e.id === entryId)!.eventId).toBeUndefined();
    expect(data().audit.some(a => a.action === 'event.delete')).toBe(true);
  });

  it('récurrences : add et delete NE journalisent PAS', () => {
    const before = auditLen();
    const rid = get().addRecurring({
      label: 'Assurance',
      categoryCode: 'D12',
      amount: 12,
      method: 'prelevement',
    });
    expect(data().recurrings).toHaveLength(1);
    get().deleteRecurring(rid);
    expect(data().recurrings).toHaveLength(0);
    expect(auditLen()).toBe(before);
  });

  it('catégorie personnalisée : code auto C1 + audit, puis suppression', () => {
    const code = get().addCustomCategory({
      label: 'Subvention',
      sens: 'recette',
    });
    expect(code).toBe('C1');
    expect(data().customCategories.find(c => c.code === 'C1')?.label).toBe(
      'Subvention'
    );
    expect(data().audit.some(a => a.action === 'category.create')).toBe(true);
    get().removeCustomCategory('C1');
    expect(data().customCategories.find(c => c.code === 'C1')).toBeUndefined();
  });
});
