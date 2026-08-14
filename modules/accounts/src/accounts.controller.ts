import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  Query,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { AccountId, NewAccount } from '@wowcms/contracts';
import { RequirePermission, type RequestWithViewer } from '@wowcms/module-auth';
import { AccountsService, InvalidCredentialsError, UsernameTakenError } from './accounts.service';

export const ACCOUNTS_SERVICE = Symbol('ACCOUNTS_SERVICE');

/** Mounted by the platform under /api/m/accounts. Its only job is turning domain
 *  errors into the right status codes; the rules live in the service. */
@Controller()
export class AccountsController {
  constructor(@Inject(ACCOUNTS_SERVICE) private readonly accounts: AccountsService) {}

  @Get()
  @RequirePermission('accounts.manage')
  list(@Query() query: { search?: string; field?: 'username' | 'email'; limit?: string; offset?: string }) {
    return this.accounts.list({ ...query, limit: Number(query.limit), offset: Number(query.offset) });
  }

  @Get('me/balances')
  async balances(@Req() request: RequestWithViewer) {
    if (!request.viewer) throw new UnauthorizedException('Log in to continue.');
    return this.accounts.balances(request.viewer.accountId);
  }

  @Post('register')
  async register(@Body() body: NewAccount): Promise<{ accountId: AccountId }> {
    try {
      return await this.accounts.register(body);
    } catch (error) {
      if (error instanceof UsernameTakenError) throw new ConflictException(error.message);
      throw error;
    }
  }

  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
  ): Promise<{ accountId: AccountId }> {
    try {
      return await this.accounts.login(body.username, body.password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) throw new UnauthorizedException(error.message);
      throw error;
    }
  }
}
