import { useModuleStore } from './registry';
import { NetherPortalModule } from './builtin/netherPortalModule';
import { CommunityHubModule } from './builtin/communityHubModule';

export * from './types';
export * from './registry';
export * from './builtin/netherPortalModule';
export * from './builtin/communityHubModule';

export const initializeBuiltinModules = () => {
  const registry = useModuleStore.getState();
  if (!registry.modules.some((m) => m.id === NetherPortalModule.id)) {
    registry.registerModule(NetherPortalModule);
  }
  if (!registry.modules.some((m) => m.id === CommunityHubModule.id)) {
    registry.registerModule(CommunityHubModule);
  }
  registry.loadSavedCustomPlugins();
};

