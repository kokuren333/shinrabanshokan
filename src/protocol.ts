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
  const context=`あなたは歴史的背景と計算根拠を区別する総合占術アナリストです。添付request.jsonの人物情報、問い、指定体系に限って鑑定してください。\n\n## 対象者\n${JSON.stringify(r.subject,null,2)}\n## 鑑定希望\n${[...r.questions,r.freeformQuestion].filter(Boolean).join('、')||'人物の資質と人生テーマ'}\n## 指定占術\n${r.requestedSystems.map(id=>names[id]||id).join('、')}\n\n出生時刻・場所などの不足情報を推測で埋めず、該当項目はunavailableとしてください。流派差、入力精度、計算根拠、出典、不確実性を明記してください。計算値や出典を捏造しないでください。複数体系が同一の暦・天体位置・氏名に依存する場合、独立した票として重複計上しないでください。Dreamspellと歴史的マヤ暦など、近代体系と伝統を混同しないでください。占術を科学的事実、診断、確定的未来予測として書かないでください。\n\n## 読み物としての鑑定書にする\n- report.mdはJSON項目の説明や占術の百科事典ではなく、依頼者が自分のことを理解できる個人向けの鑑定書にします。冒頭で結論となる人物像を短く示し、根拠、日常での現れ方、活かし方、注意点へ進みます。\n- 人物像では、自然に力を出せる場面、考え方や人との距離の取り方、強みが行き過ぎた時の癖、周囲から誤解されやすい点を具体的に描きます。長所の羅列ではなく、相反する面がどう同居するかを説明します。\n- 指定された各質問に最初の一文で直接答えます。その後、日常で現れやすい場面、活かせる点、気をつけたい点、試せる小さな行動を順に書きます。行動案は実行可能なものにし、成功や未来を保証しません。\n- 各占術は歴史や仕組みの説明で終わらせず、算出した本人固有の要素から人物像や質問への読みを導きます。根拠となる象徴を短く示し、そこからどの解釈に至ったかをつなぎます。算出できない要素は保留し、理由と不足情報を明記します。一般論で穴埋めしません。\n- 指定された全占術をJSONとreport.mdの両方で必ず扱います。出生時刻がない場合は、出生時刻が必要な要素だけを保留し、日付や出生地から信頼できる範囲で算出できる要素はpartialとして示します。必要な入力が一部欠けているだけで体系全体をunavailableにして空配列にしないでください。根拠のある計算ができない場合は推測せず、その体系の欄を残したうえで、算出保留の理由・不足情報・何が分かれば読めるかをuncertaintiesとreport.md双方に具体的に記載します。インド系では、ジョーティッシュのラグナ／ハウス、ナクシャトラの境界判定、ダシャーの開始度数など出生時刻依存の要素と、算出できた日付ベースの要素を分けます。一般的な占術解説だけで埋めず、本人の値を出せない項目は明確に保留します。\n- systemのinterpretationは2〜4件を目安に、各件をtitleとtextを持つオブジェクトにします。textには根拠、本人らしい現れ方、活かし方または注意点を含めます。systemごとに同じ性格文を使い回さず、依存する占術は一致の根拠を割り引きます。\n- summaryにはheadline、shortに加えてportrait（人物像のまとまった文章）、strengths（活かせる資質）、watchOuts（注意点）、firstStep（今日から試せる一歩）を含めます。domainProfilesは選択された質問ごとにanswer、dailyLife、strength、caution、practiceを含めます。\n- report.mdは目次、総合人物像、強みとつまずきやすい癖、質問ごとの鑑定と行動案、占術別の根拠、体系間で重なる点と異なる点、依頼があれば時期読み、限界と読み方を含む本文にします。テーマごとに見出しを立て、段落は2〜4文程度に区切り、必要な箇所だけ箇条書きを使います。日本語でおおむね5,000〜8,000字を目安にしますが、情報不足を文章量で埋めません。\n- 文体は親しみがあり、落ち着いた鑑定士が本人に語りかける自然な日本語にします。占術用語は一度だけ平易に説明します。抽象的な美辞麗句、曖昧な励まし、同じ意味の反復、過剰な断定、恐怖をあおる予言、根拠のない決めつけで紙幅を埋めません。各段落で伝えたいことを一つに絞ります。\n- 提案は自己理解と振り返りのための選択肢として書きます。医療、法律、投資などの専門判断や人生の重大決断を占いだけで促しません。計算値・出典・個人情報は捏造しません。`;
  if(output==='markdown')return `${context}\n\n## 返答形式（コピペ版）\nこの鑑定はChatGPT上で読むためのものです。自然な日本語のMarkdown本文だけをこのチャットに直接返してください。JSON、JSONコードブロック、manifest、ZIP、画像ファイルの作成は不要です。鑑定書として、総合像・各質問への回答・占術ごとの読み・一致と矛盾・限界を見出し付きでまとめてください。`;
  return `${context}\n\n## 返答形式（ZIP版・必須契約）\n同梱のschema/result.schema.jsonを読み、Draft 2020-12 JSON Schemaに適合するresult.jsonを作成してください。このスキーマは参考ではなく厳守する契約です。全必須項目を含め、型を変えたり省いたりしないでください。\n\n最重要: systems各要素のcalculations、facts、interpretation、sourcesは必ず配列です。単一の値でもオブジェクト単体にせず、例: calculations: [{"label":"method","value":"tropical"}]。該当なしは空配列 []。inputsUsedとuncertaintiesも文字列配列です。crossAnalysisにはstrongThemes、moderateThemes、contradictions、dependencyWarningsの4配列を必ず入れてください。\n\nZIP化の前にJSONとして構文確認し、result.schema.jsonで検証して、型違反をすべて修正してください。検証できない／不一致のファイルを完成品として返さないでください。鑑定本文とresult.jsonを先に完成させ、JSON構文とschema/result.schema.jsonを検証してから画像生成へ進みます。ZIPにはresult.json、report.md、manifest.json、assets/share.pngだけを含めます。result.jsonのassets.shareImageはassets/share.png、manifest.filesには実在するその相対パスを記載します。result.jsonのassets.shareCardCopyには、完成済み鑑定から選んだtitle（短い見出し）、description（本人像または助言を含む短文）、themes（2〜3件の短いテーマ）を格納します。formatはshinra-bansho-result、versionは1.0.0です。\n\n## 画像生成ワークフロー（順序厳守）\n1. まず鑑定、result.json、report.mdを完成させます。必要な項目が揃い、result.jsonがschema/result.schema.jsonに適合したことを確認するまで画像生成を開始してはいけません。\n2. 検証済みの鑑定だけからassets.shareCardCopyを作ります。titleは短く印象的に、descriptionは人物像・具体的な助言・注意のいずれかを含む読み切れる一文に、themesは本人固有の重要テーマを2〜3件に絞ります。鑑定にない事実を足しません。\n3. shareCardCopyの全テキストを対象者の氏名・読み・別名・生年月日・出生時刻・出生地・現在地・性別・連絡先・プロフィール特定情報と照合し、個人情報やそれを推測できる表現があれば削除して安全な文に書き直します。日付、年齢、固有の場所、個人名をカード文面に入れません。安全確認後に限り、画像生成ツールを一度だけ呼び出します。\n\n## 生成する画像は完成カード1枚のみ\nassets/share.pngを画像生成ツールで実際に1枚だけ生成します。キャンバスは正確に1200×675ピクセル、横16:9。鑑定結果を読み終えた後にのみ生成し、鑑定固有の象徴・強いテーマ・情緒に合わせて、深い藍と墨、古い和紙、真鍮や金、朱を用いた細密で複雑な占術図鑑／天文装飾のある完成済みシェアカードにします。星図、軌道、占術盤、植物紋様、装飾枠、光と影を多層に組み、汎用の宇宙壁紙や空のテンプレートにしません。\n\nresult.jsonのassets.shareCardCopyにあるtitle、description、themesの日本語を**一字一句そのまま**配置してください。変数名やJSONキーをカードに印字せず、値そのものを描きます。文字は画像に焼き込み、明瞭で正確に読める日本語書体と十分なコントラストを使います。見出し・説明・テーマの階層を整え、装飾で文字を隠さないでください。これら以外の文章は描かず、対象者の氏名、日付、出生情報、所在地、性別、連絡先、個人を特定できる内容も絶対に描かないでください。実在人物の写真は使いません。鑑定書の表紙は横長3:2の固定CSSデザインを使い、AI生成しません。summary.pngは作成しません。SVG、CSS図形、Canvas、別の画像生成でカード画像を代用しません。`;
}

export async function createRequestZip(request:Request,prompt:string,now=new Date()){const zip=new JSZip();zip.file('request.json',JSON.stringify(request,null,2));zip.file('schema/request.schema.json',JSON.stringify(requestJsonSchema,null,2));zip.file('schema/result.schema.json',JSON.stringify(resultJsonSchema,null,2));zip.file('instructions.md','# 鑑定実行手順\n\nrequest.jsonを読み、指定体系について根拠と限界を分けて鑑定してください。指定された各質問へ直接回答し、一般論の水増しを避けてください。不足情報を推測で補わず、計算値・出典を捏造しないでください。依存体系を独立票として数えないこと。\n\n## 出力スキーマは必須\nschema/result.schema.jsonを読み、Draft 2020-12に適合するresult.jsonを作成します。systems内のcalculations、facts、interpretation、sourcesは一件でも配列にしてください。オブジェクト単体は禁止し、該当なしは[]とします。JSONの構文と全フィールドの型を検証してからZIP化してください。不適合JSONを返却しないでください。\n\nreport.mdには、総合像、本人らしい強みと注意点、日常での現れ方、質問ごとの具体的な回答・実行可能な助言、占術別の根拠と限界を含む読み応えのある鑑定書を書きます。まず鑑定本文とresult.jsonを完成させ、JSON構文とschema/result.schema.jsonを検証してください。検証完了前に画像生成へ進んではいけません。\n\n検証済み鑑定からassets.shareCardCopy（title、description、themes 2〜3件）を作成し、人物名・読み・別名・生年月日・出生時刻・出生地・現在地・性別・連絡先・個人特定につながる情報を含まないか照合します。安全な文面に確定した後、画像生成ツールを一度だけ使い、1200×675ピクセル・横16:9の完成済みカードをassets/share.pngとして生成します。カードにはresult.jsonのassets.shareCardCopyにある日本語の値を一字一句そのまま焼き込みます。文字なし背景やアプリによる後乗せではありません。画像内に個人情報を入れないでください。鑑定書の表紙は横長3:2の固定CSSデザインを使用し、AI生成しません。summary.pngは作成しません。manifest.filesには実在ファイルだけ（assets/share.pngを含む）を記載します。');zip.file('prompt.md',prompt);zip.file('manifest.json',JSON.stringify({format:'shinra-bansho-request',version:'1.0.0',createdAt:now.toISOString(),files:['request.json','schema/request.schema.json','schema/result.schema.json','instructions.md','prompt.md','README.md']},null,2));zip.file('README.md','# 森羅万象鑑 鑑定依頼パッケージ\n\nChatGPT等にZIPを添付し、prompt.mdとinstructions.mdに従ってください。result.jsonの形式は同梱schema/result.schema.jsonが定義します。');return zip.generateAsync({type:'blob'});}

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
