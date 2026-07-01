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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupermarketsService } from './supermarkets.service';
import { CreateSupermarketDto } from './dto/create-supermarket.dto';
import { UpdateSupermarketDto } from './dto/update-supermarket.dto';
import { QuerySupermarketDto } from './dto/query-supermarket.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('supermarkets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('supermarkets')
export class SupermarketsController {
  constructor(private readonly service: SupermarketsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create supermarket' })
  create(@CurrentUser() userId: string, @Body() dto: CreateSupermarketDto) {
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List supermarkets (paginated, searchable)' })
  findAll(@CurrentUser() userId: string, @Query() query: QuerySupermarketDto) {
    return this.service.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get supermarket by ID' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@CurrentUser() userId: string, @Param('id', ParseUuidPipe) id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update supermarket' })
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateSupermarketDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete supermarket' })
  remove(@CurrentUser() userId: string, @Param('id', ParseUuidPipe) id: string) {
    return this.service.remove(userId, id);
  }
}
