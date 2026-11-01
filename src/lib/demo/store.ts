import { buildDemoData } from "./data";

/**
 * Punto unico da cui le pagine leggono i dati nella Milestone 1.
 * Dalla Milestone 2 questo modulo verrà sostituito da letture su Supabase con la stessa forma.
 */
export function getData() {
  return buildDemoData();
}
