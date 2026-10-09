"""Read the manufacturer's product facts into an auditable, local catalog.

Input: /tmp/barmaksan-product-map.json (from server/seed/catalog.js).
Requires beautifulsoup4. This never writes the application database.
"""
import concurrent.futures
import json
import pathlib
import re
import urllib.request
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parents[1]


def clean(node):
    return re.sub(r'\s+', ' ', node.get_text(' ', strip=True)).strip()


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Barmaksan product catalog/1.0'})
    with urllib.request.urlopen(req, timeout=20) as response:
        return BeautifulSoup(response.read(), 'html.parser')


def table_data(table, index, code):
    grid = []
    spans = {}
    for ri, row in enumerate(table.select('tr')):
        cells, ci = [], 0
        def carry():
            nonlocal ci
            while (ri, ci) in spans:
                cells.append(spans[(ri, ci)])
                ci += 1
        for cell in row.find_all(['th', 'td'], recursive=False):
            carry()
            value = clean(cell)
            colspan, rowspan = int(cell.get('colspan', 1)), int(cell.get('rowspan', 1))
            for offset in range(colspan):
                cells.append(value)
                for nr in range(1, rowspan):
                    spans[(ri+nr, ci+offset)] = value
            ci += colspan
        carry()
        grid.append(cells)
    start = next((i for i, row in enumerate(grid) if len(row) > 1 and row[0].lower() not in ['model', 'type', 'tip'] and any(re.fullmatch(r'[\d,.x×*\-+ /]+', v) and re.search(r'\d', v) for v in row[1:])), None)
    if start is None or start == 0:
        return None
    width = len(grid[start])
    if width > 40 or any(len(row) != width for row in grid):
        return None  # Never silently shift a technical value under the wrong heading.
    columns = []
    for ci in range(width):
        labels = list(dict.fromkeys(row[ci] for row in grid[:start] if row[ci]))
        columns.append(' / '.join(labels) or (f'Sütun {ci+1}' if code == 'tr' else f'Column {ci+1}'))
    previous = table.find_previous(['h4', 'strong'])
    while previous and previous.find_parent('table'):
        previous = previous.find_previous(['h4', 'strong'])
    title = clean(previous) if previous else ''
    if not title or title.lower() in ['teknik özellikler', 'technical specifications']:
        title = ('Ölçüler' if code == 'tr' else 'Dimensions') if any('Ölçüler' in c or 'Dimensions' in c for c in columns) and width > 10 and not any('Motor' in c for c in columns) else ('Teknik veriler' if code == 'tr' else 'Technical data')
    return {'title': title, 'columns': columns, 'rows': grid[start:]}


def profile(soup, machine, code, url):
    return {
        'title': machine[code],
        'description': machine.get('summaryTr' if code == 'tr' else 'summaryEn') or '',
        'features': [clean(li) for li in soup.select('.litab-1 li')],
        'applications': [clean(li) for li in soup.select('.litab-3 li')],
        'specifications': [t for i, node in enumerate(soup.select('.litab-2 table')) if (t := table_data(node, i, code))],
        'productUrl': url,
        'changeNote': 'Resmi ürün sayfasından alınan ürün verileri' if code == 'tr' else 'Product facts from the official product page',
    }


def product(machine):
    url = machine.get('url')
    if not url:
        return machine['slug'], {}, ['No source URL']
    result, errors = {}, []
    try:
        soup = fetch(url)
        result['tr'] = profile(soup, machine, 'tr', url)
        alternate = soup.select_one('link[hreflang="en"]')
        if alternate:
            en_url = alternate['href']
            english = fetch(en_url)
            result['en'] = profile(english, machine, 'en', en_url)
    except Exception as error:
        errors.append(str(error))
    print(machine['slug'], ','.join(result) or 'failed', flush=True)
    return machine['slug'], result, errors


def normalize(content):
    for codes in content.values():
        for code, p in codes.items():
            for t in p['specifications']:
                if code == 'en':
                    t['columns'] = [c.replace('Widthgineu', 'Motor').replace('Widthgine', 'Motor').replace('Modal', 'Model').replace('t/sa.', 't/h').replace(' / Kw', ' / kW').replace(' / kw', ' / kW') for c in t['columns']]
                    if t['title'] == 'Technical data' and any('Dimension' in c for c in t['columns']) and not any('Motor' in c for c in t['columns']):
                        t['title'] = 'Dimensions'
    # These source pages serve English copy even on their Turkish URLs.
    from copy import deepcopy
    for slug, name, description in [
        ('kovali-elevator', 'Bucket Elevator', 'Kovalı Elevatör, tahıl ve işlenmiş ürünleri kayışa bağlı kovalarla aşağıdan yukarıya taşır. Farklı taşıma kapasitelerine uygun modellerle üretilir.'),
        ('zincirli-konveyor', 'Chain Conveyor', 'Zincirli Konveyör, ürünlerin yatay yönde taşınması için kullanılır. Un, yem ve gıda tesislerinin yanı sıra maden, talaş ve toprak işleme alanlarında da kullanıma uygundur.'),
    ]:
        if slug not in content or 'tr' not in content[slug]:
            continue
        tr = content[slug]['tr']
        if 'en' not in content[slug]:
            en = deepcopy(tr)
            en['title'] = name
            en['changeNote'] = 'Product facts from the official product page'
            for table in en['specifications']:
                table['title'] = 'Technical data'
                table['columns'] = [c.replace('Modal','Model').replace('Kasnak','Pulley').replace('Kayış','Belt').replace('Kova','Bucket').replace('Un','Flour').replace('İrmik','Semolina').replace('Kepek','Bran').replace('Atık','Waste').replace('m³/dk.','m³/min.').replace('t/sa','t/h') for c in table['columns']]
            content[slug]['en'] = en
        tr['description'] = description
        tr['features'] = ['Dikey tahıl ve ürün taşıma', 'Kapasiteye göre model seçimi', 'Kayışa bağlı kovalarla ürün aktarımı'] if slug == 'kovali-elevator' else []
        tr['applications'] = ['Gıda endüstrisi', 'Un fabrikaları', 'İrmik fabrikaları', 'Mısır fabrikaları', 'Bisküvi fabrikaları', 'Makarna fabrikaları', 'Yem fabrikaları', 'Yağ rafinerileri']
        for table in tr['specifications']:
            table['title'] = 'Teknik veriler'
            table['columns'] = [c.replace('Modal','Model').replace('Length','Uzunluk').replace('Capacity - Capacity (t/s - t/h)','Kapasite (t/sa.)').replace('Capacity','Kapasite').replace('Wheat','Buğday').replace('Air Requirement','Hava ihtiyacı').replace('Dimensions','Ölçüler') for c in table['columns']]
    return content


if __name__ == '__main__':
    machines = json.loads(pathlib.Path('/tmp/barmaksan-product-map.json').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(product, machines))
    content = {slug: profiles for slug, profiles, errors in rows if profiles}
    # Concise descriptions written from the product facts, in both languages.
    descriptions = {
        'cleanmax-4': {
            'tr': 'Cleanmax 4, un, irmik ve bakliyat tesislerinin temizleme bölümünde ürünü boyutlarına göre sınıflandırır. Çift katlı elek düzeni, yüksek miktarda ürünün işlenmesini sağlar.\n\nYan kapaklar eleklere erişimi kolaylaştırır. Motor açısı ve ağırlık ayarı ürün akışına göre değiştirilebilir. Aspirasyon ve son hava kanalı, hafif yabancı maddelerin uzaklaştırılmasına yardımcı olur.',
            'en': 'Cleanmax 4 classifies material by size in the cleaning sections of flour, semolina and pulses plants. Its two-deck sieve arrangement supports high-throughput processing.\n\nSide covers provide access to the sieves. Motor angle and weight settings can be adjusted for the product flow. Aspiration and the final air channel help remove lightweight impurities.',
        },
        'vibro-kepek-fircasi': {
            'tr': 'Vibro Kepek Fırçası, kepeğe yapışmış un parçacıklarını ayırarak un fabrikalarında randımanın artırılmasına yardımcı olur.\n\nPaslanmaz besleme bölümü, elek kafesi ve titreşimli çalışma düzeni bir arada kullanılır. Kauçuk bağlantılar, gövdedeki titreşimin taşınmasını azaltır. Tek ve çift katlı modellerin teknik verileri aşağıda ayrı tablolarda yer alır.',
            'en': 'The Vibro Bran Finisher separates flour particles that remain attached to bran, helping mills improve flour extraction.\n\nIts design combines a stainless-steel feeding section, a sieve cage and vibration. Rubber mounts help isolate vibration from the body. Technical data for the single- and double-deck models is listed separately below.',
        },
    }
    for slug, codes in descriptions.items():
        for code, description in codes.items():
            if code in content.get(slug, {}):
                content[slug][code]['description'] = description
    destination = ROOT / 'assets/site/product-content.json'
    destination.write_text(json.dumps(normalize(content), ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'machines': len(content), 'profiles': sum(len(v) for v in content.values()), 'errors': {s: e for s, p, e in rows if e}}, ensure_ascii=False))
