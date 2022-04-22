#!/bin/sh

ASSETS=(
   index.html
   resume.json
   headshot.jpg
)

npx tsc 
npx rollup -c 
cp -r ${ASSETS/#/src/} dist/
