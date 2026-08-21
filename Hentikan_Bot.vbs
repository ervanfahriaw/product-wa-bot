' ========================================================
'   WA BOT CONTROLLER - SILENT STOPPER
'   Menghentikan proses WA Bot yang berjalan di background.
' ========================================================

Set WshShell = CreateObject("WScript.Shell")

' Hentikan proses node yang menjalankan WA Bot (port 3000)
WshShell.Run "cmd /c taskkill /F /IM node.exe", 0, True

' Tampilkan notifikasi singkat
MsgBox "WhatsApp Bot Controller berhasil dihentikan.", vbInformation + vbOKOnly, "WA Bot Controller"
