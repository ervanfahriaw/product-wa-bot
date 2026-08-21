; ========================================================
;   INNO SETUP SCRIPT — WA BOT BISNIS & ASISTEN PRIBADI
;   Menghasilkan file installer tunggal: Setup_WABot_Bisnis_v1.0.exe
; ========================================================

#define MyAppName "WhatsApp Bot Bisnis & Asisten Pribadi"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Ervan Fahri"
#define MyAppURL "https://lynk.id/ervanfahriaw"
#define MyAppExeName "Jalankan_Bot.vbs"

[Setup]
; AppId unik untuk identifikasi instalasi aplikasi
AppId={{8B43C3A1-72E5-4C89-B0F9-E1826D45E201}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Lokasi instalasi di AppData Pengguna (Tidak butuh hak Administrator / UAC, bebas dari error write permission)
DefaultDirName={userappdata}\WABotController
DefaultGroupName=WhatsApp Bot Controller
DisableProgramGroupPage=yes

; Lokasi dan nama file installer hasil kompilasi
OutputDir=dist
OutputBaseFilename=Setup_WABot_Bisnis_v1.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

; Hak akses instalasi
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

; Banner dan Tampilan Wizard
UninstallDisplayName={#MyAppName} v{#MyAppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Folder runtime Node.js v20 bawaan (terisolasi & portabel)
Source: ".tools\node-v20.18.0-win-x64\*"; DestDir: "{app}\.tools\node-v20.18.0-win-x64"; Flags: ignoreversion recursesubdirs createallsubdirs
; Source code aplikasi backend & frontend (kecuali session & log)
Source: "src\*"; DestDir: "{app}\src"; Excludes: "engine\session\*,*.log"; Flags: ignoreversion recursesubdirs createallsubdirs
; Modul dependensi (node_modules)
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Excludes: ".cache\*,*.log"; Flags: ignoreversion recursesubdirs createallsubdirs
; Aset statis & gambar
Source: "assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs
; File konfigurasi template bawaan
Source: "config\config.json.example"; DestDir: "{app}\config"; Flags: ignoreversion
Source: "config\config.json.example"; DestDir: "{app}\config"; DestName: "config.json"; Flags: onlyifdoesntexist
; File package & script peluncur
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "start.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "start.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Jalankan_Bot.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "Hentikan_Bot.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
; Pastikan folder data dan log terbuat otomatis saat instalasi
Name: "{app}\data"
Name: "{app}\config"
Name: "{app}\data\uploads"

[Icons]
; Shortcut di Desktop
Name: "{autodesktop}\WA Bot Controller"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Jalankan_Bot.vbs"""; WorkingDir: "{app}"; IconFilename: "{sys}\shell32.dll"; IconIndex: 220; Tasks: desktopicon

; Shortcut di Start Menu Program
Name: "{group}\Buka WA Bot Controller"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Jalankan_Bot.vbs"""; WorkingDir: "{app}"; IconFilename: "{sys}\shell32.dll"; IconIndex: 220
Name: "{group}\Hentikan WA Bot"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Hentikan_Bot.vbs"""; WorkingDir: "{app}"; IconFilename: "{sys}\shell32.dll"; IconIndex: 131
Name: "{group}\Buka Folder Data"; Filename: "explorer.exe"; Parameters: """{app}"""; WorkingDir: "{app}"
Name: "{group}\Uninstall WA Bot"; Filename: "{uninstallexe}"

[Run]
; Opsi centang otomatis di halaman akhir instalasi untuk langsung menjalankan bot
Filename: "{sys}\wscript.exe"; Parameters: """{app}\Jalankan_Bot.vbs"""; WorkingDir: "{app}"; Description: "Jalankan WA Bot sekarang (Buka Dashboard Browser)"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Matikan bot terlebih dahulu sebelum proses uninstall berjalan
Filename: "{sys}\wscript.exe"; Parameters: """{app}\Hentikan_Bot.vbs"""; Flags: nowait
