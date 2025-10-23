#!/bin/bash

# TSOGO-BIS Cleanup Script for Production Deployment
# This script removes documentation and temporary files

echo "🧹 Starting cleanup for production deployment..."

# Create docs/archive directory if it doesn't exist
mkdir -p docs/archive

echo "📁 Moving documentation files to docs/archive..."

# Move documentation files
mv ADMIN_PANEL_COMPLETE.md docs/archive/ 2>/dev/null
mv ADMIN_SETTINGS_UPDATE.md docs/archive/ 2>/dev/null
mv ANALYTICS_PAYMENT_FILTER.md docs/archive/ 2>/dev/null
mv CART_FIXES_COMPLETE.md docs/archive/ 2>/dev/null
mv CHECKOUTS_TABLE_CLARIFICATION.md docs/archive/ 2>/dev/null
mv COMPLETED_WORK_SUMMARY.md docs/archive/ 2>/dev/null
mv COMPLETE_ADMIN_SYSTEM.md docs/archive/ 2>/dev/null
mv COMPLETE_DASHBOARDS_DOCUMENTATION.md docs/archive/ 2>/dev/null
mv COMPREHENSIVE_FIXES_TODO.md docs/archive/ 2>/dev/null
mv FINAL_COMPLETION_SUMMARY.md docs/archive/ 2>/dev/null
mv FINAL_IMPLEMENTATION_SUMMARY.md docs/archive/ 2>/dev/null
mv FIXES_SUMMARY.md docs/archive/ 2>/dev/null
mv FULL_ADMIN_PANEL_COMPLETE.md docs/archive/ 2>/dev/null
mv IMPLEMENTATION_COMPLETE.md docs/archive/ 2>/dev/null
mv LATEST_UPDATES_SUMMARY.md docs/archive/ 2>/dev/null
mv OPTION_PRICING_FIX.md docs/archive/ 2>/dev/null
mv SITE_SETTINGS_IMPLEMENTATION.md docs/archive/ 2>/dev/null
mv UNIVERSAL_DYNAMIC_OPTIONS_COMPLETE.md docs/archive/ 2>/dev/null
mv USER_DASHBOARD_DOCUMENTATION.md docs/archive/ 2>/dev/null

echo "🗑️  Deleting temporary files..."

# Delete temporary files (be careful with these!)
rm -f fgdhf 2>/dev/null
rm -f jkl\;jh 2>/dev/null
rm -f DBpassword 2>/dev/null

echo "✅ Cleanup complete!"
echo ""
echo "📋 Summary:"
echo "  - Documentation files moved to docs/archive/"
echo "  - Temporary files deleted"
echo ""
echo "🚀 Next steps:"
echo "  1. Review .env file and ensure all variables are set"
echo "  2. Run 'npm run build' to create production build"
echo "  3. Test with 'npm run preview'"
echo "  4. Deploy to your hosting platform"
echo ""
echo "⚠️  Don't forget to:"
echo "  - Set environment variables on your hosting platform"
echo "  - Configure custom domain and SSL"
echo "  - Test all features after deployment"
