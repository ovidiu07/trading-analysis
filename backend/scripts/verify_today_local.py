import json,urllib.request,urllib.error,uuid,os
from pathlib import Path
# Synthetic accounts only; run against an isolated QA database, never production.
base=os.environ.get('TODAY_QA_API','http://localhost:8080/api')
from urllib.parse import urlparse
if urlparse(base).hostname not in ('localhost','127.0.0.1'):
 raise SystemExit('This verification script only runs against an isolated local QA API.')
checks=[]
def req(path,data=None,method=None,token=None):
 r=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if token else {})},method=method or ('POST' if data is not None else 'GET'))
 try:
  with urllib.request.urlopen(r) as x:return x.status,json.loads(x.read() or 'null')
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read() or 'null')
def check(name,condition):
 checks.append({'check':name,'passed':bool(condition)})
 if not condition: raise AssertionError(name)
a=req('/auth/login',{'email':'today-admin@example.test','password':'Today-QA-2026-only!'})[1]['token']
u=req('/auth/login',{'email':'today-user@example.test','password':'Today-QA-2026-only!'})[1]['token']
status,acct=req('/accounts',{'name':'Today QA EUR','currency':'EUR','broker':'Manual QA','brokerTimezone':'Europe/Bucharest','startingBalance':10000},token=a);check('Create isolated QA account',status==201)
id=acct['id'];Path('/tmp/today_qa_account').write_text(id)
root=f'/today/reviews/{id}/2026-09-06'
prep={'step':3,'briefingSession':'ASIA','manualSession':True,'bias':'neutral','chartPlan':'Watch only; no executed setup','chartSymbol':'XETR:DAX','chartInterval':'15','observing':True,'contextAcknowledged':True,'chartConfirmed':True,'preparationConfirmed':True,'checklist':[]}
data={'revision':0,'state':'PREPARE','instruments':'DAX','strategyId':None,'focus':'Private EU thesis','nextFocus':'','carryForward':None,'assessments':[],'preparation':prep}
status,europe=req(root+'?session=EUROPE',data,'PUT',a);check('Durable European preparation',status==200)
status,usa=req(root+'?session=US',{**data,'focus':'Independent US thesis'},'PUT',a);check('Two sessions have independent revision one',status==200 and usa['revision']==europe['revision']==1)
check('Foreign user cannot read preparation',req(root+'?session=EUROPE',token=u)[0] in [403,404])
check('Stale tab write rejected',req(root+'?session=EUROPE',data,'PUT',a)[0]==409)
status,brief=req('/today/briefing/2026-09-06?session=ASIA',{},token=a);check('Unavailable-provider briefing is persisted',status==200 and brief['instruments'][2]['reason']=='NO_ES_FUTURES_PROVIDER')
check('Briefing cache reuses exact version',req('/today/briefing/2026-09-06?session=ASIA',{},token=a)[1]['id']==brief['id'])
check('Foreign user cannot read briefing version',req('/today/briefing/version/'+brief['id'],token=u)[0] in [403,404])
prep['briefingId']=brief['id'];status,ready=req(root+'?session=EUROPE',{**data,'revision':1,'state':'TRADE'},'PUT',a);check('Ready captures briefing version',status==200 and ready['data']['readyContext']['briefing']['id']==brief['id'])
status,newbrief=req('/today/briefing/2026-09-06?session=ASIA&refresh=true',{},token=a);check('Refresh creates separate version',status==200 and newbrief['id']!=brief['id'])
check('Ready retains original briefing',req(root+'?session=EUROPE',token=a)[1]['data']['readyContext']['briefing']['id']==brief['id'])
status,note=req(f'/today/journals/{id}/2026-09-06?session=EUROPE',{},token=a);check('Canonical Notebook note creation',status==200)
status,note2=req(f'/today/journals/{id}/2026-09-06?session=EUROPE',{'body':'Observed only\nNo trade','updatedAt':note['updatedAt']},'PUT',a);check('Journal save',status==200)
check('Notebook reads same content', 'Observed only' in req('/notebook/notes/'+note['id'],token=a)[1]['body'])
check('Journal rejects stale timestamp',req(f'/today/journals/{id}/2026-09-06?session=EUROPE',{'body':'stale','updatedAt':note['updatedAt']},'PUT',a)[0]==409)
status,strategies=req('/strategies',token=u);check('Other user sees three published defaults',status==200 and len(strategies['mentorStrategies'])==3)
source=strategies['mentorStrategies'][0]['id'];status,personal=req('/strategies/mentor/'+source+'/adopt',{},token=u);check('Adopt canonical Mentor strategy',status==200)
check('Adoption retry uses same personal strategy',req('/strategies/mentor/'+source+'/adopt',{},token=u)[1]['id']==personal['id'])
check('Archive personal copy',req('/strategies/'+personal['id'],method='DELETE',token=u)[0] in [200,204])
check('Adoption does not resurrect archived copy',req('/strategies/mentor/'+source+'/adopt',{},token=u)[1]['archived'])
check('Explicit restoration',not req('/strategies/mentor/'+source+'/adopt?restore=true',{},token=u)[1]['archived'])
trade={'symbol':'QA','market':'OTHER','direction':'LONG','status':'OPEN','openedAt':'2026-09-06T10:00:00Z','quantity':1,'entryPrice':100,'accountRefId':id}
body={'requestId':str(uuid.uuid4()),'accountId':id,'date':'2026-09-06','session':'EUROPE','preparationRevision':2,'trade':trade}
status,logged=req('/today/log-trade',body,token=a);check('Log open trade without exit',status==200 and logged['status']=='OPEN' and logged.get('closedAt') is None)
check('Retry returns same trade',req('/today/log-trade',body,token=a)[1]['id']==logged['id'])
body['trade']['entryPrice']=101;check('Changed retry payload rejected',req('/today/log-trade',body,token=a)[0]==409)
status,review=req(root+'?session=EUROPE',{**data,'revision':2,'state':'REVIEW'},'PUT',a);check('Review retains Ready snapshot',status==200 and review['data']['readyContext']['briefing']['id']==brief['id'])
Path('outputs/today-prepare-verification/api-checks.json').write_text(json.dumps(checks,indent=2))
print(json.dumps({'passed':len(checks),'checks':checks},indent=2))
