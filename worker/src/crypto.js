/* Outils cryptographiques : signature personal_sign (EIP-191), adresses, encodage ABI minimal. */
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from '@noble/hashes/utils';

export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function isAddress(a) { return typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a); }
export function lower(a) { return String(a).toLowerCase(); }

export function hashPersonalMessage(message) {
  const m = utf8ToBytes(message);
  return keccak_256(concatBytes(utf8ToBytes('\x19Ethereum Signed Message:\n' + m.length), m));
}

/** Retrouve l'adresse qui a signé (ECDSA). Renvoie null si la signature est invalide. */
export function recoverAddress(message, signature) {
  try {
    const sig = String(signature).replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{130}$/.test(sig)) return null;
    let v = parseInt(sig.slice(128, 130), 16);
    if (v >= 27) v -= 27;
    if (v !== 0 && v !== 1) return null;
    const s = secp256k1.Signature.fromCompact(sig.slice(0, 128)).addRecoveryBit(v);
    if (s.hasHighS()) return null; // signatures malléables refusées
    const pub = s.recoverPublicKey(hashPersonalMessage(message)).toRawBytes(false);
    return '0x' + bytesToHex(keccak_256(pub.slice(1)).slice(-20));
  } catch (e) { return null; }
}

export function pad32(hexNoPrefix) { return hexNoPrefix.replace(/^0x/, '').toLowerCase().padStart(64, '0'); }
export function addrTopic(a) { return '0x' + pad32(a); }
export function uintTopic(n) { return '0x' + pad32(BigInt(n).toString(16)); }

/** safeTransferFrom(address,address,uint256) — sélecteur 0x42842e0e */
export function encodeSafeTransferFrom(from, to, tokenId) {
  return '0x42842e0e' + pad32(from) + pad32(to) + pad32(BigInt(tokenId).toString(16));
}
/** ownerOf(uint256) — sélecteur 0x6352211e */
export function encodeOwnerOf(tokenId) { return '0x6352211e' + pad32(BigInt(tokenId).toString(16)); }

/** isValidSignature(bytes32,bytes) — ERC-1271, sélecteur 0x1626ba7e. null si la signature n'est pas un hex pair borné. */
export function encodeIsValidSignature(hashBytes, signature) {
  const sig = String(signature).replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(sig) || sig.length % 2 !== 0 || sig.length < 2 || sig.length > 8000) return null;
  const len = sig.length / 2;
  const padded = sig.padEnd(Math.ceil(sig.length / 64) * 64, '0');
  return '0x1626ba7e' + bytesToHex(hashBytes) + pad32('40') + pad32(len.toString(16)) + padded;
}

/**
 * Valeur magique ERC-1271, encodage ABI d'un bytes4 (mot de 32 octets, bourré à droite) ou sélecteur nu.
 * Tout autre remplissage (y compris 0xffffffff) est un échec : on refuse.
 */
export function is1271Magic(res) {
  const h = String(res || '').toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(h)) return false;
  const body = h.slice(2);
  if (body.length !== 8 && body.length !== 64) return false;
  if (body.slice(0, 8) !== '1626ba7e') return false;
  return body.length === 8 || /^0{56}$/.test(body.slice(8));
}

export function randomHex(bytes) {
  const b = new Uint8Array(bytes); crypto.getRandomValues(b); return bytesToHex(b);
}
export async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', utf8ToBytes(s));
  return bytesToHex(new Uint8Array(d));
}
export { hexToBytes, bytesToHex };
