import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImages, faTimes } from "@fortawesome/free-solid-svg-icons";
import { preloadAllImages, getCachedImage } from "../../utils/imageCache";
import "../../styles/imageGallery.css";

export default function ImageGallery() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGalleryImages = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select(`
            id,
            name,
            product_images!inner(image_url, is_primary)
          `)
          .limit(6);

        if (error) throw error;

        // Get all images (not just primary)
        const allImages = [];
        data.forEach(product => {
          product.product_images.forEach(img => {
            allImages.push({
              id: `${product.id}-${img.image_url}`,
              url: img.image_url,
              title: product.name
            });
          });
        });

        // Take first 6 unique images
        const uniqueImages = allImages.slice(0, 6);

        // Preload images
        await preloadAllImages(data);
        const mappedImages = uniqueImages.map(img => ({
          ...img,
          url: getCachedImage(img.url)
        }));

        setImages(mappedImages);
      } catch (err) {
        console.error("Error fetching gallery images:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGalleryImages();
  }, []);

  if (loading || !images.length) return null;

  return (
    <section className="gallery-section">
      <div className="gallery-container">
        <div className="gallery-header">
          <div className="gallery-icon">
            <FontAwesomeIcon icon={faImages} />
          </div>
          <h2 className="gallery-title">Product Gallery</h2>
          <p className="gallery-subtitle">Explore our products in action</p>
        </div>

        <div className="gallery-grid">
          {images.map(image => (
            <div key={image.id} className="gallery-item" onClick={() => setSelectedImage(image)}>
              <img src={image.url} alt={image.title} className="gallery-image" />
              <div className="gallery-overlay">
                <span className="view-text">View Image</span>
              </div>
            </div>
          ))}
        </div>

        {selectedImage && (
          <div className="lightbox" onClick={() => setSelectedImage(null)}>
            <button className="lightbox-close" onClick={() => setSelectedImage(null)}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <img src={selectedImage.url} alt={selectedImage.title} className="lightbox-image" />
          </div>
        )}
      </div>
    </section>
  );
}
