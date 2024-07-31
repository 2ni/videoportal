#! /bin/bash

# install cronjob
# 12 23 * * * /home/www/videoportal/download.sh > /home/www/videoportal/download.log 2>&1
#
# downloadlist:
#  # this is a comment
#  some-directory
#  https://www.zdf.de/nachrichten/heute-sendungen/videos/heute-xpress-aktuelle-sendung-100.html -o heute.mp4
#  https://www.ardmediathek.de/video/himmelstal/folge-3-carol-s01-e03/one/Y3JpZDovL3dkci5kZS9CZWl0cmFnLWZkMzYxZmQwLTE0ZmMtNGYwZS1iYjMyLTNiZmQxZDA1ZGIzYg -o 03-carol.mp4

shopt -s expand_aliases
alias yt-dlp-web='/home/denis/.pyenv/shims/yt-dlp -cf "bv*[ext=mp4][width<=1440]+ba/b"'
file="/home/www/videoportal/downloadlist"
baseDir="/home/www/videoportal/movies/"

cd $baseDir
if [ -f $file ]; then
	while read line; do
		if [[ $line != \#* && $line != "" ]]; then
			if [[ $line != https* ]]; then
				#echo "chdir ${line}"
				cd $baseDir && mkdir -p $line && cd $line
			else
				#echo "download: ${line}"
				yt-dlp-web $line
			fi
		fi
	done < "${file}"
fi
