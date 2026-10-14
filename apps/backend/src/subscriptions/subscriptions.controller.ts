import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/api-response.types';
import { Public } from '../common/decorators/public.decorator';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Public()
  @Get('catalog')
  catalog() {
    return this.subscriptions.catalog();
  }

  @Get('me')
  @ApiBearerAuth()
  mine(@CurrentUser() user: RequestUser) {
    return this.subscriptions.mine(user.id);
  }

  @Post('checkout')
  @ApiBearerAuth()
  checkout(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    return this.subscriptions.checkout(user.id, dto);
  }
}
