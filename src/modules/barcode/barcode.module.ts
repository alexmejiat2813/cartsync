import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BarcodeService } from './barcode.service';
import { BarcodeController } from './barcode.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  providers: [BarcodeService],
  controllers: [BarcodeController],
})
export class BarcodeModule {}
