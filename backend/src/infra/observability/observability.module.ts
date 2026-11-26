import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { TerminusModule } from '@nestjs/terminus';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    TerminusModule,
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
  ],
  exports: [TerminusModule, ObserveModule],
})
export class ObservabilityModule {}
