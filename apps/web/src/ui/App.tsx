import { AdministrationPage } from './pages/Administration';
import { ProfilePage, RecoveryPage } from './pages/Identity';
import { ConfirmationProvider } from './components/ConfirmationProvider';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { httpCatalog } from '../adapters/http/catalog-repository';
import { httpLearning } from '../adapters/http/personal';
import { LearningProvider } from './context';
import { StudyProvider } from './study-provider';
import { useAuth, RequireSession } from './auth-context';
import { Layout } from './components/Layout';
import { ButtonLink, EmptyState } from './components/primitives';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { CoursePage, Classroom } from './pages/Course';
import { Paths, PathDetail } from './pages/Paths';
import { Dashboard } from './pages/Dashboard';
import { About } from './pages/About';
import { TeachingPage } from './pages/Teaching';
import { AuthPage } from './pages/Auth';
export function App() {
  const { session, loading } = useAuth();
  const accountId = session?.learner.id ?? 'guest';
  if (loading) {
    return <p className="container section">Chargement de votre espace…</p>;
  }
  return (
    <LearningProvider
      key={accountId}
      catalog={httpCatalog}
      learning={httpLearning}
      authenticated={!!session}
    >
      <StudyProvider accountId={session?.learner.id ?? null}>
        <BrowserRouter>
          <ConfirmationProvider>
            <Routes>
              <Route element={<RequireSession />}>
                <Route path="administration/*" element={<AdministrationPage />} />
              </Route>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="catalogue" element={<Catalog />} />
                <Route path="cours/:id" element={<CoursePage />} />
                <Route path="parcours" element={<Paths />} />
                <Route path="parcours/:id" element={<PathDetail />} />
                <Route
                  path="mot-de-passe-oublie"
                  element={<RecoveryPage key="forgot" mode="forgot" />}
                />
                <Route
                  path="nouveau-mot-de-passe"
                  element={<RecoveryPage key="reset" mode="reset" />}
                />
                <Route
                  path="verifier-email"
                  element={<RecoveryPage key="verify" mode="verify" />}
                />
                <Route path="connexion" element={<AuthPage />} />
                <Route element={<RequireSession />}>
                  <Route
                    path="profil"
                    element={
                      session && ['SUPER_ADMIN', 'REGULATOR'].includes(session.learner.role) ? (
                        <Navigate replace to="/administration/profil" />
                      ) : (
                        <ProfilePage />
                      )
                    }
                  />
                  <Route path="enseigner" element={<TeachingPage />} />
                  <Route
                    path="mon-espace"
                    element={
                      session && ['SUPER_ADMIN', 'REGULATOR'].includes(session.learner.role) ? (
                        <Navigate replace to="/administration" />
                      ) : (
                        <Dashboard />
                      )
                    }
                  />
                  <Route path="apprendre/:id/:lessonId?" element={<Classroom />} />
                </Route>
                <Route path="a-propos" element={<About />} />
                <Route
                  path="*"
                  element={
                    <EmptyState
                      title="Cette page a pris un autre chemin"
                      description="Retrouvez votre prochaine découverte à l’accueil."
                    >
                      <ButtonLink to="/">Retour à l’accueil</ButtonLink>
                    </EmptyState>
                  }
                />
              </Route>
            </Routes>
          </ConfirmationProvider>
        </BrowserRouter>
      </StudyProvider>
    </LearningProvider>
  );
}
