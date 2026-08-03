import { assertMasterPasswordConfigured } from "../masterPassword";

export type ServerModuleLoader = () => Promise<unknown>;

const loadOperationalServer: ServerModuleLoader = () => import("./server");

export function startConfiguredServer(
  configuredHash: string | undefined,
  loadServer: ServerModuleLoader = loadOperationalServer
): Promise<unknown> {
  assertMasterPasswordConfigured(configuredHash);
  return loadServer();
}
