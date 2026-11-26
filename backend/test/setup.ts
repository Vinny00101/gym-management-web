import { ConsoleLogger } from '@nestjs/common';

// Alguns testes exercitam caminhos de erro de propósito (filtro de exceções e
// health check com banco indisponível). O ConsoleLogger imprime esses erros
// mesmo quando a asserção passa, poluindo a saída. Silencia apenas nos testes;
// o comportamento de logging em produção permanece intacto.
for (const level of ['error', 'warn', 'log', 'debug', 'verbose', 'fatal'] as const) {
  vi.spyOn(ConsoleLogger.prototype, level).mockImplementation(() => undefined);
}
