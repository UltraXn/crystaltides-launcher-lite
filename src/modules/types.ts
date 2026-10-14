import React from 'react';
import type { GameInstance } from '../services/instanceService';
import type { UserAccount } from '../store/launcherStore';

export type ModuleCategory = 'tools' | 'gaming' | 'social' | 'appearance' | 'server' | 'utility';

export interface ModuleStorage {
  get: <T = unknown>(key: string, defaultValue?: T) => T;
  set: <T = unknown>(key: string, value: T) => void;
  remove: (key: string) => void;
}

export interface LauncherModuleContext {
  activeInstance: GameInstance | undefined;
  activeAccount: UserAccount | undefined;
  serverStatus: {
    online: boolean;
    playersCount: number;
    maxPlayers: number;
    ping: number;
  };
  accentColor: string;
  openModuleModal: (moduleId: string) => void;
  closeModuleModal: () => void;
  launchGame: () => void;
  storage: ModuleStorage;
}

export interface ModuleDockButtonSlot {
  id: string;
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  defaultColor?: string;
  onClick: (ctx: LauncherModuleContext) => void;
}

export interface ModuleModalSlot {
  id: string;
  title: string;
  width?: string;
  component: React.FC<{
    ctx: LauncherModuleContext;
    onClose: () => void;
  }>;
}

export interface ModuleWidgetSlot {
  id: string;
  title: string;
  defaultPosition?: { x: number; y: number };
  component: React.FC<{
    ctx: LauncherModuleContext;
  }>;
}

export interface LauncherModule {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: ModuleCategory;
  accentColor?: string;
  isCustom?: boolean;
  manifest?: CustomPluginManifest;
  slots: {
    dockButton?: ModuleDockButtonSlot;
    modal?: ModuleModalSlot;
    widget?: ModuleWidgetSlot;
  };
  onInit?: (ctx: LauncherModuleContext) => void;
  onDestroy?: () => void;
}

export interface CustomPluginManifest {
  id: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  category?: ModuleCategory;
  accentColor?: string;
  slots?: {
    dockButton?: {
      label: string;
      tooltip?: string;
      iconName?: string;
      defaultColor?: string;
      actionType: 'url' | 'modal' | 'openDir';
      actionTarget?: string;
    };
    modal?: {
      title: string;
      description?: string;
      externalUrl?: string;
      links?: Array<{
        title: string;
        desc?: string;
        url: string;
      }>;
    };
  };
}

