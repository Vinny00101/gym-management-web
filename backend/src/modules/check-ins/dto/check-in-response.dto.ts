import { ApiProperty } from '@nestjs/swagger';

export class CheckInResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 7 })
  memberId: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-26T12:34:56.000Z',
  })
  checkedInAt: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-26T00:00:00.000Z',
  })
  localDate: Date;
}
