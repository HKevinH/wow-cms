import { Body, Controller, Get, Inject, Param, Put, Post } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { RequirePermission } from '@wowcms/module-auth';

export const STORE_POOL = Symbol('STORE_POOL');

@Controller()
export class StoreController {
  constructor(@Inject(STORE_POOL) private readonly pool: Pool) {}

  @Get('config')
  async config() {
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT setting_key, setting_value FROM store_config');
    const values = Object.fromEntries(rows.map((r) => [String(r.setting_key), String(r.setting_value)]));
    return { enabled: values.enabled === 'true', currency: values.currency ?? 'USD' };
  }

  @Get('items')
  async items() { return this.listItems(false); }

  @Get('packages')
  async publicPackages() { const [rows] = await this.pool.query<RowDataPacket[]>('SELECT id,payment_method_id AS paymentMethodId,name,description,amount,currency,donor_points AS donorPoints,vote_points AS votePoints FROM store_package WHERE enabled = 1 ORDER BY sort_order,name'); return rows; }

  @Get('items/:id')
  async item(@Param('id') id: string) {
    const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT * FROM store_item WHERE id = ? AND enabled = 1 LIMIT 1', [Number(id)]);
    return this.mapItem(rows[0]);
  }

  @Get('admin/items') @RequirePermission('store.manage')
  async adminItems() { return this.listItems(true); }

  @Get('admin/payment-methods') @RequirePermission('store.manage')
  async paymentMethods() { const [rows] = await this.pool.query<RowDataPacket[]>('SELECT id,name,description,checkout_url AS checkoutUrl,enabled,sort_order AS sortOrder FROM store_payment_method ORDER BY sort_order,name'); return rows; }

  @Post('admin/payment-methods') @RequirePermission('store.manage')
  async createPaymentMethod(@Body() body: Record<string, unknown>) { const [result] = await this.pool.execute('INSERT INTO store_payment_method (name,description,checkout_url,enabled,sort_order) VALUES (?,?,?,?,?)', [String(body.name ?? ''), String(body.description ?? ''), String(body.checkoutUrl ?? ''), body.enabled === false ? 0 : 1, Number(body.sortOrder ?? 0)] as any[]); return { id: (result as { insertId: number }).insertId }; }

  @Get('admin/packages') @RequirePermission('store.manage')
  async packages() { const [rows] = await this.pool.query<RowDataPacket[]>('SELECT id,payment_method_id AS paymentMethodId,name,description,amount,currency,donor_points AS donorPoints,vote_points AS votePoints,enabled,sort_order AS sortOrder FROM store_package ORDER BY sort_order,name'); return rows; }

  @Post('admin/packages') @RequirePermission('store.manage')
  async createPackage(@Body() body: Record<string, unknown>) { const [result] = await this.pool.execute('INSERT INTO store_package (payment_method_id,name,description,amount,currency,donor_points,vote_points,enabled,sort_order) VALUES (?,?,?,?,?,?,?,?,?)', [body.paymentMethodId == null ? null : Number(body.paymentMethodId), String(body.name ?? ''), String(body.description ?? ''), Number(body.amount ?? 0), String(body.currency ?? 'USD'), Number(body.donorPoints ?? 0), Number(body.votePoints ?? 0), body.enabled === false ? 0 : 1, Number(body.sortOrder ?? 0)] as any[]); return { id: (result as { insertId: number }).insertId }; }

  @Put('admin/config') @RequirePermission('store.manage')
  async updateConfig(@Body() body: { enabled?: boolean; currency?: string }) {
    for (const [key, value] of Object.entries({ enabled: body.enabled, currency: body.currency })) if (value !== undefined) await this.pool.execute('INSERT INTO store_config (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [key, String(value)]);
    return this.config();
  }

  @Post('admin/items') @RequirePermission('store.manage')
  async createItem(@Body() body: Record<string, unknown>) {
    const [result] = await this.pool.execute('INSERT INTO store_item (realm_id,item_id,name,description,icon_url,category,price_donor_points,price_vote_points,details_json,enabled) VALUES (?,?,?,?,?,?,?,?,?,?)', [body.realmId == null ? null : Number(body.realmId), Number(body.itemId ?? 0), String(body.name ?? ''), String(body.description ?? ''), String(body.iconUrl ?? ''), String(body.category ?? ''), Number(body.priceDonorPoints ?? 0), Number(body.priceVotePoints ?? 0), JSON.stringify(body.details ?? {}), body.enabled === false ? 0 : 1] as any[]);
    return { id: (result as { insertId: number }).insertId };
  }

  private async listItems(includeDisabled: boolean) {
    const [rows] = await this.pool.query<RowDataPacket[]>(`SELECT * FROM store_item ${includeDisabled ? '' : 'WHERE enabled = 1'} ORDER BY category, name`);
    return rows.map((row) => this.mapItem(row));
  }

  private mapItem(row: RowDataPacket | undefined) {
    if (!row) return null;
    let details: Record<string, unknown> = {};
    try { details = row.details_json ? JSON.parse(String(row.details_json)) : {}; } catch { /* invalid legacy metadata remains empty */ }
    return { id: Number(row.id), realmId: row.realm_id === null ? null : Number(row.realm_id), itemId: Number(row.item_id), name: String(row.name), description: String(row.description ?? ''), iconUrl: String(row.icon_url ?? ''), category: String(row.category ?? ''), priceDonorPoints: Number(row.price_donor_points), priceVotePoints: Number(row.price_vote_points), details, enabled: Boolean(row.enabled) };
  }
}

export class StoreApiModule { static register(pool: Pool) { return { module: StoreApiModule, controllers: [StoreController], providers: [{ provide: STORE_POOL, useValue: pool }] }; } }
