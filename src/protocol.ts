import JSZip from 'jszip';
import { z } from 'zod';
import requestJsonSchema from '../schemas/request.schema.json';
import resultJsonSchema from '../schemas/result.schema.json';

export const RequestSchema = z.object({
  schemaVersion:z.string(), app:z.literal('shinra-bansho-kan'), mode:z.enum(['individual','compatibility']).default('individual'),
  subject:z.object({name:z.string(),nameKana:z.string().optional(),romanizedName:z.string().optional(),oldName:z.string().optional(),aliases:z.string().optional(),birthDate:z.string(),birthTime:z.string().nullable(),birthTimePrecision:z.enum(['exact','approximate','unknown']),birthPlace:z.object({country:z.string().optional(),region:z.string().optional(),city:z.string().optional()}),sex:z.string().optional(),language:z.string().optional(),currentLocation:z.string().optional()}),
  questions:z.array(z.string()),freeformQuestion:z.string(),requestedSystems:z.array(z.string()),options:z.object({crossAnalysis:z.boolean(),showCalculations:z.boolean(),showUncertainty:z.boolean(),generateSummaryImage:z.boolean()}).passthrough()
}).passthrough();
const Text=z.union([z.string(),z.record(z.unknown())]);
export const ResultSchema=z.object({schemaVersion:z.string(),subject:z.record(z.unknown()).default({}),meta:z.record(z.unknown()).default({}),baseInfo:z.record(z.unknown()).default({}),systems:z.array(z.object({id:z.string(),name:z.string().optional(),status:z.string().optional(),inputsUsed:z.array(z.string()).optional(),calculations:z.array(Text).optional(),facts:z.array(Text).optional(),interpretation:z.array(Text).optional(),uncertainties:z.array(z.string()).optional(),sources:z.array(Text).optional()}).passthrough()).default([]),crossAnalysis:z.object({strongThemes:z.array(Text).default([]),moderateThemes:z.array(Text).default([]),contradictions:z.array(Text).default([]),dependencyWarnings:z.array(Text).default([])}).passthrough().default({}),domainProfiles:z.record(z.unknown()).default({}),summary:z.union([z.string(),z.record(z.unknown())]).default({}),limitations:z.union([z.array(z.string()),z.record(z.unknown())]).default([]),assets:z.record(z.unknown()).default({})}).passthrough();
export type Request=z.infer<typeof RequestSchema>;export type Result=z.infer<typeof ResultSchema>;
function parseJson(text:string){try{return JSON.parse(text)}catch{throw Error('JSONを読み取れません。ファイルの形式を確認してください。')}}

export function makePrompt(r:Request,names:Record<string,string>={},output:'package'|'markdown'='package'){
  const context=`あなたは歴史的背景と計算根拠を区別する総合占術アナリストです。添付request.jsonの人物情報、問い、指定体系に限って鑑定してください。\n\n## 対象者\n${JSON.stringify(r.subject,null,2)}\n## 鑑定希望\n${[...r.questions,r.freeformQuestion].filter(Boolean).join('、')||'人物の資質と人生テーマ'}\n## 指定占術\n${r.requestedSystems.map(id=>names[id]||id).join('、')}\n\n出生時刻・場所などの不足情報を推測で埋めず、該当項目はunavailableとしてください。流派差、入力精度、計算根拠、出典、不確実性を明記してください。計算値や出典を捏造しないでください。複数体系が同一の暦・天体位置・氏名に依存する場合、独立した票として重複計上しないでください。Dreamspellと歴史的マヤ暦など、近代体系と伝統を混同しないでください。占術を科学的事実、診断、確定的未来予測として書かないでください。\n\n## 鑑定の内容品質\n- 指定された質問テーマと自由記述の問いを一つずつ見出しで扱い、問いに直接答えてください。\n- 各占術について、算出できた事実、そこからの解釈、質問への関係、限界を分けてください。情報がある体系では、その体系固有の象徴を使った具体的で重複しない読みを複数示してください。情報が足りない体系は短く保留し、文章量のために一般論を水増ししないでください。\n- 総合分析の各テーマは、根拠となるsystemsのid、依存関係、確信度の理由を示してください。食い違う読みも消さず、どう両立しうるかを述べてください。\n- 質問ごとの実用的な省察案を示し、占術を根拠に重大な決断を促さないでください。`;
  if(output==='markdown')return `${context}\n\n## 返答形式（コピペ版）\nこの鑑定はChatGPT上で読むためのものです。自然な日本語のMarkdown本文だけをこのチャットに直接返してください。JSON、JSONコードブロック、manifest、ZIP、画像ファイルの作成は不要です。鑑定書として、総合像・各質問への回答・占術ごとの読み・一致と矛盾・限界を見出し付きでまとめてください。`;
  return `${context}\n\n## 返答形式（ZIP版・必須契約）\n同梱のschema/result.schema.jsonを読み、Draft 2020-12 JSON Schemaに適合するresult.jsonを作成してください。このスキーマは参考ではなく厳守する契約です。全必須項目を含め、型を変えたり省いたりしないでください。\n\n最重要: systems各要素のcalculations、facts、interpretation、sourcesは必ず配列です。単一の値でもオブジェクト単体にせず、例: calculations: [{"label":"method","value":"tropical"}]。該当なしは空配列 []。inputsUsedとuncertaintiesも文字列配列です。crossAnalysisにはstrongThemes、moderateThemes、contradictions、dependencyWarningsの4配列を必ず入れてください。\n\nZIP化の前にJSONとして構文確認し、result.schema.jsonで検証して、型違反をすべて修正してください。検証できない／不一致のファイルを完成品として返さないでください。ZIPにはresult.json、充実した本文のreport.md、manifest.jsonを必ず含めます。summary.pngとshare.pngも**画像生成ツールで実際に生成したPNG**として含めてください。SVG、CSS図形、Canvas描画、空のテンプレート画像で代用しないでください。manifestのfilesには実ファイルだけを記載します。formatはshinra-bansho-result、versionは1.0.0です。\n\n## 画像アートディレクション（必須）\n鑑定の具体的な象徴から着想した、複雑で密度のあるスピリチュアル／天文図鑑風の生成画像を2点作成してください。summary.pngは鑑定書の縦長キービジュアル、share.pngは横長SNSカード用です。深い藍・墨・古い羊皮紙・真鍮や金箔・朱の差し色を基調に、星図、精密な天体軌道、占術盤、植物紋様、細密な装飾枠、光と影を多層に組み合わせ、印刷物のような質感まで描き込みます。指定占術に実在する象徴だけを選び、相反する体系は記号を混同せず別のレイヤーとして調和させます。単色背景に数個のラベルを置くだけの構成、ミニマルなUIカード、汎用宇宙壁紙は不可。画像内に文字・数字・氏名を描かず、文字はアプリが後から重ねられる余白を確保してください。本人の実在写真や断定的な未来図は使いません。`;
}

export async function createRequestZip(request:Request,prompt:string,now=new Date()){const zip=new JSZip();zip.file('request.json',JSON.stringify(request,null,2));zip.file('schema/request.schema.json',JSON.stringify(requestJsonSchema,null,2));zip.file('schema/result.schema.json',JSON.stringify(resultJsonSchema,null,2));zip.file('instructions.md','# 鑑定実行手順\n\nrequest.jsonを読み、指定体系について根拠と限界を分けて鑑定してください。指定された各質問へ直接回答し、一般論の水増しを避けてください。不足情報を推測で補わず、計算値・出典を捏造しないでください。依存体系を独立票として数えないこと。\n\n## 出力スキーマは必須\nschema/result.schema.jsonを読み、Draft 2020-12に適合するresult.jsonを作成します。systems内のcalculations、facts、interpretation、sourcesは一件でも配列にしてください。オブジェクト単体は禁止し、該当なしは[]とします。JSONの構文と全フィールドの型を検証してからZIP化してください。不適合JSONを返却しないでください。\n\nreport.mdには、総合像、占術別の固有な読み、質問ごとの回答、根拠と限界を含む読み応えのある鑑定書を書きます。summary.pngとshare.pngには、prompt.mdのアートディレクションに沿うAI生成画像を含めます。SVGや単純な図形テンプレートで代替しないでください。');zip.file('prompt.md',prompt);zip.file('manifest.json',JSON.stringify({format:'shinra-bansho-request',version:'1.0.0',createdAt:now.toISOString(),files:['request.json','schema/request.schema.json','schema/result.schema.json','instructions.md','prompt.md','README.md']},null,2));zip.file('README.md','# 森羅万象鑑 鑑定依頼パッケージ\n\nChatGPT等にZIPを添付し、prompt.mdとinstructions.mdに従ってください。result.jsonの形式は同梱schema/result.schema.jsonが定義します。');return zip.generateAsync({type:'blob'});}

export async function parseResultBundle(file:File):Promise<Result>{
  let data:any;let reportMarkdown:string|undefined;
  if(file.name.toLowerCase().endsWith('.zip')){
    const zip=await JSZip.loadAsync(file);const entry=zip.file('result.json');
    if(!entry){if(zip.file('request.json'))throw Error('これは鑑定依頼ZIPです。鑑定結果ZIPを選んでください。');throw Error('ZIPにresult.jsonがありません。')}
    const manifestFile=zip.file('manifest.json');
    if(manifestFile){const manifest=parseJson(await manifestFile.async('text'));if(manifest.format&&manifest.format!=='shinra-bansho-result')throw Error('manifestの形式が鑑定結果ではありません。');if(manifest.version&&!/^1\./.test(manifest.version))throw Error(`未対応の結果形式バージョンです: ${manifest.version}`)}
    data=parseJson(await entry.async('text'));data.assets=data.assets||{};
    for(const [assetName,key,mime] of [['summary.png','summaryImage','image/png'],['share.png','shareImage','image/png']] as const){const asset=zip.file(`assets/${assetName}`);if(asset)data.assets[key]=`data:${mime};base64,${await asset.async('base64')}`}
    const markdown=zip.file('report.md');if(markdown)reportMarkdown=await markdown.async('text');
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
