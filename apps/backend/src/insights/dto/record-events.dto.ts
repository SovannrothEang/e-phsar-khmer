import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import {
  LISTING_EVENT_TYPES,
  type ListingEventType,
} from '../../db/schema/insights.schema';

/** One interaction in a tracking batch. */
export class ListingEventDto {
  @ApiProperty({ description: 'The listing the visitor interacted with' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ enum: LISTING_EVENT_TYPES })
  @IsIn(LISTING_EVENT_TYPES)
  type!: ListingEventType;
}

/**
 * A batch of interactions. The web client buffers feed impressions and sends
 * single action events; 50 is the ceiling for either shape.
 */
export class RecordEventsDto {
  @ApiProperty({ type: [ListingEventDto], maxItems: 50 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ListingEventDto)
  events!: ListingEventDto[];
}

/** The service's input shape; the DTO satisfies it without a cast. */
export interface InsightEventInput {
  listingId: string;
  type: ListingEventType;
}
