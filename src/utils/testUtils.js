// Test utilities and mock data
export const mockProducts = [
  {
    id: 1,
    name: "Test Product 1",
    description: "A test product description",
    price: 29.99,
    new_price: 24.99,
    category_id: 1,
    created_at: "2024-01-01T00:00:00Z",
    product_images: [
      {
        image_path: "/test-image-1.jpg",
        is_primary: true
      }
    ],
    product_tags: [
      {
        tag: "featured"
      }
    ],
    avg_rating: 4.5
  },
  {
    id: 2,
    name: "Test Product 2",
    description: "Another test product description",
    price: 39.99,
    category_id: 2,
    created_at: "2024-01-02T00:00:00Z",
    product_images: [
      {
        image_path: "/test-image-2.jpg",
        is_primary: true
      }
    ],
    product_tags: [
      {
        tag: "featured"
      }
    ],
    avg_rating: 4.2
  }
];

export const mockCategories = [
  {
    id: 1,
    name: "Electronics",
    parent_id: null
  },
  {
    id: 2,
    name: "Clothing",
    parent_id: null
  },
  {
    id: 3,
    name: "Smartphones",
    parent_id: 1
  }
];

export const mockUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User"
  }
};

export const mockCartItems = [
  {
    product_id: mockProducts[0],
    quantity: 2
  },
  {
    product_id: mockProducts[1],
    quantity: 1
  }
];

// Note: Jest testing utilities have been removed as this is a client-side application
// For testing, use a proper testing framework setup

// Test data generators
export const generateTestProduct = (overrides = {}) => ({
  id: Math.floor(Math.random() * 1000),
  name: `Test Product ${Math.random().toString(36).substr(2, 5)}`,
  description: "Test product description",
  price: Math.floor(Math.random() * 100) + 10,
  category_id: 1,
  created_at: new Date().toISOString(),
  product_images: [
    {
      image_path: "/test-image.jpg",
      is_primary: true
    }
  ],
  product_tags: [
    {
      tag: "featured"
    }
  ],
  avg_rating: Math.random() * 5,
  ...overrides
});

export const generateTestUser = (overrides = {}) => ({
  id: `user-${Math.random().toString(36).substr(2, 9)}`,
  email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
  user_metadata: {
    full_name: `Test User ${Math.random().toString(36).substr(2, 5)}`
  },
  ...overrides
});

// Performance testing utilities
export const measurePerformance = async (callback, iterations = 1000) => {
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await callback();
  }
  
  const endTime = performance.now();
  const averageTime = (endTime - startTime) / iterations;
  
  return {
    totalTime: endTime - startTime,
    averageTime,
    iterations
  };
};

// Accessibility testing utilities
export const checkAccessibility = async (container) => {
  const issues = [];
  
  // Check for missing alt attributes
  const imagesWithoutAlt = container.querySelectorAll('img:not([alt])');
  if (imagesWithoutAlt.length > 0) {
    issues.push(`Found ${imagesWithoutAlt.length} images without alt attributes`);
  }
  
  // Check for missing form labels
  const inputsWithoutLabels = container.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
  if (inputsWithoutLabels.length > 0) {
    issues.push(`Found ${inputsWithoutLabels.length} inputs without proper labels`);
  }
  
  // Check for sufficient color contrast (basic check)
  // Note: This would normally use a proper contrast checking library
  // const lowContrastElements = container.querySelectorAll('*');
  
  return issues;
};
