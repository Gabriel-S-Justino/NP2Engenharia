import AsyncStorage from '@react-native-async-storage/async-storage';

/** Persistência local mínima (identificador da conversa, preferências). Falhas são ignoradas com segurança. */
const PREFIX = 'acervo-ia:';

export async function readValue(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export async function writeValue(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(PREFIX + key);
    else await AsyncStorage.setItem(PREFIX + key, value);
  } catch {
    // armazenamento indisponível (ex.: modo privado): a aplicação continua funcionando sem persistência
  }
}
