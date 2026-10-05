// Local browser QA. Requires Playwright and a running local frontend. All application API responses below are synthetic.
const {chromium} = require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true, ...(process.env.TJA_BROWSER_EXECUTABLE ? {executablePath:process.env.TJA_BROWSER_EXECUTABLE} : {})});
const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
const output=process.env.TJA_SCREENSHOT_DIR || __dirname;
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{if(location.hostname !== '127.0.0.1') return;localStorage.setItem('token','synthetic-layout-test');localStorage.setItem('app.language','en');});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let review={revision:1,data:{state:'PREPARE',instruments:'GER40',strategyId:'strategy-1',focus:'Wait for the liquidity sweep and retest.',nextFocus:'',carryForward:null,assessments:[],preparation:{step:0,briefingSession:'ASIA',manualSession:false,bias:'bullish',chartPlan:'A close below the swept low invalidates this idea.',chartSymbol:'OANDA:DE30EUR',chartInterval:'15',observing:false,contextAcknowledged:false,chartConfirmed:false,preparationConfirmed:false,checklist:[true,true,false],emotion:'focused',discipline:{chasing:false,revenge:false,social:false},riskDrafts:{'CFD:DAX':{version:1,draftId:'qa-risk',entryPrice:'',stopLossPrice:'',takeProfitPrice:'',intendedRiskAmount:'200',manualQuantity:'',invalidation:''}}}}};
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.pathname.startsWith('/api/') && !url.hostname.includes('tradingview')){
 let data={};const path=url.pathname;
 if(path.endsWith('/users/me')) data={id:'qa-user',email:'qa@example.test',timezone:'Europe/Bucharest',baseCurrency:'EUR',themePreference:'DARK',role:'USER'};
 else if(path.endsWith('/accounts'))data=[{id:'qa-account',name:'Personal',currency:'EUR',brokerTimezone:'Europe/Bucharest',status:'ACTIVE',isDefault:true}];
 else if(path.includes('/today/reviews/')) {if(route.request().method()==='PUT'){review={revision:review.revision+1,data:JSON.parse(route.request().postData())};}data=review;}
 else if(path.includes('/strategies'))data={myStrategies:[{id:'strategy-1',name:'Liquidity setup',source:'MY',entryConditions:['Liquidity sweep','Structure shift','Retest confirmed'],invalidationLogic:'Below the low',noTradeRules:'No chasing',sessionSuitability:[],tags:[]}],mentorStrategies:[]};
 else if(path.includes('/growth-coach'))data={detail:{account:{currency:'EUR'},operatingSystem:{tradingPermission:{maximumPermittedRisk:250,maximumPermittedRiskPct:.93,remainingTrades:3,primaryReason:'growthCoach.permission.withinLimits'}}}};
 else if(path.includes('/market-context'))data={instrument:url.searchParams.get('instrument'),date:url.searchParams.get('date'),timezone:'Europe/Bucharest',window:'SESSION',news:[],events:[],observations:[],coverage:[]};
 else if(path.includes('/market-workspace'))data={selectedInstrument:url.searchParams.get('instrument')||'GER40',quotes:[],macroObservations:[],retrievedAt:new Date().toISOString()};
 else if(path.includes('/trades'))data={content:[],totalPages:0};
 else if(path.includes('/analytics'))data={advice:[]};
 else if(path.includes('/notebook')||path.includes('/notifications'))data=[];
 else if(path.includes('/session-briefings')||path.includes('/today/briefing'))data={id:'qa-briefing',kind:'EDITORIAL',selected:null,composition:[]};
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 }
 if(url.hostname.endsWith('tradingview.com')) return route.continue();
 if(url.hostname==='127.0.0.1'||url.hostname==='localhost'||url.protocol==='data:') return route.continue();
 // Public provider embeds render normally; application account/plan data is synthetic.
 return route.continue();
});
await page.goto(`${process.env.TJA_BASE_URL || 'http://127.0.0.1:5178'}/today?accountIds=qa-account`);
await page.getByTestId('chart-plan-workspace').waitFor();
await page.waitForTimeout(12000);
await page.screenshot({path:output+'/desktop.png',fullPage:true});
console.log(JSON.stringify({errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),text:(await page.locator('body').innerText()).slice(0,3000)}));
await page.getByText('Psychology · Focused', {exact:true}).click();
await page.getByRole('button',{name:'Calm',exact:true}).click();
await page.getByLabel('Psychology notes',{exact:true}).fill('Paused, reviewed the plan, and waited for confirmation.');
await page.getByLabel('Chasing price',{exact:true}).check();
await page.getByText('Session notes',{exact:true}).first().click();
await page.getByLabel('Session notes',{exact:true}).fill('Latest note saved during browser QA.');
await page.getByLabel('Entry price',{exact:true}).fill('24000');
await page.getByLabel('Stop loss',{exact:true}).fill('23990');
await page.getByLabel('Take profit',{exact:true}).fill('24020');
await page.getByLabel('Quantity',{exact:true}).fill('2');
await page.getByLabel('Invalidation',{exact:true}).fill('Close below swept low');
await page.waitForFunction(()=>document.body.innerText.includes('Saved'));
await page.waitForTimeout(1800);
assert.equal(review.data.preparation.emotion,'calm');
assert.equal(review.data.preparation.discipline.chasing,true);
assert.equal(review.data.preparation.psychologyNotes,'Paused, reviewed the plan, and waited for confirmation.');
assert.equal(review.data.preparation.riskDrafts['CFD:DAX'].entryPrice,'24000');
await page.reload();
await page.getByTestId('chart-plan-workspace').waitFor();
assert.equal(await page.getByLabel('Entry price',{exact:true}).inputValue(),'24000');
await page.getByText('Psychology · Calm',{exact:true}).click();
assert.equal(await page.getByLabel('Psychology notes',{exact:true}).inputValue(),'Paused, reviewed the plan, and waited for confirmation.');
assert(await page.getByLabel('Chasing price',{exact:true}).isChecked());
await page.waitForTimeout(12000);
await page.screenshot({path:output+'/psychology.png',fullPage:true});
await page.getByRole('button',{name:'Calendar',exact:true}).click();
await page.getByRole('button',{name:'Close',exact:true}).waitFor();
await page.waitForTimeout(8000);
await page.screenshot({path:output+'/calendar.png',fullPage:true});
await page.keyboard.press('Escape');
await page.getByRole('button',{name:'Close',exact:true}).waitFor({state:'hidden'});
await page.getByText('Psychology · Calm',{exact:true}).click();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false); assert.deepEqual(errors,[]); console.log('PASS: desktop/mobile no overflow; psychology, risk and notes save/reload; calendar opens and Escape closes; no page errors.');
await browser.close();
})();
