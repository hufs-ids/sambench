import { IsString } from 'class-validator';

export class TaskDto {
  @IsString({ each: true })
  readonly queries: string[];
}
