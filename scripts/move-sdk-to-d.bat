@echo off
set "SRC=C:\Users\vanne\AppData\Local\Android\Sdk"
set "DEST=D:\Android\Sdk"

echo Moving Android SDK from C: to D:...
if not exist "D:\Android" mkdir "D:\Android"
robocopy "%SRC%" "%DEST%" /E /MOVE /NFL /NDL /NJH /NJS /nc /ns /np
echo Move complete!
dir "%DEST%"
