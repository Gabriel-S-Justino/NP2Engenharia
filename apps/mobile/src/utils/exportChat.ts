import { Platform } from 'react-native';

export async function downloadChat(filename: string, content: string) {
  const safeName = filename.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0,100);
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = safeName; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const [{ File, Paths }, sharing] = await Promise.all([import('expo-file-system'), import('expo-sharing')]);
  if (!await sharing.isAvailableAsync()) throw new Error('Compartilhamento indisponível neste dispositivo.');
  const file = new File(Paths.cache, safeName);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  await sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: 'Exportar conversa' });
}
