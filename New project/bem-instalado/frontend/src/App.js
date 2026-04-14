import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import AdminDashboard from './components/Admin/AdminDashboard';
import Agenda from './components/Agenda/Agenda';
import Budgets from './components/Budgets/Budgets';
import BudgetForm from './components/Budgets/BudgetForm';
import Clients from './components/Clients/Clients';
import Dashboard from './components/Dashboard/Dashboard';
import AdminRoute from './components/Layout/AdminRoute';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import SubscriptionGate from './components/Layout/SubscriptionGate';
import Notifications from './components/Notifications/Notifications';
import Profile from './components/Profile/Profile';
import ClientLanding from './components/Public/ClientLanding';
import Home from './components/Public/Home';
import InstallerProfile from './components/Public/InstallerProfile';
import SupportChat from './components/Support/SupportChat';
import Subscription from './components/Subscription/Subscription';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ClientLanding />} path="/" />
        <Route element={<Home />} path="/cliente" />
        <Route element={<InstallerProfile />} path="/installers/:id" />
        <Route element={<Navigate replace to="/" />} path="/login" />
        <Route element={<Login />} path="/instalador/entrar" />
        <Route element={<Navigate replace to="/" />} path="/register" />
        <Route element={<Register />} path="/instalador/cadastro" />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route element={<Profile />} path="/profile" />
            <Route element={<Subscription />} path="/subscription" />
            <Route element={<SupportChat />} path="/support" />
            <Route element={<AdminRoute />}>
              <Route element={<AdminDashboard />} path="/admin" />
            </Route>

            <Route element={<SubscriptionGate />}>
              <Route element={<Dashboard />} path="/dashboard" />
              <Route element={<Clients />} path="/clients" />
              <Route element={<Budgets />} path="/budgets" />
              <Route element={<BudgetForm />} path="/budgets/new" />
              <Route element={<Agenda />} path="/agenda" />
              <Route element={<Notifications />} path="/notifications" />
            </Route>
          </Route>
        </Route>
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
