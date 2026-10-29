/* Configuração dos testes: AsyncStorage em memória (mock oficial do pacote). */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
