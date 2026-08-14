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
  /** `ItemDisplayInfo` row this item renders as, or 0 when unknown. The model
   *  pipeline is keyed by it, and it is the only handle the emulator gives us
   *  onto the art: two items with the same appearance share a display. */
  readonly displayId: number;
  /** Where the item is worn. The pipeline needs it because `ItemDisplayInfo`
   *  stores a bare filename and the folder under `Item\ObjectComponents`
   *  follows the slot. */
  readonly inventoryType: number;
  readonly details: Record<string, unknown>;
  readonly enabled: boolean;
}
