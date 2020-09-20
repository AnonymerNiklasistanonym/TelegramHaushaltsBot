#!/usr/bin/env bash

if ! [ -x "$(command -v convert)" ]; then
    echo 'Error: convert is not installed. (pacman -S imagemagick | https://www.imagemagick.org/script/download.php)' >&2
    exit 1
fi

if ! [ -x "$(command -v inkscape)" ]; then
    echo 'Error: inkscape is not installed. (pacman -S inkscape | https://inkscape.org/release)' >&2
    exit 1
fi

inkscape bot_bg.svg -o bot_bg.png -w 2000 -h 2000
inkscape bot_fg.svg -o bot_fg.png -w 2000 -h 2000
convert bot_bg.png bot_fg.png -geometry +100-100 -composite out.png
