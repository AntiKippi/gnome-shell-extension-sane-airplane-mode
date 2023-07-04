#!/bin/bash

FILES=("schemas/" "constants.js" "extension.js" "metadata.json" "prefs.js")
EXTNAME="sane-airplane-mode@kippi"
ZIPNAME="$EXTNAME.zip"
EXTDIR=~/.local/share/gnome-shell/extensions/$EXTNAME/

print_help_exit() {
    echo "USAGE: $(basename "$0") -l|--local|-z|--zip"
    exit $1
}

case "$1" in
    -h|--help)
        print_help_exit 0
        ;;
    -l|--local)
        cp -vr ${FILES[@]} $EXTDIR
        ;;
    -z|--zip)
        zip -r "$ZIPNAME" ${FILES[@]}
        ;;
    *)
        print_help_exit 2;
        ;;
esac
