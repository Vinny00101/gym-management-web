import { ApiProperty } from '@nestjs/swagger';
import { CheckInResponseDto } from './check-in-response.dto.js';

export class CheckInHistoryResponseDto {
  @ApiProperty({ type: [CheckInResponseDto] })
  items: CheckInResponseDto[];

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}
