import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BarcodeService } from './barcode.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('barcode')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('barcode')
export class BarcodeController {
  constructor(private readonly barcodeService: BarcodeService) {}

  @Get('scan/:code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lookup product by barcode via Open Food Facts' })
  @ApiParam({ name: 'code', example: '7501055300166' })
  @ApiResponse({ status: 200, description: 'Product data for autocomplete' })
  @ApiResponse({ status: 404, description: 'Barcode not found in external registry' })
  async scan(
    @Param('code') code: string,
    @CurrentUser() userId: string,
  ) {
    return this.barcodeService.lookup(code, userId);
  }
}
