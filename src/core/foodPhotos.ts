import type { Product } from './types';

export const FOOD_PHOTOS = [
  'Jajecznica', 'Omlet', 'Jajko sadzone', 'Jajko na twardo', 'Surowe jajka', 'Owsianka', 'Płatki owsiane', 'Jogurt naturalny',
  'Serek wiejski', 'Ser żółty', 'Mleko', 'Masło', 'Chleb', 'Bułka', 'Pancakes', 'Naleśniki',
  'Ryż suchy', 'Ryż ugotowany', 'Makaron suchy', 'Makaron ugotowany', 'Kurczak surowy', 'Kurczak pieczony', 'Wołowina surowa', 'Wołowina po obróbce',
  'Wieprzowina surowa', 'Wieprzowina po obróbce', 'Łosoś surowy', 'Łosoś po obróbce', 'Biała ryba surowa', 'Biała ryba po obróbce', 'Tofu', 'Soczewica',
  'Ziemniaki', 'Frytki', 'Brokuł', 'Marchew', 'Pomidor', 'Ogórek', 'Sałata', 'Pieczarki',
  'Jabłko', 'Banan', 'Truskawki', 'Borówki', 'Pomarańcza', 'Winogrona', 'Awokado', 'Gruszka',
  'Migdały', 'Orzechy włoskie', 'Masło orzechowe', 'Oliwa', 'Cukier', 'Mąka', 'Czekolada', 'Herbatniki',
  'Zupa jarzynowa', 'Pizza serowa', 'Hamburger', 'Kanapka z serem', 'Kawa czarna', 'Herbata', 'Woda', 'Sok pomarańczowy',
  'Jagnięcina surowa','Jagnięcina pieczona','Cielęcina surowa','Cielęcina po obróbce','Indyk surowy','Indyk pieczony','Wołowina mielona surowa','Kotlet wołowy',
  'Szynka','Bekon surowy','Bekon smażony','Kiełbasa wędzona','Parówki','Wątróbka surowa','Wątróbka drobiowa smażona','Klopsiki',
  'Tuńczyk w kawałkach','Sardynki z puszki','Krewetki','Małże','Fasola czerwona gotowana','Groszek zielony','Hummus','Ciecierzyca gotowana',
  'Płatki kukurydziane','Musli','Kukurydza','Popcorn','Krakersy','Precle','Orzeszki ziemne','Nerkowce',
  'Pistacje','Pestki słonecznika','Pestki dyni','Sezam','Rodzynki','Daktyle','Morele suszone','Brzoskwinia',
  'Ananas','Kiwi','Cytryna','Maliny','Arbuz','Cebula','Kapusta','Papryka czerwona',
  'Szpinak','Fasolka szparagowa','Buraki','Dynia','Batat','Ziemniaki gotowane','Puree ziemniaczane','Zupa pomidorowa',
  'Zupa z kurczakiem i makaronem','Gulasz wołowy','Makaron z sosem pomidorowym','Kurczak z ryżem','Lody waniliowe','Ciasto czekoladowe','Brownie','Muffin z borówkami',
  'Twaróg','Skyr naturalny','Ryż brązowy suchy','Ryż brązowy ugotowany','Gofr','Kefir','Śmietana','Kasza manna na mleku','Pierogi','Ogórki kiszone','Owsianka z bananem','Kawa z mlekiem','Wafle ryżowe','Płatki otrębowe',
] as const;

export function referenceTile(index:number) {
  if(index<128)return {src:index<64?'/images/food-reference-atlas.png':'/images/food-reference-atlas-2.png',x:index%8*156.75,y:Math.floor(index%64/8)*156.75,size:156.75};
  // The two buckwheat cells were rejected during visual review.
  const cell=[0,1,2,3,4,7,8,9,10,11,12,13,14,15][index-128];
  return {src:'/images/food-reference-atlas-3.png',x:cell%4*313.5,y:Math.floor(cell/4)*313.5,size:313.5};
}

export function validPhotoKey(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < FOOD_PHOTOS.length;
}

export function safeProductPhoto(url: unknown, code: string): string | undefined {
  if (typeof url !== 'string' || url.length > 350 || !/^\d{8,14}$/.test(code)) return;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== 'images.openfoodfacts.org' || u.username || u.password || u.port || u.search || u.hash) return;
    const match = u.pathname.match(/^\/images\/products\/([\d/]+)\/front_[a-z]{2}\.\d+\.(?:100|200|400)\.jpg$/);
    if (match?.[1].replaceAll('/', '').padStart(14, '0') === code.padStart(14, '0')) return u.href;
  } catch { /* No arbitrary image hosts or executable URLs. */ }
}

// Source descriptions identify the food itself. A contained ingredient is not
// enough to select a picture (e.g. chicken soup must not become a raw breast).
export function referencePhoto(p: Pick<Product, 'name' | 'originalName' | 'barcode' | 'photoKey'>): number[] {
  if (validPhotoKey(p.photoKey)) return [p.photoKey];
  if (p.barcode) return [];
  const full = (p.originalName || p.name).toLocaleLowerCase('pl');
  const head = full.split(/,| · /)[0].trim();
  const cooked = /cooked|roasted|grilled|braised|broiled|fried|pieczon|gotowan|smażon/.test(full);
  if(/^twaróg(?: chudy| półtłusty| tłusty)?$/.test(head))return[128];
  if(/^skyr naturalny$/.test(head))return[129];
  if(/^rice$|^ryż brązowy$/.test(head)&&/brown|brązow/.test(full)&&!/with |pudding|cake|flour| z /.test(full))return[cooked?131:130];
  if(/^waffles?$|^gofr$/.test(head)&&!/with |chocolat|fruit|z |czekol|owoc/.test(full))return[132];
  if(/^kefir$/.test(head)&&!/flavor|fruit|owoc/.test(full))return[133];
  if(/^cream$|^śmietana$/.test(head)&&/sour|śmietana/.test(full))return[134];
  if(/^kasza manna na mleku$/.test(head))return[135];
  if(/^pierogi$/.test(head))return[136];
  if(/^ogórki kiszone$/.test(head))return[137];
  if(/^owsianka z bananem$/.test(head))return[138];
  if(/^kawa z mlekiem$/.test(head))return[139];
  if(/^wafle ryżowe$|^rice cakes?$/.test(head)&&!/chocolat|czekol/.test(full))return[140];
  if(/^płatki otrębowe$/.test(head))return[141];
  const extra = extraPhoto(full,head,cooked);if(extra.length)return extra;
  if (/egg omelet or scrambled/.test(head) || /^jajecznica lub omlet/.test(head)) return [0,1];
  if (/^(?:egg|eggs|jajko|jajka)$/.test(head)) {
    if (/scrambled|jajecznic/.test(full) && !/frozen mixture/.test(full)) return [0];
    if (/omelet|omlet/.test(full)) return [1];
    if (/fried|sadzone/.test(full)) return [2];
    if (/hard.boiled|twardo/.test(full)) return [3];
    if (/raw|surow/.test(full) || full === 'jajko') return [4];
    return [];
  }
  if (/^jajecznica$/.test(head)) return [0];
  if (/^omlet$/.test(head)) return [1];
  if (/^oatmeal$|^owsianka$/.test(head)) return [5];
  if (/^oats$|^płatki owsiane$/.test(head)) return [6];
  if (/^yogurt$|^jogurt(?: naturalny)?$/.test(head) && !/fruit|flavor|vanilla|chocolat|strawberr|owoc|wanili|czekol|truskaw/.test(full)) return [7];
  if (/^(?:cheese|serek wiejski)/.test(head) && /cottage|wiejski/.test(full)) return [8];
  if (/^cheese$|^ser żółty$/.test(head) && /cheddar|swiss|gouda|edam|żółty/.test(full)) return [9];
  if (/^milk$|^mleko(?: \d.*)?$/.test(head) && !/dried|powder|condensed|chocolate|infant|prosz|czekol|skondens/.test(full)) return [10];
  if (/^butter$|^masło$/.test(head)) return [11];
  if (/^bread$|^chleb(?: żytni| pszenny)?$/.test(head)) return [12];
  if (/^rolls?$|^bułka$/.test(head)) return [13];
  if (/^pancakes?$|^pancakes$/.test(head)) return [14];
  if (/^crepes?$|^naleśniki$/.test(head)) return [15];
  if (/^rice$|^ryż(?: biały)?$/.test(head) && !/with |pudding|cake|flour|z |mąka|brown|wild|brązow|dziki/.test(full)) return [cooked ? 17 : 16];
  if (/^pasta$|^macaroni$|^spaghetti$|^makaron$/.test(head) && !/with |sauce|z |sos/.test(full)) return [cooked ? 19 : 18];
  if (/^chicken$|^pierś z kurczaka$/.test(head) && !/liver|heart|giblet|canned|nugget|skin only|ground|sausage/.test(full)) return [cooked ? 21 : 20];
  if (/^beef$|^wołowina$/.test(head) && !/variety|liver|kidney|heart|tongue|ground|canned|sausage|jerky|brain|tripe/.test(full)) return [cooked ? 23 : 22];
  if (/^pork$|^wieprzowina$/.test(head) && !/variety|liver|kidney|heart|tongue|ground|canned|sausage|bacon|ham|skin|jowl|tail|feet/.test(full)) return [cooked ? 25 : 24];
  if (/^(?:fish|salmon|łosoś)/.test(head) && /salmon|łosoś/.test(full) && !/canned|smoked|konserw|wędzon/.test(full)) return [cooked ? 27 : 26];
  if (/^(?:fish|dorsz|haddock|pollock)/.test(head) && /cod|haddock|pollock|dorsz/.test(full) && !/smoked|canned|breaded|soup/.test(full)) return [cooked ? 29 : 28];
  if (/^tofu$/.test(head)) return [30];
  if (/^lentils$|^soczewica$/.test(head) && cooked) return [31];
  if (/^potatoes$|^ziemniaki$/.test(head) && /french|fryt/.test(full)) return [33];
  if (/^potatoes$|^ziemniaki$/.test(head) && !cooked && !/flour|chips|dehydrated|pancake/.test(full)) return [32];
  if (/^broccoli$|^brokuł$/.test(head)) return [34];
  if (/^carrots?$|^marchew$/.test(head)) return [35];
  if (/^tomatoes$|^pomidor$/.test(head) && !/sauce|paste|juice|soup/.test(full)) return [36];
  if (/^cucumbers?$|^ogórek$/.test(head) && !/pickl/.test(full)) return [37];
  if (/^lettuce$|^sałata$/.test(head)) return [38];
  if (/^mushrooms$|^pieczarki$/.test(head) && !/dried|canned/.test(full)) return [39];
  const fruit = [[/^apples?$|^jabłko$/,40],[/^bananas?$|^banan$/,41],[/^strawberries$|^truskawki$/,42],[/^blueberries$|^borówki$/,43],[/^oranges$|^pomarańcza$/,44],[/^grapes$|^winogrona$/,45],[/^avocados$|^awokado$/,46],[/^pears$|^gruszka$/,47]] as const;
  for (const [pattern,key] of fruit) if (pattern.test(head) && !/juice|dried|canned|sauce|pie|sok|suszon|kompot|dżem/.test(full)) return [key];
  if (/^nuts$|^almonds$|^migdały$/.test(head) && /almond|migdał/.test(full) && !/butter|oil|flour/.test(full)) return [48];
  if (/^nuts$|^walnuts$|^orzechy włoskie$/.test(head) && /walnut|włoskie/.test(full) && !/oil/.test(full)) return [49];
  if (/^peanut butter$|^masło orzechowe$/.test(head)) return [50];
  if (/^oil$|^oliwa z oliwek$/.test(head) && /olive|oliw/.test(full)) return [51];
  if (/^sugars$|^cukier$/.test(head) && !/brown|powder/.test(full)) return [52];
  if (/^wheat flour$|^mąka pszenna$/.test(head)) return [53];
  if (/^chocolate$|^czekolada$/.test(head) && /dark|gorzk/.test(full)) return [54];
  if (/^cookies$|^herbatniki$/.test(head) && /plain|tea|herbat/.test(full)) return [55];
  if (/^soup$|^zupa jarzynowa$/.test(head) && /vegetable|jarzyn/.test(full) && !/cream|dry|condensed/.test(full)) return [56];
  if (/^pizza$/.test(head) && /cheese|ser/.test(full) && !/pepperoni|meat|sausage/.test(full)) return [57];
  if (/^hamburger$/.test(head)) return [58];
  if (/^cheese sandwich$|^kanapka z serem$/.test(head)) return [59];
  if (/^coffee$|^kawa$/.test(head) && !/milk|sugar|powder|instant.*dry|mleko|cuk/.test(full)) return [60];
  if (/^tea$|^herbata$/.test(head) && !/dry|sugar|powder|such|cuk/.test(full)) return [61];
  if (/^water$|^woda$/.test(head)) return [62];
  if (/^orange juice$|^sok pomarańczowy$/.test(head) && !/frozen|concentrate|mroż|koncentrat/.test(full)) return [63];
  return [];
}

function extraPhoto(full:string,head:string,cooked:boolean):number[]{
  const meat=/variety|liver|kidney|heart|tongue|brain|tripe|fat only|separable fat|ground|sausage|canned|processed/.test(full);
  if(/^lamb$/.test(head)&&!meat)return[cooked?65:64];
  if(/^veal$/.test(head)&&!meat)return[cooked?67:66];
  if(/^turkey$/.test(head)&&!meat&&!/skin only|leg|thigh|wing|neck/.test(full))return[cooked?69:68];
  if(/^beef$/.test(head)&&/ground/.test(full)){if(!cooked)return[70];if(/patty|patties/.test(full))return[71];return[];}
  if((/^pork$/.test(head)&&/ham/.test(full)&&/cured|smoked|canned/.test(full))||(/^ham$/.test(head)&&!full.includes('raw')))return[72];
  if(/^(?:pork|bacon)$/.test(head)&&/bacon/.test(full))return[cooked?74:73];
  if(/^(?:sausage|sausages|kiełbasa)$/.test(head)&&/smoked|wędzon/.test(full))return[75];
  if(/^frankfurter|^parówk/.test(head))return[76];
  if(/^(?:beef|pork|chicken|lamb|veal|wątróbka)$/.test(head)&&/liver|wątrób/.test(full)&&!cooked)return[77];
  if(/^chicken$/.test(head)&&/liver/.test(full)&&cooked)return[78];
  if(/^meatballs$|^klopsiki$/.test(head)&&!full.includes('sauce'))return[79];
  if(/^fish$/.test(head)&&/tuna/.test(full)&&/canned/.test(full))return[80];
  if(/^fish$/.test(head)&&/sardine/.test(full)&&/canned/.test(full))return[81];
  if(/^crustaceans$|^shrimp$/.test(head)&&/shrimp/.test(full)&&cooked)return[82];
  if(/^mollusks$|^mussels$/.test(head)&&/mussel/.test(full)&&cooked)return[83];
  if(/^beans$/.test(head)&&/kidney|red/.test(full)&&cooked)return[84];
  if(/^peas$|^groszek/.test(head)&&/green|zielon/.test(full)&&!full.includes('dry'))return[85];
  if(/^hummus/.test(head))return[86];
  if(/^chickpeas/.test(head)&&cooked)return[87];
  if(/^cereals ready.to.eat$|^cereal$/.test(head)&&/corn.*flakes|cornflakes/.test(full))return[88];
  if(/^cereals|^muesli|^musli/.test(head)&&/muesli|musli/.test(full))return[89];
  if(/^corn$|^kukurydza$/.test(head)&&!/(?:flour|meal|oil|starch|flakes|bran)/.test(full))return[90];
  if(/^popcorn$|^snacks$/.test(head)&&/popcorn/.test(full))return[91];
  if(/^crackers$|^krakersy$/.test(head)&&!full.includes('cheese'))return[92];
  if(/^pretzels$|^snacks$/.test(head)&&/pretzel/.test(full))return[93];
  if(/^peanuts$|^nuts$/.test(head)&&/peanut/.test(full)&&!/(?:butter|oil|flour)/.test(full))return[94];
  if(/^nuts$/.test(head)&&/cashew/.test(full))return[95];
  if(/^nuts$/.test(head)&&/pistachio/.test(full))return[96];
  if(/^seeds$/.test(head)&&/sunflower/.test(full))return[97];
  if(/^seeds$/.test(head)&&/pumpkin/.test(full))return[98];
  if(/^seeds$/.test(head)&&/sesame/.test(full))return[99];
  const fruits=[[/^raisins$|^rodzynki$/,100],[/^dates$|^daktyle$/,101],[/^peaches$|^brzoskwinia$/,103],[/^pineapple$|^ananas$/,104],[/^kiwifruit|^kiwi$/,105],[/^lemons$|^cytryna$/,106],[/^raspberries$|^maliny$/,107],[/^watermelon$|^arbuz$/,108]] as const;
  for(const [pattern,key]of fruits)if(pattern.test(head)&&!/juice|canned|dried|sauce/.test(full))return[key];
  if(/^apricots$/.test(head)&&/dried/.test(full))return[102];
  const veg=[[/^onions?$|^cebula$/,109],[/^cabbage$|^kapusta$/,110],[/^peppers$|^papryka$|^sweet pepper$/.test(head)&&/red|czerwon/.test(full)?/.*/:/^never$/,111],[/^spinach$|^szpinak$/,112],[/^beets$|^buraki$/,114],[/^pumpkin$|^dynia$/,115],[/^sweet potato|^batat$/,116]] as const;
  for(const [pattern,key]of veg)if(pattern.test(head)&&!cooked&&!/dehydrated|dried|frozen|canned/.test(full))return[key];
  if(/^beans$/.test(head)&&/snap|green/.test(full)&&!full.includes('dry'))return[113];
  if(/^potato(?:es)?$|^ziemniaki$/.test(head)&&/mashed|puree/.test(full)&&!full.includes('dehydrated'))return[118];
  if(/^potato(?:es)?$|^ziemniaki$/.test(head)&&/boiled|gotowan/.test(full))return[117];
  if(/^soup$/.test(head)&&/tomato/.test(full)&&!/dry|condensed|cream/.test(full))return[119];
  if(/^soup$|^chicken noodle soup$/.test(head)&&/chicken noodle/.test(full)&&!/dry|condensed|cream/.test(full))return[120];
  if(/^beef stew/.test(head))return[121];
  if(/^pasta|^spaghetti|^macaroni/.test(head)&&/tomato sauce/.test(full)&&!/meat|beef|chicken/.test(full))return[122];
  if(/^chicken|^rice/.test(head)&&/with rice|with chicken/.test(full)&&!/soup|fried|sauce/.test(full))return[123];
  if(/^ice creams?$/.test(head)&&/vanilla/.test(full)&&!/chocolate|cookie|sandwich/.test(full))return[124];
  if(/^cake$/.test(head)&&/chocolate/.test(full))return[125];
  if(/^brownies?$/.test(head))return[126];
  if(/^muffins?$/.test(head)&&/blueberry/.test(full))return[127];
  return[];
}
