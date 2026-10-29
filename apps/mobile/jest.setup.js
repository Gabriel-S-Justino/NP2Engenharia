/* Configuração dos testes: AsyncStorage em memória (mock oficial do pacote). */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/* Ícones: substitui o componente que carrega fontes por um elemento simples (somente nos testes). */
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = require('react-native');
  const Icon = ({ name }) => require('react').createElement(Text, { accessibilityElementsHidden: true, importantForAccessibility: 'no' }, '');
  Icon.displayName = 'Ionicons';
  return { __esModule: true, default: Icon };
});
