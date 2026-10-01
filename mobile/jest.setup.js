import "@testing-library/react-native/extend-expect";

// `src/services/api.ts` lee EXPO_PUBLIC_API_URL en el scope del módulo y hace
// throw si está vacía (línea 16), así que el fallo ocurre al importarlo, antes
// de que el test pueda hacer nada. Los .env no se versionan, por lo que se
// define aquí: en los tests nunca se abre una conexión real.
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || "/api";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({}),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  expoConfig: {
    version: "1.0.0",
  },
}));

jest.mock("expo-device", () => ({
  modelName: "Test Device",
  osVersion: "14.0",
}));