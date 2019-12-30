rm -r public/
mkdir public || exit 1
cp -r subtitles public/ || exit 1
cp -r static/** public/ || exit 1
