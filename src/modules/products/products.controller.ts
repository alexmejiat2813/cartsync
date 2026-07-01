import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lists/:listId/products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add product to list — recalculates list total_amount' })
  @ApiParam({ name: 'listId', format: 'uuid' })
  create(
    @CurrentUser() userId: string,
    @Param('listId', ParseUuidPipe) listId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.service.create(userId, listId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List products in a list (paginated)' })
  @ApiParam({ name: 'listId', format: 'uuid' })
  findAll(
    @CurrentUser() userId: string,
    @Param('listId', ParseUuidPipe) listId: string,
    @Query() query: QueryProductDto,
  ) {
    return this.service.findAll(userId, listId, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product — recalculates total if price/qty changes' })
  @ApiParam({ name: 'listId', format: 'uuid' })
  update(
    @CurrentUser() userId: string,
    @Param('listId', ParseUuidPipe) listId: string,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(userId, listId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove product — recalculates list total_amount' })
  @ApiParam({ name: 'listId', format: 'uuid' })
  remove(
    @CurrentUser() userId: string,
    @Param('listId', ParseUuidPipe) listId: string,
    @Param('id', ParseUuidPipe) id: string,
  ) {
    return this.service.remove(userId, listId, id);
  }
}
