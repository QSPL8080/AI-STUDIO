@echo off
REM Quickupp AI Studio - removes files the website no longer uses.
REM Run this BEFORE you commit and push.
cd /d "%~dp0" || exit /b 1
echo Cleaning unused files in %CD% ...
echo.
echo Old code files:
if exist "src\components\site\checkout-modal.tsx" (del /q "src\components\site\checkout-modal.tsx" && echo   deleted  src\components\site\checkout-modal.tsx)
if exist "src\lib\paypal-actions.ts" (del /q "src\lib\paypal-actions.ts" && echo   deleted  src\lib\paypal-actions.ts)
if exist "src\lib\paypal.ts" (del /q "src\lib\paypal.ts" && echo   deleted  src\lib\paypal.ts)
if exist "src\lib\pricing.ts" (del /q "src\lib\pricing.ts" && echo   deleted  src\lib\pricing.ts)
if exist "src\routes\api.receipt.tsx" (del /q "src\routes\api.receipt.tsx" && echo   deleted  src\routes\api.receipt.tsx)
echo.
echo Old / unused videos:
if exist "public\videos\Avtar Portfolio.mp4" (del /q "public\videos\Avtar Portfolio.mp4" && echo   deleted  public\videos\Avtar Portfolio.mp4)
if exist "public\videos\Avtar Sample new.mp4" (del /q "public\videos\Avtar Sample new.mp4" && echo   deleted  public\videos\Avtar Sample new.mp4)
if exist "public\videos\Cartoon Portfolio.mp4" (del /q "public\videos\Cartoon Portfolio.mp4" && echo   deleted  public\videos\Cartoon Portfolio.mp4)
if exist "public\videos\Cartoon Sample.mp4" (del /q "public\videos\Cartoon Sample.mp4" && echo   deleted  public\videos\Cartoon Sample.mp4)
if exist "public\videos\Digital Twin Sample.mp4" (del /q "public\videos\Digital Twin Sample.mp4" && echo   deleted  public\videos\Digital Twin Sample.mp4)
if exist "public\videos\Hyper Realistic Sample.mp4" (del /q "public\videos\Hyper Realistic Sample.mp4" && echo   deleted  public\videos\Hyper Realistic Sample.mp4)
if exist "public\videos\Jwellery Portfolio.mp4" (del /q "public\videos\Jwellery Portfolio.mp4" && echo   deleted  public\videos\Jwellery Portfolio.mp4)
if exist "public\videos\page 1.mp4" (del /q "public\videos\page 1.mp4" && echo   deleted  public\videos\page 1.mp4)
if exist "public\videos\Page 2.mp4" (del /q "public\videos\Page 2.mp4" && echo   deleted  public\videos\Page 2.mp4)
if exist "public\videos\Page 3.mp4" (del /q "public\videos\Page 3.mp4" && echo   deleted  public\videos\Page 3.mp4)
if exist "public\videos\Page 4.mp4" (del /q "public\videos\Page 4.mp4" && echo   deleted  public\videos\Page 4.mp4)
if exist "public\videos\Page 5.mp4" (del /q "public\videos\Page 5.mp4" && echo   deleted  public\videos\Page 5.mp4)
if exist "public\videos\Page 6.mp4" (del /q "public\videos\Page 6.mp4" && echo   deleted  public\videos\Page 6.mp4)
if exist "public\videos\Portflio 6.mp4" (del /q "public\videos\Portflio 6.mp4" && echo   deleted  public\videos\Portflio 6.mp4)
if exist "public\videos\UGC Porfolio.mp4" (del /q "public\videos\UGC Porfolio.mp4" && echo   deleted  public\videos\UGC Porfolio.mp4)
if exist "public\videos\UGC Sample new.mp4" (del /q "public\videos\UGC Sample new.mp4" && echo   deleted  public\videos\UGC Sample new.mp4)
if exist "public\videos\HERO NEW.mp4" (del /q "public\videos\HERO NEW.mp4" && echo   deleted  public\videos\HERO NEW.mp4)
if exist "public\videos\hyper-realistic -sample.mp4" (del /q "public\videos\hyper-realistic -sample.mp4" && echo   deleted  public\videos\hyper-realistic -sample.mp4)
if exist "public\videos\Hero-Showcase.mp4" (del /q "public\videos\Hero-Showcase.mp4" && echo   deleted  public\videos\Hero-Showcase.mp4)
if exist "public\videos\hyper-realistic-sample.mp4" (del /q "public\videos\hyper-realistic-sample.mp4" && echo   deleted  public\videos\hyper-realistic-sample.mp4)
if exist "public\videos\posters\Hero-Showcase.jpg" (del /q "public\videos\posters\Hero-Showcase.jpg" && echo   deleted  public\videos\posters\Hero-Showcase.jpg)
if exist "public\videos\posters\hyper-realistic-sample.jpg" (del /q "public\videos\posters\hyper-realistic-sample.jpg" && echo   deleted  public\videos\posters\hyper-realistic-sample.jpg)
echo.
echo Old background images:
if exist "public\images\bg" (rmdir /s /q "public\images\bg" && echo   deleted  public\images\bg folder)
echo.
echo Done. The files the website uses were not touched.
echo Now commit and push your changes.
pause
(goto) 2>nul & del "%~f0"
