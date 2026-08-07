// Polyfill IndexedDB for tests so idb-keyval works under Node.
import 'fake-indexeddb/auto';

// Node 18 has no global Web Crypto (stable global from Node 19); the VPS runs 18.
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto as unknown as Crypto;
