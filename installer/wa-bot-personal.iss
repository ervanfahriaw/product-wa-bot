; ========================================================
; Script Inno Setup untuk WA Asisten Pribadi AI
; Menghasilkan 1 File Installer (.exe) Siap Jual di Lynk.id
; ========================================================

#define MyAppName "WA Asisten Pribadi AI"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Digital Solution"
#define MyAppBatLauncher "Buka-Bot-Personal.bat"
#define MyAppVbsLauncher "Buka-Bot-Personal.vbs"

[Setup]
; Informasi Aplikasi
AppId={{C7B2E9D8-7E63-4B12-8C3B-WABOTPERSONAL01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=Setup_WABot_Personal_v1.0
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
; Root Files
Source: "..\dist\wa-bot-personal\Buka-Bot-Personal.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\wa-bot-personal\Buka-Bot-Personal.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\wa-bot-personal\Matikan-Bot-Personal.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\wa-bot-personal\Matikan-Bot-Personal.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\wa-bot-personal\1-KLIK-IZINKAN-APLIKASI.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\wa-bot-personal\Buku_Panduan_Lengkap_WA_Asisten_Pribadi_AI.docx"; DestDir: "{app}"; Flags: ignoreversion
; Sistem Folder
Source: "..\dist\wa-bot-personal\sistem\*"; DestDir: "{app}\sistem"; Excludes: "data, data\*, .wwebjs_auth, .wwebjs_auth\*, .wwebjs_cache, .wwebjs_cache\*, *.old, *.log, config\config.json, config\license.json"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Shortcut di Start Menu
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppVbsLauncher}"; WorkingDir: "{app}"
Name: "{group}\Buka Bot (Terminal Log)"; Filename: "{app}\{#MyAppBatLauncher}"; WorkingDir: "{app}"
Name: "{group}\Matikan {#MyAppName}"; Filename: "{app}\Matikan-Bot-Personal.vbs"; WorkingDir: "{app}"
Name: "{group}\Buku Panduan Lengkap"; Filename: "{app}\Buku_Panduan_Lengkap_WA_Asisten_Pribadi_AI.docx"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

; Shortcut di Desktop
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppVbsLauncher}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; 1. Buka blokir Windows SmartScreen secara otomatis pada seluruh file yang diinstall
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Get-ChildItem -Path '{app}' -Recurse | Unblock-File -ErrorAction SilentlyContinue"""; Flags: runhidden waituntilterminated

; 2. Opsi jalankan aplikasi setelah selesai instalasi
Filename: "{app}\{#MyAppVbsLauncher}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall skipifsilent
