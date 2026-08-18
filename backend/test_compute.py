import urllib.request, json, urllib.error
req = urllib.request.Request('http://localhost:8000/compute/score?user_id=608f555b-eef6-4fec-a35a-a14dfd043da2', headers={'Authorization': 'Bearer dev_shared_secret_key', 'X-API-Key': 'dev_shared_secret_key'}, method='POST')
try:
    print(urllib.request.urlopen(req).read().decode())
except urllib.error.HTTPError as e:
    print('Error:', e.code, e.read().decode())
