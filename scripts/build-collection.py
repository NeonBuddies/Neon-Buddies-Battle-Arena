#!/usr/bin/env python3
"""Reconstruit assets/nft/*.jpg et js/collection.js à partir des métadonnées ON-CHAIN de Neon Buddies 2.
Source : tokenURI(id) du contrat 0x3aFaFa532c6Ea72ad5533A5aeEb409276ACC0aFc (Robinhood Chain)
  = ipfs://bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e/{id}.json
Usage : python3 scripts/build-collection.py <dossier contenant json/{id}.json et img/{id}.jpg>
Rareté de jeu : sur la blockchain, chaque valeur de trait apparaît exactement 10 fois sur 100 (rareté statistique égale).
L'arène attribue donc une rareté DE JEU déterministe (5 Légendaire, 10 Épique, 25 Rare, 60 Commun) en classant les
tokens selon une empreinte SHA-256 de leurs traits on-chain. Ce n'est pas une rareté on-chain."""
import hashlib, json, sys, os
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else '/workspace/nb2-onchain'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META_CID = 'bafybeidm3cdfsawaecj5ne3euuyji3oxhw4hgymibsl4opfvyi4apraz5e'
TRAITS = ['famille', 'palette', 'tenue', 'yeux', 'couvre-chef', 'accessoire']
rows = []
for i in range(1, 101):
    d = json.load(open(f'{src}/json/{i}.json'))
    attrs = {a['trait_type']: a['value'] for a in d['attributes']}
    traits = {k: attrs[k] for k in TRAITS}
    key = hashlib.sha256(('NB2|' + '|'.join(traits[k] for k in TRAITS) + f'|{i}').encode()).hexdigest()
    rows.append({'id': f'{i:04d}', 'tokenId': i, 'name': d['name'], 'traits': traits, 'image_ipfs': d['image'],
                 'metadata': f'ipfs://{META_CID}/{i}.json', '_k': key})
order = sorted(rows, key=lambda r: r['_k'])
for rank, r in enumerate(order, 1):
    r['rank'] = rank
    r['rarity'] = 'Légendaire' if rank <= 5 else 'Épique' if rank <= 15 else 'Rare' if rank <= 40 else 'Commun'
os.makedirs(f'{root}/assets/nft', exist_ok=True)
for r in rows:
    im = Image.open(f"{src}/img/{r['tokenId']}.jpg").convert('RGB'); im.thumbnail((512, 512))
    im.save(f"{root}/assets/nft/{r['id']}.jpg", quality=80, optimize=True, progressive=True)
    del r['_k']
out = '/* Neon Buddies 2 — généré par scripts/build-collection.py depuis les métadonnées on-chain (tokenURI). */\n'
out += 'var NB_COLLECTION = ' + json.dumps(rows, ensure_ascii=False, indent=0) + ';\n'
out += 'if (typeof module !== "undefined" && module.exports) module.exports = NB_COLLECTION; else window.NB_COLLECTION = NB_COLLECTION;\n'
open(f'{root}/js/collection.js', 'w').write(out)
from collections import Counter
print('ok', Counter(r['rarity'] for r in rows), [r['id'] for r in rows if r['rarity'] == 'Légendaire'])
