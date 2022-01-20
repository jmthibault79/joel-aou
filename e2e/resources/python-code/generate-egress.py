####
# Copy and execute this block to generate a large file with random content
# and upload it to the internet, using an arbitrary speed test endpoint.
# 
# This should trip a high-egress signal in the Workbench system (and an 
# oncall alert in the prod environment -- so take care!)
#
# See http://broad.io/aou-egress-alerting for more details.
####
import os
import requests
import datetime

def timestamp():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

print('Generating file at '+ timestamp())
newfile = open("data.txt", "wb")
newfile.write(os.urandom(20000000))    # generate 20MB random content file
newfile.close()
# Upload to the internet.
#
# Upload the file 9 times and expect to upload 180MB data. This stays under the 200MB limit, which could affect
# tests up to an hour later via the larger egress window.
for x in range(1, 10):
    print('Uploading to the internet at '+ timestamp() + ' , current count: ' + str(x))
    with open('data.txt', 'rb') as f:
        r = requests.post('http://speedtest.tele2.net/upload.php', files={'data.txt': f})
    print('Successfully uploaded file to the internet at '+ timestamp())
