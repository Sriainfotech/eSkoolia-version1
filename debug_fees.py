import urllib.request
import urllib.error
import sys

token = 'Bearer ' + open('frontend/token.txt').read().strip()
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/fees/assignments/', headers={'Authorization': token})

try:
    urllib.request.urlopen(req)
    print("Success")
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode('utf-8'))
