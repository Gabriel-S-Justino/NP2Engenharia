import { router } from 'expo-router';

import { Button, EmptyState, PageContainer } from '@/components/ui';

export default function NotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon="compass-outline"
        title="Parece que saímos da rota"
        message="O endereço acessado não existe no Lume."
        action={<Button label="Ir para o início" onPress={() => router.replace('/')} />}
      />
    </PageContainer>
  );
}
