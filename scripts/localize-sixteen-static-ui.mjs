// Static UI-only codemod; never rewrites route IDs, enums, API keys or user-authored data.
import fs from 'node:fs';import ts from 'typescript';import {pathToFileURL} from 'node:url';
const root=JSON.parse(fs.readFileSync('docs/reports/16-requirements-evidence/base.json')).artifact;
const catalogFile=root+'/src/systemTranslations.ts';let catalog=fs.readFileSync(catalogFile,'utf8');for(const name of ['Admin','Portal','Property','Template'])if(!catalog.includes('import generated'+name))catalog='import generated'+name+' from "./generated'+name+'English.json"\n'+catalog;catalog=catalog.replace(' ...dashboardTranslations,',' ...dashboardTranslations,\n ...generatedAdmin,...generatedPortal,...generatedProperty,...generatedTemplate,');fs.writeFileSync(catalogFile,catalog);
const dict=(await import(pathToFileURL(catalogFile))).englishSystemText,report=[],missing=new Set(),hasThai=s=>/[ก-๙]/.test(s),translated=s=>typeof dict[s]==='string';
const uiAttrs=new Set(['aria-label','title','placeholder','alt','aria-description']);
function alreadyTranslated(node){for(let parent=node.parent;parent;parent=parent.parent){if(ts.isCallExpression(parent)){const name=parent.expression.getText();if(/^(t|tr|label|copy|useCopy)$/.test(name)||name.endsWith('.t'))return true}if(ts.isJsxElement(parent)||ts.isSourceFile(parent))break}return false}
function renderContext(node){for(let parent=node.parent;parent;parent=parent.parent){if(ts.isJsxAttribute(parent))return uiAttrs.has(parent.name.getText());if(ts.isArrowFunction(parent)||ts.isFunctionExpression(parent)||ts.isFunctionDeclaration(parent))return false;if(ts.isJsxExpression(parent))return true}return false}
function feedbackContext(node){for(let parent=node.parent;parent;parent=parent.parent){if(ts.isCallExpression(parent)&&/^(setError|setMessage|setSuccess|setNotice|alert|confirm|window\.alert|window\.confirm)$/.test(parent.expression.getText()))return true;if(ts.isNewExpression(parent)&&parent.expression.getText()==='Error')return true;if(ts.isStatement(parent)||ts.isJsxAttribute(parent))break}return false}
for(const name of fs.readdirSync(root+'/src').filter(f=>/\.(ts|tsx)$/.test(f)&&!/Translations|locale\.ts/.test(f))){const file=root+'/src/'+name,source=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),edits=[],seen=new Set();let needsT=false,needsTag=false;
 const edit=(start,end,text)=>{if(seen.has(start))return;seen.add(start);edits.push({start,end,text})};
 function call(value){if(!translated(value)){missing.add(value);return null}needsT=true;return 't('+JSON.stringify(value)+')'}
 function visit(node){
  if(ts.isJsxText(node)&&hasThai(node.text)&&node.text.trim()){const key=node.text.trim().replace(/\s+/g,' '),value=call(key);if(value){const lead=/^[ \t]/.test(node.text)&&!/^\s*\n/.test(node.text)?' ':'';const tail=/[ \t]$/.test(node.text)&&!/\n\s*$/.test(node.text)?' ':'';edit(node.getStart(sf),node.end,(lead?'{" "}':'')+'{'+value+'}'+(tail?'{" "}':''))}return}
  if(ts.isTemplateExpression(node)&&!alreadyTranslated(node)&&(renderContext(node)||feedbackContext(node))){let key=node.head.text;node.templateSpans.forEach((span,i)=>{key+='{v'+i+'}'+span.literal.text});if(hasThai(key)){if(translated(key)){needsT=true;edit(node.getStart(sf),node.end,'t('+JSON.stringify(key)+', {'+node.templateSpans.map((span,i)=>'v'+i+': '+span.expression.getText(sf)).join(', ')+'})');return}else missing.add(key)}}
  if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&hasThai(node.text)&&!alreadyTranslated(node)){
   const parent=node.parent,attribute=ts.isJsxAttribute(parent)&&uiAttrs.has(parent.name.getText()),directRender=renderContext(node),feedback=feedbackContext(node);
   // Conditions and object/array data are not UI output. Translate only render branches/concatenation leaves.
   const structural=ts.isBinaryExpression(parent)&&!['+','??','||'].includes(parent.operatorToken.getText())||ts.isPropertyAssignment(parent)||ts.isElementAccessExpression(parent)||ts.isArrayLiteralExpression(parent)||ts.isCaseClause(parent);
   if(attribute||(!structural&&(directRender||feedback))){const value=call(node.text);if(value)edit(node.getStart(sf),node.end,attribute?'{'+value+'}':value)}
  }
  if(ts.isStringLiteral(node)&&node.text==='th-TH'&&ts.isCallExpression(node.parent)){const callee=node.parent.expression.getText();if(/toLocale(DateString|TimeString|String)$/.test(callee)||/Intl\.(DateTimeFormat|NumberFormat)$/.test(callee)){needsTag=true;edit(node.getStart(sf),node.end,'localeTag()')}}
  ts.forEachChild(node,visit)
 }
 visit(sf);if(!edits.length)continue;let next=source;for(const change of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,change.start)+change.text+next.slice(change.end);
 const names=[];if(needsT&&!/import\s*\{[^}]*\bt\b[^}]*\}\s*from\s*['"]\.\/locale['"]/.test(next))names.push('t');if(needsTag&&!/import\s*\{[^}]*\blocaleTag\b[^}]*\}\s*from\s*['"]\.\/locale['"]/.test(next))names.push('localeTag');if(names.length)next='import {'+names.join(',')+'} from "./locale"\n'+next;fs.writeFileSync(file,next);report.push({file:name,replacements:edits.length});
}
fs.writeFileSync('docs/reports/16-requirements-evidence/locale-codemod.json',JSON.stringify({report,missing:[...missing],files:report.length,replacements:report.reduce((n,r)=>n+r.replacements,0)},null,2));console.log({files:report.length,replacements:report.reduce((n,r)=>n+r.replacements,0),missing:missing.size});
