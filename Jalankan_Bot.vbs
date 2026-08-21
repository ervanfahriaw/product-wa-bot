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

' Setup environment PATH untuk node portabel
strTools = strCurrentDir & "\.tools\node-v20.18.0-win-x64"
strPath = WshShell.Environment("PROCESS")("PATH")
If fso.FolderExists(strTools) Then
    WshShell.Environment("PROCESS")("PATH") = strTools & ";" & strPath
    strNodeExe = strTools & "\node.exe"
Else
    strNodeExe = "node"
End If

' Jalankan server Node.js
strCmd = """" & strNodeExe & """ """ & strCurrentDir & "\src\server\index.js"""
WshShell.Run strCmd, 0, False

' Beri jeda 2.5 detik lalu buka dashboard di browser bawaan
WScript.Sleep 2500
WshShell.Run "http://localhost:3000"
