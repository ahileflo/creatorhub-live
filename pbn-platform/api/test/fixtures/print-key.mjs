import { LocalKeyProvider } from '../../src/crypto/keys.js';
const p = new LocalKeyProvider({ keyDir: process.argv[2] });
const { spkiDer } = await p.getUploadPublicKey();
process.stdout.write(spkiDer.toString('base64') + ':' + p.masterKey.toString('base64'));
