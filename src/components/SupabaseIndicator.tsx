// Indicador visual de que se están usando datos de Supabase
import { Database } from 'lucide-react';
import { Badge } from './ui/badge';

export function SupabaseIndicator() {
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 flex items-center gap-2 px-3 py-1.5">
        <Database className="size-3.5" />
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full size-2 bg-green-500"></span>
        </span>
      </Badge>
    </div>
  );
}
