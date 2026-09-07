"""Behavior tests against synthetic users in an isolated local PostgreSQL-backed API."""
import json, urllib.request, urllib.error, uuid, os, copy
from datetime import date as Date, timedelta
from pathlib import Path
from urllib.parse import urlparse
base=os.environ.get('EDITORIAL_QA_API','http://localhost:8081/api')
assert urlparse(base).hostname in ('localhost','127.0.0.1')
checks=[]
def req(path,data=None,method=None,token=None):
 r=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})},method=method or ('POST' if data is not None else 'GET'))
 try:
  with urllib.request.urlopen(r) as x:return x.status,json.loads(x.read() or 'null')
 except urllib.error.HTTPError as e:
  raw=e.read()
  try: body=json.loads(raw or 'null')
  except: body=raw.decode()
  return e.code,body

def check(name,condition):
 checks.append({'check':name,'passed':bool(condition)})
 Path('outputs/editorial-briefings/api-checks.json').write_text(json.dumps(checks,indent=2))
 if not condition:raise AssertionError(name)

def good(path,data=None,method=None,token=None):
 status,body=req(path,data,method,token)
 if status not in (200,201,204):raise AssertionError((path,status,body))
 return body

a=good('/auth/login',{'email':'today-admin@example.test','password':'Today-QA-2026-only!'})['token']
u=good('/auth/login',{'email':'today-user@example.test','password':'Today-QA-2026-only!'})['token']

def doc(date,slot,ref='2026-08-31T06:00:00Z'):
 return {'schemaVersion':1,'editorialDate':date,'slot':slot,'editorialTimezone':'Europe/Bucharest','coverageStart':'2026-08-31T00:00:00Z','coverageEnd':ref,'referenceTime':ref,'coverage':'COMPLETE','author':'Synthetic QA editor','contentLanguage':'en','translations':{'en':{'title':f'QA {date} {slot}','summary':['Synthetic context for application verification.','No market claims or executable advice.','Manually prepare and verify your own analysis.'],'facts':[{'id':'fact-asia','time':'2026-08-31T05:00:00Z','topic':'QA','statement':'Original synthetic fact &amp; literal entity','source':'Synthetic fixture','availableAt':'2026-08-31T05:00:00Z'}],'news':[],'events':[],'macro':[],'scenarios':[],'sourcesAndLimitations':'Synthetic QA fixture. No external data.'}}}
root='/admin/session-briefings'
# Fresh test date per run avoids modifying existing fixture publications.
date=os.environ.get('EDITORIAL_QA_DATE','2026-08-31')
D={}
for slot in ['ASIA','LONDON','DAY_RECAP']:
 d=doc(date,slot);D[slot]=good(root,{'version':0,'document':d},token=a)
 check('Admin creates draft '+slot,D[slot]['version']==1)
check('Duplicate date/session identity rejected',req(root,{'version':0,'document':doc(date,'ASIA')},token=a)[0]==409)
check('Three draft slots visible to admin',len(good(root+'?date='+date,token=a))==3)
check('Drafts invisible in user discovery',good('/session-briefings?date='+date+'&slot=DAY_RECAP',token=u).get('selected') is None)
id=D['ASIA']['id'];path=root+'/'+id
for suffix,method,data in [('',None,None),('/history',None,None),('/publish',None,{'version':1,'requestId':str(uuid.uuid4())}),('', 'PUT',{'version':1,'document':doc(date,'ASIA')}),('/withdraw',None,{'version':1})]:
 check('Normal user denied '+method.__str__()+suffix,req(path+suffix,data,method,u)[0]==403)
check('Anonymous reads denied',req('/session-briefings?date='+date)[0] in (401,403))
check('Normal user preview denied',req(root+'/preview',doc(date,'ASIA'),token=u)[0]==403)
offsetdoc=doc(date,'ASIA');offsetdoc['referenceTime']='2026-08-31T09:00:00+03:00'
check('Offset-bearing reference accepted as an instant',req(root+'/preview',offsetdoc,token=a)[0]==200)
check('Valid import preview',req(root+'/preview',doc(date,'ASIA'),token=a)[0]==200)
for name,alter in [
 ('privileged field',lambda d:d.update(role='ADMIN')),
 ('future reference',lambda d:d.update(referenceTime='2099-01-01T00:00:00Z')),
 ('unsafe URL',lambda d:d['translations']['en']['facts'][0].update(sourceUrl='javascript:alert(1)')),
 ('missing availability',lambda d:d['translations']['en']['facts'][0].pop('availableAt')),
 ('duplicate fact',lambda d:d['translations']['en']['facts'].append(copy.deepcopy(d['translations']['en']['facts'][0]))),
 ('missing original translation',lambda d:d.update(contentLanguage='ro')),
 ('invented widget metrics',lambda d:d.update(athDistance=5)),
 ('future fact',lambda d:d['translations']['en']['facts'][0].update(time='2099-01-01T00:00:00Z'))]:
 d=doc(date,'ASIA');alter(d);check('Reject '+name,req(root+'/preview',d,token=a)[0]==400)
request={'version':1,'requestId':str(uuid.uuid4())}
first=good(path+'/publish',request,token=a)
check('Idempotent publication retry',good(path+'/publish',request,token=a)['id']==first['id'])
check('Double-click with second key does not duplicate',good(path+'/publish',{'version':1,'requestId':str(uuid.uuid4())},token=a)['id']==first['id'])
check('Another signed-in user reads publication',good('/session-briefings?date='+date+'&slot=ASIA',token=u)['selected']['id']==first['id'])
check('Missing London retains actual Asia identity',good('/session-briefings?date='+date+'&slot=LONDON',token=u)['selected']['document']['slot']=='ASIA')
cap=good('/session-briefings/capture/'+date,{'editorialDate':date,'slot':'ASIA'},token=u)
check('Asia-only composition',len(cap['composition'])==1)
check('Capture is private',req('/today/briefing/version/'+cap['id'],token=a)[0]==404)
acct=good('/accounts',{'name':'Editorial QA','currency':'EUR','broker':'Manual QA','brokerTimezone':'Europe/Bucharest','startingBalance':10000},token=u)
prep={'step':3,'briefingSession':'ASIA','briefingDate':date,'manualSession':True,'bias':'neutral','chartPlan':'Observe only','chartSymbol':'TVC:DXY','chartInterval':'15','observing':True,'contextAcknowledged':True,'chartConfirmed':True,'preparationConfirmed':True,'checklist':[],'briefingId':cap['id']}
review={'revision':0,'state':'TRADE','instruments':'QA','strategyId':None,'focus':'Personal thesis','nextFocus':'','carryForward':None,'assessments':[],'preparation':prep}
reviewpath=f"/today/reviews/{acct['id']}/{date}"
ready=good(reviewpath,review,'PUT',u)
check('Ready freezes exact publication composition',ready['data']['readyContext']['briefing']['composition']==cap['composition'])
d=doc(date,'ASIA');d['translations']['en']['facts'].append({'id':'correction-1','topic':'QA','statement':'Explicit correction','source':'QA','availableAt':'2026-08-31T05:30:00Z','relatedFactId':'fact-asia','relationship':'CORRECTION'})
updated=good(path,{'version':1,'document':d},'PUT',a)
check('Stale draft rejected',req(path,{'version':1,'document':d},'PUT',a)[0]==409)
check('Stale publish rejected',req(path+'/publish',{'version':1,'requestId':str(uuid.uuid4())},token=a)[0]==409)
second=good(path+'/publish',{'version':2,'requestId':str(uuid.uuid4())},token=a)
check('Update creates immutable revision two',second['revision']==2 and second['id']!=first['id'])
check('Correction preserved',second['document']['translations']['en']['facts'][1]['relationship']=='CORRECTION')
check('Ready unchanged after update',good(reviewpath,token=u)['data']['readyContext']==ready['data']['readyContext'])
check('Capture unchanged after update',good('/today/briefing/version/'+cap['id'],token=u)['composition']==cap['composition'])
for slot,ref in [('LONDON','2026-08-31T14:00:00Z'),('DAY_RECAP','2026-08-31T20:00:00Z')]:
 item=D[slot];d=doc(date,slot,ref);d['translations']['en']['facts']=[{'id':slot.lower()+'-development','topic':'QA','statement':'New development '+slot,'source':'QA','availableAt':ref,'relatedFactId':'fact-asia','relationship':'UPDATE'}]
 good(root+'/'+item['id'],{'version':1,'document':d},'PUT',a);good(root+'/'+item['id']+'/publish',{'version':2,'requestId':str(uuid.uuid4())},token=a)
 capture=good('/session-briefings/capture/'+date,{'editorialDate':date,'slot':slot},token=u)
 check(slot+' cumulative composition',len(capture['composition'])==(2 if slot=='LONDON' else 3))
check('Earlier Asia view excludes later knowledge',len(good('/session-briefings/capture/'+date,{'editorialDate':date,'slot':'ASIA'},token=u)['composition'])==1)
check('Weekend without Friday uses latest actual publication',good('/session-briefings?date='+str(Date.fromisoformat(date)+timedelta(days=6))+'&slot=ASIA',token=u)['selected']['document']['editorialDate']==date)
trade={'symbol':'QA','market':'OTHER','direction':'LONG','status':'OPEN','openedAt':date+'T10:00:00Z','quantity':1,'entryPrice':100,'accountRefId':acct['id']}
body={'requestId':str(uuid.uuid4()),'accountId':acct['id'],'date':date,'session':'DAY','preparationRevision':1,'trade':trade}
logged=good('/today/log-trade',body,token=u)
check('Open trade without exit logs',logged['status']=='OPEN' and logged.get('closedAt') is None)
check('Trade retry deduplicates',good('/today/log-trade',body,token=u)['id']==logged['id'])
check('Linked trade Review retains original context',good('/today/log-trade/context/'+logged['id'],token=u)['readyContext']==ready['data']['readyContext'])
good(path+'/withdraw',{'version':2,'requestId':str(uuid.uuid4())},token=a)
check('Withdrawal removes normal discovery',good('/session-briefings?date='+date+'&slot=ASIA',token=u).get('selected') is None)
check('Withdrawal notice for frozen preparation',first['id'] in good('/session-briefings/capture/'+cap['id']+'/withdrawals',token=u))
history=good(path+'/history',token=a)
check('History preserves both revisions and actions',len(history['revisions'])==2 and any(x['action']=='WITHDRAW' for x in history['actions']))
check('Foreign user cannot read linked context',req('/today/log-trade/context/'+logged['id'],token=a)[0] in (403,404))
# A late Asia revision with an older information reference cannot enter an earlier London view.
late=doc(date,'ASIA')
late['translations']['en']['facts'].append({'id':'late-development','topic':'QA','statement':'Late publication, earlier information reference','source':'QA','availableAt':'2026-08-31T05:45:00Z','relatedFactId':'fact-asia','relationship':'CONTINUATION'})
good(path,{'version':3,'document':late},'PUT',a)
latepub=good(path+'/publish',{'version':4,'requestId':str(uuid.uuid4())},token=a)
london=good('/session-briefings/capture/'+date,{'editorialDate':date,'slot':'LONDON'},token=u)
check('Late earlier-reference revision excluded from earlier London cutoff',latepub['id'] not in [x['id'] for x in london['composition']])
check('Original London-eligible Asia revision retained',second['id'] in [x['id'] for x in london['composition']])
check('Frozen capture contains no widget values',all(k not in cap for k in ['widgetValues','ath','dayRange','livePrices']))
check('Manual date/session persists',good(reviewpath,token=u)['data']['preparation']['briefingDate']==date and good(reviewpath,token=u)['data']['preparation']['manualSession'])
# Silent fact rewrites must use an explicit new ID and relationship.
rewrite=copy.deepcopy(late);rewrite['translations']['en']['facts'][0]['statement']='Silent rewrite'
good(path,{'version':4,'document':rewrite},'PUT',a)
check('Silent stable-ID fact rewrite rejected',req(path+'/publish',{'version':5,'requestId':str(uuid.uuid4())},token=a)[0]==400)
# Ordinary CMS publish cannot bypass the typed publication path.
check('Generic CMS publication path is guarded',req('/admin/content/'+id+'/publish',{},token=a)[0]==409)
Path('outputs/editorial-briefings/fixture-ids.json').write_text(json.dumps({'accountId':acct['id'],'date':date,'tradeId':logged['id'],'captureId':cap['id']},indent=2))
print(json.dumps({'passed':len(checks),'checks':checks},indent=2))
