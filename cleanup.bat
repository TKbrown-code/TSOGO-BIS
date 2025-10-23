@echo off
REM TSOGO-BIS Cleanup Script for Production Deployment (Windows)
REM This script removes documentation and temporary files

echo 🧹 Starting cleanup for production deployment...
echo.

REM Create docs\archive directory if it doesn't exist
if not exist "docs\archive" mkdir "docs\archive"

echo 📁 Moving documentation files to docs\archive...
echo.

REM Move documentation files
move /Y ADMIN_PANEL_COMPLETE.md docs\archive\ 2>nul
move /Y ADMIN_SETTINGS_UPDATE.md docs\archive\ 2>nul
move /Y ANALYTICS_PAYMENT_FILTER.md docs\archive\ 2>nul
move /Y CART_FIXES_COMPLETE.md docs\archive\ 2>nul
move /Y CHECKOUTS_TABLE_CLARIFICATION.md docs\archive\ 2>nul
move /Y COMPLETED_WORK_SUMMARY.md docs\archive\ 2>nul
move /Y COMPLETE_ADMIN_SYSTEM.md docs\archive\ 2>nul
move /Y COMPLETE_DASHBOARDS_DOCUMENTATION.md docs\archive\ 2>nul
move /Y COMPREHENSIVE_FIXES_TODO.md docs\archive\ 2>nul
move /Y FINAL_COMPLETION_SUMMARY.md docs\archive\ 2>nul
move /Y FINAL_IMPLEMENTATION_SUMMARY.md docs\archive\ 2>nul
move /Y FIXES_SUMMARY.md docs\archive\ 2>nul
move /Y FULL_ADMIN_PANEL_COMPLETE.md docs\archive\ 2>nul
move /Y IMPLEMENTATION_COMPLETE.md docs\archive\ 2>nul
move /Y LATEST_UPDATES_SUMMARY.md docs\archive\ 2>nul
move /Y OPTION_PRICING_FIX.md docs\archive\ 2>nul
move /Y SITE_SETTINGS_IMPLEMENTATION.md docs\archive\ 2>nul
move /Y UNIVERSAL_DYNAMIC_OPTIONS_COMPLETE.md docs\archive\ 2>nul
move /Y USER_DASHBOARD_DOCUMENTATION.md docs\archive\ 2>nul

echo 🗑️  Deleting temporary files...
echo.

REM Delete temporary files (be careful with these!)
del /F /Q fgdhf 2>nul
del /F /Q "jkl;jh" 2>nul
del /F /Q DBpassword 2>nul

echo ✅ Cleanup complete!
echo.
echo 📋 Summary:
echo   - Documentation files moved to docs\archive\
echo   - Temporary files deleted
echo.
echo 🚀 Next steps:
echo   1. Review .env file and ensure all variables are set
echo   2. Run 'npm run build' to create production build
echo   3. Test with 'npm run preview'
echo   4. Deploy to your hosting platform
echo.
echo ⚠️  Don't forget to:
echo   - Set environment variables on your hosting platform
echo   - Configure custom domain and SSL
echo   - Test all features after deployment
echo.
pause
