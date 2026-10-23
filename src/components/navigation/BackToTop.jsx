import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import './BackToTop.css';

const BackToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Show button when page is scrolled down
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  // Scroll to top smoothly
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <>
      {isVisible && (
        <button
          type="button"
          className="back-to-top-button"
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp size={20} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </>
  );
};

export default BackToTop;
