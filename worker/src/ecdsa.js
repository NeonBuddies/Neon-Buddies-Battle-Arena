/* Récupération ECDSA secp256k1. Module séparé : import() uniquement pour /api/auth/verify.
   La vérification reste complète (low-s, bit de recovery, hash EIP-191). */
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import { hashPersonalMessage } from './crypto.js';

export function recoverAddress(message, signature) {
  try {
    const sig = String(signature).replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{130}$/.test(sig)) return null;
    let v = parseInt(sig.slice(128, 130), 16);
    if (v >= 27) v -= 27;
    if (v !== 0 && v !== 1) return null;
    const s = secp256k1.Signature.fromCompact(sig.slice(0, 128)).addRecoveryBit(v);
    if (s.hasHighS()) return null;
    const pub = s.recoverPublicKey(hashPersonalMessage(message)).toRawBytes(false);
    return '0x' + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
  } catch (e) { return null; }
}
