"""News-only stream. No orders. Immutable first-seen rule-based assessments."""
import asyncio
import hashlib
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
import websockets

ROOT = Path(os.environ.get('NEWS_STATE_DIR', '/var/lib/dayjumper/news'))

def now():
    return datetime.now(timezone.utc).isoformat()

def assess(headline):
    h = headline.lower()
    uncertain = bool(re.search(r'\b(may|could|rumou?r|seeks|expects|potential|awaits|pending)\b', h))
    fda = 'fda' in h or bool(re.search(r'\b(regulatory|pdufa)\b', h))
    fda_negative = bool(re.search(r'\b(rejects?|rejected|denied|fails?|failed|not (?:yet )?(?:approved|granted)|complete response letter|withdrawn?|terminated)\b', h))
    fda_positive = bool(re.search(r'\b(approves?|approved|approval granted|clearance granted)\b', h))
    financing = bool(re.search(r'\b(offering|dilution|stock sale|at-the-market|registered direct)\b', h))
    financing_cancelled = bool(re.search(r'\b(cancels?|cancelled|withdraws?|withdrawn|terminates?|terminated)\b.{0,40}\b(offering|stock sale|at-the-market)\b', h))
    merger = bool(re.search(r'\b(merger|acquisition|acquire|buyout|takeover)\b', h))
    earnings = bool(re.search(r'\b(earnings|guidance|revenue)\b', h))
    events = []
    biases = []
    if fda:
        events.append('FDA / regulatory')
        biases.append('Bearish hypothesis' if fda_negative else 'Bullish hypothesis' if fda_positive and not uncertain else 'Uncertain')
    if financing:
        events.append('Financing')
        biases.append('Uncertain' if financing_cancelled else 'Bearish hypothesis')
    if merger:
        events.append('M&A')
        biases.append('Mixed / role dependent')
    if earnings:
        events.append('Earnings / guidance')
        biases.append('Uncertain')
    event = ' + '.join(events) if events else 'Other news'
    directional = {bias for bias in biases if bias in {'Bullish hypothesis', 'Bearish hypothesis'}}
    if len(directional) > 1 or (financing and fda_positive and not financing_cancelled):
        bias = 'Mixed / financing risk'
    elif biases:
        bias = biases[0] if len(set(biases)) == 1 else 'Uncertain'
    else:
        bias = 'Uncertain'
    return {'event':event, 'sentiment':bias, 'prediction':bias,
            'method':'headline_rules_v2', 'confidence':'Uncalibrated',
            'horizon':'Next regular trading session',
            'reason':'Headline-only assessment. Confirm event details, ticker role, timing and price reaction.',
            'outcome':'Not evaluated'}

def store(db, event):
    if event.get('T') != 'n' or not event.get('id'):
        return
    headline = str(event.get('headline', ''))[:1000]
    symbols = [s for s in event.get('symbols', []) if isinstance(s,str) and re.fullmatch(r'[A-Z][A-Z0-9.\-]{0,14}', s)]
    record = {'id':str(event['id']), 'headline':headline, 'tickers':symbols,
              'source':str(event.get('source','Alpaca news'))[:100],
              'url':str(event.get('url','')), 'publishedAt':event.get('created_at'),
              'receivedAt':now(), **assess(headline)}
    db.execute('CREATE TABLE IF NOT EXISTS news_versions (id TEXT, version_hash TEXT, received TEXT, payload TEXT, PRIMARY KEY (id, version_hash))')
    version_hash = hashlib.sha256(json.dumps(event, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()
    db.execute('INSERT OR IGNORE INTO news_versions VALUES (?, ?, ?, ?)', (record['id'],version_hash,record['receivedAt'],json.dumps(record)))
    # Preserve the first-seen assessment while retaining edited versions for audit.
    db.execute('INSERT OR IGNORE INTO news VALUES (?, ?, ?)', (record['id'],record['receivedAt'],json.dumps(record)))
    db.commit()

def export(db, status):
    records = [json.loads(row[0]) for row in db.execute('SELECT payload FROM news ORDER BY received DESC LIMIT 100')]
    payload = {'status':status,'updatedAt':now(),'mode':'Streaming intake / periodic publication',
               'items':records,'disclaimer':'Unvalidated headline rules; not trade signals or measured social sentiment.'}
    tmp = ROOT/'public-news.tmp'
    tmp.write_text(json.dumps(payload))
    tmp.chmod(0o640)
    tmp.replace(ROOT/'public-news.json')

async def run():
    ROOT.mkdir(parents=True,exist_ok=True)
    db = sqlite3.connect(ROOT/'news.sqlite3')
    db.execute('CREATE TABLE IF NOT EXISTS news (id TEXT PRIMARY KEY, received TEXT, payload TEXT)')
    db.execute('CREATE TABLE IF NOT EXISTS news_versions (id TEXT, version_hash TEXT, received TEXT, payload TEXT, PRIMARY KEY (id, version_hash))')
    while True:
        try:
            export(db,'CONNECTING')
            async with websockets.connect('wss://stream.data.alpaca.markets/v1beta1/news',open_timeout=15,max_queue=32,max_size=2**20) as ws:
                await ws.send(json.dumps({'action':'auth','key':os.environ['APCA_API_KEY_ID'],'secret':os.environ['APCA_API_SECRET_KEY']}))
                authenticated = False
                async with asyncio.timeout(20):
                    while not authenticated:
                        for item in json.loads(await ws.recv()):
                            if item.get('T') == 'error': raise RuntimeError('Authentication rejected')
                            if item.get('msg') == 'authenticated': authenticated = True
                await ws.send(json.dumps({'action':'subscribe','news':['*']}))
                async with asyncio.timeout(20):
                    while True:
                        batch = json.loads(await ws.recv())
                        if any(i.get('T') == 'error' for i in batch): raise RuntimeError('Subscription rejected')
                        for event in batch:
                            store(db,event)
                        if any(i.get('T') == 'subscription' and '*' in i.get('news',[]) for i in batch): break
                export(db,'CONNECTED')
                while True:
                    try:
                        batch = json.loads(await asyncio.wait_for(ws.recv(),60))
                    except asyncio.TimeoutError:
                        export(db,'CONNECTED')
                        continue
                    for event in batch:
                        if event.get('T') == 'error': raise RuntimeError('Stream error')
                        store(db,event)
                    export(db,'CONNECTED')
        except Exception as error:
            export(db,'DISCONNECTED')
            print('NEWS_STREAM_ERROR:',type(error).__name__,flush=True)
            await asyncio.sleep(30)

if __name__ == '__main__':
    asyncio.run(run())
