import { Article } from './warehouseUtils';

// Erstellt das vollständige PUT-Payload für das Verschieben eines Artikels.
// Backend erwartet das VOLLSTÄNDIGE Article-Objekt (kein PATCH-Endpoint vorhanden).
export function buildMovePayload(article: Article, newLocationId: string): Article {
  return { ...article, storage_location_id: newLocationId };
}

// Validiert einen Move-Vorgang. Gibt null zurück wenn ok, sonst Fehlermeldung.
export function validateMove(
  currentLocationId: string,
  targetLocationId: string
): string | null {
  if (!targetLocationId) return 'Bitte einen Ziel-Lagerplatz auswählen.';
  if (targetLocationId === currentLocationId) {
    return 'Ziel-Lagerplatz ist identisch mit dem aktuellen Lagerplatz.';
  }
  return null;
}
