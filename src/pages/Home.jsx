import React, { useState } from "react";
import CategoriesAside from "../components/category";
import ProductsGrid from "../components/Products";
import Header from "../components/Hero";
import CurrencyToggle from "../components/CurrencyToggle";


export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  return (
    <>
    <main>
        <Header/>
    <div  className="main-home-container">
      <div className="categorysection">
      <CategoriesAside
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />
      </div>
      <div className="productsection">
        <ProductsGrid selectedCategory={selectedCategory} />
      </div>
    </div>
    <CurrencyToggle/>
    </main>
    </>
  );
}
