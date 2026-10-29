import { router } from 'expo-router';

import { Button, EmptyState, PageContainer } from '@/components/ui';

export default function NotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon="compass-outline"
        title="Página não encontrada"
        message="O endereço acessado não existe no Acervo IA."
        action={<Button label="Ir para a visão geral" onPress={() => router.replace('/')} />}
      />
    </PageContainer>
  );
}
