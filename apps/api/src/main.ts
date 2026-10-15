import { createApplication } from './bootstrap';
import { readConfiguration, StartupError } from './config/environment';

async function start() {
  const configuration = readConfiguration();
  const app = await createApplication(configuration);
  let closing = false;
  const shutdown = async () => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info('Arrêt du serveur et des traitements en cours');
    // Une préparation interrompue sera reprise grâce à sa réservation en base.
    const deadline = setTimeout(() => {
      app.log.error('Délai de fermeture dépassé');
      process.exit(1);
    }, configuration.shutdownTimeout);
    deadline.unref();
    try {
      await app.close();
    } catch {
      app.log.error('La fermeture du serveur a échoué');
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  try {
    await app.listen({ host: configuration.http.host, port: configuration.http.port });
  } catch {
    // Fermer aussi les connexions si le port demandé est déjà occupé.
    await app.close();
    throw new StartupError('Écoute impossible. Vérifiez API_HOST et API_PORT.');
  }
}
void start().catch((error: unknown) => {
  // Les erreurs techniques peuvent contenir des accès : ne pas les imprimer ici.
  console.error(
    error instanceof StartupError
      ? error.message
      : 'Démarrage impossible. Vérifiez la base, ses migrations et le stockage configuré.',
  );
  process.exitCode = 1;
});
