import { Navigate, Route, Routes } from 'react-router';
import { AppProvider, useApp, useSession } from './lib/app';
import { Loading } from './components/ui';
import { UpdateBanner } from './components/UpdateBanner';
import SignIn from './screens/SignIn';
import Welcome from './screens/Welcome';
import ListsHome from './screens/ListsHome';
import ListDetail from './screens/ListDetail';
import FinishTrip from './screens/FinishTrip';
import Repeats from './screens/Repeats';
import Spending from './screens/Spending';
import Family from './screens/Family';

export default function App() {
  const session = useSession();
  return (
    <div className="app">
      <UpdateBanner />
      {session === undefined ? (
        <Loading />
      ) : session === null ? (
        <SignIn />
      ) : (
        <AppProvider session={session} key={session.user.id}>
          <Gate />
        </AppProvider>
      )}
    </div>
  );
}

function Gate() {
  const { loading, household } = useApp();
  if (loading) return <Loading />;
  if (!household) return <Welcome />;
  return (
    <Routes>
      <Route path="/" element={<ListsHome />} />
      <Route path="/list/:listId" element={<ListDetail />} />
      <Route path="/list/:listId/finish" element={<FinishTrip />} />
      <Route path="/repeats" element={<Repeats />} />
      <Route path="/spending" element={<Spending />} />
      <Route path="/family" element={<Family />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
