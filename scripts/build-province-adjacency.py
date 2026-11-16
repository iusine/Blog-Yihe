"""从 china.json 计算省份相邻关系，输出 adcode -> [相邻 adcode]。

思路：省级边界顶点密度足够高，两个省的边界若相邻，顶点之间必然存在非常近的点对。
用 0.02° 的网格做空间哈希，只比较落在同一/相邻格子里的点，避免 O(n*m) 全量比较。
"""
import json
import math

SRC = r'F:\小工具\Blog-Yihe\public\geo\china.json'
OUT = r'F:\小工具\Blog-Yihe\src\app\pictures\data\province-adjacency.json'

CELL = 0.02
THRESHOLD = 0.045  # 度；0.045° ≈ 5km，足够识别共享边界，又不会把隔海相望的省份连起来

data = json.load(open(SRC, encoding='utf-8'))

provinces = {}
for f in data['features']:
    props = f['properties']
    adcode = props.get('adcode')
    if not isinstance(adcode, int):
        continue  # 跳过南海诸岛（adcode 是字符串）

    coords = f['geometry']['coordinates']
    rings = coords if f['geometry']['type'] == 'Polygon' else [r for poly in coords for r in poly]
    points = [pt for ring in rings for pt in ring]
    provinces[adcode] = points

print('provinces:', len(provinces))


def grid_key(x, y):
    return (int(math.floor(x / CELL)), int(math.floor(y / CELL)))


# 建索引：cell -> [(x, y, adcode)]
index = {}
for adcode, points in provinces.items():
    for x, y, *_ in points:
        index.setdefault(grid_key(x, y), []).append((x, y, adcode))

adjacency = {code: set() for code in provinces}

for adcode, points in provinces.items():
    for x, y, *_ in points:
        gx, gy = grid_key(x, y)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for ox, oy, other in index.get((gx + dx, gy + dy), ()):
                    if other == adcode:
                        continue
                    # 快速排除：格子内两端距离
                    if abs(ox - x) > THRESHOLD or abs(oy - y) > THRESHOLD:
                        continue
                    if (ox - x) ** 2 + (oy - y) ** 2 <= THRESHOLD**2:
                        adjacency[adcode].add(other)

result = {str(code): sorted(str(n) for n in adjacency[code]) for code in sorted(adjacency)}

names = {str(f['properties']['adcode']): f['properties']['name'] for f in data['features'] if isinstance(f['properties'].get('adcode'), int)}
for code, neighbours in result.items():
    print(names.get(code, code), '->', ', '.join(names.get(n, n) for n in neighbours))

json.dump(result, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent='\t')
print('written', OUT, 'edges', sum(len(v) for v in result.values()) // 2)
