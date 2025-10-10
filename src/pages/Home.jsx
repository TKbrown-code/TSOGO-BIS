import React, { useState } from "react";
import CategoriesAside from "../components/category";
import ProductsGrid from "../components/Products";
import Header from "../components/Hero";
import CurrencyToggle from "../components/CurrencyToggle";
import NewArrivals from "../components/NewArrivals";
import CallToAction from "../components/CallToAction";
import AfterHeroHighlight from "../components/AfterHeroHighlight";
import TaggedProducts from "../components/TaggedProducts";

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  return (
    <>
    <Header/>
    <div className="main-home-container">
      <div className="categorysection">
      <CategoriesAside
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />
      </div>
      <div className="productsection">
        <NewArrivals/>
        <CallToAction/>
        <ProductsGrid selectedCategory={selectedCategory} />
        <TaggedProducts/>
        <AfterHeroHighlight/>
      </div>
    </div>
    <CurrencyToggle/>
    </>
  );
}
