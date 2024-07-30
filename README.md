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
mkdir -p /home/www/videoportal
cd /home/www
sudo chown -R denis:denis videoportal
sudo -u denis git clone git@github.com:2ni/videoportal.git
cd videoportal
npm install
cd ..
sudo chgrp -R www-data videoportal
ln -s /mnt/data/movies .                          # add movies directory (eg external usb drive)
sudo usermod -aG www-data denis                   # add myself to group (probably not needed)
sudo chmod g+s /home/www/videoportal              # add sticky bit so every file gets group of parent, ie www-data
sudo cp videoportal.service /etc/systemd/system/
sudo systemctl daemon-reload                      # to reload configs
sudo systemctl [start|stop|restart] videoportal
sudo systemctl [enable|disable] videoportal       # to disable/enable  on boot
sudo systemctl list-unit-files --type=service     # to list if service starts on boot
journalctl -u videoportal -f # to show log output
```

### Setup external usb drive
see also [RaspberryPi](https://docs.google.com/document/d/1Doonk8PYe0l1jPQtM02R959S_Awvrqm1HeDRFwrLI7U/edit) doc
```
lsblk                      # find which drive, eg /dev/sda
sudo umount /dev/sda1      # might not be mounted
sudo umount /dev/sda2
sudo fdisk /dev/sda
> p                        # list partitions
> d                        # choose partition to delete (2x)
> w                        # write and exit
sudo parted /dev/sda       # create new partition table
> mklabel gpt
> quit
sudo parted /dev/sda
> mkpart primary 0% 100%   # create a single partition that spans entire space
> quit
sudo mkfs.ext4 /dev/sda1   # format the partition
sudo lsblk -f              # verify partition

sudo mkdir -p /mnt/movies  # create mount endpoint
sudo blkid                 # find UUID of partition  
systemctl daemon-reload    # to reload fstab
sudo vi /etc/fstab

add the following line:
UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx /mnt/data ext4 defaults 0 2
sudo mount -a
df -h                      # verify
ls -ld /mnt/movies         # check permissions
sudo chown -R denis:denis /mnt/data
```

listen to http://<ip_of_your_rpi>:3002

### Reverse proxy setup
- set static route on your router http://videoportal pointing to your rpi ip
- to debug add `?dbg=true` to the url
- add the following to nginx:
```
  server {
    listen 80;
    server_name videoportal;

    location / {
      proxy_pass http://192.168.1.10:3002/;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_cache_bypass $http_upgrade;
      proxy_read_timeout 86400;
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

### Create empty video from single image
```
convert -size 720x540 xc:black black.png
ffmpeg -f image2 -i black.png black.mp4
echo -n "data:video/mp4;base64," > black-base64.txt
base64 black.mp4 >> black-base64.txt
```

### Misc
- https://www.npmjs.com/package/youtube-dl-exec
- https://stackoverflow.com/questions/58873023/convert-file-with-any-extension-to-mp4-with-ffmpeg
  - https://github.com/ytdl-org/youtube-dl/#format-selection-examples
  - https://github.com/ytdl-org/youtube-dl/#format-selection-examples
  - youtube-dl -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
