/**
 * Messages du groupe « io » (outils finances) : import Excel, rapprochement
 * bancaire et modèles récurrents. Recomposé dans `../messages.ts` sous la clé
 * `io`. fr/en de forme identique.
 */
export const ioFr = {
  import: {
    title: 'Importer depuis Excel',
    introBefore: 'Importe la feuille ',
    introSheet: '« Compte »',
    introMid:
      ' de votre classeur. Les écritures sont ajoutées à la saison active ',
    introAfter:
      ' (les catégories sont déduites du code d’ORDRE : R1…R9, D1…D13).',
    chooseFile: 'Choisir un fichier .xlsx',
    reading: 'Lecture…',
    readError:
      'Lecture impossible. Vérifiez votre connexion (le lecteur Excel est chargé à la demande) et le format .xlsx.',
    importN: 'Importer {n} écriture(s)',
    seasonClosed: 'Saison {season} clôturée — rouvrez-la pour importer.',
    sheetRead: 'Feuille lue',
    entriesDetected: 'Écritures détectées',
    openingDetected: 'Reliquat détecté',
    warnings: '{n} avertissement(s)',
    andMore: '… et {n} autre(s)',
    applyOpening: "Appliquer le reliquat détecté comme solde d'ouverture",
    done: '{n} écriture(s) importée(s) dans {season}.',
  },
  reconcile: {
    title: 'Rapprochement bancaire',
    introBefore:
      'Importez le CSV de votre relevé (colonnes Date, Libellé, Débit/Crédit ou Montant). Les écritures de même montant et date proche sont ',
    introStrong: 'pointées',
    introAfter: ' automatiquement.',
    chooseFile: 'Choisir un relevé .csv',
    readError: 'Lecture du CSV impossible.',
    statementLines: 'Lignes du relevé',
    matched: 'Appariées',
    unmatched: 'Sans correspondance',
    seeUnmatched: 'Voir les lignes non rapprochées',
    matchN: 'Pointer {n} écriture(s)',
    done: '{n} écriture(s) pointée(s).',
  },
  recurring: {
    title: 'Modèles récurrents',
    intro:
      'Générez en un clic les écritures qui reviennent (frais bancaires, soutiens…). La saisie est ajoutée à la saison active.',
    genDate: 'Date de génération',
    generated: 'Écriture « {label} » générée au {date}.',
    noTemplates: 'Aucun modèle.',
    generate: 'Générer',
    generateAria: 'Générer {label}',
    deleteAria: 'Supprimer {label}',
    newTemplate: 'Nouveau modèle',
    label: 'Libellé',
    labelPlaceholder: 'Frais bancaires SG',
    amountEuro: 'Montant (€)',
    method: 'Mode de règlement',
    addTemplate: 'Ajouter le modèle',
  },
} as const;

export const ioEn = {
  import: {
    title: 'Import from Excel',
    introBefore: 'Imports the ',
    introSheet: '« Compte »',
    introMid:
      ' sheet of your workbook. Entries are added to the active season ',
    introAfter:
      ' (categories are inferred from the ORDER code: R1…R9, D1…D13).',
    chooseFile: 'Choose an .xlsx file',
    reading: 'Reading…',
    readError:
      'Could not read the file. Check your connection (the Excel reader loads on demand) and the .xlsx format.',
    importN: 'Import {n} entry(ies)',
    seasonClosed: 'Season {season} is closed — reopen it to import.',
    sheetRead: 'Sheet read',
    entriesDetected: 'Entries detected',
    openingDetected: 'Opening balance detected',
    warnings: '{n} warning(s)',
    andMore: '… and {n} more',
    applyOpening: 'Apply the detected balance as the opening balance',
    done: '{n} entry(ies) imported into {season}.',
  },
  reconcile: {
    title: 'Bank reconciliation',
    introBefore:
      'Import your statement CSV (Date, Label, Debit/Credit or Amount columns). Entries with the same amount and a close date are ',
    introStrong: 'reconciled',
    introAfter: ' automatically.',
    chooseFile: 'Choose a .csv statement',
    readError: 'Could not read the CSV.',
    statementLines: 'Statement lines',
    matched: 'Matched',
    unmatched: 'Unmatched',
    seeUnmatched: 'Show unmatched lines',
    matchN: 'Reconcile {n} entry(ies)',
    done: '{n} entry(ies) reconciled.',
  },
  recurring: {
    title: 'Recurring templates',
    intro:
      'Generate recurring entries in one click (bank fees, grants…). The entry is added to the active season.',
    genDate: 'Generation date',
    generated: 'Entry "{label}" generated on {date}.',
    noTemplates: 'No template.',
    generate: 'Generate',
    generateAria: 'Generate {label}',
    deleteAria: 'Delete {label}',
    newTemplate: 'New template',
    label: 'Label',
    labelPlaceholder: 'Bank fees SG',
    amountEuro: 'Amount (€)',
    method: 'Payment method',
    addTemplate: 'Add template',
  },
} as const;
