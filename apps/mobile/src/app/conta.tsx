import { router } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, Card, Notice, PageContainer, PageHeader, TextField } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/services/api';
import { authMessage, getAuthClient, MIN_PASSWORD_LENGTH } from '@/services/auth';
import { useAppState } from '@/state/AppState';
import { useAuth } from '@/state/AuthState';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';
export default function AccountScreen() {
  const { user, loading, error: sessionError, refreshSession, signOut } = useAuth();
  const { sending, historyLoading, adminToken, importLegacy, legacyCount } = useAppState();
  const usage = useAsync(() => user ? api.usage() : Promise.resolve(null), [user?.id]);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const changeMode = (next: Mode) => { setMode(next); setError(null); setMessage(null); setPassword(''); setOtp(''); };

  const submit = async () => {
    if (busy || loading) return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setError('Informe um e-mail válido.'); return; }
    if ((mode === 'signup' || mode === 'reset') && password.length < MIN_PASSWORD_LENGTH) { setError(`Use uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`); return; }
    if (mode === 'signup' && !name.trim()) { setError('Informe seu nome.'); return; }
    setBusy(true); setError(null); setMessage(null);
    try {
      const client = await getAuthClient();
      if (mode === 'forgot') {
        const result = await client.emailOtp.requestPasswordReset({ email: address });
        if (result.error) { setError(authMessage(result.error)); return; }
        setMode('reset'); setMessage('Pedido recebido. Se houver uma conta com esse e-mail, confira a caixa de entrada e o spam.'); return;
      }
      if (mode === 'reset') {
        const result = await client.emailOtp.resetPassword({ email: address, otp: otp.trim(), password });
        if (result.error) { setError(authMessage(result.error)); return; }
        setMode('login'); setPassword(''); setOtp(''); setMessage('Senha atualizada. Entre na sua conta.'); return;
      }
      const result = mode === 'signup'
        ? await client.signUp.email({ email: address, password, name: name.trim() })
        : await client.signIn.email({ email: address, password });
      if (result.error) { setError(authMessage(result.error)); return; }
      setPassword('');
      if (!await refreshSession()) {
        setError('Não foi possível iniciar a sessão neste navegador. Tente entrar novamente.');
        return;
      }
      router.replace('/chat');
    } catch (failure) { setError(authMessage(failure)); }
    finally { setBusy(false); }
  };

  return (
    <PageContainer width="reading">
      <PageHeader title={user ? 'Sua conta' : mode === 'signup' ? 'Crie sua conta' : mode === 'login' ? 'Entre no Lumme' : 'Recuperar acesso'}
        description="Suas conversas ficam vinculadas à sua conta e podem ser abertas em outros dispositivos." />
      {sessionError ? <Notice tone="warning">{sessionError}<Button label="Verificar acesso novamente" variant="ghost" onPress={() => void refreshSession()} /></Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      {user ? (
        <>
          <Card>
            <AppText variant="subtitle">{user.name}</AppText>
            <AppText>{user.email}</AppText>
            <Button label="Sair da conta" variant="secondary" disabled={sending || historyLoading || busy} onPress={() => {
              setBusy(true); setError(null);
              void signOut().catch(() => setError('Não foi possível sair. Tente novamente.')).finally(() => setBusy(false));
            }} />
          </Card>
          <Card>
            <AppText variant="subtitle">Seu consumo</AppText>
            {usage.data ? (
              <><AppText>{usage.data.daily_used} de {usage.data.daily_limit} perguntas admitidas hoje.</AppText>
              <AppText variant="helper">A cota renova à meia-noite UTC. Tentativas aceitas também contam quando o provedor falha.</AppText></>
            ) : <AppText variant="helper">O consumo aparece quando o serviço estiver disponível.</AppText>}
            <Button label="Atualizar consumo" variant="ghost" onPress={() => void usage.reload()} />
          </Card>
          {legacyCount > 0 ? (
            <Card>
              <AppText variant="subtitle">Histórico anterior ao login</AppText>
              <AppText>Há identificadores de conversas antigas neste dispositivo. Eles não comprovam quem era o usuário anônimo. Um administrador pode vinculá-los à conta exibida acima.</AppText>
              {!adminToken ? <AppText variant="helper">Informe seu token administrativo em Configurações para habilitar a vinculação.</AppText> : null}
              <Button label={confirmImport ? 'Confirmar vinculação a esta conta' : 'Revisar vinculação do histórico anterior'}
                disabled={!adminToken || busy || sending || historyLoading}
                onPress={() => {
                  if (!confirmImport) { setConfirmImport(true); return; }
                  setBusy(true); setError(null);
                  void importLegacy().then((count) => { setMessage(`${count} conversa(s) vinculada(s) à sua conta.`); setConfirmImport(false); })
                    .catch(() => setError('Não foi possível vincular o histórico. Confira o token e tente novamente.')).finally(() => setBusy(false));
                }} />
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          {mode === 'signup' ? <TextField label="Nome" value={name} onChangeText={setName} autoComplete="name" /> : null}
          <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} />
          {mode === 'reset' ? <TextField label="Código recebido por e-mail" value={otp} onChangeText={setOtp} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy} /> : null}
          {mode !== 'forgot' ? <TextField label={mode === 'reset' ? 'Nova senha' : 'Senha'} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} editable={!busy} /> : null}
          <Button label={mode === 'signup' ? 'Criar conta' : mode === 'login' ? 'Entrar' : mode === 'forgot' ? 'Enviar código' : 'Atualizar senha'} loading={busy || loading} onPress={() => void submit()} />
          <Button label={mode === 'login' ? 'Criar uma conta' : 'Voltar para entrar'} variant="ghost" disabled={busy} onPress={() => changeMode(mode === 'login' ? 'signup' : 'login')} />
          {mode === 'reset' ? <Button label="Solicitar novo código" variant="ghost" disabled={busy} onPress={() => changeMode('forgot')} /> : null}
          {mode === 'login' ? <Button label="Esqueci minha senha" variant="ghost" disabled={busy} onPress={() => changeMode('forgot')} /> : null}
          <AppText variant="caption" color="textSecondary">Usamos o Neon Auth para gerenciar seu acesso. O Neon Auth valida as credenciais e gerencia a sessão.</AppText>
        </Card>
      )}
    </PageContainer>
  );
}
