import React from "react";
import { Link } from "react-router-dom";
// 'div' was imported from "framer-motion/client" but not used.

export default function Hero() {
  return (
    <>
    <section className="hero">
      <h1>Discover Amazing Products On TSOGO-BIS</h1>
      <p>Shop from thousands of products with fast delivery and secure payment. Your one-stop destinaeion for quality shopping.</p>
      <Link to="/shop"><button>Shop Now</button></Link>
    </section>
    </>
  );
}
