export function createMockIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();

  return {
    open(_dbName: string, _version: number) {
      const listeners: Record<string, ((ev: unknown) => void)[]> = {};
      const addEventListener = (event: string, cb: (ev: unknown) => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      };

      const mockDb = {
        addEventListener: (_evt: string, _cb: unknown) => {},
        removeEventListener: (_evt: string, _cb: unknown) => {},
        close: () => {},
        objectStoreNames: {
          contains(name: string) {
            return stores.has(name);
          },
        },
        createObjectStore(name: string) {
          if (!stores.has(name)) {
            stores.set(name, new Map());
          }
          return {};
        },
        transaction(storeNames: string | string[], _mode: string) {
          const storeName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
          if (!stores.has(storeName)) {
            stores.set(storeName, new Map());
          }
          const storeMap = stores.get(storeName)!;
          const txListeners: Record<string, ((ev: unknown) => void)[]> = {};

          const tx = {
            error: null,
            addEventListener(evt: string, fn: (ev: unknown) => void) {
              txListeners[evt] = txListeners[evt] || [];
              txListeners[evt].push(fn);
            },
            objectStore(_name: string) {
              return {
                get(key: string) {
                  const reqListeners: Record<string, ((ev: unknown) => void)[]> = {};
                  const req = {
                    result: storeMap.get(key) || null,
                    error: null,
                    addEventListener(evt: string, fn: (ev: unknown) => void) {
                      reqListeners[evt] = reqListeners[evt] || [];
                      reqListeners[evt].push(fn);
                    },
                  };
                  queueMicrotask(() => {
                    reqListeners['success']?.forEach((fn) => fn({ target: req }));
                    txListeners['complete']?.forEach((fn) => fn({ target: tx }));
                  });
                  return req;
                },
                put(val: unknown, key: string) {
                  storeMap.set(key, val);
                  const reqListeners: Record<string, ((ev: unknown) => void)[]> = {};
                  const req = {
                    result: key,
                    error: null,
                    addEventListener(evt: string, fn: (ev: unknown) => void) {
                      reqListeners[evt] = reqListeners[evt] || [];
                      reqListeners[evt].push(fn);
                    },
                  };
                  queueMicrotask(() => {
                    reqListeners['success']?.forEach((fn) => fn({ target: req }));
                    txListeners['complete']?.forEach((fn) => fn({ target: tx }));
                  });
                  return req;
                },
              };
            },
          };
          return tx;
        },
      };

      const request = {
        result: mockDb,
        error: null,
        addEventListener,
      };

      queueMicrotask(() => {
        listeners['upgradeneeded']?.forEach((fn) => fn({ target: request }));
        listeners['success']?.forEach((fn) => fn({ target: request }));
      });

      return request;
    },
  };
}

if (typeof globalThis.indexedDB === 'undefined') {
  globalThis.indexedDB = createMockIndexedDB() as unknown as IDBFactory;
}
