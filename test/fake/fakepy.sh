#!/bin/bash
# Fake-"python": simuliert pybricksdev, bleak-Import und Syntaxcheck
args="$*"
case "$args" in
  *"--version"*) echo "Python 3.12.0"; exit 0;;
  *"import importlib.metadata"*) echo "2.0.1"; exit 0;;
  *"run ble --help"*) echo "--name --no-start --no-wait"; exit 0;;
  *"pip install"*) exit 0;;
  *"import os, pybricks"*) echo "/tmp/fake/site"; exit 0;;
  *"compile(open"*) f="${@: -1}"; if grep -q "SYNTAXFEHLER" "$f"; then echo '{"line":2,"message":"SyntaxError: invalid syntax"}'; fi; exit 0;;
  *"-m pybricksdev run ble"*)
     echo "Searching for any hub with Pybricks service..." >&2; sleep 0.2
     echo "Connected!" >&2; sleep 0.2
     echo "Sending 50%" >&2; sleep 0.2
     f="${@: -1}"
     if grep -q "CRASH" "$f"; then
        echo "Traceback (most recent call last):"; echo '  File "main.py", line 3, in <module>'; echo "NameError: name 'x' isn't defined"; exit 1
     fi
     echo "Abstand: 120 Winkel: 5"; echo "Abstand: 90 Winkel: 7"; sleep 0.3; exit 0;;
esac
exit 0
