import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AccountSummary, Role } from '@wowcms/contracts';
import type { Pool } from 'mysql2/promise';
import { listAccounts, type FieldMap } from '@wowcms/core-adapters';
import { MysqlAuthStore } from './auth.repository';
import { RequirePermission } from './guard';

export const AUTH_STORE = Symbol('AUTH_STORE');
export const EMULATOR_ACCESS = Symbol('EMULATOR_ACCESS');

export interface EmulatorAccess {
  readonly pool: Pool;
  readonly fieldMap: FieldMap;
}

interface RoleBody {
  name?: string;
  description?: string;
  permissions?: unknown;
}

/** Role and grant administration. Mounted at /api/roles and /api/accounts by the
 *  platform for the same reason the session controller is: who may do what is not
 *  a module's private business. */
@Controller()
export class RolesController {
  constructor(
    @Inject(AUTH_STORE) private readonly store: MysqlAuthStore,
    @Inject(EMULATOR_ACCESS) private readonly emulator: EmulatorAccess,
  ) {}

  @Get('roles')
  @RequirePermission('roles.manage')
  listRoles(): Promise<Role[]> {
    return this.store.listRoles();
  }

  @Post('roles')
  @RequirePermission('roles.manage')
  async createRole(@Body() body: RoleBody): Promise<{ id: number }> {
    const name = (body.name ?? '').trim();
    if (!/^[a-z0-9-]{2,64}$/.test(name)) {
      throw new BadRequestException('A role name is 2-64 lowercase letters, digits or hyphens.');
    }

    const id = await this.store.createRole(
      name,
      (body.description ?? '').slice(0, 255),
      toPermissions(body.permissions),
    );
    return { id };
  }

  @Put('roles/:id')
  @RequirePermission('roles.manage')
  async updateRole(@Param('id') id: string, @Body() body: RoleBody): Promise<{ ok: true }> {
    await this.store.updateRole(
      toId(id),
      (body.description ?? '').slice(0, 255),
      toPermissions(body.permissions),
    );
    return { ok: true };
  }

  @Delete('roles/:id')
  @RequirePermission('roles.manage')
  async deleteRole(@Param('id') id: string): Promise<{ ok: true }> {
    await this.store.deleteRole(toId(id));
    return { ok: true };
  }

  /** The account list, joined with the roles each one holds. The accounts
   *  themselves come from the emulator through the adapter; only the grants are
   *  ours. */
  @Get('accounts')
  @RequirePermission('accounts.manage')
  async listAccounts(
    @Query('search') search?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ): Promise<{ items: AccountSummary[]; total: number }> {
    const page = await listAccounts(this.emulator.pool, this.emulator.fieldMap, {
      search,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });

    const roles = await this.store.roleNamesOf(page.items.map((account) => account.id));

    return {
      total: page.total,
      items: page.items.map((account) => ({
        id: account.id,
        username: account.username,
        email: account.email,
        roles: roles.get(account.id) ?? [],
      })),
    };
  }

  @Post('accounts/:accountId/roles/:roleId')
  @RequirePermission('accounts.manage')
  async grant(
    @Param('accountId') accountId: string,
    @Param('roleId') roleId: string,
  ): Promise<{ ok: true }> {
    await this.store.grantRole(toId(accountId), toId(roleId));
    return { ok: true };
  }

  @Delete('accounts/:accountId/roles/:roleId')
  @RequirePermission('accounts.manage')
  async revoke(
    @Param('accountId') accountId: string,
    @Param('roleId') roleId: string,
  ): Promise<{ ok: true }> {
    await this.store.revokeRole(toId(accountId), toId(roleId));
    return { ok: true };
  }
}

function toId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new BadRequestException(`'${value}' is not an id.`);
  }
  return id;
}

/** Permissions arrive as JSON from a form. Anything that is not an array of
 *  strings becomes an empty list rather than a role that grants who knows what. */
function toPermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}
