@echo off
REM Deletes the 16 old, unused full-size videos from public\videos.
REM The website uses the small re-encoded copies (page-1.mp4, ugc-sample.mp4, ...) which are NOT touched.
cd /d "%~dp0public\videos" || (echo public\videos folder not found & pause & exit /b 1)
echo Removing unused videos from %CD% ...
if exist "Avtar Portfolio.mp4" (del /q "Avtar Portfolio.mp4" && echo   deleted  Avtar Portfolio.mp4)
if exist "Avtar Sample new.mp4" (del /q "Avtar Sample new.mp4" && echo   deleted  Avtar Sample new.mp4)
if exist "Cartoon Portfolio.mp4" (del /q "Cartoon Portfolio.mp4" && echo   deleted  Cartoon Portfolio.mp4)
if exist "Cartoon Sample.mp4" (del /q "Cartoon Sample.mp4" && echo   deleted  Cartoon Sample.mp4)
if exist "Digital Twin Sample.mp4" (del /q "Digital Twin Sample.mp4" && echo   deleted  Digital Twin Sample.mp4)
if exist "Hyper Realistic Sample.mp4" (del /q "Hyper Realistic Sample.mp4" && echo   deleted  Hyper Realistic Sample.mp4)
if exist "Jwellery Portfolio.mp4" (del /q "Jwellery Portfolio.mp4" && echo   deleted  Jwellery Portfolio.mp4)
if exist "page 1.mp4" (del /q "page 1.mp4" && echo   deleted  page 1.mp4)
if exist "Page 2.mp4" (del /q "Page 2.mp4" && echo   deleted  Page 2.mp4)
if exist "Page 3.mp4" (del /q "Page 3.mp4" && echo   deleted  Page 3.mp4)
if exist "Page 4.mp4" (del /q "Page 4.mp4" && echo   deleted  Page 4.mp4)
if exist "Page 5.mp4" (del /q "Page 5.mp4" && echo   deleted  Page 5.mp4)
if exist "Page 6.mp4" (del /q "Page 6.mp4" && echo   deleted  Page 6.mp4)
if exist "Portflio 6.mp4" (del /q "Portflio 6.mp4" && echo   deleted  Portflio 6.mp4)
if exist "UGC Porfolio.mp4" (del /q "UGC Porfolio.mp4" && echo   deleted  UGC Porfolio.mp4)
if exist "UGC Sample new.mp4" (del /q "UGC Sample new.mp4" && echo   deleted  UGC Sample new.mp4)
echo.
echo Done. The videos the website uses are untouched.
echo You can delete this file (delete-unused-videos.bat) now.
pause
