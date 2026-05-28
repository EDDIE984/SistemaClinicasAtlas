// Vista de Configuraciones del Sistema integrada con Supabase
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BriefcaseMedical, Building2, MapPin, Users, UserCog, Tag, DoorOpen, CalendarClock, Stethoscope } from 'lucide-react';
import { SupabaseIndicator } from './SupabaseIndicator';

// Importar tabs individuales
import { CompaniaTabSupabase } from './config/CompaniaTabSupabase';
import { SucursalTabSupabase } from './config/SucursalTabSupabase';
import { ConsultorioTabSupabase } from './config/ConsultorioTabSupabase';
import { ServicioTabSupabase } from './config/ServicioTabSupabase';
import { UsuarioTabSupabase } from './config/UsuarioTabSupabase';
import { UsuarioSucursalTabSupabase } from './config/UsuarioSucursalTabSupabase';
import { PrecioBaseTabSupabase } from './config/PrecioBaseTabSupabase';
import { AsignacionConsultorioTabSupabase } from './config/AsignacionConsultorioTabSupabase';
import { HorarioServicioTabSupabase } from './config/HorarioServicioTabSupabase';
import { EspecialidadTabSupabase } from './config/EspecialidadTabSupabase';

export function ConfiguracionesViewSupabase() {
  const [tabActiva, setTabActiva] = useState('compania');

  const tabs = [
    { value: 'compania', label: 'Compañías', icon: Building2 },
    { value: 'sucursal', label: 'Sucursales', icon: MapPin },
    { value: 'consultorio', label: 'Consultorios', icon: DoorOpen },
    { value: 'servicio', label: 'Servicios', icon: BriefcaseMedical },
    { value: 'usuario', label: 'Usuarios', icon: Users },
    { value: 'usuario-sucursal', label: 'Asignaciones', icon: UserCog },
    { value: 'asignacion-consultorio', label: 'Horarios', icon: CalendarClock },
    { value: 'horarios-servicios', label: 'Horarios Servicios', icon: CalendarClock },
    { value: 'especialidad', label: 'Especialidades', icon: Stethoscope },
    { value: 'precio-base', label: 'Precios Base', icon: Tag },
  ];

  const tabActual = tabs.find(t => t.value === tabActiva);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <SupabaseIndicator />

      <div>
        <h1 className="mb-2">Configuraciones del Sistema</h1>
        <p className="text-sm md:text-base text-gray-600">
          Gestiona la información de compañías, sucursales, consultorios, servicios, usuarios, horarios y precios
        </p>
      </div>

      <Tabs value={tabActiva} onValueChange={setTabActiva} className="w-full">
        {/* Vista Desktop - Tabs horizontales */}
        <TabsList
          className="hidden md:grid w-full mb-6"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="min-w-0 flex items-center gap-2">
                <Icon className="size-4" />
                <span className="hidden lg:inline truncate">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Vista Móvil - Selector dropdown */}
        <div className="md:hidden mb-4">
          <Select value={tabActiva} onValueChange={setTabActiva}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {tabActual && (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Icon = tabActual.icon;
                      return <Icon className="size-4" />;
                    })()}
                    <span>{tabActual.label}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <SelectItem key={tab.value} value={tab.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4" />
                      <span>{tab.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="compania">
          <CompaniaTabSupabase />
        </TabsContent>

        <TabsContent value="sucursal">
          <SucursalTabSupabase />
        </TabsContent>

        <TabsContent value="consultorio">
          <ConsultorioTabSupabase />
        </TabsContent>

        <TabsContent value="servicio">
          <ServicioTabSupabase />
        </TabsContent>

        <TabsContent value="usuario">
          <UsuarioTabSupabase />
        </TabsContent>

        <TabsContent value="usuario-sucursal">
          <UsuarioSucursalTabSupabase />
        </TabsContent>

        <TabsContent value="asignacion-consultorio">
          <AsignacionConsultorioTabSupabase />
        </TabsContent>

        <TabsContent value="horarios-servicios">
          <HorarioServicioTabSupabase />
        </TabsContent>

        <TabsContent value="especialidad">
          <EspecialidadTabSupabase />
        </TabsContent>

        <TabsContent value="precio-base">
          <PrecioBaseTabSupabase />
        </TabsContent>
      </Tabs>
    </div>
  );
}
