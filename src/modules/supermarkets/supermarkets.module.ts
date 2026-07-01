import { Module } from '@nestjs/common';
import { SupermarketsService } from './supermarkets.service';
import { SupermarketsController } from './supermarkets.controller';

@Module({
  providers: [SupermarketsService],
  controllers: [SupermarketsController],
  exports: [SupermarketsService],
})
export class SupermarketsModule {}
