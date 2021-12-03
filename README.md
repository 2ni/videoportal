# About
This is a simple and lightweight video portal implemented in expressjs with handlebars as template engine. Best install it on eg a raspberry pi or internal server. You can then play your videos on any browser within your internal network.

Some features:
- no external javascript, only uses vanilla javascript
- no database used, just uses directory structure to show list of movies or groups
- uses standard video player, no tracking or ads (unless within video itself)
- automatic fullscreen mode on mobile landscape mode
- saves last seen time, so you can continue where you stopped
- uses websockets to control videos on other screens, eg from mobile to desktop

### Installation
```
npm init
npm install
```

### Setup on production see [stackoverflow](https://stackoverflow.com/questions/4018154/how-do-i-run-a-node-js-app-as-a-background-service)
```
git clone...
npm install
sudo cp videoportal.service /etc/systemd/system/
sudo systemctl [start|stop] videoportal
sudo systemctl enable videoportal # to enable  on boot
journalctl -u videoportal -f # for logging output
```

listen to http://<ip_of_your_rpi>:3002

### Reverse proxy setup
- set static route on your router http://videoportal pointing to your rpi ip
- add the following to nginx:
```
  server {
    listen 80;
    server_name videoportal;

    location / {
      proxy_pass http://192.168.1.10:3002/;
      proxy_redirect off;
      proxy_set_header   X-Real-IP        $remote_addr;
      proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
      proxy_set_header   Host             $host;
    }
  }
```


### Run
```
npm run dev
```

### Misc
- https://www.npmjs.com/package/youtube-dl-exec
- https://stackoverflow.com/questions/58873023/convert-file-with-any-extension-to-mp4-with-ffmpeg
  - https://github.com/ytdl-org/youtube-dl/#format-selection-examples
  - https://github.com/ytdl-org/youtube-dl/#format-selection-examples
  - youtube-dl -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
