// Speech substitutions affect words only; catalog sizes and prices are never guessed.
const standardWords: Record<string, string[]> = {
  dkos: ["дкос", "дкоз", "декос", "декоз", "дэ кос", "дэ коз", "де кос", "де коз", "дэ ка о эс", "д к о с", "ди кей о эс"],
  dkol: ["дкол", "дколь", "декол", "деколь", "дэ кол", "де кол", "дэ ка о эл", "д к о л", "ди кей о эл"],
  dkfw: ["дкфв", "дкф в", "дкф-в", "дэ ка эф вэ", "ди кей эф дабл ю", "dkf-w"],
  dk: ["дк", "дэ ка", "де ка", "д ка", "д к", "ди кей"],
  bsp: ["бсп", "бэ эс пэ", "би эс пи", "бспи", "бспэ"],
  jic: ["джик", "джи ай си", "джи ай с", "жик", "джикс"],
  jis: ["джис", "джи ай эс", "жис"],
  orfs: ["орфс", "орфэс", "о эр эф эс", "ор эф эс"],
  nptf: ["нптф", "эн пи ти эф", "эн пэ тэ эф", "нпт эф"],
  banjo: ["банджо", "банжо", "банджи"],
  sf: ["сф", "эс эф", "эсф"],
  uaz: ["уаз", "у аз"],
};
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words: Record<string, number> = {
  ноль:0, нуль:0, один:1, одна:1, одно:1, одну:1, два:2, две:2,
  три:3, четыре:4, пять:5, шесть:6, семь:7, восемь:8, девять:9, полтора:1.5, полторы:1.5,
  десять:10, одиннадцать:11, двенадцать:12, тринадцать:13, четырнадцать:14,
  пятнадцать:15, шестнадцать:16, семнадцать:17, восемнадцать:18, девятнадцать:19,
  двадцать:20, тридцать:30, сорок:40, пятьдесят:50, шестьдесят:60,
  семьдесят:70, восемьдесят:80, девяносто:90, сто:100, двести:200,
  триста:300, четыреста:400, пятьсот:500, шестьсот:600, семьсот:700,
  восемьсот:800, девятьсот:900,
};
function numberWords(text: string): string {
  const tokens = text.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    if (!(tokens[i] in words)) continue;
    let value = words[tokens[i]];
    let last = value;
    let j = i + 2;
    while (j < tokens.length && /^\s+$/.test(tokens[j-1]) && tokens[j] in words) {
      const next = words[tokens[j]];
      if (!((last >= 100 && next > 0 && next < 100) || (last >= 20 && last < 100 && next > 0 && next < 10))) break;
      value += next; last = next;
      tokens[j-1] = ""; tokens[j] = ""; j += 2;
    }
    tokens[i] = String(value);
  }
  return tokens.join("");
}
function distance(a: string, b: string): number {
  let row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i+1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j]+1, row[j+1]+1, row[j]+(a[i] === b[j] ? 0 : 1)));
    row = next;
  }
  return row[b.length];
}
export function normalizeSpeech(value: string): string {
  let text = value.toLowerCase().replace(/ё/g,"е").replace(/[–—]/g,"-");
  text = text.replace(/(?:полдюйма|полдюймовый|половина дюйма)/gu, '1/2"');
  const aliases = Object.entries(standardWords).flatMap(([key,list]) => list.map(alias => ({key,alias})))
    .sort((a,b) => b.alias.length-a.alias.length);
  for (const {key,alias} of aliases) {
    const pattern = escapeRegex(alias).replace(/\s+/g, "\\s*");
    text = text.replace(new RegExp("(^|[^\\p{L}])"+pattern+"(?=$|[^\\p{L}])","gu"), (_,before) => before+key);
  }
  // One-letter typos are accepted only beside a thread size and only with a unique standard.
  text = text.replace(/([а-яa-z]{4,})\s*(?=\d+(?:[.,]\d+)?\s*(?:на|[xх×*]))/gu, (word) => {
    if (word.trim() in standardWords) return word;
    const token = word.trim();
    const matches = Object.entries(standardWords).filter(([key,list]) =>
      [key,...list.filter(alias => !alias.includes(" ") && alias.length >= 4)].some(alias => distance(token,alias) <= 1));
    return matches.length === 1 ? matches[0][0]+" " : word;
  });
  text = numberWords(text);
  text = text
    .replace(/(\d+)\s+четверт(?:и|ь|ых)(?:\s+дюйм[а-я]*)?/gu, '$1/4"')
    .replace(/(\d+)\s+втор(?:ая|ых)(?:\s+дюйм[а-я]*)?/gu, '$1/2"')
    .replace(/(\d+)\s*(?:целая|целых|целое)\s*(\d+)\s*(десятых|сотых|тысячных)/gu,
      (_,a,b,unit) => a+"."+b.padStart(unit === "десятых" ? 1 : unit === "сотых" ? 2 : 3,"0"))
    .replace(/(\d+)\s*(?:запятая|точка)\s*(\d+)/gu, "$1.$2")
    .replace(/(\d+)\s*(?:эс\s*эн|ес\s*ен|эс\s*н|с\s*н|эсэн|сэн)/gu, "$1sn")
    .replace(/(\d+sn)\s*[-]?\s*(?:ка|к)(?=$|[^а-яa-z])/gu, "$1k")
    .replace(/(\d+)\s*(?:эс\s*це|сц)/gu, "$1sc")
    .replace(/(\d+)\s*(?:эс\s*пи|эс\s*пэ|с\s*п)/gu, "$1sp")
    .replace(/(\d+)\s*(?:эс\s*аш|с\s*ш)/gu, "$1sh")
    .replace(/(^|[^а-яa-z])(?:дэ\s*эн|де\s*эн|ди\s*эн|дэ\s*н|ден|дэн|ду)(?=\s*\d)/gu, "$1dn")
    .replace(/(?:чайна|китай)/gu,"china")
    .replace(/(?:птфе|пи\s*ти\s*эф\s*и|тефлон(?:овый)?)/gu,"ptfe")
    .replace(/шланк/gu,"шланг")
    .replace(/(?:наценга|наценко|надценка|наценочка|на\s+ценка)/gu,"наценка")
    .replace(/(?:прямм?ои|пряммая|прямм?ые)/gu,"прямой")
    .replace(/(?:штуцир|штуцыр|штуцерр)/gu,"штуцер")
    .replace(/\s+/gu," ").trim();
  return text;
}

