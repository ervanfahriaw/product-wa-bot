; ========================================================
; Script Inno Setup untuk WA Bot Bisnis AI
; Menghasilkan 1 File Installer (.exe) Siap Jual di Lynk.id
; ========================================================

#define MyAppName "WA Bot Bisnis AI"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Digital Solution"
#define MyAppBatLauncher "Buka-Bot-Bisnis.bat"
#define MyAppVbsLauncher "Buka-Bot-Bisnis.vbs"

[Setup]
; Informasi Aplikasi
AppId={{E8A1F8C9-8F74-4C23-9D4A-WABOTBISNIS01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=Setup_WABot_Bisnis_v1.0
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Salin semua file bersih dari folder dist/wa-bot-bisnis (kecuali data runtime & cache sesi)
Source: "..\dist\wa-bot-bisnis\*"; DestDir: "{app}"; Excludes: "data, data\*, .wwebjs_auth, .wwebjs_auth\*, .wwebjs_cache, .wwebjs_cache\*, *.old, *.log, config\config.json, config\license.json"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Shortcut di Start Menu
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppVbsLauncher}"; WorkingDir: "{app}"
Name: "{group}\Buka Bot (Terminal Log)"; Filename: "{app}\{#MyAppBatLauncher}"; WorkingDir: "{app}"
Name: "{group}\Matikan {#MyAppName}"; Filename: "{app}\Matikan-Bot-Bisnis.vbs"; WorkingDir: "{app}"
Name: "{group}\Buku Panduan Lengkap"; Filename: "{app}\Buku_Panduan_Lengkap_WA_Bot_Bisnis_AI.docx"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

; Shortcut di Desktop
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppVbsLauncher}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; 1. Buka blokir Windows SmartScreen secara otomatis pada seluruh file yang diinstall
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Get-ChildItem -Path '{app}' -Recurse | Unblock-File -ErrorAction SilentlyContinue"""; Flags: runhidden waituntilterminated

; 2. Opsi jalankan aplikasi setelah selesai instalasi
Filename: "{app}\{#MyAppVbsLauncher}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall skipifsilent
