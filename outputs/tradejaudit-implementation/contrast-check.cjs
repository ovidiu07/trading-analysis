const fs = require('fs')
const luminance = hex => { const v = hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4); return .2126*v[0]+.7152*v[1]+.0722*v[2] }
const pairs = [
 ['Primary text/card','#F3F7FC','#121B28',4.5],['Secondary text/card','#AFBDD0','#121B28',4.5],['Muted text/elevated','#8293AA','#1A2738',4.5],
 ['Primary button/start','#08121F','#A4D5FF',4.5],['Primary button/end','#08121F','#7AB9F3',4.5],['Profit/background','#54D6A0','#102A23',4.5],['Loss/background','#FF7C89','#321D27',4.5],['Attention/background','#F3C675','#302719',4.5],['Control outline/elevated','#627A96','#1A2738',3],['Focus/hover','#B4E5FF','#223249',3],['Text/card gradient start','#AFBDD0','#172334',4.5]
].map(([pair,fg,bg,min]) => {const a=luminance(fg),b=luminance(bg);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return {pair,foreground:fg,background:bg,ratio:+ratio.toFixed(2),minimum:min,pass:ratio>=min}})
fs.writeFileSync(__dirname+'/contrast-results.json',JSON.stringify(pairs,null,2));console.log(pairs);if(pairs.some(x=>!x.pass))process.exitCode=1
