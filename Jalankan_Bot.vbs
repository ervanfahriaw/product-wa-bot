' ========================================================
'   WA BOT CONTROLLER - SILENT LAUNCHER
'   Menjalankan server Node.js di background (tanpa jendela CMD)
'   dan membuka browser otomatis ke Web Controller Dashboard.
' ========================================================

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Dapatkan direktori tempat script ini berada
strCurrentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strCurrentDir

' Cek apakah node.exe bawaan (.tools) tersedia, atau gunakan node global
strNodeExe = strCurrentDir & "\.tools\node-v20.18.0-win-x64\node.exe"
If fso.FileExists(strNodeExe) Then
    strCmd = """" & strNodeExe & """ """ & strCurrentDir & "\src\server\index.js"""
Else
    strCmd = "node """ & strCurrentDir & "\src\server\index.js"""
End If

' Jalankan server di background (0 = Hidden window, False = Don't wait for completion)
WshShell.Run strCmd, 0, False

' Beri jeda 2 detik agar server siap mendengarkan port 3000
WScript.Sleep 2000

' Buka dashboard di browser bawaan pengguna
WshShell.Run "http://localhost:3000"
