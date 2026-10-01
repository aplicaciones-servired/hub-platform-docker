// Entorno para los tests.
//
// `src/config/env.ts` llama a `requireEnv()` al ser importado, y
// `src/lib/logger.ts` lo importa en la línea 1. Eso significa que cualquier
// suite que cargue el logger (los 10 `*.controller.test.ts`) exige
// DATABASE_URL, JWT_SECRET y JWT_REFRESH_SECRET antes de ejecutar un solo test.
//
// Antes estos valores venían del `backend/.env` versionado, que es justo lo que
// dejó de existir: los .env no se versionan. Los tests no deben depender de un
// archivo que el repo no lleva, así que se definen aquí.
//
// No se abre ninguna conexión: los valores son sintácticamente válidos pero
// ningún test llega a usarlos para conectar. Se usa ||= para no pisar una
// variable real si el desarrollador sí tiene un `.env` local.
process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/hub_test";
process.env.JWT_SECRET ||= "test_jwt_secret_placeholder_1234567890_abcdefgh";
process.env.JWT_REFRESH_SECRET ||= "test_jwt_refresh_secret_placeholder_1234567890";
