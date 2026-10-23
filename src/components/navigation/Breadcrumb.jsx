import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Breadcrumb({ 
  productName, 
  categoryName,
  currentPage 
}) {
  const location = useLocation();
  const { t } = useTranslation();
  
  const pathnames = location.pathname.split('/').filter(x => x);
  
  // Generate breadcrumb items based on current route
  const getBreadcrumbItems = () => {
    const items = [
      { name: t('home') || 'Home', path: '/' }
    ];

    // Add dynamic breadcrumbs based on current route
    if (pathnames.includes('shop')) {
      items.push({ name: t('shop') || 'Shop', path: '/shop' });
    }
    
    if (pathnames.includes('ProductDetails')) {
      if (categoryName) {
        items.push({ 
          name: categoryName, 
          path: `/shop?category=${encodeURIComponent(categoryName)}` 
        });
      }
      if (productName) {
        items.push({ name: productName, path: '', isCurrent: true });
      }
    }
    
    if (pathnames.includes('checkout')) {
      items.push({ name: t('checkout') || 'Checkout', path: '', isCurrent: true });
    }
    
    if (pathnames.includes('dashboard')) {
      items.push({ name: t('dashboard') || 'Dashboard', path: '', isCurrent: true });
    }
    
    if (pathnames.includes('orders')) {
      items.push({ name: t('orders') || 'Orders', path: '', isCurrent: true });
    }
    
    if (pathnames.includes('admin')) {
      items.push({ name: t('admin') || 'Admin', path: '', isCurrent: true });
    }

    // Add custom current page if provided
    if (currentPage && !items.some(item => item.isCurrent)) {
      items.push({ name: currentPage, path: '', isCurrent: true });
    }

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  if (breadcrumbItems.length <= 1) {
    return null; // Don't show breadcrumb if only home exists
  }

  return (
    <nav 
      className="breadcrumb" 
      aria-label="Breadcrumb"
      role="navigation"
    >
      <ol className="breadcrumb-list">
        {breadcrumbItems.map((item, index) => (
          <li 
            key={index} 
            className={`breadcrumb-item ${item.isCurrent ? 'current' : ''}`}
          >
            {item.isCurrent ? (
              <span 
                className="breadcrumb-link current"
                aria-current="page"
              >
                {item.name}
              </span>
            ) : (
              <Link 
                to={item.path} 
                className="breadcrumb-link"
                aria-label={`Go to ${item.name}`}
              >
                {item.name}
              </Link>
            )}
            
            {index < breadcrumbItems.length - 1 && (
              <span 
                className="breadcrumb-separator" 
                aria-hidden="true"
              >
                ›
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
