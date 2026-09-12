import json
import sqlite3
import unittest
from worker import assess, store

class NewsTests(unittest.TestCase):
    def test_fda_positive(self):
        self.assertEqual(assess('FDA approves new treatment')['prediction'],'Bullish hypothesis')
    def test_uncertain(self):
        self.assertEqual(assess('Company expects FDA approval')['prediction'],'Uncertain')
    def test_negative(self):
        self.assertEqual(assess('FDA says drug not approved')['prediction'],'Bearish hypothesis')
    def test_approval_not_granted_is_not_bullish(self):
        self.assertEqual(assess('FDA approval not granted')['prediction'],'Bearish hypothesis')
    def test_mixed_approval_and_offering_keeps_financing_risk(self):
        self.assertEqual(assess('FDA approves treatment; company announces offering')['prediction'],'Mixed / financing risk')
    def test_merger(self):
        self.assertEqual(assess('Merger announced')['prediction'],'Mixed / role dependent')
    def test_immutable(self):
        db=sqlite3.connect(':memory:')
        db.execute('CREATE TABLE news (id TEXT PRIMARY KEY, received TEXT, payload TEXT)')
        e={'T':'n','id':1,'headline':'FDA approves treatment','symbols':['AAPL','<script>']}
        store(db,e);e['headline']='FDA rejected treatment';store(db,e)
        record=json.loads(db.execute('SELECT payload FROM news').fetchone()[0])
        self.assertEqual(record['prediction'],'Bullish hypothesis')
        self.assertEqual(record['tickers'],['AAPL'])
        self.assertEqual(db.execute('SELECT COUNT(*) FROM news').fetchone()[0],1)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM news_versions').fetchone()[0],2)

if __name__=='__main__':unittest.main()
