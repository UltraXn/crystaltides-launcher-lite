import { useModuleStore } from './registry';
import { NetherPortalModule } from './builtin/netherPortalModule';
import { CommunityHubModule } from './builtin/communityHubModule';

export * from './types';
export * from './registry';
export * from './builtin/netherPortalModule';
export * from './builtin/communityHubModule';

let initialized = false;

export const initializeBuiltinModules = () => {
  if (initialized) return;
  initialized = true;

  const registry = useModuleStore.getState();
  registry.registerModule(NetherPortalModule);
  registry.registerModule(CommunityHubModule);
  registry.loadSavedCustomPlugins();
};
