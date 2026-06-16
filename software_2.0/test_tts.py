import json, urllib.request, base64

clusters = ['volcano_tts', 'volcano_icl', 'volcano_tts_v2']
voices = ['BV700_streaming', 'zh_female_tianmei', 'BV406_streaming', 'xiaoxiao']

for cl in clusters:
    for v in voices:
        body = json.dumps({
            'app': {'appid': '5897452773', 'token': 'JYyWQCrTx9vbrH6aLxklZFNUKCq8IMWD', 'cluster': cl},
            'user': {'uid': 't'},
            'audio': {'voice_type': v, 'encoding': 'mp3'},
            'request': {'reqid': 'test9', 'text': '你好世界', 'text_type': 'plain', 'operation': 'submit'}
        })
        h = {'Content-Type': 'application/json', 'Authorization': 'Bearer ark-6c40917b-c43a-4102-b524-fb472c88ca51-20741'}
        try:
            r = json.loads(urllib.request.urlopen(
                urllib.request.Request('https://openspeech.bytedance.com/api/v1/tts', body.encode(), h), timeout=8
            ).read())
            code = r.get('code')
            msg = str(r.get('message', ''))[:60]
            print(f'{cl}/{v}: code={code} {msg}')
            if r.get('data'):
                mp3 = base64.b64decode(r['data'])
                open('D:/软件杯/test_tts.mp3', 'wb').write(mp3)
                print(f'  >>> SUCCESS! size={len(mp3)}')
                raise SystemExit(0)
        except Exception as e:
            s = str(e)[:80]
            print(f'{cl}/{v}: {s}')
