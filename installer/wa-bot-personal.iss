; ========================================================
; Script Inno Setup untuk WA Asisten Pribadi AI
; Menghasilkan 1 File Installer (.exe) Siap Jual di Lynk.id
; ========================================================

#define MyAppName "WA Asisten Pribadi AI"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Digital Solution"
#define MyAppExeName "wa-bot-personal.exe"
#define MyAppLauncher "Buka-Bot-Personal.bat"

[Setup]
; Informasi Aplikasi
AppId={{C7B2E9D8-7E63-4B12-8C3B-WABOTPERSONAL01}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
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
Name: "indonesian"; MessagesFile: "compiler:Languages\Indonesian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Salin semua file dari folder dist/wa-bot-personal
Source: "..\dist\wa-bot-personal\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Shortcut di Start Menu
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppLauncher}"; WorkingDir: "{app}"
Name: "{group}\Buku Panduan PDF"; Filename: "{app}\Buku_Panduan_Lengkap_WA_Asisten_Pribadi_AI.docx"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"

; Shortcut di Desktop
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppLauncher}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; 1. Buka blokir Windows SmartScreen (Mark-of-the-Web) secara otomatis pada seluruh file yang diinstall
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""Get-ChildItem -Path '{app}' -Recurse | Unblock-File"""; Flags: runhidden waituntilterminated

; 2. Opsi jalankan aplikasi setelah selesai instalasi
Filename: "{app}\{#MyAppLauncher}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: shellexec postinstall skipifsilent
