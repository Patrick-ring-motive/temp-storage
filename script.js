(() => {
  if (!self.sessionStorage) {
    const sessionStorageMap = new Map();
    const sessionStore = {
      getItem(key) {
        return sessionStorageMap.get(String(key));
      },
      setItem(key, value) {
        sessionStorageMap.set(String(key), String(value));
      },
      removeItem(key) {
        sessionStorageMap.delete(String(key));
      },
      clear() {
        sessionStorageMap.clear();
      },
      key(index) {
        return [...sessionStorageMap.keys()][index];
      }
    };
    Object.defineProperty(sessionStore, 'length', {
      get() {
        return sessionStorageMap.size;
      }
    });
    self.sessionStorage = sessionStore;
  }
})();
(() => {
  (function SharedWorkerStorageScript() {
    const instanceOf = (x, y) => {
      try {
        return x instanceof y;
      } catch {
        return false;
      }
    };
    if (instanceOf(self, self.SharedWorkerGlobalScope) || instanceOf(self, self.DedicatedWorkerGlobalScope)) {
      (() => {
        const store = new Map();
        onconnect = (event) => {
          const port = [...event?.ports ?? []]?.shift?.();
          (port ?? self).onmessage = (e) => {
            const { requestId, type, key, value } = e?.data ?? {};
            const respond = {
              SET: () => port.postMessage({
                requestId, type: 'SET_RESULT',
                success: store.set(key, value)
              }),
              GET: () => port.postMessage({
                requestId,
                type: 'GET_RESULT',
                key,
                value: store.get(key)
              }),
              DELETE: () => port.postMessage({
                requestId,
                type: 'DELETE_RESULT',
                key,
                value: store.delete(key)
              })
            };
            respond[type]();
          };
        };
        onconnect();
      })();
    } else {
      (() => {
        const sharedWorker = new (self.SharedWorker ?? self.Worker)(`data:text/javascript,(${encodeURIComponent(SharedWorkerStorageScript)})();`);
        sharedWorker?.port?.start?.();
        class SharedWorkerStorage {
          constructor(port) {
            this.port = port;
            this.pendingRequests = new Map();
            this.port.onmessage = (e) => this.onMessage(e);
          }
          onMessage(e) {
            const { requestId, type, key, value, success } = e.data;
            this.pendingRequests.get(requestId)?.({ type, key, value, success });
            this.pendingRequests.delete(requestId);
          }
          generateId() {
            return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
          }
          setItem(key, value) {
            sessionStorage.setItem(`~tempStorage~${key}`, value);
            return new Promise((resolve) => {
              const requestId = this.generateId();
              this.pendingRequests.set(requestId, resolve);
              const tid = setTimeout(resolve,100);
              try {
                this.port.postMessage({ requestId, type: 'SET', key, value });
              } catch (e) {
                resolve(null);
                clearTimeout(tid);
                console.warn(e, ...arguments)
              }
            });
          }
          getItem(key) {
            return new Promise((resolve) => {
              const tid = setTimeout(resolve,100);
              const requestId = this.generateId();
              this.pendingRequests.set(requestId, (msg) => {
                let value = msg.value;
                if (value == null) {
                  value = sessionStorage.getItem(`~tempStorage~${key}`);
                }else{
                  sessionStorage.setItem(`~tempStorage~${key}`,value);
                }
                if (value != null) {
                  tempStorage.setItem(key, value);
                }
                resolve(value);
              });
              try {
                this.port.postMessage({ requestId, type: 'GET', key });
              } catch (e) {
                resolve(null);
                clearTimeout(tid);
                console.warn(e, ...arguments)
              }
            });
          }
          removeItem(key) {
            return new Promise((resolve) => {
              sessionStorage.removeItem(`~tempStorage~${key}`);
              const requestId = this.generateId();
              this.pendingRequests.set(requestId, (msg) => resolve(msg.value));
              const tid = setTimeout(resolve,100);
              try {
                this.port.postMessage({ requestId, type: 'DELETE', key });
              } catch (e) {
                resolve(null);
                clearTimeout(tid);
                console.warn(e, ...arguments)
              }
            });
          }
        }
        self.tempStorage = new SharedWorkerStorage(sharedWorker.port ?? sharedWorker);
      })();
    }
  })();
})();

