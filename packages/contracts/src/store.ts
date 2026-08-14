export interface StoreConfig {
  readonly enabled: boolean;
  readonly currency: string;
}

export interface PaymentMethod {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly checkoutUrl: string;
  readonly enabled: boolean;
  readonly sortOrder: number;
}

export interface PointPackage {
  readonly id: number;
  readonly paymentMethodId: number | null;
  readonly name: string;
  readonly description: string;
  readonly amount: number;
  readonly currency: string;
  readonly donorPoints: number;
  readonly votePoints: number;
  readonly enabled: boolean;
  readonly sortOrder: number;
}

export interface StoreItem {
  readonly id: number;
  readonly realmId: number | null;
  readonly itemId: number;
  readonly name: string;
  readonly description: string;
  readonly iconUrl: string;
  readonly category: string;
  readonly priceDonorPoints: number;
  readonly priceVotePoints: number;
  readonly details: Record<string, unknown>;
  readonly enabled: boolean;
}
