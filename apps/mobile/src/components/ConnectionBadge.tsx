import { Badge } from '@/components/ui';
import { useAppState } from '@/state/AppState';

export function ConnectionBadge() {
  const { connection } = useAppState();
  const map = {
    checking: { label: 'Verificando conexão…', tone: 'neutral' as const, icon: 'time-outline' as const },
    online: { label: 'Tudo pronto', tone: 'success' as const, icon: 'checkmark-circle-outline' as const },
    degraded: { label: 'Atenção ao serviço', tone: 'warning' as const, icon: 'warning-outline' as const },
    offline: { label: 'Sem conexão', tone: 'danger' as const, icon: 'cloud-offline-outline' as const },
  }[connection];
  return <Badge label={map.label} tone={map.tone} icon={map.icon} />;
}
