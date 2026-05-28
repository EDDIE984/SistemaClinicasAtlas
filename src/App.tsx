import { useState } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Toaster } from './components/ui/sonner';
import { ConfigProvider } from './contexts/ConfigContext';
import type { Usuario, AsignacionCompleta } from './lib/authService';

interface SessionData {
  usuario: Usuario;
  asignacion: AsignacionCompleta;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  const handleLogin = (usuario: Usuario, asignacion: AsignacionCompleta) => {
    setSessionData({ usuario, asignacion });
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSessionData(null);
  };

  const isConsultaExterna = (asignacion?: AsignacionCompleta | null) => {
    const servicio = asignacion?.servicio;
    if (!servicio) return true;

    const area = servicio.area.trim().toUpperCase();
    const descripcion = servicio.descripcion.trim().toUpperCase();

    return area === 'CONSULTA_EXTERNA' || descripcion === 'CONSULTA EXTERNA';
  };

  // Preparar datos del usuario para el Dashboard
  const currentUser = sessionData ? {
    name: `${sessionData.usuario.tipo_usuario === 'medico' ? 'Dr. ' : ''}${sessionData.usuario.nombre} ${sessionData.usuario.apellido}`,
    email: sessionData.usuario.email,
    compania: sessionData.asignacion.compania.nombre,
    id_sucursal: sessionData.asignacion.sucursal.id_sucursal,
    sucursal: sessionData.asignacion.sucursal.nombre,
    id_servicio: sessionData.asignacion.servicio?.id_servicio,
    especialidad: sessionData.asignacion.especialidad,
    servicio: sessionData.asignacion.servicio?.descripcion,
    servicio_area: sessionData.asignacion.servicio?.area,
    tipo_usuario: sessionData.usuario.tipo_usuario
  } : null;

  return (
    <ConfigProvider>
      <div className="min-h-screen">
        {!isLoggedIn ? (
          <Login onLogin={handleLogin} />
        ) : (
          <Dashboard onLogout={handleLogout} currentUser={currentUser} />
        )}
        <Toaster />
      </div>
    </ConfigProvider>
  );
}
