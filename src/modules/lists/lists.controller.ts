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
import { ListsService } from './lists.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { QueryListDto } from './dto/query-list.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe';

@ApiTags('lists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lists')
export class ListsController {
  constructor(private readonly service: ListsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create shopping list' })
  create(@CurrentUser() userId: string, @Body() dto: CreateListDto) {
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List shopping lists (paginated, filterable)' })
  findAll(@CurrentUser() userId: string, @Query() query: QueryListDto) {
    return this.service.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get list with supermarket and products' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@CurrentUser() userId: string, @Param('id', ParseUuidPipe) id: string) {
    return this.service.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update list — completing recalculates total_amount' })
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateListDto,
  ) {
    return this.service.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete list' })
  remove(@CurrentUser() userId: string, @Param('id', ParseUuidPipe) id: string) {
    return this.service.remove(userId, id);
  }
}
