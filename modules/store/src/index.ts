import type { WowCmsModule } from "@wowcms/module-sdk";
import { StoreApiModule } from "./api.module";
import { storeMigrations } from "./migrations";
export { StoreApiModule } from "./api.module";
export { storeMigrations } from "./migrations";
export const storeModule: WowCmsModule = {
  id: "store",
  version: "1.0.0",
  permissions: [
    {
      key: "store.manage",
      description: "Manage the store catalog and payment settings.",
    },
  ],
  dashboard: [
    {
      path: "/admin/store",
      title: "Store",
      permission: "store.manage",
      order: 40,
    },
  ],
  migrations: storeMigrations,
  api: StoreApiModule,
};
