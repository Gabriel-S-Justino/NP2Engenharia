import { Badge } from '@/components/ui';
import { useAppState } from '@/state/AppState';

export function ConnectionBadge() {
  const { connection } = useAppState();
  const map = {
    checking: { label: 'Verificando conexão…', tone: 'neutral' as const, icon: 'time-outline' as const },
    online: { label: 'Backend conectado', tone: 'success' as const, icon: 'checkmark-circle-outline' as const },
    degraded: { label: 'Backend com alertas', tone: 'warning' as const, icon: 'warning-outline' as const },
    offline: { label: 'Backend indisponível', tone: 'danger' as const, icon: 'cloud-offline-outline' as const },
  }[connection];
  return <Badge label={map.label} tone={map.tone} icon={map.icon} />;
}
