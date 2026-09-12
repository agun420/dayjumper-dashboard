"""News-only stream. No orders. Immutable first-seen rule-based assessments."""
import asyncio
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
    uncertain = bool(re.search(r'\b(may|could|rumou?r|seeks|expects|potential|awaits)\b', h))
    negative = bool(re.search(r'\b(rejects?|rejected|denied|fails?|failed|not approved|complete response letter|terminated)\b', h))
    if 'fda' in h:
        event = 'FDA / regulatory'
        bias = 'Bearish hypothesis' if negative else 'Bullish hypothesis' if re.search(r'\b(approves?|approved|approval)\b', h) and not uncertain else 'Uncertain'
    elif re.search(r'\b(merger|acquisition|acquire|buyout|takeover)\b', h):
        event, bias = 'M&A', 'Mixed / role dependent'
    elif re.search(r'\b(offering|dilution|stock sale)\b', h):
        event, bias = 'Financing', 'Bearish hypothesis'
    elif re.search(r'\b(earnings|guidance|revenue)\b', h):
        event, bias = 'Earnings / guidance', 'Uncertain'
    else:
        event, bias = 'Other news', 'Uncertain'
    if uncertain:
        bias = 'Uncertain'
    return {'event':event, 'sentiment':bias, 'prediction':bias,
            'method':'headline_rules_v1', 'confidence':'Uncalibrated',
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
    # Never revise an earlier prediction using a later edited headline.
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
