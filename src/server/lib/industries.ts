/**
 * 業種 for work history: a static two-level list (大分類 → 業種) following
 * マイナビ's industry list (job.mynavi.jp/27/pc/search/by_industry.html),
 * plus 「その他」 for self-employed / founders. Codes are stored on
 * WorkEntry.industry ("ICT" = 大分類 only, "ICT-01" = 業種); labels come from
 * here, so they can be reworded — but never renumber existing codes.
 */

export type IndustryItem = { code: string; ja: string; en: string };
export type IndustryGroup = IndustryItem & { children: IndustryItem[] };

export const twoLevelGroup = (
  code: string,
  ja: string,
  en: string,
  children: [string, string, string][],
): IndustryGroup => ({
  code,
  ja,
  en,
  children: children.map(([c, cja, cen]) => ({
    code: `${code}-${c}`,
    ja: cja,
    en: cen,
  })),
});

const g = twoLevelGroup;

export const INDUSTRIES: IndustryGroup[] = [
  g("MFR", "メーカー", "Manufacturers", [
    ["01", "農林・水産", "Agriculture, forestry & fisheries"],
    ["02", "食品", "Food"],
    ["03", "建設", "Construction"],
    ["04", "設備工事・設備設計", "Building services & equipment design"],
    ["05", "建装・ディスプレイ", "Interior fit-out & displays"],
    ["06", "建築設計", "Architectural design"],
    ["07", "建設コンサルタント", "Construction consulting"],
    ["08", "住宅", "Housing"],
    ["09", "住宅（リフォーム）", "Housing (renovation)"],
    ["10", "建材・エクステリア", "Building materials & exteriors"],
    ["11", "インテリア・住宅関連", "Interior & home products"],
    ["12", "空間デザイン", "Spatial design"],
    ["13", "アパレル（メーカー）", "Apparel (manufacturer)"],
    ["14", "繊維", "Textiles"],
    ["15", "紙・パルプ", "Paper & pulp"],
    ["16", "化学", "Chemicals"],
    ["17", "プラスチック", "Plastics"],
    ["18", "石油", "Petroleum"],
    ["19", "薬品", "Pharmaceuticals"],
    ["20", "化粧品", "Cosmetics"],
    ["21", "タイヤ・ゴム製品", "Tyres & rubber products"],
    ["22", "セメント", "Cement"],
    ["23", "ガラス・セラミックス", "Glass & ceramics"],
    ["24", "鉱業", "Mining"],
    ["25", "鉄鋼", "Steel"],
    ["26", "非鉄金属", "Non-ferrous metals"],
    ["27", "金属製品", "Metal products"],
    ["28", "機械", "Machinery"],
    ["29", "機械設計", "Mechanical design"],
    ["30", "プラント・エンジニアリング", "Plant engineering"],
    ["31", "環境・リサイクル", "Environment & recycling"],
    ["32", "総合電機", "Diversified electronics"],
    ["33", "重電・産業用電気機器", "Heavy electrical & industrial equipment"],
    ["34", "家電・AV機器", "Home appliances & AV"],
    ["35", "半導体・電子・電気機器", "Semiconductors & electronics"],
    ["36", "その他電子・電気関連", "Other electronics"],
    ["37", "コンピュータ・通信機器", "Computers & telecom equipment"],
    [
      "38",
      "輸送用機器（船舶・航空・宇宙関連など）",
      "Transport equipment (ships, aircraft, space)",
    ],
    ["39", "自動車・自動車部品", "Automobiles & auto parts"],
    ["40", "精密機器", "Precision instruments"],
    ["41", "医療用機器・医療関連", "Medical devices"],
    ["42", "印刷・印刷関連", "Printing"],
    ["43", "文具・事務機器関連", "Stationery & office equipment"],
    ["44", "日用品・生活関連機器", "Household goods"],
    [
      "45",
      "ゲーム・玩具・アミューズメント製品",
      "Games, toys & amusement products",
    ],
    [
      "46",
      "スポーツ・レジャー用品（メーカー）",
      "Sports & leisure goods (manufacturer)",
    ],
    ["47", "その他メーカー", "Other manufacturers"],
    ["48", "受託開発", "Contract development & manufacturing"],
  ]),
  g("TRD", "商社", "Trading companies", [
    ["01", "総合商社", "General trading companies"],
    ["02", "商社（複合）", "Trading (diversified)"],
    [
      "03",
      "商社（食品・農林・水産）",
      "Trading (food, agriculture & fisheries)",
    ],
    ["04", "商社（インテリア・住宅関連）", "Trading (interior & housing)"],
    ["05", "商社（建材）", "Trading (building materials)"],
    ["06", "商社（アパレル・ファッション関連）", "Trading (apparel & fashion)"],
    ["07", "商社（紙・パルプ）", "Trading (paper & pulp)"],
    [
      "08",
      "商社（化学・石油・ガス・電気）",
      "Trading (chemicals, petroleum, gas & power)",
    ],
    ["09", "商社（薬品・化粧品）", "Trading (pharmaceuticals & cosmetics)"],
    ["10", "商社（鉄鋼・金属）", "Trading (steel & metals)"],
    [
      "11",
      "商社（機械・プラント・環境）",
      "Trading (machinery, plant & environment)",
    ],
    [
      "12",
      "商社（電子・電気機器・OA機器）",
      "Trading (electronics & office equipment)",
    ],
    [
      "13",
      "商社（自動車関連・輸送用機器）",
      "Trading (automotive & transport equipment)",
    ],
    ["14", "商社（精密機器）", "Trading (precision instruments)"],
    ["15", "商社（医療機器）", "Trading (medical devices)"],
    ["16", "商社（通信）", "Trading (telecommunications)"],
    ["17", "商社（ソフトウェア）", "Trading (software)"],
    [
      "18",
      "商社（文具・事務用品・日用品）",
      "Trading (stationery, office & household goods)",
    ],
    ["19", "商社（出版）", "Trading (publishing)"],
    [
      "20",
      "商社（スポーツ・レジャー用品）",
      "Trading (sports & leisure goods)",
    ],
    ["21", "商社（教育関連）", "Trading (education)"],
    ["22", "商社（グループ）", "Trading (group company)"],
    ["23", "商社（その他製品）", "Trading (other products)"],
    ["24", "通販・ネット販売", "Mail order & online retail"],
  ]),
  g("RTL", "流通・小売", "Distribution & retail", [
    ["01", "百貨店", "Department stores"],
    ["02", "スーパーマーケット", "Supermarkets"],
    ["03", "コンビニエンスストア", "Convenience stores"],
    ["04", "ホームセンター", "Home centres"],
    ["05", "生活協同組合", "Consumer co-operatives"],
    ["06", "ドラッグストア", "Drugstores"],
    ["07", "専門店（複合）", "Specialty stores (diversified)"],
    [
      "08",
      "専門店（家電・通信・OA機器）",
      "Specialty stores (electronics & mobile)",
    ],
    [
      "09",
      "専門店（メガネ・貴金属・ジュエリー）",
      "Specialty stores (eyewear & jewellery)",
    ],
    ["10", "専門店（食品・日用品）", "Specialty stores (food & household)"],
    [
      "11",
      "専門店（アパレル・ファッション関連）",
      "Specialty stores (apparel & fashion)",
    ],
    [
      "12",
      "専門店（自動車販売・自動車関連）",
      "Specialty stores (car dealers & automotive)",
    ],
    [
      "13",
      "専門店（書籍・音楽・インテリア）",
      "Specialty stores (books, music & interior)",
    ],
    [
      "14",
      "専門店（スポーツ・レジャー関連）",
      "Specialty stores (sports & leisure)",
    ],
    ["15", "専門店（ホビー・ペット関連）", "Specialty stores (hobby & pets)"],
    ["16", "専門店（その他小売）", "Specialty stores (other retail)"],
  ]),
  g("FIN", "金融", "Finance", [
    [
      "01",
      "政府系・系統金融機関",
      "Government & cooperative financial institutions",
    ],
    ["02", "金融総合グループ", "Financial groups"],
    ["03", "銀行（都銀）", "Banks (city banks)"],
    ["04", "銀行（地銀）", "Banks (regional banks)"],
    ["05", "銀行（ネットバンク・その他）", "Banks (online & other)"],
    [
      "06",
      "信託銀行・投資銀行・投資信託委託",
      "Trust banks, investment banks & asset management",
    ],
    ["07", "証券", "Securities"],
    ["08", "信用金庫・労働金庫・信用組合", "Credit unions & shinkin banks"],
    ["09", "外資系金融", "Foreign financial institutions"],
    ["10", "クレジット・信販", "Credit cards & consumer credit"],
    ["11", "共済", "Mutual aid (kyosai)"],
    ["12", "リース・レンタル", "Leasing & rental"],
    ["13", "消費者金融", "Consumer finance"],
    ["14", "商品取引", "Commodity trading"],
    ["15", "その他金融", "Other finance"],
    ["16", "損害保険", "Non-life insurance"],
    ["17", "生命保険", "Life insurance"],
  ]),
  g("SVC", "サービス・インフラ", "Services & infrastructure", [
    ["01", "不動産", "Real estate"],
    ["02", "不動産（管理）", "Real estate (property management)"],
    ["03", "鉄道", "Railways"],
    ["04", "鉄道サービス", "Railway services"],
    ["05", "空輸", "Airlines & air freight"],
    ["06", "空港サービス", "Airport services"],
    ["07", "道路管理", "Road management"],
    [
      "08",
      "陸運（貨物・バス・タクシー）",
      "Land transport (freight, bus & taxi)",
    ],
    ["09", "海運", "Shipping"],
    ["10", "物流・倉庫", "Logistics & warehousing"],
    ["11", "電力", "Electric power"],
    ["12", "ガス・エネルギー", "Gas & energy"],
    ["13", "外食・レストラン", "Restaurants & food service"],
    ["14", "給食・デリカ・フードビジネス", "Catering, delis & food business"],
    ["15", "ホテル・旅館", "Hotels & ryokan"],
    ["16", "旅行・観光", "Travel & tourism"],
    ["17", "調剤薬局", "Dispensing pharmacies"],
    ["18", "医療機関", "Medical institutions"],
    ["19", "福祉サービス", "Welfare services"],
    ["20", "フィットネスクラブ", "Fitness clubs"],
    ["21", "エステティック・美容・理容", "Beauty salons & barbers"],
    ["22", "マッサージ・整体・鍼灸", "Massage, chiropractic & acupuncture"],
    ["23", "レジャーサービス", "Leisure services"],
    ["24", "アミューズメント", "Amusement"],
    ["25", "冠婚葬祭", "Weddings & funerals"],
    ["26", "ビル施設管理・メンテナンス", "Building management & maintenance"],
    ["27", "セキュリティ", "Security"],
    ["28", "芸術関連", "Arts"],
    ["29", "各種ビジネスサービス・BPO", "Business services & BPO"],
    ["30", "試験・分析・測定", "Testing, analysis & measurement"],
    ["31", "フォトサービス", "Photo services"],
    ["32", "クリーニング", "Cleaning & laundry"],
    ["33", "イベント・興行", "Events & entertainment production"],
    ["34", "検査・整備・メンテナンス", "Inspection & maintenance"],
    ["35", "サービス（その他）", "Other services"],
    [
      "36",
      "シンクタンク・マーケティング・調査",
      "Think tanks, marketing & research",
    ],
    ["37", "専門コンサルティング", "Specialist consulting"],
    ["38", "コンサルティングファーム", "Consulting firms"],
    ["39", "人材派遣・人材紹介", "Staffing & recruitment"],
    ["40", "教育", "Education"],
    ["41", "学校法人", "Schools & universities"],
    ["42", "幼稚園・保育園", "Kindergartens & nurseries"],
  ]),
  g("ICT", "ソフトウエア・通信", "Software & telecommunications", [
    ["01", "ソフトウエア", "Software"],
    ["02", "情報処理", "Information processing & IT services"],
    ["03", "インターネット関連", "Internet"],
    ["04", "ゲームソフト", "Game software"],
    ["05", "通信・インフラ", "Telecommunications & infrastructure"],
    ["06", "ニュース・データ通信", "News & data services"],
  ]),
  g("MED", "広告・出版・マスコミ", "Advertising, publishing & media", [
    ["01", "放送", "Broadcasting"],
    ["02", "新聞", "Newspapers"],
    ["03", "出版", "Publishing"],
    ["04", "広告", "Advertising"],
    ["05", "広告制作・Web制作", "Ad & web production"],
    ["06", "芸能・映画・音楽", "Entertainment, film & music"],
  ]),
  g("GOV", "官公庁・公社・団体", "Government & public organisations", [
    [
      "01",
      "農業協同組合（JA金融機関含む）",
      "Agricultural co-operatives (incl. JA banks)",
    ],
    [
      "02",
      "公益・特殊・独立行政法人",
      "Public-interest & independent administrative corporations",
    ],
    ["03", "官公庁・警察・消防", "Government offices, police & fire"],
    [
      "04",
      "財団・社団・その他団体",
      "Foundations, associations & other organisations",
    ],
  ]),
  g("OTH", "その他", "Other", [
    ["01", "自営業・フリーランス", "Self-employed & freelance"],
    ["02", "起業・スタートアップ", "Founder / startup"],
    ["03", "その他", "Other"],
  ]),
];

/** Lookups for a two-level list (業種, 職種). */
export function twoLevelLookup(list: IndustryGroup[]) {
  const byCode = new Map<
    string,
    { group: IndustryGroup; item: IndustryItem }
  >();
  for (const group of list) {
    byCode.set(group.code, { group, item: group });
    for (const item of group.children) byCode.set(item.code, { group, item });
  }
  return {
    isCode: (code: string) => byCode.has(code),
    /** The 大分類 code of a stored code ("ICT-01" → "ICT"). */
    groupOf: (code: string | null | undefined) =>
      code ? (byCode.get(code)?.group.code ?? "") : "",
    /** "大分類 › 詳細" (or just the 大分類), null if unknown. */
    label: (code: string | null | undefined, locale: "ja" | "en") => {
      const hit = code ? byCode.get(code) : undefined;
      if (!hit) return null;
      const name = (x: IndustryItem) => (locale === "en" ? x.en : x.ja);
      return hit.item === hit.group
        ? name(hit.group)
        : `${name(hit.group)} › ${name(hit.item)}`;
    },
  };
}

const industries = twoLevelLookup(INDUSTRIES);
export const isIndustryCode = industries.isCode;
export const industryGroupOf = industries.groupOf;
export const industryLabel = industries.label;
