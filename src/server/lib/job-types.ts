import {
  twoLevelGroup as g,
  type IndustryGroup,
  twoLevelLookup,
} from "@/server/lib/industries";

/**
 * 職種 for work history: a static two-level list (大分類 → 職種) in the
 * style of Japanese job sites, plus 「その他」. Codes are stored on
 * WorkEntry.jobType ("IT" = 大分類 only, "IT-01" = 職種); never renumber.
 */
export const JOB_TYPES: IndustryGroup[] = [
  g("SAL", "営業系", "Sales", [
    ["01", "法人営業", "Corporate sales"],
    ["02", "個人営業", "Consumer sales"],
    ["03", "海外営業", "International sales"],
    ["04", "ルートセールス", "Account management"],
    ["05", "MR・医療営業", "Medical representative"],
    ["06", "カスタマーサクセス", "Customer success"],
  ]),
  g("PLN", "企画・マーケティング系", "Planning & marketing", [
    ["01", "経営企画・事業企画", "Corporate & business planning"],
    ["02", "商品企画・開発", "Product planning & development"],
    ["03", "マーケティング", "Marketing"],
    ["04", "広報・PR", "Public relations"],
    ["05", "宣伝・広告", "Advertising & promotion"],
  ]),
  g("ADM", "事務・管理系", "Office & administration", [
    ["01", "総務", "General affairs"],
    ["02", "人事・採用", "Human resources & recruiting"],
    ["03", "経理・財務", "Accounting & finance"],
    ["04", "法務・知財", "Legal & IP"],
    ["05", "一般事務・営業事務", "Office & sales administration"],
    ["06", "秘書・受付", "Secretary & reception"],
    ["07", "購買・物流管理", "Purchasing & logistics"],
  ]),
  g("SRV", "販売・サービス系", "Retail & service", [
    ["01", "販売・店舗スタッフ", "Sales & store staff"],
    ["02", "店長・店舗運営", "Store management"],
    ["03", "接客・ホテル・ブライダル", "Hospitality, hotels & weddings"],
    ["04", "飲食・調理", "Food service & cooking"],
    ["05", "旅行・航空・交通サービス", "Travel, airline & transport services"],
    ["06", "美容・エステ", "Beauty & esthetics"],
  ]),
  g("IT", "IT・Web系", "IT & web", [
    ["01", "システムエンジニア", "Systems engineer"],
    [
      "02",
      "プログラマー・ソフトウェア開発",
      "Programmer & software development",
    ],
    ["03", "Webエンジニア", "Web engineer"],
    [
      "04",
      "インフラ・ネットワーク・クラウド",
      "Infrastructure, network & cloud",
    ],
    ["05", "データサイエンス・AI", "Data science & AI"],
    ["06", "ITコンサルタント", "IT consultant"],
    ["07", "社内SE・情報システム", "In-house IT"],
    ["08", "プロダクトマネージャー", "Product manager"],
  ]),
  g(
    "ENG",
    "技術系（電気・機械・化学）",
    "Engineering (electrical, mechanical & chemical)",
    [
      ["01", "研究・開発", "Research & development"],
      ["02", "設計（機械・電気・電子）", "Design (mechanical & electrical)"],
      ["03", "生産技術・製造", "Production engineering & manufacturing"],
      ["04", "品質管理・品質保証", "Quality control & assurance"],
      ["05", "化学・素材・バイオ", "Chemistry, materials & biotech"],
      ["06", "フィールドエンジニア・保守", "Field engineering & maintenance"],
    ],
  ),
  g("CON", "技術系（建築・土木）", "Engineering (architecture & civil)", [
    ["01", "建築設計", "Architectural design"],
    ["02", "施工管理", "Construction management"],
    ["03", "土木設計", "Civil engineering design"],
    ["04", "設備設計", "Building services design"],
    ["05", "測量・調査", "Surveying"],
  ]),
  g("MED", "専門職（医療・福祉）", "Professional (medical & welfare)", [
    ["01", "医師・歯科医師", "Doctor & dentist"],
    ["02", "看護師・助産師", "Nurse & midwife"],
    ["03", "薬剤師", "Pharmacist"],
    ["04", "医療技術・リハビリ", "Medical technology & rehabilitation"],
    ["05", "介護・福祉", "Nursing care & welfare"],
    ["06", "保育士", "Childcare worker"],
  ]),
  g(
    "PRO",
    "専門職（金融・コンサル・法律）",
    "Professional (finance, consulting & law)",
    [
      ["01", "コンサルタント", "Consultant"],
      [
        "02",
        "金融専門職（アナリスト・ディーラーなど）",
        "Finance specialist (analyst, trader…)",
      ],
      ["03", "弁護士・司法書士", "Lawyer & judicial scrivener"],
      ["04", "公認会計士・税理士", "CPA & tax accountant"],
      ["05", "不動産専門職", "Real estate specialist"],
      ["06", "研究員・シンクタンク", "Researcher & think tank"],
    ],
  ),
  g("CRE", "クリエイティブ系", "Creative", [
    ["01", "デザイナー（Web・グラフィック）", "Designer (web & graphic)"],
    ["02", "UI・UXデザイナー", "UI/UX designer"],
    ["03", "編集・ライター", "Editor & writer"],
    ["04", "映像・音楽制作", "Video & music production"],
    ["05", "ゲーム制作", "Game development"],
    ["06", "アート・ファッション", "Art & fashion"],
  ]),
  g("EDU", "教育・公務系", "Education & public service", [
    ["01", "教員・講師", "Teacher & lecturer"],
    ["02", "インターナショナルスクール教員", "International school teacher"],
    ["03", "学校職員・大学職員", "School & university staff"],
    ["04", "公務員", "Public servant"],
    ["05", "国際機関・外交", "International organisations & diplomacy"],
    ["06", "NPO・団体職員", "NPO & association staff"],
  ]),
  g("OTH", "その他", "Other", [
    ["01", "経営者・役員", "Executive & business owner"],
    ["02", "自営業・フリーランス", "Self-employed & freelance"],
    ["03", "学生・研究", "Student & research"],
    ["04", "その他", "Other"],
  ]),
];

const jobTypes = twoLevelLookup(JOB_TYPES);
export const isJobTypeCode = jobTypes.isCode;
export const jobTypeLabel = jobTypes.label;
