import {bootstrapAdmin, deploymentConfig} from '../lib/bootstrap';
import {getDb} from '../lib/db';

try {
  const created = await bootstrapAdmin(getDb(), deploymentConfig(process.env));
  console.log(created ? 'Verwaltungskonto wurde angelegt.' : 'Datenbank ist bereits eingerichtet.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Die Einrichtung ist fehlgeschlagen.');
  process.exit(1);
}
