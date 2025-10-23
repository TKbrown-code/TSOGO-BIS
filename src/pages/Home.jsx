import React, { useState } from "react";
import CategoriesAside from "../components/category";
import ProductsGrid from "../components/Products";
import Header from "../components/Hero";
import CurrencyToggle from "../components/CurrencyToggle";
import NewArrivals from "../components/NewArrivals";
import CallToAction from "../components/CallToAction";
import AfterHeroHighlight from "../components/AfterHeroHighlight";
import TaggedProducts from "../components/TaggedProducts";
import Testimonials from "../components/Testimonials";
import BestSellers from "../components/BestSellers";
import DealsDiscounts from "../components/DealsDiscounts";
import HowItWorks from "../components/HowItWorks";
import Newsletter from "../components/Newsletter";
import FAQ from "../components/FAQ";
import ImageGallery from "../components/ImageGallery";
import ProductQuiz from "../components/ProductQuiz";

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  return (
    <>
    <Header/>
    <div  className="main-home-container">
      <div className="categorysection">
      <CategoriesAside
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />
      </div>
      <div className="productsection">
        <NewArrivals/>
        <DealsDiscounts/>
        <BestSellers/>
        <CallToAction/>
        <ProductsGrid selectedCategory={selectedCategory} />
        <TaggedProducts/>
        <HowItWorks/>
        <ImageGallery/>
        <Testimonials />
        <ProductQuiz/>
        <FAQ/>
        <Newsletter/>
        <AfterHeroHighlight/>
      </div>
    </div>
    <CurrencyToggle/>
    </>
  );
}
