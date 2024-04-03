import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TaskDto {
  @IsString({ each: true })
  @ApiProperty({
    type: [String],
    example: [
      'q1.sql',
      'q2.sql',
      'q3.sql',
      's1.sql',
      's2.sql',
      's3.sql',
      'i1.sql',
      'i2.sql',
      'i3.sql',
      'm1.sql',
      'm2.sql',
      'g1.sql',
      'g2.sql',
      'g3.sql',
      'g4.sql',
      't1.sql',
      't2.sql',
      'l1.sql',
      'l2.sql',
      'l3.sql',
      'x1.sql',
      'x2.sql',
      'x3.sql',
      'x4.sql',
      'f1.sql',
      'f2.sql',
    ],
  })
  readonly queries: string[];
}
