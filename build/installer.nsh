; Pre-install: migrate old DB from resources/data/ to %APPDATA% before NSIS overwrites it
!macro customInit
  ; Check if previous version stored DB inside install dir
  IfFileExists "$INSTDIR\resources\data\library.db" 0 skipMigration
    ; Target: %APPDATA%\game-translator\data\
    CreateDirectory "$APPDATA\game-translator\data"
    IfFileExists "$APPDATA\game-translator\data\library.db" skipMigration 0
      ; Copy DB file
      CopyFiles /SILENT "$INSTDIR\resources\data\library.db" "$APPDATA\game-translator\data\library.db"
      ; Copy covers directory
      IfFileExists "$INSTDIR\resources\data\covers\*.*" 0 +2
        CopyFiles /SILENT "$INSTDIR\resources\data\covers\*.*" "$APPDATA\game-translator\data\covers\"
      ; Copy thumbnails directory
      IfFileExists "$INSTDIR\resources\data\thumbnails\*.*" 0 +2
        CopyFiles /SILENT "$INSTDIR\resources\data\thumbnails\*.*" "$APPDATA\game-translator\data\thumbnails\"
  skipMigration:
!macroend
