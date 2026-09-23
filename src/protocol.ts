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
  if(output==='markdown')return `${context}\n\n## 返答形式（ChatGPT完結・コピペ版）\nこの鑑定はChatGPT上で読むためのものです。鑑定結果はこのチャットに、見出しと読みやすい段落を使った日本語の鑑定書として直接返してください。JSON、JSONコードブロック、manifest、ZIPは作成しません。総合人物像、各質問への具体的な回答と助言、占術別の根拠、体系間の一致と違い、実行しやすい一歩、算出条件を含めます。\n\n鑑定本文を完成させた後、氏名・読み・別名・生年月日・出生時刻・出生地・現在地・性別・連絡先など個人特定情報を一切含まないシェアカード文面を作り、ここまでの鑑定で実際に算出した事実に結び付く3〜5個の視覚モチーフを選びます。続けてChatGPTの画像生成機能（gpt-image）を実際に呼び出し、鑑定固有の細密な絵画的デザインと日本語の鑑定タイトル・短い説明・テーマを文字まで焼き込んだ1200×675px・16:9の完成カードを1枚生成し、このチャットに表示してください。SVG、HTML/CSS、Canvas、Python、プログラム描画、テンプレート、既存画像での代用は禁止です。画像生成機能を呼び出せない場合、代用品を作らず、生成できないと明記してください。カード文面と図柄を鑑定内容に照らし、個人情報が入っていないことを確認してください。`;
  return `${context}\n\n## 返答形式（ZIP版・必須契約）\n同梱のschema/result.schema.jsonを読み、Draft 2020-12 JSON Schemaに適合するresult.jsonを作成してください。このスキーマは参考ではなく厳守する契約です。全必須項目を含め、型を変えたり省いたりしないでください。\n\n最重要: systems各要素のcalculations、facts、interpretation、sourcesは必ず配列です。単一の値でもオブジェクト単体にせず、例: calculations: [{"label":"method","value":"tropical"}]。該当なしは空配列 []。inputsUsedとuncertaintiesも文字列配列です。crossAnalysisにはstrongThemes、moderateThemes、contradictions、dependencyWarningsの4配列を必ず入れてください。\n\nZIP化の前にJSONとして構文確認し、result.schema.jsonで検証して、型違反をすべて修正してください。検証できない／不一致のファイルを完成品として返さないでください。鑑定本文とresult.jsonを先に完成させ、JSON構文とschema/result.schema.jsonを検証してから画像生成へ進みます。ZIPにはresult.json、report.md、manifest.json、assets/share.pngだけを含めます。result.jsonのassets.shareImageはassets/share.png、manifest.filesには実在するその相対パスを記載します。result.jsonのassets.shareCardCopyにはtitle、description、themes（2〜3件）に加え、算出事実に直接結び付くvisualMotifsを3〜5件格納します。assets.shareGenerationには実際に呼び出した生成方式・モデル・根拠とした占術上の事実を記録します。formatはshinra-bansho-result、versionは1.0.0です。\n\n## 画像生成ワークフロー（順序厳守）
1. 先に鑑定、result.json、report.mdを完成させ、JSON構文と同梱schema/result.schema.jsonへの適合を確認します。検証前に画像を作りません。
2. 完成した鑑定から、個人を特定する情報を含まないshareCardCopyを作ります。さらにsystems[].facts/calculations内で実際に算出した占術上の事実を読み、visualMotifsに3〜5件記録します。各件はsourceSystem、sourceFact、visualMotifを含み、sourceFactは例「九紫火星」「Life Path 11/2」のような象徴的な算出結果に限ります。名前、生年月日、出生時刻、場所、年齢は記録しません。鑑定の結論や実際の事実と無関係な汎用モチーフを選びません。
3. shareCardCopy全体とvisualMotifsから個人特定情報を除きます。日付、年齢、氏名、出生情報、住所・地域、連絡先は画像にも文面にも入れません。匿名化したカード文面とvisualMotifsを確定し、これを使う画像生成プロンプトを組み立てます。
4. ChatGPTの画像生成機能を実際に呼び出し、gpt-imageモデルで完成カードを生成します。画像生成ツールを使わず、プロンプト文だけ返すことは禁止です。SVG、HTML/CSS、Canvas、Python、プログラム描画、既存画像の加工、図形テンプレートでの代用も禁止です。実ツールが利用できない場合は偽のPNGを作らず、生成できなかったとユーザーへ伝えて処理を止めます。
5. 生成後、文字の正確さ、visualMotifsとの一致、1200×675px、個人情報の有無を目視確認します。要件に満たない画像を完成品として梱包しません。

## 生成する画像は完成カード1枚のみ
ChatGPTのgpt-image画像生成機能でassets/share.pngを1枚だけ生成します。最終画像は正確に1200×675ピクセル、横16:9。絵柄の中心、色、質感、周辺の細部をvisualMotifsの実占術データに結び付け、本人の鑑定に固有の図像にします。最低3層の具体的な描写（主役となる象徴的な情景、占術事実に由来する副モチーフ、植物・地形・天体・装飾枠の細密な彫刻表現）を重ね、深い藍・墨・古い和紙・真鍮・金・朱、手描きと版画を合わせた密度のある神秘的な図鑑表現にします。画面を同心円、軌道線、点だけで構成すること、単純なベクター図形、空の余白に短文ラベルを置いたUIカード、汎用宇宙壁紙は禁止です。主役になる具体的な絵画的モチーフを必ず一つ以上描きます。

カードに印字する日本語はresult.jsonのassets.shareCardCopyのtitle、description、themesの値を一字一句そのまま使います。視認性の高い日本語書体と明確な文字階層を保ち、指定文以外の文字は描きません。本人の実在写真は使いません。鑑定書の表紙は横長3:2の固定CSSデザインで、AI画像生成はカード1枚のみです。画像生成後の追加のCSS/Canvas文字合成は禁止します。
`;
}

export async function createRequestZip(request:Request,prompt:string,now=new Date()){const zip=new JSZip();zip.file('request.json',JSON.stringify(request,null,2));zip.file('schema/request.schema.json',JSON.stringify(requestJsonSchema,null,2));zip.file('schema/result.schema.json',JSON.stringify(resultJsonSchema,null,2));zip.file('instructions.md','# 鑑定実行手順\n\nrequest.jsonを読み、指定体系について根拠と限界を分けて鑑定してください。指定された各質問へ直接回答し、一般論の水増しを避けてください。不足情報を推測で補わず、計算値・出典を捏造しないでください。依存体系を独立票として数えないこと。\n\n## 出力スキーマは必須\nschema/result.schema.jsonを読み、Draft 2020-12に適合するresult.jsonを作成します。systems内のcalculations、facts、interpretation、sourcesは一件でも配列にしてください。オブジェクト単体は禁止し、該当なしは[]とします。JSONの構文と全フィールドの型を検証してからZIP化してください。不適合JSONを返却しないでください。\n\nreport.mdには、全質問への直接回答、本人像、日常例、強みの使い方、注意点、実践案、占術ごとの事実と解釈を含む概ね10,000〜14,000字の鑑定書を書きます。保険表現やサービス共通の免責文を反復せず、自然で明快な占い文体にします。各質問・占術を薄い一文で済ませず、具体的な根拠と考察を展開します。まず鑑定本文とresult.jsonを完成させ、JSON構文とschema/result.schema.jsonを検証してください。検証完了前に画像生成へ進んではいけません。\n\n検証済み鑑定からassets.shareCardCopy（title、description、themes 2〜3件、算出事実に基づくvisualMotifs 3〜5件）を作成し、人物名・読み・別名・生年月日・出生時刻・出生地・現在地・性別・連絡先・個人特定につながる情報を含まないか照合します。安全な文面に確定した後、ChatGPTの画像生成機能（gpt-image）を実際に呼び出し、SVGやプログラム描画で代用せず、visualMotifsに基づく細密な絵画的カードを1200×675ピクセル・横16:9でassets/share.pngとして生成します。実ツールが使えない場合は代用品を作らず生成できない旨を伝えます。カードにはresult.jsonのassets.shareCardCopyにある日本語の値を一字一句そのまま焼き込みます。文字なし背景やアプリによる後乗せではありません。画像内に個人情報を入れないでください。生成後はvisualMotifsとの一致、文字、比率、個人情報を確認します。鑑定書の表紙は横長3:2の固定CSSデザインを使用し、AI生成しません。summary.pngは作成しません。manifest.filesには実在ファイルだけ（assets/share.pngを含む）を記載します。');zip.file('prompt.md',prompt);zip.file('manifest.json',JSON.stringify({format:'shinra-bansho-request',version:'1.0.0',createdAt:now.toISOString(),files:['request.json','schema/request.schema.json','schema/result.schema.json','instructions.md','prompt.md','README.md']},null,2));zip.file('README.md','# 森羅万象鑑 鑑定依頼パッケージ\n\nChatGPT等にZIPを添付し、prompt.mdとinstructions.mdに従ってください。result.jsonの形式は同梱schema/result.schema.jsonが定義します。');return zip.generateAsync({type:'blob'});}

export async function parseResultBundle(file:File):Promise<Result>{
  let data:any;let reportMarkdown:string|undefined;
  if(file.name.toLowerCase().endsWith('.zip')){
    const zip=await JSZip.loadAsync(file);const entry=zip.file('result.json');
    if(!entry){if(zip.file('request.json'))throw Error('これは鑑定依頼ZIPです。鑑定結果ZIPを選んでください。');throw Error('ZIPにresult.jsonがありません。')}
    const manifestFile=zip.file('manifest.json');
    if(manifestFile){const manifest=parseJson(await manifestFile.async('text'));if(manifest.format&&manifest.format!=='shinra-bansho-result')throw Error('manifestの形式が鑑定結果ではありません。');if(manifest.version&&!/^1\./.test(manifest.version))throw Error(`未対応の結果形式バージョンです: ${manifest.version}`)}
    data=parseJson(await entry.async('text'));data.assets=data.assets||{};
    const assetWarnings:string[]=[];
    for(const [defaultName,key] of [['summary.png','summaryImage'],['share.png','shareImage']] as const){
      const referenced=typeof data.assets[key]==='string'?String(data.assets[key]).replace(/^\.\//,''):'';
      const candidates=[referenced,`assets/${defaultName}`,defaultName].filter((path,index,all)=>path&&all.indexOf(path)===index);
      let asset:JSZip.JSZipObject|null=null;let assetPath='';
      for(const path of candidates){asset=zip.file(path);if(asset){assetPath=path;break}}
      if(asset){const bytes=await asset.async('uint8array');const mime=detectImageMime(bytes);if(mime)data.assets[key]=`data:${mime};base64,${await asset.async('base64')}`;else{delete data.assets[key];assetWarnings.push(`${assetPath}は対応している画像形式ではありません`)}}
      else if(referenced&&!referenced.startsWith('data:image/')){delete data.assets[key];assetWarnings.push(`${referenced}がZIP内にありません`)}
    }
    const markdown=zip.file('report.md');if(markdown)reportMarkdown=await markdown.async('text');
    if(assetWarnings.length)data.meta={...(data.meta||{}),assetWarnings};
  }else data=parseJson(await file.text());
  const importWarnings:string[]=[];
  if(Array.isArray(data?.systems))data.systems=data.systems.map((system:any)=>{
    if(system&&system.calculations&&typeof system.calculations==='object'&&!Array.isArray(system.calculations)){
      importWarnings.push(`${system.name||system.id}: calculationsを配列へ補正`);
      return {...system,calculations:Object.entries(system.calculations).map(([label,value])=>({label,value}))};
    }
    return system;
  });
  if(data&&typeof data==='object'){
    if(reportMarkdown)data.reportMarkdown=reportMarkdown;
    if(importWarnings.length)data.meta={...(data.meta||{}),importWarnings};
  }
  const parsed=ResultSchema.safeParse(data);
  if(!parsed.success)throw Error('鑑定結果の形式が不正です: '+parsed.error.issues.slice(0,3).map(issue=>issue.path.join('.')+' '+issue.message).join(' / '));
  if(!/^1\./.test(parsed.data.schemaVersion))throw Error(`未対応の結果形式バージョンです: ${parsed.data.schemaVersion}`);
  return parsed.data;
}
