import JSZip from 'jszip';
import { z } from 'zod';
import requestJsonSchema from '../schemas/request.schema.json';
import resultJsonSchema from '../schemas/result.schema.json';

export const RequestSchema = z.object({
  schemaVersion:z.string(), app:z.literal('shinra-bansho-kan'), mode:z.enum(['individual','compatibility']).default('individual'),
  subject:z.object({name:z.string(),nameKana:z.string().optional(),romanizedName:z.string().optional(),oldName:z.string().optional(),aliases:z.string().optional(),birthDate:z.string(),birthTime:z.string().nullable(),birthTimePrecision:z.enum(['exact','approximate','unknown']),birthPlace:z.object({country:z.string().optional(),region:z.string().optional(),city:z.string().optional()}),sex:z.string().optional(),language:z.string().optional(),currentLocation:z.string().optional()}),
  questions:z.array(z.string()),freeformQuestion:z.string(),requestedSystems:z.array(z.string()),options:z.object({crossAnalysis:z.boolean(),showCalculations:z.boolean(),showUncertainty:z.boolean(),generateShareCard:z.boolean().optional(),generateSummaryImage:z.boolean().optional()}).passthrough()
}).passthrough();
const Text=z.union([z.string(),z.record(z.unknown())]);
export const ResultSchema=z.object({schemaVersion:z.string(),subject:z.record(z.unknown()).default({}),meta:z.record(z.unknown()).default({}),baseInfo:z.record(z.unknown()).default({}),systems:z.array(z.object({id:z.string(),name:z.string().optional(),status:z.string().optional(),inputsUsed:z.array(z.string()).optional(),calculations:z.array(Text).optional(),facts:z.array(Text).optional(),interpretation:z.array(Text).optional(),uncertainties:z.array(z.string()).optional(),sources:z.array(Text).optional()}).passthrough()).default([]),crossAnalysis:z.object({strongThemes:z.array(Text).default([]),moderateThemes:z.array(Text).default([]),contradictions:z.array(Text).default([]),dependencyWarnings:z.array(Text).default([])}).passthrough().default({}),domainProfiles:z.record(z.unknown()).default({}),summary:z.union([z.string(),z.record(z.unknown())]).default({}),limitations:z.union([z.array(z.string()),z.record(z.unknown())]).default([]),assets:z.record(z.unknown()).default({})}).passthrough();
export type Request=z.infer<typeof RequestSchema>;export type Result=z.infer<typeof ResultSchema>;
function parseJson(text:string){try{return JSON.parse(text)}catch{throw Error('JSONを読み取れません。ファイルの形式を確認してください。')}}
function detectImageMime(bytes:Uint8Array):string|undefined{
  if(bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return 'image/png';
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
  if(bytes.length>=6&&(String.fromCharCode(...bytes.slice(0,6))==='GIF87a'||String.fromCharCode(...bytes.slice(0,6))==='GIF89a'))return 'image/gif';
  return undefined;
}

export function makePrompt(r:Request,names:Record<string,string>={},output:'package'|'markdown'='package'){
  const context=`あなたは歴史的背景と計算根拠を区別する総合占術アナリストです。以下に記載する対象者情報、希望テーマ、指定占術に基づいて鑑定してください。\n\n## 対象者\n${JSON.stringify(r.subject,null,2)}\n## 鑑定希望\n${[...r.questions,r.freeformQuestion].filter(Boolean).join('、')||'人物の資質と人生テーマ'}\n## 指定占術\n${r.requestedSystems.map(id=>names[id]||id).join('、')}\n\n不足情報から何が計算でき、何が保留になるかを分けます。計算できた要素は本人の事実として明示し、時間・場所などが必要な要素だけを保留します。計算値、出典、流派差は正確に記録し、同じ暦や天体位置に由来する体系を独立票として重複計上しません。歴史的体系と近代創作体系も区別します。

## 読み物としての鑑定書
- 鑑定本文は項目の羅列ではなく、読み進めたくなる個人向けの鑑定書です。冒頭で人物像と中心テーマを具体的に描き、根拠、日常での現れ方、強みの使い方、つまずきやすい局面、実践案へ展開します。
- 自然に力が出る状況、考え方の癖、人との距離、本人が自覚しにくい長所、強みを使い過ぎた時の反動、周囲からの見え方を立体的に描きます。長所の羅列にせず、矛盾する性質がどう同居し、場面ごとにどう現れるかまで推定します。
- すべての質問へ冒頭の一文で答えます。各テーマについて、適性の理由、向く役割や環境、起こりやすい具体的な場面、相手との関わり方、避けたい落とし穴、実行する順序や試せる行動まで書きます。抽象的な助言だけで終えません。
- 選択された全占術を鑑定本文で扱います。各体系で算出できた本人固有の事実から解釈を導き、事実→象徴の意味→本人の振る舞い→活かし方という筋道を示します。体系全体をunavailableにして空欄にせず、計算できた部分をpartialとして読みます。計算できない項目は理由と不足情報を具体的に記載します。一般的な体系解説で代用しません。
- ジョーティッシュ等で出生時刻が欠ける場合も、時刻依存のラグナ・ハウス・ダシャー開始点だけを保留し、日付や出生地から正確に求められる配置は記載します。ナクシャトラが日中に境界をまたぐ場合は候補と根拠を示し、断定可能な範囲と保留範囲を分けます。
- systemのinterpretationは原則3件、各件はtitleとtextを持つオブジェクトとします。各textは具体的な本人の計算事実を引用し、意味、日常例、活用または注意まで含む120〜220字程度の段落にします。同じ性格文を体系間で使い回しません。
- summaryにはheadline、short、portrait、strengths、watchOuts、firstStepを含めます。人物像portraitは500〜800字を目安に、強みと影、対人面、力が出る環境を織り込みます。domainProfilesは各質問にanswer、dailyLife、strength、caution、practiceを含め、各欄を具体的な2〜4文、合計300〜500字程度にします。内容のないテンプレートや同文の反復で字数を満たしません。
- 鑑定書には、目次、総合人物像、性質の二面性、質問ごとの鑑定、占術ごとの算出事実と読み、体系間の一致と食い違い、具体的な実践案、計算条件を含めます。全体系・全質問を扱う依頼では概ね10,000〜14,000字を目安とし、指定数が少ない場合は相応に調整します。各段落は一つの主題を深め、見出し・短い段落・必要な箇条書きで読みやすくします。
- 文章は鑑定士が本人に語る自然な占い文体にします。結論は具体的で明快な言い切りを基本にし、「かもしれません」「可能性があります」「傾向があります」「保証しません」などの保険表現を段落ごとに重ねません。計算上の不確かさが実際にある箇所だけ、その理由と範囲を個別に説明します。運命を固定する恐怖表現や成功を確約する表現は避けます。
- 鑑定本文や各解釈にサービス共通の免責文、科学的根拠の有無の定型文、専門家への相談を促す定型文を繰り返し挿入しません。サービス全体の免責はサイトの「免責事項」ページにまとめます。limitationsには出生時刻や暦法など、その鑑定固有の算出制約だけを記載します。
- 医療・法律・投資の診断や専門判断を占いとして断定しません。本人の計算結果や質問を根拠にし、計算できない事実・出典・属性を創作しません。`;
  if(output==='markdown')return `${context}\n\n## 返答形式（ChatGPT完結・コピペ版）\nこの鑑定はChatGPT上で読むためのものです。鑑定結果はこのチャットに、見出しと読みやすい段落を使った日本語の鑑定書として直接返してください。JSON、JSONコードブロック、manifest、ZIPは作成しません。総合人物像、各質問への具体的な回答と助言、占術別の根拠、体系間の一致と違い、実行しやすい一歩、算出条件を含めます。\n\n鑑定本文を完成させた後、カード生成を試す場合は氏名・読み・別名・生年月日・出生時刻・出生地・現在地・性別・連絡先など個人特定情報を一切含まない文面と、実際に算出した事実に結び付く視覚モチーフを選びます。画像生成機能が利用できる場合は一度試し、ChatGPTではgpt-imageを優先します。その他のサービスでは実際に利用できる機能を使い、鑑定固有の絵画的デザインと匿名の日本語コピーを焼き込んだカードを1枚生成して表示します。1200×675px・16:9は希望値です。サイズが異なる場合も元画像を受け入れ、分かる範囲の実寸を伝えてください。SVG、HTML/CSS、Canvas、Python、プログラム描画、テンプレート、既存画像での代用は禁止です。画像生成は利用可能なら一度試し、利用不可・失敗の場合も鑑定本文を中断せず画像なしで完了してください。カード文面と図柄を鑑定内容に照らし、個人情報が入っていないことを確認してください。`;
  return `${context}\n\n## 返答形式（ZIP版・必須契約）\n同梱のschema/result.schema.jsonを読み、Draft 2020-12 JSON Schemaに適合するresult.jsonを作成してください。このスキーマは参考ではなく厳守する契約です。全必須項目を含め、型を変えたり省いたりしないでください。\n\n最重要: systems各要素のcalculations、facts、interpretation、sourcesは必ず配列です。単一の値でもオブジェクト単体にせず、例: calculations: [{"label":"method","value":"tropical"}]。該当なしは空配列 []。inputsUsedとuncertaintiesも文字列配列です。crossAnalysisにはstrongThemes、moderateThemes、contradictions、dependencyWarningsの4配列を必ず入れてください。\n\nZIP化の前にJSONとして構文確認し、result.schema.jsonで検証して、型違反をすべて修正してください。検証できない／不一致のファイルを完成品として返さないでください。鑑定本文とresult.jsonを先に完成させ、JSON構文とschema/result.schema.jsonを検証してから、利用可能なら画像生成を試します。画像生成の成功・失敗や出力サイズはZIP完成の条件にしません。ZIPにはresult.json、report.md、manifest.jsonを必須で含め、実際に生成できた場合だけ画像ファイルを追加します。assets.shareImageとmanifest.filesには実在するパスだけを書き、画像がないときはassets.shareImageを省略します。ZIPを作れないサービスでは、reportMarkdownを含む単体result.jsonを返してください（アプリは読み込めます）。画像生成を試す場合はassets.shareCardCopyにtitle、description、themesと、可能なら算出事実に結び付くvisualMotifsを格納します。生成画像がない場合はshareCardCopyごと省略してかまいません。assets.shareGenerationは任意です。画像を試した場合はstatusをgenerated/unavailable/failedのいずれかにし、実際に使ったサービス・モデル・ツール・分かった範囲の実寸を正確に記録します。ChatGPT以外ならその名称を記し、使っていないgpt-imageを申告しません。formatはshinra-bansho-result、versionは1.0.0です。\n\n## 画像生成ワークフロー（順序厳守）
1. 先に鑑定、result.json、report.mdを完成させ、JSON構文と同梱schema/result.schema.jsonへの適合を確認します。検証前に画像を作りません。
2. 画像生成を試す場合は、完成した鑑定から個人を特定する情報を含まないshareCardCopyを作り、systems[].facts/calculations内の実際の算出事実からvisualMotifsを選びます。各件はsourceSystem、sourceFact、visualMotifを含み、sourceFactは例「九紫火星」「Life Path 11/2」のような象徴的な算出結果に限ります。名前、生年月日、出生時刻、場所、年齢は記録しません。鑑定の結論や実際の事実と無関係な汎用モチーフを選びません。
3. 生成を試す場合はshareCardCopy全体とvisualMotifsから個人特定情報を除きます。日付、年齢、氏名、出生情報、住所・地域、連絡先は画像にも文面にも入れません。匿名化したカード文面とvisualMotifsを確定し、これを使う画像生成プロンプトを組み立てます。
4. 画像生成は任意のベストエフォート工程です。ChatGPTでgpt-imageが使える場合はそれを使い、他サービスではそのサービスの画像生成機能を使います。利用不可・失敗・タイムアウト時も鑑定とZIP作成を中断せず、画像なしで続行します。SVG、HTML/CSS、Canvas、Python、プログラム描画、既存画像の加工、図形テンプレートを生成画像の代用品にしてはいけません。
5. 画像が生成できた場合、文字・visualMotifs・個人情報を確認し、分かる場合は実寸を記録します。1200×675px・16:9は希望値です。生成サービスが別サイズしか返さない場合も処理を止めず、元画像をそのまま同梱して実寸を記録します。画像を加工・再生成できない場合もZIPを完成させます。

## 生成する画像は完成カード1枚のみ
利用可能な画像生成機能でカードを1枚だけ試します。ChatGPTではgpt-imageを優先し、他サービスでは実際の生成機能・モデル名を記録します。1200×675ピクセル・横16:9を希望しますが、生成サービスの出力サイズが異なっても不合格扱いにせず、元の画像寸法のまま受け入れます。絵柄の中心、色、質感、周辺の細部をvisualMotifsの実占術データに結び付け、本人の鑑定に固有の図像にします。最低3層の具体的な描写（主役となる象徴的な情景、占術事実に由来する副モチーフ、植物・地形・天体・装飾枠の細密な彫刻表現）を重ね、深い藍・墨・古い和紙・真鍮・金・朱、手描きと版画を合わせた密度のある神秘的な図鑑表現にします。画面を同心円、軌道線、点だけで構成すること、単純なベクター図形、空の余白に短文ラベルを置いたUIカード、汎用宇宙壁紙は禁止です。主役になる具体的な絵画的モチーフを必ず一つ以上描きます。

画像を生成できた場合はassets.shareCardCopyのtitle、description、themesに含まれる日本語を可能な限りそのまま使います。視認性の高い日本語書体と明確な文字階層を保ち、指定文以外の文字は描きません。本人の実在写真は使いません。鑑定書の表紙は横長3:2の固定CSSデザインで、AI画像生成はカード1枚のみです。画像生成後の追加のCSS/Canvas文字合成は禁止します。生成できない場合は画像ファイルを省略し、shareGeneration.statusと理由を記録するだけで鑑定ZIPを完成させます。
`;
}

export async function createRequestZip(request:Request,prompt:string,now=new Date()){
  const zip=new JSZip();
  zip.file('request.json',JSON.stringify(request,null,2));
  zip.file('schema/request.schema.json',JSON.stringify(requestJsonSchema,null,2));
  zip.file('schema/result.schema.json',JSON.stringify(resultJsonSchema,null,2));
  const instructions=[
    '# 鑑定実行手順','',
    'request.jsonを読み、指定体系と質問に沿って鑑定してください。不足情報を推測で補わず、計算値・出典を捏造しないでください。依存体系を独立票として数えず、本人像、具体的な日常例、活かし方、注意点、行動案を含む読み応えのある鑑定本文を書いてください。',
    '',
    '## ZIPの必須内容とスキーマ',
    '結果ZIPにはresult.json、report.md、manifest.jsonを必ず含めます。result.jsonにはrequired項目としてassetsオブジェクトを含め、画像がなければassets:{}とします。JSONは同梱schema/result.schema.jsonに適合させ、systems[].calculations、facts、interpretation、sourcesは配列、該当なしは[]としてください。画像の有無や画像寸法を理由にZIP作成を中断してはいけません。',
    '',
    '画像生成は任意のベストエフォートです。利用可能なら鑑定完了後に一枚だけ試してください。ChatGPTではgpt-imageを優先し、他サービスでは実際に利用できる画像生成機能を使います。利用不可、失敗、タイムアウトでも鑑定JSON・本文・ZIPを必ず完成させます。SVGやプログラム描画の偽画像は作りません。',
    'カードは1200×675px・16:9を希望しますが、生成サービスが別の寸法しか返さない場合は最も近い横長サイズをそのまま受け入れ、画像の実寸が分かる場合だけshareGenerationに記録します。サイズ不一致だけを理由に再生成・失敗扱い・返却中止にしません。出力がPNG/JPEG/WebPなら実際の形式と拡張子を維持し、ZIPに実在する画像だけを追加します。',
    '画像が生成できた場合のみassets.shareImageにその実在パスを設定し、manifest.filesにも追加します。画像がない場合はassets.shareImageを省略し、shareGeneration.statusをunavailableまたはfailedとして簡潔な理由を記録します。画像がない結果もスキーマ適合の有効な鑑定結果です。shareCardCopyは個人情報を除いた文面として格納できますが、含める場合はtitle、description、themesを満たします。画像を生成できたことの証明にはなりません。',
    '氏名・読み・別名・生年月日・出生時刻・出生地・現住所・性別・連絡先などはカードの文面と図柄に含めません。カード文面・図柄は実際に算出した占術事実に結び付けます。',
    '',
    'サービスがZIP添付を作成できない場合だけ、reportMarkdownを含む完全なresult.jsonを単体ファイルとして返します。このアプリは単体JSONも読み込めます。ZIPが作成可能なら単体ファイルの羅列で済ませず、上記の必須3ファイルを含む一つの結果ZIPを返してください。',
    '',
    'JSONの構文とスキーマを確認し、manifest.filesには実在するファイル名だけを記載します。formatはshinra-bansho-result、versionは1.0.0です。鑑定書の表紙はアプリの固定CSSを使用します。'
  ].join('\n');
  zip.file('instructions.md',instructions);
  zip.file('prompt.md',prompt);
  zip.file('manifest.json',JSON.stringify({format:'shinra-bansho-request',version:'1.0.0',createdAt:now.toISOString(),files:['request.json','schema/request.schema.json','schema/result.schema.json','instructions.md','prompt.md','README.md']},null,2));
  zip.file('README.md','# 森羅万象鑑 鑑定依頼パッケージ\n\nChatGPT等にZIPを添付し、prompt.mdとinstructions.mdに従ってください。鑑定JSONは同梱schema/result.schema.jsonに適合させます。画像生成に失敗しても画像なしの結果ZIPは有効です。');
  return zip.generateAsync({type:'blob'});
}
function isRecord(value:unknown):value is Record<string,any>{return Boolean(value&&typeof value==='object'&&!Array.isArray(value))}
function normalizeEntryList(value:unknown,asStrings=false):unknown[]|undefined{
  if(value===undefined||value===null)return undefined;
  let entries:unknown[];
  if(Array.isArray(value))entries=value;
  else if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')entries=[value];
  else if(isRecord(value)){
    if(Array.isArray(value.items))entries=value.items;
    else if(['title','heading','label','text','body','reading','interpretation','answer'].some(key=>key in value))entries=[value];
    else entries=Object.entries(value).map(([label,item])=>({label,value:item}));
  }else entries=[String(value)];
  if(asStrings)return entries.map(item=>typeof item==='string'?item:isRecord(item)?Object.entries(item).map(([k,v])=>String(k)+': '+(typeof v==='string'?v:JSON.stringify(v))).join(' / '):String(item));
  return entries;
}
function findZipEntry(zip:JSZip,leafName:string):JSZip.JSZipObject|null{
  const exact=zip.file(leafName);if(exact)return exact;
  const target=leafName.toLowerCase();
  const match=Object.keys(zip.files).filter(path=>{const normalized=path.replace(/\\/g,'/').toLowerCase();const leaf=normalized.split('/').pop()||'';const matches=normalized===target||normalized.endsWith('/'+target)||(target==='result.json'&&/^(?:shinra-bansho-)?result(?:[-_][^/]*)?\.json$/.test(leaf));return !zip.files[path].dir&&matches}).sort((a,b)=>a.split(/[\\/]/).length-b.split(/[\\/]/).length)[0];
  return match?zip.file(match):null;
}
function normalizeImportedResult(data:any,warnings:string[]):any{
  if(!isRecord(data))throw Error('鑑定結果JSONのルートはオブジェクトである必要があります。');
  if(typeof data.schemaVersion!=='string'){data.schemaVersion='1.0.0';warnings.push('schemaVersionがないため1.0.0として補いました')}
  for(const key of ['subject','meta','baseInfo'] as const)if(!isRecord(data[key])){data[key]=key==='subject'&&typeof data[key]==='string'?{name:data[key]}:data[key]===undefined||data[key]===null?{}:{text:String(data[key])};warnings.push(key+'をオブジェクトへ補正')}
  if(!isRecord(data.assets)){data.assets={};warnings.push('assetsを空のオブジェクトへ補正')}
  if(data.reportMarkdown===undefined){const candidate=data.report??data.markdown;if(typeof candidate==='string')data.reportMarkdown=candidate}
  if(!Array.isArray(data.systems)){
    if(isRecord(data.systems)){data.systems=Object.entries(data.systems).map(([id,value])=>isRecord(value)?{id,...value}:{id,name:id,interpretation:[String(value)]});warnings.push('systemsを配列へ補正')}
    else if(data.systems!==undefined&&data.systems!==null){data.systems=[data.systems];warnings.push('systemsを配列へ補正')}
    else data.systems=[];
  }
  data.systems=data.systems.map((raw:any,index:number)=>{
    const system:any=isRecord(raw)?{...raw}:{id:'system-'+(index+1),name:String(raw),status:'partial'};
    if(typeof system.id!=='string'||!system.id.trim()){system.id=typeof system.name==='string'&&system.name.trim()?system.name:'system-'+(index+1);warnings.push('systems['+index+'].idを補いました')}
    if(typeof system.name!=='string'||!system.name.trim())system.name=system.id;
    if(system.status!==undefined&&typeof system.status!=='string')system.status=String(system.status);
    for(const key of ['inputsUsed','calculations','facts','interpretation','uncertainties','sources'] as const){
      if(system[key]===undefined||system[key]===null)continue;
      if(!Array.isArray(system[key]))warnings.push(system.name+': '+key+'を配列へ補正');
      system[key]=normalizeEntryList(system[key],key==='inputsUsed'||key==='uncertainties');
    }
    return system;
  });
  if(!isRecord(data.crossAnalysis)){data.crossAnalysis={};warnings.push('crossAnalysisを空のオブジェクトへ補正')}
  for(const key of ['strongThemes','moderateThemes','contradictions','dependencyWarnings'] as const){
    if(data.crossAnalysis[key]===undefined||data.crossAnalysis[key]===null){data.crossAnalysis[key]=[];continue}
    if(!Array.isArray(data.crossAnalysis[key]))warnings.push('crossAnalysis.'+key+'を配列へ補正');
    data.crossAnalysis[key]=normalizeEntryList(data.crossAnalysis[key],false);
  }
  if(!isRecord(data.domainProfiles)){if(Array.isArray(data.domainProfiles))data.domainProfiles=Object.fromEntries(data.domainProfiles.map((value:any,index:number)=>[String(value?.title||value?.topic||index+1),value]));else if(data.domainProfiles!==undefined&&data.domainProfiles!==null)data.domainProfiles={overview:data.domainProfiles};else data.domainProfiles={};warnings.push('domainProfilesをオブジェクトへ補正')}
  if(data.summary===undefined||data.summary===null)data.summary={};else if(typeof data.summary!=='string'&&!isRecord(data.summary))data.summary=String(data.summary);
  if(data.limitations===undefined||data.limitations===null)data.limitations=[];else if(!Array.isArray(data.limitations)&&!isRecord(data.limitations))data.limitations=[String(data.limitations)];
  if(warnings.length)data.meta={...data.meta,importWarnings:warnings};
  return data;
}
export async function parseResultBundle(file:File):Promise<Result>{
  let data:any;let reportMarkdown:string|undefined;const assetWarnings:string[]=[];const importWarnings:string[]=[];
  if(file.name.toLowerCase().endsWith('.zip')){
    const zip=await JSZip.loadAsync(file);const entry=findZipEntry(zip,'result.json');
    if(!entry){if(findZipEntry(zip,'request.json'))throw Error('これは鑑定依頼ZIPです。鑑定結果ZIPを選んでください。');throw Error('ZIPにresult.jsonがありません。ファイル名をresult.jsonにしてください。')}
    const manifestFile=findZipEntry(zip,'manifest.json');
    if(manifestFile){try{const manifest=parseJson(await manifestFile.async('text'));if(manifest.format&&manifest.format!=='shinra-bansho-result')importWarnings.push('manifestの形式名が標準と異なります。result.jsonを基準に読み込みました');if(manifest.version&&!/^1\./.test(manifest.version))importWarnings.push('manifestの版が標準と異なります。result.jsonを基準に読み込みました')}catch{importWarnings.push('manifestを解析できませんでしたが、result.jsonから読み込みました')}}
    data=parseJson(await entry.async('text'));if(!isRecord(data.assets))data.assets={};
    const rasterPaths=Object.keys(zip.files).filter(path=>!zip.files[path].dir&&/\.(png|jpe?g|webp|gif)$/i.test(path));
    for(const [defaultName,key] of [['summary.png','summaryImage'],['share.png','shareImage']] as const){
      const original=typeof data.assets[key]==='string'?String(data.assets[key]):'';
      if(original.startsWith('data:image/'))continue;
      const referenced=original.replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+/, '');
      const namedCandidates=rasterPaths.filter(path=>{const normalized=path.replace(/\\/g,'/');return key==='summaryImage'?/(^|\/)summary(?:[-_].*)?\.(png|jpe?g|webp|gif)$/i.test(normalized):/(^|\/)(?:share|card)(?:[-_].*)?\.(png|jpe?g|webp|gif)$/i.test(normalized)}).sort((a,b)=>Number(/(^|\/)share/i.test(b))-Number(/(^|\/)share/i.test(a)));
      const unique=[referenced,'assets/'+defaultName,defaultName,...namedCandidates,...(key==='shareImage'&&rasterPaths.length===1?rasterPaths:[])].filter((path,index,all)=>path&&all.indexOf(path)===index);
      let asset:JSZip.JSZipObject|null=null;let assetPath='';
      for(const path of unique){asset=zip.file(path);if(!asset){const actual=Object.keys(zip.files).find(name=>name.toLowerCase()===path.toLowerCase());if(actual)asset=zip.file(actual)}if(asset){assetPath=path;break}}
      if(asset){const bytes=await asset.async('uint8array');const mime=detectImageMime(bytes);if(mime)data.assets[key]='data:'+mime+';base64,'+await asset.async('base64');else{delete data.assets[key];assetWarnings.push(assetPath+'は対応しているラスター画像形式ではありません')}}
      else if(referenced){delete data.assets[key];assetWarnings.push(referenced+'がZIP内にありません')}
    }
    const markdown=findZipEntry(zip,'report.md')||(()=>{const name=Object.keys(zip.files).filter(path=>!zip.files[path].dir&&/(^|[\\/])(?:report|reading|鑑定書)(?:[-_][^\\/]*)?\.(?:md|markdown)$/i.test(path.replace(/\\/g,'/'))).sort((a,b)=>a.split(/[\\/]/).length-b.split(/[\\/]/).length)[0];return name?zip.file(name):null})();if(markdown)reportMarkdown=await markdown.async('text');
    if(assetWarnings.length)data.meta={...(isRecord(data.meta)?data.meta:{}),assetWarnings};
  }else data=parseJson(await file.text());
  if(reportMarkdown)data.reportMarkdown=reportMarkdown;
  if(typeof data?.assets?.shareImage==='string'&&!data.assets.shareImage.startsWith('data:image/')){delete data.assets.shareImage;assetWarnings.push('単体JSONに画像ファイルの相対パスだけがあり、画像本体がないため省略しました')}
  data=normalizeImportedResult(data,importWarnings);
  if(assetWarnings.length)data.meta={...data.meta,assetWarnings};
  const parsed=ResultSchema.safeParse(data);
  if(!parsed.success)throw Error('鑑定結果の形式が不正です: '+parsed.error.issues.slice(0,3).map(issue=>issue.path.join('.')+' '+issue.message).join(' / '));
  if(!/^1\./.test(parsed.data.schemaVersion))throw Error('未対応の結果形式バージョンです: '+parsed.data.schemaVersion);
  return parsed.data;
}