import React from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faNewspaper, faArrowRight, faClock, faUser } from "@fortawesome/free-solid-svg-icons";
import "../styles/blogPosts.css";

export default function BlogPosts() {
  const posts = [
    {
      id: 1,
      title: "Top 10 Must-Have Products for 2024",
      excerpt: "Discover the trending products that everyone is talking about this year...",
      image: "https://via.placeholder.com/600x400?text=Blog+1",
      author: "Admin",
      date: "Jan 15, 2024",
      readTime: "5 min read"
    },
    {
      id: 2,
      title: "How to Choose the Perfect Gift",
      excerpt: "A comprehensive guide to selecting gifts that your loved ones will cherish...",
      image: "https://via.placeholder.com/600x400?text=Blog+2",
      author: "Admin",
      date: "Jan 10, 2024",
      readTime: "4 min read"
    },
    {
      id: 3,
      title: "Shopping Tips: Save More on Every Purchase",
      excerpt: "Learn insider tricks to maximize your savings and get the best deals...",
      image: "https://via.placeholder.com/600x400?text=Blog+3",
      author: "Admin",
      date: "Jan 5, 2024",
      readTime: "6 min read"
    }
  ];

  return (
    <section className="blog-section">
      <div className="blog-container">
        <div className="blog-header">
          <div className="blog-icon">
            <FontAwesomeIcon icon={faNewspaper} />
          </div>
          <h2 className="blog-title">Latest from Our Blog</h2>
          <p className="blog-subtitle">Tips, guides, and insights to enhance your shopping experience</p>
        </div>

        <div className="blog-grid">
          {posts.map(post => (
            <article key={post.id} className="blog-card">
              <div className="blog-image-container">
                <img src={post.image} alt={post.title} className="blog-image" />
              </div>
              <div className="blog-content">
                <div className="blog-meta">
                  <span className="meta-item">
                    <FontAwesomeIcon icon={faUser} />
                    {post.author}
                  </span>
                  <span className="meta-item">
                    <FontAwesomeIcon icon={faClock} />
                    {post.readTime}
                  </span>
                </div>
                <h3 className="blog-post-title">{post.title}</h3>
                <p className="blog-excerpt">{post.excerpt}</p>
                <Link to={`/blog/${post.id}`} className="read-more">
                  Read More
                  <FontAwesomeIcon icon={faArrowRight} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
